import type { ObjectLists, SupportedLocale } from "@megacrow/megalo";
import { getQuotedPathCompletionQuery, setLocale } from "@megacrow/megalo";
import type { Connection } from "vscode-languageserver";
import type {
  DidChangeTextDocumentParams,
  InitializeParams,
  InitializeResult,
} from "vscode-languageserver-protocol";
import { TextDocumentSyncKind } from "vscode-languageserver-protocol";
import { TextDocument } from "vscode-languageserver-textdocument";
import { requestArtifactsFromSnapshot } from "./artifacts";
import { createCoalescer, createPromiseCoalescer } from "./coalesce";
import {
  completionsFromSnapshot,
  hoverFromSnapshot,
  pathCompletionsFromEntries,
} from "./completions";
import { definitionFromSnapshot } from "./definition";
import { analyzeObjectListFor, versionConfigurationFor } from "./diagnostics";
import { DocumentStore } from "./documentStore";
import {
  MEGACROW_ANALYZE_OBJECT_LIST_METHOD,
  MEGACROW_LIST_DIRECTORY_METHOD,
  MEGACROW_REQUEST_ARTIFACTS_METHOD,
  MEGACROW_RESET_SESSION_METHOD,
  MEGACROW_SET_COMPILER_SETTINGS_METHOD,
  MEGACROW_SET_LOCALE_METHOD,
  MEGACROW_SET_MEGACROW_EXTENSIONS_METHOD,
  MEGACROW_SET_MEGALO_VERSION_METHOD,
  MEGACROW_SET_OBJECT_LISTS_METHOD,
  MEGACROW_SET_RESOLVE_BASE_FILE_METHOD,
  MEGACROW_VERSION_CONFIGURATION_METHOD,
  type MegacrowAnalyzeObjectListParams,
  type MegacrowAnalyzeObjectListResult,
  type MegacrowListDirectoryParams,
  type MegacrowListDirectoryResult,
  type MegacrowRequestArtifactsParams,
  type MegacrowRequestArtifactsResult,
  type MegacrowSetCompilerSettingsParams,
  type MegacrowSetLocaleParams,
  type MegacrowSetMegacrowExtensionsParams,
  type MegacrowSetMegaloVersionParams,
  type MegacrowSetObjectListsParams,
  type MegacrowSetResolveBaseFileParams,
  type MegacrowVersionConfigurationResult,
  SEMANTIC_TOKENS_LEGEND,
} from "./protocol";
import { createResolvers } from "./resolvers";
import { MegacrowSession } from "./sessionSettings";
import { SnapshotCache } from "./snapshotCache";

export const startMegacrowLanguageServer = (connection: Connection): void => {
  const session = new MegacrowSession();
  const documents = new DocumentStore();
  const snapshotCache = new SnapshotCache();

  let workspaceObjectLists: ObjectLists | undefined;
  let resolveBaseFileEnabled = true;
  let sessionEpoch = 0;

  const staleArtifactsResult = (
    version: number
  ): MegacrowRequestArtifactsResult => ({
    version,
    ok: false,
    error: "superseded",
    diagnostics: [],
  });

  const resolverOptions = () => ({
    objectLists: workspaceObjectLists,
    resolvers: createResolvers(connection, resolveBaseFileEnabled),
  });

  const publishCoalescer = createCoalescer<{
    uri: string;
    text: string;
    version: number;
  }>(async (job) => {
    const epoch = sessionEpoch;
    const entry = await snapshotCache.refresh(
      job.uri,
      job.text,
      job.version,
      session,
      resolverOptions()
    );
    if (epoch !== sessionEpoch) {
      return;
    }
    const doc = documents.get(job.uri);
    if (!doc || doc.version !== job.version) {
      return;
    }
    const artifacts = await requestArtifactsFromSnapshot(
      entry.snapshot,
      session,
      {
        artifacts: ["diagnostics"],
        documentVersion: job.version,
        fromUri: job.uri,
        objectLists: workspaceObjectLists,
        resolvers: createResolvers(connection, resolveBaseFileEnabled),
      }
    );
    if (epoch !== sessionEpoch) {
      return;
    }
    const latest = documents.get(job.uri);
    if (!latest || latest.version !== job.version) {
      return;
    }
    connection.sendDiagnostics({
      uri: job.uri,
      diagnostics: artifacts.diagnostics ?? [],
    });
  });

  const invalidateAndRepublishAll = (): void => {
    snapshotCache.clear();
    for (const [uri, doc] of documents.entries()) {
      publishCoalescer.schedule({
        uri,
        text: doc.getText(),
        version: doc.version,
      });
    }
  };

  const runRequestArtifacts = async (
    params: MegacrowRequestArtifactsParams
  ): Promise<MegacrowRequestArtifactsResult> => {
    const uri = params.textDocument.uri;
    const existing = documents.get(uri);
    const text = params.text ?? existing?.getText() ?? "";
    const version =
      params.text !== undefined && params.text !== existing?.getText()
        ? (existing?.version ?? 0) + 1
        : (existing?.version ?? 0);

    if (params.text !== undefined) {
      const doc = TextDocument.create(
        uri,
        existing?.languageId ?? "megalo",
        version,
        text
      );
      documents.set(uri, doc);
    }

    const doc = documents.get(uri);
    const entry = doc
      ? await snapshotCache.getOrRefresh(uri, doc, session, resolverOptions())
      : await snapshotCache.refresh(
          uri,
          text,
          version,
          session,
          resolverOptions()
        );

    const artifacts = await requestArtifactsFromSnapshot(
      entry.snapshot,
      session,
      {
        artifacts: params.artifacts,
        documentVersion: entry.version,
        fromUri: uri,
        objectLists: params.objectLists ?? workspaceObjectLists,
        resolvers: createResolvers(connection, resolveBaseFileEnabled),
      }
    );

    if (
      params.artifacts.includes("semanticTokens") &&
      artifacts.semanticTokens
    ) {
      entry.semanticTokens = artifacts.semanticTokens;
      snapshotCache.set(uri, entry);
    }

    if (artifacts.diagnostics) {
      const latest = documents.get(uri);
      if (latest && latest.version === entry.version) {
        connection.sendDiagnostics({
          uri,
          diagnostics: artifacts.diagnostics,
        });
      }
    }

    return artifacts;
  };

  const artifactsCoalescer = createPromiseCoalescer<
    MegacrowRequestArtifactsParams,
    MegacrowRequestArtifactsResult
  >(runRequestArtifacts, {
    onSuperseded: (previous) => {
      previous.resolve(
        staleArtifactsResult(
          documents.get(
            (previous.job as MegacrowRequestArtifactsParams).textDocument.uri
          )?.version ?? 0
        )
      );
    },
    captureEpoch: () => sessionEpoch,
    isEpochStale: (epoch) => epoch !== sessionEpoch,
    staleResult: () => staleArtifactsResult(0),
  });

  const resetSession = (): void => {
    sessionEpoch += 1;
    publishCoalescer.clearPending();
    artifactsCoalescer.clearPending(staleArtifactsResult(0));
    snapshotCache.clear();
    documents.clearAllDiagnostics(connection);
  };

  connection.onInitialize(
    (_params: InitializeParams): InitializeResult => ({
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Full,
        hoverProvider: true,
        definitionProvider: true,
        completionProvider: {
          triggerCharacters: [" ", ".", "_", '"', "/"],
          resolveProvider: false,
        },
        semanticTokensProvider: {
          legend: SEMANTIC_TOKENS_LEGEND,
          full: true,
          range: false,
        },
      },
      serverInfo: {
        name: "megacrow-lsp",
        version: "0.1.0",
      },
    })
  );

  connection.onDidOpenTextDocument((params) => {
    const { uri, languageId, version, text } = params.textDocument;
    const doc = TextDocument.create(uri, languageId, version, text);
    documents.set(uri, doc);
    publishCoalescer.schedule({ uri, text, version });
  });

  connection.onDidChangeTextDocument((params: DidChangeTextDocumentParams) => {
    const uri = params.textDocument.uri;
    const existing = documents.get(uri);
    const change = params.contentChanges.at(-1);
    if (!(change && "text" in change) || typeof change.text !== "string") {
      return;
    }
    const version = params.textDocument.version;
    const doc = TextDocument.create(
      uri,
      existing?.languageId ?? "megalo",
      version,
      change.text
    );
    documents.set(uri, doc);
    publishCoalescer.schedule({ uri, text: change.text, version });
  });

  connection.onDidCloseTextDocument((params) => {
    const uri = params.textDocument.uri;
    snapshotCache.delete(uri);
    documents.clearDiagnostics(connection, uri);
  });

  connection.onNotification(MEGACROW_RESET_SESSION_METHOD, () => {
    resetSession();
  });

  connection.languages.semanticTokens.on(async (params) => {
    const uri = params.textDocument.uri;
    const doc = documents.get(uri);
    if (!doc) {
      return { data: [] };
    }
    const entry = await snapshotCache.getOrRefresh(
      uri,
      doc,
      session,
      resolverOptions()
    );
    return { data: entry.semanticTokens };
  });

  connection.onDefinition(async (params) => {
    const uri = params.textDocument.uri;
    const doc = documents.get(uri);
    if (!doc) {
      return null;
    }
    const entry = await snapshotCache.getOrRefresh(
      uri,
      doc,
      session,
      resolverOptions()
    );
    return definitionFromSnapshot(entry.snapshot, uri, params.position);
  });

  connection.onHover(async (params) => {
    if (!session.megacrowExtensions.reservedKeywords) {
      return null;
    }
    const uri = params.textDocument.uri;
    const doc = documents.get(uri);
    if (!doc) {
      return null;
    }
    const entry = await snapshotCache.getOrRefresh(
      uri,
      doc,
      session,
      resolverOptions()
    );
    const hover = hoverFromSnapshot(entry.snapshot, params.position);
    if (!hover) {
      return null;
    }
    return {
      contents: {
        kind: "markdown",
        value: hover.contents.value,
      },
      range: hover.range,
    };
  });

  connection.onCompletion(async (params) => {
    if (!session.megacrowExtensions.reservedKeywords) {
      return [];
    }
    const uri = params.textDocument.uri;
    const doc = documents.get(uri);
    if (!doc) {
      return [];
    }
    const entry = await snapshotCache.getOrRefresh(
      uri,
      doc,
      session,
      resolverOptions()
    );
    const pathQuery = getQuotedPathCompletionQuery(
      entry.snapshot,
      params.position
    );
    if (pathQuery) {
      try {
        const listed = (await connection.sendRequest(
          MEGACROW_LIST_DIRECTORY_METHOD,
          {
            directory: pathQuery.directory,
            fromUri: uri,
          } satisfies MegacrowListDirectoryParams
        )) as MegacrowListDirectoryResult;
        if (!("error" in listed)) {
          return pathCompletionsFromEntries(pathQuery, listed.entries);
        }
      } catch (error) {
        console.warn("[megacrow-lsp] listDirectory failed", error);
      }
      return [];
    }
    return completionsFromSnapshot(entry.snapshot, params.position);
  });

  connection.onRequest(
    MEGACROW_REQUEST_ARTIFACTS_METHOD,
    (params: MegacrowRequestArtifactsParams) =>
      artifactsCoalescer.enqueue(params)
  );

  connection.onRequest(
    MEGACROW_VERSION_CONFIGURATION_METHOD,
    (): MegacrowVersionConfigurationResult =>
      versionConfigurationFor(session.megaloVersion)
  );

  connection.onRequest(
    MEGACROW_ANALYZE_OBJECT_LIST_METHOD,
    (
      params: MegacrowAnalyzeObjectListParams
    ): MegacrowAnalyzeObjectListResult =>
      analyzeObjectListFor(params.text, session.megaloVersion)
  );

  connection.onNotification(
    MEGACROW_SET_OBJECT_LISTS_METHOD,
    (params: MegacrowSetObjectListsParams) => {
      workspaceObjectLists = params.objectLists ?? undefined;
      invalidateAndRepublishAll();
    }
  );

  connection.onNotification(
    MEGACROW_SET_RESOLVE_BASE_FILE_METHOD,
    (params: MegacrowSetResolveBaseFileParams) => {
      const next = params.enabled;
      if (resolveBaseFileEnabled === next) {
        return;
      }
      resolveBaseFileEnabled = next;
      invalidateAndRepublishAll();
    }
  );

  connection.onNotification(
    MEGACROW_SET_LOCALE_METHOD,
    (params: MegacrowSetLocaleParams) => {
      const next = (params.locale === "ja" ? "ja" : "en") as SupportedLocale;
      setLocale(next);
      invalidateAndRepublishAll();
    }
  );

  connection.onNotification(
    MEGACROW_SET_MEGACROW_EXTENSIONS_METHOD,
    (params: MegacrowSetMegacrowExtensionsParams) => {
      session.setMegacrowExtensions(params.megacrowExtensions);
      invalidateAndRepublishAll();
    }
  );

  connection.onNotification(
    MEGACROW_SET_COMPILER_SETTINGS_METHOD,
    (params: MegacrowSetCompilerSettingsParams) => {
      session.setCompilerSettings(params.compilerSettings);
      invalidateAndRepublishAll();
    }
  );

  connection.onNotification(
    MEGACROW_SET_MEGALO_VERSION_METHOD,
    (params: MegacrowSetMegaloVersionParams) => {
      if (!session.setMegaloVersion(params.megaloVersion)) {
        console.warn(
          `[megacrow-lsp] ignored unknown megaloVersion: ${params.megaloVersion}`
        );
        return;
      }
      invalidateAndRepublishAll();
    }
  );

  connection.listen();
};

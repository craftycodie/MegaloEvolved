import { _event_error, _event_warning, event } from "@blamnetwork/datamine";
import type { ObjectLists } from "@megacrow/megalo";
import {
  getQuotedPathCompletionQuery,
  isMegaloVersionId,
  MEGALO_VERSIONS,
  setLocale,
} from "@megacrow/megalo";
import type { Connection } from "vscode-languageserver";
import type {
  DidChangeConfigurationParams,
  DidChangeTextDocumentParams,
  InitializeParams,
  InitializeResult,
} from "vscode-languageserver-protocol";
import { TextDocumentSyncKind } from "vscode-languageserver-protocol";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  analyzeDocumentSnapshot,
  requestArtifactsFromSnapshot,
} from "./artifacts";
import { createCoalescer, createPromiseCoalescer } from "./coalesce";
import {
  completionsFromSnapshot,
  hoverFromSnapshot,
  pathCompletionsFromEntries,
} from "./completions";
import { DEFAULT_MEGACROW_CONFIG, parseConfig, sameConfig } from "./config";
import { definitionFromSnapshot } from "./definition";
import { analyzeObjectListFor, versionConfigurationFor } from "./diagnostics";
import { DocumentStore } from "./documentStore";
import {
  MEGACROW_ANALYZE_OBJECT_LIST_METHOD,
  MEGACROW_CONFIGURATION_SECTION,
  MEGACROW_LIST_DIRECTORY_METHOD,
  MEGACROW_REQUEST_ARTIFACTS_METHOD,
  MEGACROW_RESET_SESSION_METHOD,
  MEGACROW_VERSION_CONFIGURATION_METHOD,
  type MegacrowAnalyzeObjectListParams,
  type MegacrowAnalyzeObjectListResult,
  type MegacrowConfig,
  type MegacrowInitializationOptions,
  type MegacrowListDirectoryParams,
  type MegacrowListDirectoryResult,
  type MegacrowRequestArtifactsParams,
  type MegacrowRequestArtifactsResult,
  type MegacrowVersionConfigurationParams,
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

  let config: MegacrowConfig = DEFAULT_MEGACROW_CONFIG;
  let workspaceObjectLists: ObjectLists | undefined;
  let resolveBaseFileEnabled = true;
  let sessionEpoch = 0;

  /**
   * Validate and apply a whole configuration. Returns true only when it
   * differs from the current one (callers then re-analyze open documents).
   */
  const applyConfig = (raw: unknown, source: string): boolean => {
    const parsed = parseConfig(raw);
    if (!parsed.ok) {
      event(
        _event_error,
        "lsp: ignored invalid configuration from %s: %s",
        source,
        parsed.error
      );
      return false;
    }
    const next = parsed.config;
    if (sameConfig(next, config)) {
      return false;
    }
    config = next;
    session.setMegacrowExtensions(next.megacrowExtensions);
    session.setCompilerSettings(next.compilerSettings);
    session.gameBuildNumber = next.gameBuildNumber ?? undefined;
    session.setMegaloVersion(next.megaloVersion);
    workspaceObjectLists = next.objectLists ?? undefined;
    resolveBaseFileEnabled = next.resolveBaseFile;
    setLocale(next.locale);
    return true;
  };

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
  }>(
    (job) => job.uri,
    async (job) => {
      const entry = await snapshotCache.refresh(
        job.uri,
        job.text,
        job.version,
        session,
        resolverOptions()
      );
      // Settings changed or the session was reset while analyzing: a fresh
      // publish for this document is already queued.
      if (entry.epoch !== snapshotCache.epoch) {
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
          reuse: entry,
        }
      );
      if (entry.epoch !== snapshotCache.epoch) {
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
    }
  );

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

    const resolvers = createResolvers(connection, resolveBaseFileEnabled);

    // Object lists passed with the request (not the workspace lists the
    // snapshot cache uses): parse and compile against those lists, uncached.
    if (
      params.objectLists !== undefined &&
      params.objectLists !== workspaceObjectLists
    ) {
      const snapshot = await analyzeDocumentSnapshot(text, session, {
        version: session.megaloVersion,
        objectLists: params.objectLists,
        fromUri: uri,
        resolvers,
      });
      return requestArtifactsFromSnapshot(snapshot, session, {
        artifacts: params.artifacts,
        documentVersion: version,
        fromUri: uri,
        objectLists: params.objectLists,
        resolvers,
      });
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
        objectLists: workspaceObjectLists,
        resolvers,
        reuse: entry,
      }
    );

    if (artifacts.diagnostics && entry.epoch === snapshotCache.epoch) {
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

  connection.onInitialize((params: InitializeParams): InitializeResult => {
    const options = params.initializationOptions as
      | MegacrowInitializationOptions
      | undefined;
    if (options?.config !== undefined) {
      // No documents are open yet, so there is nothing to republish.
      applyConfig(options.config, "initializationOptions");
    }
    return {
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
    };
  });

  connection.onDidChangeConfiguration(
    (params: DidChangeConfigurationParams) => {
      const settings = params.settings as Record<string, unknown> | null;
      const raw = settings?.[MEGACROW_CONFIGURATION_SECTION];
      if (raw === undefined) {
        return;
      }
      if (applyConfig(raw, "workspace/didChangeConfiguration")) {
        invalidateAndRepublishAll();
      }
    }
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
        event(_event_warning, "lsp: listDirectory failed: %s", String(error));
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
    (
      params?: MegacrowVersionConfigurationParams
    ): MegacrowVersionConfigurationResult => {
      const requested = params?.megaloVersion;
      return versionConfigurationFor(
        requested && isMegaloVersionId(requested)
          ? MEGALO_VERSIONS[requested]
          : session.megaloVersion
      );
    }
  );

  connection.onRequest(
    MEGACROW_ANALYZE_OBJECT_LIST_METHOD,
    (
      params: MegacrowAnalyzeObjectListParams
    ): MegacrowAnalyzeObjectListResult =>
      analyzeObjectListFor(params.text, session.megaloVersion)
  );

  connection.listen();
};

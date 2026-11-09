import {
  MEGACROW_LIST_DIRECTORY_METHOD,
  MEGACROW_RESET_SESSION_METHOD,
  MEGACROW_RESOLVE_BASE_FILE_METHOD,
  MEGACROW_RESOLVE_INCLUDE_METHOD,
  type MegacrowInitializationOptions,
} from "@megacrow/lsp/protocol";
import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createMessageConnection,
  type MessageConnection,
} from "vscode-jsonrpc/browser";
import type {
  Diagnostic,
  InitializeParams,
  PublishDiagnosticsParams,
} from "vscode-languageserver-protocol";
import type { Workspace } from "../workspace/workspace";
import {
  handleListDirectory,
  handleResolveBaseFile,
  handleResolveInclude,
  type ListDirectoryParams,
  type ResolveBaseFileParams,
  type ResolveIncludeParams,
} from "./resolvers";
import {
  bumpDocumentVersion,
  DEFAULT_DOC_URI,
  getActiveFilePath,
  getDocumentUri,
  getLastSyncedText,
  getLspConfig,
  isDocumentOpen,
  isPlaceholderDocumentUri,
  pathToDocumentUri,
  resetDocumentState,
  setActiveFilePath,
  setConfiguredWorkspace,
  setDocumentOpen,
  setDocumentUri,
  setLastSyncedText,
} from "./state";

export { DEFAULT_DOC_URI, isPlaceholderDocumentUri, pathToDocumentUri };

type DiagnosticsListener = (diagnostics: Diagnostic[]) => void;

let connectionPromise: Promise<MessageConnection> | null = null;
const diagnosticsListeners = new Set<DiagnosticsListener>();

export function preloadLspConnection(): void {
  void getConnection();
}

export async function getConnection(): Promise<MessageConnection> {
  if (!connectionPromise) {
    connectionPromise = (async () => {
      const worker = new Worker(
        new URL("../workers/megaloLspWorker.ts", import.meta.url),
        { type: "module" }
      );
      const reader = new BrowserMessageReader(worker);
      const writer = new BrowserMessageWriter(worker);
      const connection = createMessageConnection(reader, writer);
      connection.listen();

      connection.onNotification(
        "textDocument/publishDiagnostics",
        (params: PublishDiagnosticsParams) => {
          if (params.uri !== getDocumentUri()) {
            return;
          }
          for (const listener of diagnosticsListeners) {
            listener(params.diagnostics);
          }
        }
      );

      connection.onRequest(
        MEGACROW_RESOLVE_INCLUDE_METHOD,
        (params: ResolveIncludeParams) => handleResolveInclude(params)
      );
      connection.onRequest(
        MEGACROW_RESOLVE_BASE_FILE_METHOD,
        (params: ResolveBaseFileParams) => handleResolveBaseFile(params)
      );
      connection.onRequest(
        MEGACROW_LIST_DIRECTORY_METHOD,
        (params: ListDirectoryParams) => handleListDirectory(params)
      );

      const initParams: InitializeParams = {
        processId: null,
        rootUri: null,
        capabilities: {
          textDocument: {
            semanticTokens: {
              requests: { full: true },
              tokenTypes: [],
              tokenModifiers: [],
              formats: ["relative"],
              overlappingTokenSupport: false,
              multilineTokenSupport: false,
            },
          },
        },
        workspaceFolders: null,
        initializationOptions: {
          config: getLspConfig(),
        } satisfies MegacrowInitializationOptions,
      };
      await connection.sendRequest("initialize", initParams);
      connection.sendNotification("initialized", {});
      return connection;
    })();
  }
  return connectionPromise;
}

export function subscribeLspDiagnostics(
  listener: DiagnosticsListener
): () => void {
  diagnosticsListeners.add(listener);
  return () => {
    diagnosticsListeners.delete(listener);
  };
}

export function lspConfigureResolveContext(options: {
  workspace?: Workspace | null;
  filePath?: string | null;
}): void {
  let textToResync: string | null = null;

  if (options.workspace !== undefined) {
    // Used by the resolve handlers; `resolveBaseFile` is part of the server
    // configuration (see `lspUpdateConfig`).
    setConfiguredWorkspace(options.workspace);
  }
  if (options.filePath !== undefined) {
    const nextPath = options.filePath;
    const nextUri = nextPath ? pathToDocumentUri(nextPath) : DEFAULT_DOC_URI;
    if (nextPath !== getActiveFilePath() || nextUri !== getDocumentUri()) {
      const previousUri = getDocumentUri();
      const wasOpen = isDocumentOpen();
      textToResync = getLastSyncedText();
      setActiveFilePath(nextPath);
      setDocumentUri(nextUri);
      setDocumentOpen(false);
      setLastSyncedText(null);
      for (const listener of diagnosticsListeners) {
        listener([]);
      }
      if (wasOpen && previousUri !== nextUri) {
        void getConnection().then((connection) => {
          connection.sendNotification("textDocument/didClose", {
            textDocument: { uri: previousUri },
          });
        });
      }
    }
  }

  if (textToResync !== null) {
    void lspSyncDocument(textToResync);
  }
}

export async function lspResetSession(): Promise<void> {
  const connection = await getConnection();
  const { previousUri, wasOpen } = resetDocumentState();
  for (const listener of diagnosticsListeners) {
    listener([]);
  }
  if (wasOpen) {
    connection.sendNotification("textDocument/didClose", {
      textDocument: { uri: previousUri },
    });
  }
  connection.sendNotification(MEGACROW_RESET_SESSION_METHOD, {});
}

export async function lspSyncDocument(text: string): Promise<void> {
  const connection = await getConnection();
  if (isDocumentOpen() && getLastSyncedText() === text) {
    return;
  }
  const version = bumpDocumentVersion();
  setLastSyncedText(text);
  const uri = getDocumentUri();
  if (!isDocumentOpen()) {
    setDocumentOpen(true);
    connection.sendNotification("textDocument/didOpen", {
      textDocument: {
        uri,
        languageId: "megalo",
        version,
        text,
      },
    });
    return;
  }
  connection.sendNotification("textDocument/didChange", {
    textDocument: {
      uri,
      version,
    },
    contentChanges: [{ text }],
  });
}

export function lspDocumentUri(): string {
  return getDocumentUri();
}

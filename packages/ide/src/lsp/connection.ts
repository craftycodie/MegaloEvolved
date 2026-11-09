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
import {
  handleListDirectory,
  handleResolveBaseFile,
  handleResolveInclude,
  type ListDirectoryParams,
  type ResolveBaseFileParams,
  type ResolveIncludeParams,
} from "./resolvers";
import {
  DEFAULT_DOC_URI,
  getActiveDocumentUri,
  getLspConfig,
  isPlaceholderDocumentUri,
  nextDocumentVersion,
  pathToDocumentUri,
  setActiveFilePath,
  syncedDocuments,
} from "./state";

export {
  DEFAULT_DOC_URI,
  getActiveDocumentUri,
  isPlaceholderDocumentUri,
  pathToDocumentUri,
};

/** Called with each document's diagnostics; `[]` clears them. */
type DiagnosticsListener = (uri: string, diagnostics: Diagnostic[]) => void;

let connectionPromise: Promise<MessageConnection> | null = null;
const diagnosticsListeners = new Set<DiagnosticsListener>();

function emitDiagnostics(uri: string, diagnostics: Diagnostic[]): void {
  for (const listener of diagnosticsListeners) {
    listener(uri, diagnostics);
  }
}

export function preloadLspConnection(): void {
  getConnection().catch(() => {
    // Logged by `dropConnection`; the next request retries.
  });
}

/**
 * Forget a dead connection so the next request starts a fresh worker. The
 * new server knows no documents, so they are re-opened on their next sync.
 */
function dropConnection(reason: unknown): void {
  if (!connectionPromise) {
    return;
  }
  console.error("Megalo LSP connection lost; restarting on next use:", reason);
  connectionPromise = null;
  const openUris = [...syncedDocuments.keys()];
  syncedDocuments.clear();
  for (const uri of openUris) {
    emitDiagnostics(uri, []);
  }
}

async function connect(): Promise<MessageConnection> {
  const worker = new Worker(
    new URL("../workers/megaloLspWorker.ts", import.meta.url),
    { type: "module" }
  );
  const reader = new BrowserMessageReader(worker);
  const writer = new BrowserMessageWriter(worker);
  const connection = createMessageConnection(reader, writer);

  const fail = (reason: unknown) => {
    dropConnection(reason);
    connection.dispose();
    worker.terminate();
  };
  worker.addEventListener("error", fail);
  connection.onClose(() => fail(new Error("connection closed")));
  connection.listen();

  connection.onNotification(
    "textDocument/publishDiagnostics",
    (params: PublishDiagnosticsParams) => {
      emitDiagnostics(params.uri, params.diagnostics);
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
  try {
    await connection.sendRequest("initialize", initParams);
  } catch (error) {
    fail(error);
    throw error;
  }
  connection.sendNotification("initialized", {});
  return connection;
}

export function getConnection(): Promise<MessageConnection> {
  connectionPromise ??= connect();
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

/**
 * Send `text` for `uri` (default: the active document): `didOpen` the first
 * time, `didChange` when the text differs from what the server has.
 */
export async function lspSyncDocument(
  text: string,
  uri: string = getActiveDocumentUri()
): Promise<void> {
  const connection = await getConnection();
  const synced = syncedDocuments.get(uri);
  if (synced?.text === text) {
    return;
  }
  const version = nextDocumentVersion();
  syncedDocuments.set(uri, { text, version });
  if (!synced) {
    connection.sendNotification("textDocument/didOpen", {
      textDocument: { uri, languageId: "megalo", version, text },
    });
    return;
  }
  connection.sendNotification("textDocument/didChange", {
    textDocument: { uri, version },
    contentChanges: [{ text }],
  });
}

/** Tell the server a document is gone, and clear its diagnostics. */
export async function lspCloseDocument(uri: string): Promise<void> {
  if (!syncedDocuments.delete(uri)) {
    return;
  }
  emitDiagnostics(uri, []);
  const connection = await getConnection();
  connection.sendNotification("textDocument/didClose", {
    textDocument: { uri },
  });
}

/**
 * Set the file shown in the editor: relative includes resolve from it, and
 * requests without a URI go to it. Documents stay open on the server until
 * the editor closes them (`lspCloseDocument`).
 */
export function lspSetActiveFile(filePath: string | null): void {
  setActiveFilePath(filePath);
}

export async function lspResetSession(): Promise<void> {
  setActiveFilePath(null);
  const uris = [...syncedDocuments.keys()];
  await Promise.all(uris.map((uri) => lspCloseDocument(uri)));
  const connection = await getConnection();
  connection.sendNotification(MEGACROW_RESET_SESSION_METHOD, {});
}

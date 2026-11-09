import {
  MEGACROW_ANALYZE_OBJECT_LIST_METHOD,
  MEGACROW_CONFIGURATION_SECTION,
  MEGACROW_REQUEST_ARTIFACTS_METHOD,
  MEGACROW_VERSION_CONFIGURATION_METHOD,
  type MegacrowArtifactKind,
  type MegacrowConfig,
  type MegacrowRequestArtifactsResult,
  type MegacrowVersionConfigurationParams,
} from "@megacrow/lsp/protocol";
import type { MegaloVersionId } from "@megacrow/megalo";
import type { CancellationToken } from "vscode-jsonrpc";
import type {
  CompletionItem,
  CompletionList,
  Diagnostic,
  DidChangeConfigurationParams,
  Hover,
  Location,
  LocationLink,
  Position,
  Range,
  SemanticTokens,
} from "vscode-languageserver-protocol";
import { getConnection, lspSyncDocument } from "./connection";
import { getActiveDocumentUri, getLspConfig, setLspConfig } from "./state";

function decodeBase64(dataBase64: string): Uint8Array {
  const binary = atob(dataBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export type { MegacrowArtifactKind };

/** Which document a request is about, and how to cancel it. */
export interface LspRequestOptions {
  /** Cancelled by Monaco when the result is no longer wanted. */
  token?: CancellationToken;
  /** Document URI; defaults to the active document. */
  uri?: string;
}

/** Sync `text` for the request's document, then return its URI. */
async function syncForRequest(
  text: string,
  options: LspRequestOptions | undefined
): Promise<string> {
  const uri = options?.uri ?? getActiveDocumentUri();
  await lspSyncDocument(text, uri);
  return uri;
}

type MegacrowCompileMetadata = MegacrowRequestArtifactsResult["metadata"];
type MegacrowLimitUsage = MegacrowRequestArtifactsResult["limitUsage"];

export interface LspArtifactsResult {
  bytes?: Uint8Array;
  diagnostics: Diagnostic[];
  error?: string;
  limitUsage?: MegacrowLimitUsage;
  metadata?: MegacrowCompileMetadata;
  ok?: boolean;
  semanticTokens?: number[];
  variantByteLength?: number;
  version: number;
}

export async function lspRequestArtifacts(
  text: string,
  artifacts: MegacrowArtifactKind[],
  options?: LspRequestOptions
): Promise<LspArtifactsResult> {
  const connection = await getConnection();
  const uri = await syncForRequest(text, options);
  const result = await connection.sendRequest<MegacrowRequestArtifactsResult>(
    MEGACROW_REQUEST_ARTIFACTS_METHOD,
    { textDocument: { uri }, text, artifacts },
    options?.token
  );
  return {
    ok: result.ok,
    bytes: result.dataBase64 ? decodeBase64(result.dataBase64) : undefined,
    diagnostics: result.diagnostics ?? [],
    error: result.error,
    metadata: result.metadata,
    semanticTokens: result.semanticTokens,
    version: result.version,
    variantByteLength: result.variantByteLength,
    limitUsage: result.limitUsage,
  };
}

export async function lspCompileSource(
  text: string,
  fileType: "mglo" | "mpvr" | "gvar" = "mglo",
  options?: LspRequestOptions
): Promise<LspArtifactsResult & { ok: boolean }> {
  const artifacts = await lspRequestArtifacts(
    text,
    ["diagnostics", fileType],
    options
  );
  if (!(artifacts.ok && artifacts.bytes)) {
    return {
      ok: false,
      diagnostics: artifacts.diagnostics,
      error: artifacts.error,
      version: artifacts.version,
    };
  }
  return { ...artifacts, ok: true };
}

export async function lspSemanticTokens(
  text: string,
  options?: LspRequestOptions
): Promise<number[]> {
  const connection = await getConnection();
  const uri = await syncForRequest(text, options);
  const result = await connection.sendRequest<SemanticTokens | null>(
    "textDocument/semanticTokens/full",
    { textDocument: { uri } },
    options?.token
  );
  return result?.data ?? [];
}

export async function lspHover(
  text: string,
  position: Position,
  options?: LspRequestOptions
): Promise<Hover | null> {
  const connection = await getConnection();
  const uri = await syncForRequest(text, options);
  return connection.sendRequest<Hover | null>(
    "textDocument/hover",
    { textDocument: { uri }, position },
    options?.token
  );
}

export interface LspDefinitionLocation {
  range: Range;
  uri: string;
}

function asDefinitionLocation(
  value: Location | LocationLink
): LspDefinitionLocation {
  if ("targetUri" in value) {
    return {
      uri: value.targetUri,
      range: value.targetSelectionRange ?? value.targetRange,
    };
  }
  return { uri: value.uri, range: value.range };
}

export async function lspDefinition(
  text: string,
  position: Position,
  options?: LspRequestOptions
): Promise<LspDefinitionLocation[]> {
  const connection = await getConnection();
  const uri = await syncForRequest(text, options);
  const result = await connection.sendRequest<
    Location | Location[] | LocationLink[] | null
  >(
    "textDocument/definition",
    { textDocument: { uri }, position },
    options?.token
  );
  if (!result) {
    return [];
  }
  const list: (Location | LocationLink)[] = Array.isArray(result)
    ? result
    : [result];
  return list.map(asDefinitionLocation);
}

export async function lspCompletions(
  text: string,
  position: Position,
  options?: LspRequestOptions
): Promise<CompletionItem[]> {
  const connection = await getConnection();
  const uri = await syncForRequest(text, options);
  const result = await connection.sendRequest<
    CompletionItem[] | CompletionList | null
  >(
    "textDocument/completion",
    { textDocument: { uri }, position },
    options?.token
  );
  if (!result) {
    return [];
  }
  return Array.isArray(result) ? result : result.items;
}

/** Object-list names for `megaloVersion` (default: the configured version). */
export async function lspVersionConfiguration(
  megaloVersion?: MegaloVersionId
): Promise<{
  objectListNames: readonly string[];
}> {
  const connection = await getConnection();
  return connection.sendRequest<{ objectListNames: readonly string[] }>(
    MEGACROW_VERSION_CONFIGURATION_METHOD,
    { megaloVersion } satisfies MegacrowVersionConfigurationParams
  );
}

export async function lspAnalyzeObjectList(text: string): Promise<{
  diagnostics: Diagnostic[];
}> {
  const connection = await getConnection();
  return connection.sendRequest<{ diagnostics: Diagnostic[] }>(
    MEGACROW_ANALYZE_OBJECT_LIST_METHOD,
    { text }
  );
}

let lastSentConfig: string | null = null;
const configListeners = new Set<() => void>();

/**
 * Called after each configuration change is queued (ahead of any request sent
 * afterwards), e.g. to recompile with the new compiler profile.
 */
export function subscribeLspConfigChanges(listener: () => void): () => void {
  configListeners.add(listener);
  return () => {
    configListeners.delete(listener);
  };
}

/**
 * Merge `patch` into the server configuration and send the whole configuration
 * with `workspace/didChangeConfiguration` — only when it actually changed, so
 * unrelated settings saves never make the server re-analyze.
 */
export function lspUpdateConfig(patch: Partial<MegacrowConfig>): void {
  const next: MegacrowConfig = { ...getLspConfig(), ...patch };
  setLspConfig(next);
  const serialized = JSON.stringify(next);
  if (serialized === lastSentConfig) {
    return;
  }
  lastSentConfig = serialized;
  void getConnection().then((connection) => {
    connection.sendNotification("workspace/didChangeConfiguration", {
      settings: { [MEGACROW_CONFIGURATION_SECTION]: next },
    } satisfies DidChangeConfigurationParams);
  });
  for (const listener of configListeners) {
    listener();
  }
}

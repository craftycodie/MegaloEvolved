import type { CompileSourceOptions } from "@megacrow/megalo";
import {
  type CompiledMegaloMetadata,
  type CompilerSettings,
  type MegacrowExtensions,
  type MegaloVersionId,
  type ObjectLists,
  type PathDirectoryEntry,
  SEMANTIC_TOKEN_MODIFIERS,
  SEMANTIC_TOKEN_TYPES,
  type VariantLimitUsage,
} from "@megacrow/megalo";
import type {
  Diagnostic,
  SemanticTokensLegend,
} from "vscode-languageserver-types";

export const MEGACROW_REQUEST_ARTIFACTS_METHOD = "megacrow/requestArtifacts";
export const MEGACROW_RESOLVE_INCLUDE_METHOD = "megacrow/resolveInclude";
export const MEGACROW_RESOLVE_BASE_FILE_METHOD = "megacrow/resolveBaseFile";
export const MEGACROW_LIST_DIRECTORY_METHOD = "megacrow/listDirectory";
export const MEGACROW_VERSION_CONFIGURATION_METHOD =
  "megacrow/versionConfiguration";
export const MEGACROW_ANALYZE_OBJECT_LIST_METHOD = "megacrow/analyzeObjectList";
/**
 * Settings section in `workspace/didChangeConfiguration`:
 * `{ settings: { megacrow: MegacrowConfig } }`.
 */
export const MEGACROW_CONFIGURATION_SECTION = "megacrow";
export const MEGACROW_RESET_SESSION_METHOD = "megacrow/resetSession";

export const MEGACROW_DEFINITION_SCHEME = "megacrow-definition";

export const SEMANTIC_TOKENS_LEGEND: SemanticTokensLegend = {
  tokenTypes: [...SEMANTIC_TOKEN_TYPES],
  tokenModifiers: [...SEMANTIC_TOKEN_MODIFIERS],
};

export type MegacrowArtifactKind =
  | "semanticTokens"
  | "diagnostics"
  | "mglo"
  | "mpvr"
  | "gvar";

export interface MegacrowRequestArtifactsParams {
  artifacts: MegacrowArtifactKind[];
  objectLists?: ObjectLists;
  /** When omitted, the server uses the last synced document text for the URI. */
  text?: string;
  textDocument: { uri: string };
}

export interface MegacrowRequestArtifactsResult {
  /** Base64-encoded output bytes when a binary artifact was requested and compilation succeeded. */
  dataBase64?: string;
  diagnostics?: Diagnostic[];
  error?: string;
  /** Compile-time resource usage from the same lowered IR. */
  limitUsage?: VariantLimitUsage;
  metadata?: CompiledMegaloMetadata;
  /** Present when a binary artifact was requested. */
  ok?: boolean;
  semanticTokens?: number[];
  /** Raw `.mglo` bitstream length (excludes BLF framing). */
  variantByteLength?: number;
  /** Document version the artifacts were computed for (server-side). */
  version: number;
}

export interface MegacrowResolveIncludeParams {
  fromUri?: string;
  kind: "include" | "localized_include";
  path: string;
}

export type MegacrowResolveIncludeResult =
  | { text: string; uri: string }
  | { error: string };

export interface MegacrowResolveBaseFileParams {
  fromUri?: string;
  path: string;
}

export type MegacrowResolveBaseFileResult =
  | { dataBase64: string }
  | { error: string };

export interface MegacrowListDirectoryParams {
  /** Relative directory under the document (or search root). Empty = document dir. */
  directory: string;
  fromUri?: string;
}

export type MegacrowListDirectoryResult =
  | { entries: PathDirectoryEntry[] }
  | { error: string };

/**
 * Everything the server analyzes and compiles with. Always sent whole: as
 * `initializationOptions.config` in `initialize`, then on every change with
 * `workspace/didChangeConfiguration` `{ settings: { megacrow: config } }`.
 * The server re-analyzes open documents only when the value actually changes.
 */
export interface MegacrowConfig {
  compilerSettings: Partial<CompilerSettings>;
  /**
   * Game build number written into the variant, or `null` for none (-1).
   * The compiler has no defaults; the host picks the build.
   */
  gameBuildNumber: number | null;
  /** Diagnostics / hover locale. */
  locale: "en" | "ja";
  megacrowExtensions: MegacrowExtensions;
  /** Engine profile id (e.g. `107-mcc`, `106`). */
  megaloVersion: MegaloVersionId;
  /** Workspace object lists, or `null` to use the bundled defaults. */
  objectLists: ObjectLists | null;
  /** When false, compile omits `resolveBaseFile` (silent sibling-source JIT). */
  resolveBaseFile: boolean;
}

/** `initialize` → `initializationOptions`. */
export interface MegacrowInitializationOptions {
  config?: MegacrowConfig;
}

export interface MegacrowVersionConfigurationParams {
  /** Answer for this version instead of the configured one. */
  megaloVersion?: MegaloVersionId;
}

export interface MegacrowVersionConfigurationResult {
  objectListNames: readonly string[];
}

export interface MegacrowAnalyzeObjectListParams {
  text: string;
}

export interface MegacrowAnalyzeObjectListResult {
  diagnostics: Diagnostic[];
}

/** Params for {@link MEGACROW_RESET_SESSION_METHOD} (currently unused; reserved). */
export type MegacrowResetSessionParams = Record<string, never>;

export type CompileResolvers = Pick<CompileSourceOptions, "resolveInclude"> &
  Partial<Pick<CompileSourceOptions, "resolveBaseFile">>;

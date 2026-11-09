import { _event_error, event } from "@blamnetwork/datamine";
import { getCompilerForVersion } from "src/backend/compile";
import type {
  CompiledMegaloFileType,
  CompiledMegaloMetadata,
} from "src/backend/compile/compiler";
import { assertEncodedSize } from "src/backend/compile/diagnostics/assertEncodedSize";
import { assertScriptStringBytes } from "src/backend/compile/diagnostics/assertScriptStringBytes";
import type { CompiledEngineStats } from "src/backend/compile/engineStats";
import type { CompilerSettings } from "src/compiler-settings";
import { MegaloCompilerContext } from "src/context";
import {
  BUILT_IN_LOCATION,
  type Diagnostic,
  DiagnosticSeverity,
  Diagnostics,
  UNKNOWN_LOCATION,
} from "src/diagnostics";
import { CompilerError } from "src/diagnostics/error";
import { diagnosticMessages } from "src/diagnostics/messages";
import {
  type AST,
  Parser,
  type ResolveIncludeFn,
} from "src/frontend/abstract-syntax-tree";
import type { IR } from "src/frontend/intermediate-representation";
import { Lowerer } from "src/frontend/intermediate-representation";
import type { ObjectLists } from "src/frontend/object-lists";
import { Lexer } from "src/frontend/tokens";
import type { AnalysisSnapshot } from "src/language-service/snapshot";
import { loadObjectListsForVersion } from "src/load-object-lists";
import type { MegacrowExtensions } from "src/megacrow-extensions";
import { resolveMegacrowExtensions } from "src/megacrow-extensions";
import {
  formatVariantLimitUsage,
  scriptStringTableEncodedBytes,
  type VariantLimitUsage,
} from "src/variant-limit-usage";
import type { SupportedMegaloVersion } from "src/version";

export type ResolveBaseFileFn = (
  path: string,
  ctx: { fromUri?: string }
) => Uint8Array | null | Promise<Uint8Array | null>;

/** Host progress hook (e.g. IDE status bar) while compiling a sibling base `.txt`. */
export type CompileProgressFn = (message: string) => void;

export interface CompileSourceOptions {
  /**
   * Halo engine build number stamped on the exported variant. When omitted,
   * the compiler uses its version default.
   */
  buildNumber?: number;
  /** MegaloEdit-parity compiler knobs. */
  compilerSettings?: Partial<CompilerSettings>;
  /**
   * Output container: raw `.mglo`, full `mpvr` BLF, or matchmaking `gvar` BLF.
   * Defaults to `mglo`.
   */
  fileType?: CompiledMegaloFileType;
  /** URI of the source document (for relative path resolution). */
  fromUri?: string;
  /**
   * When true (default), include used/max rows from compiler engine stats.
   * Set false to skip the extra payload.
   */
  includeLimitUsage?: boolean;
  /** MegaCrow-only language extensions (defaults keep MegaloEdit parity). */
  megacrowExtensions?: Partial<MegacrowExtensions>;
  /**
   * Object lists used for name resolution. When omitted, bundled defaults for
   * the compile version are loaded.
   */
  objectLists?: ObjectLists;
  /**
   * Called while just-in-time compiling a base `.txt` (when the `.mglo` is
   * missing). Hosts may surface this in a status bar.
   */
  onCompileProgress?: CompileProgressFn;
  /** Host-owned base `.mglo` resolver. */
  resolveBaseFile?: ResolveBaseFileFn;
  /** Host-owned include / source-text resolver (Tauri / OPFS / tests). */
  resolveInclude?: ResolveIncludeFn;
  version: SupportedMegaloVersion;
}

export interface CompileSourceResult {
  /** Present when compilation succeeded with no errors. */
  bytes?: Uint8Array;
  diagnostics: Diagnostic[];
  /**
   * Used/max rows from compiler {@link CompiledEngineStats}. Present unless
   * {@link CompileSourceOptions.includeLimitUsage} is false or compile stats
   * were unavailable.
   */
  limitUsage?: VariantLimitUsage;
  /** Present when compilation succeeded with no errors. */
  metadata?: CompiledMegaloMetadata;
  /**
   * Raw custom-variant bitstream length (`.mglo` content), not BLF framing /
   * ASQ padding. Used for encoded-size limits and UI meters.
   */
  variantByteLength?: number;
}

export type ResolveBaseMgloFailureReason = "not_found" | "compile_failed";

export type ResolveBaseMgloResult =
  | {
      ok: true;
      bytes: Uint8Array;
      /**
       * When set, a sibling `.txt` was JIT-compiled.
       */
      compiledFromSource?: {
        sourceUri: string;
        warningCount: number;
      };
    }
  | {
      ok: false;
      reason: ResolveBaseMgloFailureReason;
      diagnostics: Diagnostic[];
    };

interface CachedBaseCompile {
  bytes: Uint8Array;
  contentHash: string;
  warningCount: number;
}

/** In-memory compiled base `.mglo` bytes keyed by resolved `.txt` URI. */
const compiledBaseSourceCache = new Map<string, CachedBaseCompile>();

/** Paths currently being JIT-compiled (cycle detection). */
const compilingBaseSources = new Set<string>();

const displayFileName = (path: string): string => {
  const normalized = path.replace(/\\/g, "/");
  const slash = normalized.lastIndexOf("/");
  return slash >= 0 ? normalized.slice(slash + 1) : normalized;
};

const siblingBaseSourcePath = (mgloPath: string): string | null => {
  if (!/\.mglo$/i.test(mgloPath)) {
    return null;
  }
  return mgloPath.replace(/\.mglo$/i, ".txt");
};

const contentHash = (text: string): string => {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length.toString(16)}:${(hash >>> 0).toString(16)}`;
};

const cacheKeyForUri = (uri: string): string =>
  uri.replace(/\\/g, "/").toLowerCase();

export const baseFileNotFoundMessage = (baseMgloPath: string): string =>
  `No base file was found "${baseMgloPath}"`;

export const baseFileCompileFailedMessage = (baseMgloPath: string): string =>
  `No base file was found "${baseMgloPath}" and we could not compile from source`;

export const baseFileCompiledFromSourceMessage = (
  sourceFileName: string,
  warningCount = 0
): string => {
  if (warningCount <= 0) {
    return `No base file was found, ${sourceFileName} was compiled from source.`;
  }
  const warningsLabel = warningCount === 1 ? "warning" : "warnings";
  return `No base file was found, ${sourceFileName} was compiled from source with ${warningCount} ${warningsLabel}.`;
};

/**
 * Resolve a `base "….mglo"` path to encoded bytes.
 *
 * 1. Ask `resolveBaseFile` for the `.mglo` when provided.
 * 2. If missing and {@link MegacrowExtensions.compileMissingBaseFromSource} is
 *    enabled, load the sibling `.txt` via `resolveInclude`, compile it
 *    (recursively resolving nested bases), and cache the bytes in memory.
 *    A "compiled from source" warning is only emitted when `resolveBaseFile`
 *    was provided and returned null (expected a built `.mglo` but fell back).
 *    When no `resolveBaseFile` callback is supplied, sibling source is used
 *    silently.
 */
export const resolveBaseMgloBytes = async (
  baseMgloPath: string,
  options: CompileSourceOptions
): Promise<ResolveBaseMgloResult> => {
  if (options.resolveBaseFile) {
    const bytes = await options.resolveBaseFile(baseMgloPath, {
      fromUri: options.fromUri,
    });
    if (bytes !== null) {
      return { ok: true, bytes };
    }
  }

  const extensions = resolveMegacrowExtensions(options.megacrowExtensions);
  if (!extensions.compileMissingBaseFromSource) {
    return { ok: false, reason: "not_found", diagnostics: [] };
  }

  const txtPath = siblingBaseSourcePath(baseMgloPath);
  if (txtPath === null || !options.resolveInclude) {
    return { ok: false, reason: "not_found", diagnostics: [] };
  }

  const resolved = await options.resolveInclude(txtPath, {
    kind: "include",
    fromUri: options.fromUri,
  });
  if (resolved === null) {
    return { ok: false, reason: "not_found", diagnostics: [] };
  }

  /** DX only when a `.mglo` lookup was attempted and missed. */
  const warnCompiledFromSource = options.resolveBaseFile !== undefined;

  const key = cacheKeyForUri(resolved.uri);
  if (compilingBaseSources.has(key)) {
    return {
      ok: false,
      reason: "compile_failed",
      diagnostics: [
        {
          message: `Circular base dependency while compiling ${displayFileName(resolved.uri)}`,
          severity: DiagnosticSeverity.Error,
          location: UNKNOWN_LOCATION,
        },
      ],
    };
  }

  const hash = contentHash(resolved.text);
  const cached = compiledBaseSourceCache.get(key);
  if (cached !== undefined && cached.contentHash === hash) {
    return {
      ok: true,
      bytes: cached.bytes,
      compiledFromSource: warnCompiledFromSource
        ? {
            sourceUri: resolved.uri,
            warningCount: cached.warningCount,
          }
        : undefined,
    };
  }

  compilingBaseSources.add(key);
  try {
    options.onCompileProgress?.(
      `Compiling base file ${displayFileName(resolved.uri)}`
    );

    const nested = await compileSource(resolved.text, {
      ...options,
      fromUri: resolved.uri,
      includeLimitUsage: false,
    });

    const nestedErrors = nested.diagnostics.filter(
      (d) => d.severity === DiagnosticSeverity.Error
    );
    const warningCount = nested.diagnostics.filter(
      (d) => d.severity === DiagnosticSeverity.Warning
    ).length;

    if (!nested.bytes || nestedErrors.length > 0) {
      return {
        ok: false,
        reason: "compile_failed",
        diagnostics: nested.diagnostics,
      };
    }

    compiledBaseSourceCache.set(key, {
      contentHash: hash,
      bytes: nested.bytes,
      warningCount,
    });
    return {
      ok: true,
      bytes: nested.bytes,
      compiledFromSource: warnCompiledFromSource
        ? {
            sourceUri: resolved.uri,
            warningCount,
          }
        : undefined,
    };
  } finally {
    compilingBaseSources.delete(key);
  }
};

/** Test helper: clear the in-memory JIT base compile cache. */
export const clearCompiledBaseSourceCache = (): void => {
  compiledBaseSourceCache.clear();
};

const resolveAndAttachBase = async (
  ir: IR,
  diagnostics: Diagnostics,
  options: CompileSourceOptions
): Promise<void> => {
  if (!ir.baseFilePath) {
    return;
  }

  const location = ir.locations.get(ir, "baseFilePath") ?? UNKNOWN_LOCATION;

  if (!(options.resolveBaseFile || options.resolveInclude)) {
    diagnostics.addError(baseFileNotFoundMessage(ir.baseFilePath), location);
    return;
  }

  let resolved: ResolveBaseMgloResult;
  try {
    resolved = await resolveBaseMgloBytes(ir.baseFilePath, options);
  } catch (error) {
    diagnostics.addError(
      error instanceof Error
        ? error.message
        : baseFileNotFoundMessage(ir.baseFilePath),
      location
    );
    return;
  }

  if (!resolved.ok) {
    diagnostics.addError(
      resolved.reason === "compile_failed"
        ? baseFileCompileFailedMessage(ir.baseFilePath)
        : baseFileNotFoundMessage(ir.baseFilePath),
      location
    );
    return;
  }

  if (resolved.compiledFromSource) {
    diagnostics.addWarning(
      baseFileCompiledFromSourceMessage(
        displayFileName(resolved.compiledFromSource.sourceUri),
        resolved.compiledFromSource.warningCount
      ),
      location
    );
  }

  ir.baseFileBytes = resolved.bytes;
};

/**
 * Lower → resolve base → encode from an existing AST (skips lex/parse).
 * Always returns diagnostics; `bytes` is only set when there are no errors.
 */
export const compileFromAst = async (
  ast: AST,
  options: CompileSourceOptions,
  priorDiagnostics: readonly Diagnostic[] = []
): Promise<CompileSourceResult> => {
  const frontend = new MegaloCompilerContext(
    options.version,
    options.megacrowExtensions,
    options.compilerSettings
  );
  const objectLists =
    options.objectLists ?? loadObjectListsForVersion(options.version);
  const diagnostics = new Diagnostics();
  for (const diagnostic of priorDiagnostics) {
    if (diagnostic.severity === DiagnosticSeverity.Error) {
      diagnostics.addError(diagnostic.message, diagnostic.location);
    } else {
      diagnostics.addWarning(diagnostic.message, diagnostic.location);
    }
  }

  const lowerer = new Lowerer(frontend);
  const compiler = getCompilerForVersion(frontend.megaloVersion);

  const limitUsageFrom = (
    engineStats: CompiledEngineStats
  ): VariantLimitUsage | undefined => {
    if (options.includeLimitUsage === false) {
      return;
    }
    return formatVariantLimitUsage(
      engineStats,
      frontend.versionConfiguration.limits
    );
  };

  /** Best-effort stats when write did not run (separate diagnostics so we do not mutate the real bag). */
  const limitUsageFromDryRun = (ir: IR): VariantLimitUsage | undefined => {
    if (options.includeLimitUsage === false) {
      return;
    }
    try {
      const { engineStats } = compiler.dryRun(ir, new Diagnostics());
      return formatVariantLimitUsage(
        engineStats,
        frontend.versionConfiguration.limits
      );
    } catch {
      return;
    }
  };

  try {
    const ir = lowerer.lower(ast, diagnostics, {
      objectLists,
    });
    await resolveAndAttachBase(ir, diagnostics, options);

    if (diagnostics.hasErrors()) {
      return {
        diagnostics: [...diagnostics.getErrors(), ...diagnostics.getWarnings()],
        limitUsage: limitUsageFromDryRun(ir),
      };
    }

    assertScriptStringBytes(
      scriptStringTableEncodedBytes(ir),
      frontend.versionConfiguration.limits.stringBytes,
      diagnostics
    );
    if (diagnostics.hasErrors()) {
      return {
        diagnostics: [...diagnostics.getErrors(), ...diagnostics.getWarnings()],
        limitUsage: limitUsageFromDryRun(ir),
      };
    }

    let data: Uint8Array;
    let metadata: CompiledMegaloMetadata;
    let variantByteLength: number;
    let engineStats: CompiledEngineStats;
    try {
      ({ data, metadata, variantByteLength, engineStats } =
        compiler.writeMegaloFile(ir, diagnostics, {
          buildNumber: options.buildNumber,
          fileType: options.fileType ?? "mglo",
        }));
    } catch (error) {
      // Encode/write failures (incl. BLF) — size is a common cause, but not
      // the only one (e.g. unsupported container type on pre-release builds).
      if (!(error instanceof CompilerError)) {
        event(
          _event_error,
          "megalo: failed to write gametype file: %s",
          String(error)
        );
        const detail =
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : String(error);
        diagnostics.addError(
          diagnosticMessages.failedToWriteGametypeFile(detail),
          BUILT_IN_LOCATION
        );
        return {
          diagnostics: [
            ...diagnostics.getErrors(),
            ...diagnostics.getWarnings(),
          ],
          limitUsage: limitUsageFromDryRun(ir),
        };
      }
      throw error;
    }
    assertEncodedSize(
      variantByteLength,
      frontend.versionConfiguration.limits.encodedSize,
      diagnostics
    );
    const ok = !diagnostics.hasErrors();
    return {
      diagnostics: [...diagnostics.getErrors(), ...diagnostics.getWarnings()],
      bytes: ok ? data : undefined,
      metadata: ok ? metadata : undefined,
      variantByteLength: ok ? variantByteLength : undefined,
      limitUsage: limitUsageFrom(engineStats),
    };
  } catch (error) {
    if (error instanceof CompilerError) {
      diagnostics.addError(error.message, error.location ?? UNKNOWN_LOCATION);
    } else {
      diagnostics.addError(
        error instanceof Error ? error.message : String(error),
        UNKNOWN_LOCATION
      );
    }
    return {
      diagnostics: [...diagnostics.getErrors(), ...diagnostics.getWarnings()],
    };
  }
};

/**
 * Compile from an {@link AnalysisSnapshot} without re-lexing or re-parsing.
 * Parse diagnostics from the snapshot are carried into the result.
 */
export const compileFromSnapshot = async (
  snapshot: AnalysisSnapshot,
  options: Omit<CompileSourceOptions, "version"> & {
    version?: SupportedMegaloVersion;
  } = {}
): Promise<CompileSourceResult> =>
  compileFromAst(
    snapshot.ast,
    {
      ...options,
      version: options.version ?? snapshot.version,
    },
    snapshot.parseDiagnostics
  );

/**
 * Lex → parse (with include expansion) → lower → resolve base → encode a Megalo
 * script to `.mglo` bytes.
 * Always returns diagnostics; `bytes` is only set when there are no errors.
 *
 * When a `base "….mglo"` cannot be read but a sibling `.txt` can, and
 * `megacrowExtensions.compileMissingBaseFromSource` is enabled, that source is
 * compiled just-in-time (cached in memory; not written to disk). A warning is
 * reported only when `resolveBaseFile` was provided and missed; omitting the
 * callback uses sibling source without that DX.
 */
export const compileSource = async (
  source: string,
  options: CompileSourceOptions
): Promise<CompileSourceResult> => {
  const frontend = new MegaloCompilerContext(
    options.version,
    options.megacrowExtensions,
    options.compilerSettings
  );
  const objectLists =
    options.objectLists ?? loadObjectListsForVersion(options.version);
  const diagnostics = new Diagnostics();

  const lexer = new Lexer(frontend);
  const parser = new Parser(frontend);

  try {
    const tokens = lexer.lex(source, diagnostics);
    const ast = await parser.parseAsync(tokens, diagnostics, {
      objectLists,
      resolveInclude: options.resolveInclude,
      fromUri: options.fromUri,
    });
    return await compileFromAst(ast, options, [
      ...diagnostics.getErrors(),
      ...diagnostics.getWarnings(),
    ]);
  } catch (error) {
    if (error instanceof CompilerError) {
      diagnostics.addError(error.message, error.location ?? UNKNOWN_LOCATION);
    } else {
      diagnostics.addError(
        error instanceof Error ? error.message : String(error),
        UNKNOWN_LOCATION
      );
    }
    return {
      diagnostics: [...diagnostics.getErrors(), ...diagnostics.getWarnings()],
    };
  }
};

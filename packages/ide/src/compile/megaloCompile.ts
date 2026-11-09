import type { CompileSourceOptions } from "@megacrow/megalo";
import {
  type Diagnostic,
  DiagnosticSeverity,
  MEGALO_VERSIONS,
  compileSource as megaloCompileSource,
  resolveGameBuildNumber,
  SourceLocationType,
} from "@megacrow/megalo";
import { translate } from "../localization";
import {
  getCompileCreatorGamertag,
  getCompileGameBuildNumber,
  getCompileMegacrowExtensions,
  getCompileMegaloVersion,
  getCompileStrictStringLiterals,
} from "./megaloCompilerSettings";

export {
  getCompileMegacrowExtensions,
  getCompileMegaloVersion,
  normalizeCreatorGamertag,
  setCompileGameBuildNumber,
  setCompileMegaloVersion,
} from "./megaloCompilerSettings";

export interface MegaloCompileTiming {
  compileMs: number;
  parseMs: number;
  totalMs: number;
}

export function formatMegaloCompileTiming(
  t: MegaloCompileTiming | null
): string {
  if (!t) {
    return "";
  }
  const ms = t.totalMs;
  if (ms >= 100) {
    const seconds = ms / 1000;
    const rounded =
      seconds >= 10
        ? seconds.toFixed(0)
        : seconds.toFixed(2).replace(/\.?0+$/, "");
    return translate("status_compiled_in_seconds", { time: rounded });
  }
  return translate("status_compiled_in_ms", {
    time: Math.max(0, Math.round(ms)),
  });
}

export function enrichCompileErrorLocation(
  error: unknown,
  _source?: string
): { line: number; column: number; message: string } {
  const message = error instanceof Error ? error.message : String(error);
  const match = /:(\d+):(\d+):/.exec(message);
  return {
    line: match ? Number(match[1]) : 1,
    column: match ? Number(match[2]) : 1,
    message,
  };
}

export function megaloErrorLocation(error: unknown) {
  return enrichCompileErrorLocation(error);
}

function compileVersion() {
  const versionId = getCompileMegaloVersion();
  return MEGALO_VERSIONS[versionId] ?? MEGALO_VERSIONS["107-mcc"];
}

async function compileOrThrow(
  source: string,
  options?: Pick<
    CompileSourceOptions,
    "fromUri" | "resolveInclude" | "resolveBaseFile" | "onCompileProgress"
  >
): Promise<Uint8Array> {
  const result = await megaloCompileSource(source, {
    version: compileVersion(),
    // Hosts that never chose a build (CLI) get the version's default.
    buildNumber:
      getCompileGameBuildNumber() ??
      resolveGameBuildNumber(getCompileMegaloVersion(), null),
    megacrowExtensions: getCompileMegacrowExtensions(),
    compilerSettings: {
      strictStringLiterals: getCompileStrictStringLiterals(),
      creatorGamertag: getCompileCreatorGamertag(),
    },
    fromUri: options?.fromUri,
    resolveInclude: options?.resolveInclude,
    resolveBaseFile: options?.resolveBaseFile,
    onCompileProgress: options?.onCompileProgress,
  });
  if (!result.bytes) {
    const firstError = result.diagnostics.find(
      (d: Diagnostic) => d.severity === DiagnosticSeverity.Error
    );
    let message = firstError?.message ?? "Compilation failed";
    if (
      firstError &&
      firstError.location.type === SourceLocationType.SOURCE_CODE
    ) {
      const { line, column } = firstError.location.start;
      message = `:${line}:${column}: ${message}`;
    } else if (
      firstError &&
      firstError.location.type === SourceLocationType.INCLUDE
    ) {
      const { line, column } = firstError.location.declaration.start;
      message = `:${line}:${column}: ${message}`;
    }
    throw new Error(message);
  }
  return result.bytes;
}

export type MegaloCompileCallOptions = Partial<
  Pick<
    CompileSourceOptions,
    "fromUri" | "resolveInclude" | "resolveBaseFile" | "onCompileProgress"
  >
>;

export async function compileMgloFromMegaloSourceAsync(
  source: string,
  basename = "script",
  baseCustomVariant?: unknown,
  compileOptions?: MegaloCompileCallOptions
): Promise<Uint8Array> {
  void basename;
  void baseCustomVariant;
  return compileOrThrow(source, compileOptions);
}

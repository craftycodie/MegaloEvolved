import { _event_error, event } from "@blamnetwork/datamine";
import type {
  CompiledMegaloMetadata,
  VariantLimitUsage,
} from "@megacrow/megalo";
import { translate } from "../localization";
import type { MegaloDiagnostic } from "./diagnostics";
import type { MegaloCompileTiming } from "./megaloCompile";

export type CompileState = "idle" | "parsing" | "ok" | "warn" | "error";

export interface SourceAnalysis {
  compiledByteLength: number | null;
  compiledMetadata?: CompiledMegaloMetadata | null;
  compileState: CompileState;
  compileTiming: MegaloCompileTiming | null;
  diagnostics: MegaloDiagnostic[];
  errorCount: number;
  limitUsage?: VariantLimitUsage | null;
  message: string;
  mgloBytes: Uint8Array | null;
}

export const idleAnalysis = (): SourceAnalysis => ({
  compileState: "idle",
  errorCount: 0,
  message: translate("status_no_gametype_loaded"),
  compiledByteLength: null,
  mgloBytes: null,
  compileTiming: null,
  diagnostics: [],
});

/**
 * Analysis for a compile request that threw (LSP worker crash, lost
 * connection, IPC failure). Callers show it instead of staying on "parsing".
 */
export const failedAnalysis = (error: unknown): SourceAnalysis => {
  event(
    _event_error,
    "ide:compile: Megalo compile request failed: %s",
    String(error)
  );
  return {
    ...idleAnalysis(),
    compileState: "error",
    errorCount: 1,
    message: translate("status_compilation_failed"),
  };
};

/**
 * While editing, failed / in-progress compiles should not wipe sidebar
 * identity, capacity meters, or size from the last successful compile.
 */
export function withPreservedCompileArtifacts(
  previous: SourceAnalysis,
  next: SourceAnalysis
): SourceAnalysis {
  if (next.compileState === "ok" || next.compileState === "warn") {
    return next;
  }
  if (next.compileState === "idle") {
    return next;
  }
  const hadArtifacts =
    previous.compiledMetadata != null ||
    previous.compiledByteLength != null ||
    previous.limitUsage != null;
  if (!hadArtifacts) {
    return next;
  }
  return {
    ...next,
    compiledMetadata: next.compiledMetadata ?? previous.compiledMetadata,
    compiledByteLength: next.compiledByteLength ?? previous.compiledByteLength,
    limitUsage: next.limitUsage ?? previous.limitUsage,
  };
}

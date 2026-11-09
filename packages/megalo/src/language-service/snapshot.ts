import type { Diagnostic, Diagnostics } from "src/diagnostics";
import type { AST } from "src/frontend/abstract-syntax-tree";
import type { Tokens } from "src/frontend/tokens";
import type { MegacrowExtensions } from "src/megacrow-extensions";
import type { SupportedMegaloVersion } from "src/version";

/** Shared analysis result for editor features (semantic tokens, diagnostics). */
export interface AnalysisSnapshot {
  readonly ast: AST;
  /** Byte offsets of each line start in `source` (index 0 = offset 0). */
  readonly lineStarts: readonly number[];
  readonly megacrowExtensions: MegacrowExtensions;
  readonly parseDiagnostics: readonly Diagnostic[];
  readonly source: string;
  readonly tokens: Tokens;
  readonly version: SupportedMegaloVersion;
}

export type { Diagnostics };

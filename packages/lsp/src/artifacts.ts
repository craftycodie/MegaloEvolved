import {
  type AnalysisSnapshot,
  analyzeDocument,
  type CompileSourceResult,
  compileFromSnapshot,
  encodeSemanticTokens,
  getSemanticTokens,
  type ObjectLists,
  type SupportedMegaloVersion,
} from "@megacrow/megalo";
import { DiagnosticSeverity } from "vscode-languageserver-types";
import { toLspDiagnostics } from "./diagnostics";
import type {
  CompileResolvers,
  MegacrowArtifactKind,
  MegacrowRequestArtifactsResult,
} from "./protocol";
import type { MegacrowSession } from "./sessionSettings";

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

export const analyzeDocumentSnapshot = async (
  source: string,
  session: MegacrowSession,
  options: {
    version: SupportedMegaloVersion;
    objectLists?: ObjectLists;
    fromUri?: string;
    resolvers?: CompileResolvers;
  }
): Promise<AnalysisSnapshot> =>
  analyzeDocument(source, {
    version: options.version,
    objectLists: options.objectLists,
    fromUri: options.fromUri,
    resolveInclude: options.resolvers?.resolveInclude,
    megacrowExtensions: session.megacrowExtensions,
    compilerSettings: session.compilerSettings,
  });

export const semanticTokensFromSnapshot = (
  snapshot: AnalysisSnapshot
): number[] => encodeSemanticTokens(getSemanticTokens(snapshot));

/**
 * Per-snapshot results that callers may share (the snapshot cache entry).
 * `compiled` is filled in on first use and reused afterwards.
 */
export interface SnapshotArtifactsReuse {
  compiled?: Promise<CompileSourceResult>;
  semanticTokens?: number[];
}

const sharedCompile = (
  reuse: SnapshotArtifactsReuse,
  run: () => Promise<CompileSourceResult>
): Promise<CompileSourceResult> => {
  if (!reuse.compiled) {
    const pending = run();
    reuse.compiled = pending;
    // Do not keep a rejected compile around; the next caller retries.
    pending.catch(() => {
      if (reuse.compiled === pending) {
        reuse.compiled = undefined;
      }
    });
  }
  return reuse.compiled;
};

export const requestArtifactsFromSnapshot = async (
  snapshot: AnalysisSnapshot,
  session: MegacrowSession,
  options: {
    artifacts: readonly MegacrowArtifactKind[];
    documentVersion: number;
    fromUri?: string;
    objectLists?: ObjectLists;
    resolvers?: CompileResolvers;
    /**
     * Results already computed for this exact snapshot and configuration.
     * The `mglo` compile is shared through it; `gvar`/`mpvr` always compile.
     */
    reuse?: SnapshotArtifactsReuse;
  }
): Promise<MegacrowRequestArtifactsResult> => {
  const wantsTokens = options.artifacts.includes("semanticTokens");
  const wantsDiagnostics = options.artifacts.includes("diagnostics");
  const fileType = options.artifacts.includes("mpvr")
    ? ("mpvr" as const)
    : options.artifacts.includes("gvar")
      ? ("gvar" as const)
      : options.artifacts.includes("mglo")
        ? ("mglo" as const)
        : undefined;
  const wantsBinary = fileType !== undefined;

  const result: MegacrowRequestArtifactsResult = {
    version: options.documentVersion,
  };

  if (wantsTokens) {
    result.semanticTokens =
      options.reuse?.semanticTokens ?? semanticTokensFromSnapshot(snapshot);
  }

  if (wantsDiagnostics || wantsBinary) {
    const runCompile = () =>
      compileFromSnapshot(snapshot, {
        version: snapshot.version,
        objectLists: options.objectLists,
        fromUri: options.fromUri,
        resolveInclude: options.resolvers?.resolveInclude,
        resolveBaseFile: options.resolvers?.resolveBaseFile,
        megacrowExtensions: session.megacrowExtensions,
        compilerSettings: session.compilerSettings,
        buildNumber: session.gameBuildNumber,
        fileType,
      });
    // Diagnostics-only and `mglo` compile identically (`mglo` is the default
    // container), so they share one compile per snapshot.
    const shareable = fileType === undefined || fileType === "mglo";
    const compiled = await (shareable && options.reuse
      ? sharedCompile(options.reuse, runCompile)
      : runCompile());
    const diagnostics = toLspDiagnostics(compiled.diagnostics, snapshot.source);

    if (wantsDiagnostics || wantsBinary) {
      result.diagnostics = diagnostics;
      result.limitUsage = compiled.limitUsage;
    }

    if (wantsBinary) {
      if (compiled.bytes) {
        result.ok = true;
        result.dataBase64 = bytesToBase64(compiled.bytes);
        result.metadata = compiled.metadata;
        result.variantByteLength = compiled.variantByteLength;
      } else {
        result.ok = false;
        const firstError = diagnostics.find(
          (d) => d.severity === DiagnosticSeverity.Error
        );
        result.error = firstError?.message ?? "No output produced";
      }
    }
  }

  return result;
};

export const requestArtifacts = async (
  source: string,
  session: MegacrowSession,
  options: {
    artifacts: readonly MegacrowArtifactKind[];
    documentVersion: number;
    version: SupportedMegaloVersion;
    objectLists?: ObjectLists;
    fromUri?: string;
    resolvers?: CompileResolvers;
    snapshot?: AnalysisSnapshot;
  }
): Promise<MegacrowRequestArtifactsResult> => {
  const snapshot =
    options.snapshot ??
    (await analyzeDocumentSnapshot(source, session, {
      version: options.version,
      objectLists: options.objectLists,
      fromUri: options.fromUri,
      resolvers: options.resolvers,
    }));

  return requestArtifactsFromSnapshot(snapshot, session, {
    artifacts: options.artifacts,
    documentVersion: options.documentVersion,
    fromUri: options.fromUri,
    objectLists: options.objectLists,
    resolvers: options.resolvers,
  });
};

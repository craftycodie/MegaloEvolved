import type { ObjectLists } from "@megacrow/megalo";
import { MEGALO_VERSIONS } from "@megacrow/megalo";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { DEFAULT_MEGALO_VERSION, isWindowsPlatform } from "../app/constants";
import {
  type CompileState,
  failedAnalysis,
  idleAnalysis,
  megaloDiagnosticFromLsp,
  requestCompileDownloadViaLsp,
  requestCompileViaLsp,
  type SourceAnalysis,
  withPreservedCompileArtifacts,
} from "../compile";
import { writeMccHotReloadMglo } from "../desktop/mccHotReload";
import type { DocumentKind } from "../editor/documentKey";
import { editorHost } from "../editor/editorHost";
import {
  gametypeSaveFileName,
  saveGametypeBytes,
  writeBuildOutputsToWorkspace,
} from "../files";
import type { GametypeSaveFormat } from "../gametype/gametypeSaveFormat";
import { translate, translatePlural } from "../localization";
import { lspAnalyzeObjectList, lspUpdateConfig } from "../lsp";
import { bumpLocalDiskRevision } from "./revisionStore";
import { getActiveWorkspace } from "./settingsStore";

export interface CompileStoreState {
  /** Result of the last finished analysis (or a placeholder while loading). */
  analysis: SourceAnalysis;
  /** Object list files the workspace is missing (shown in the problems tray). */
  missingObjectListNames: readonly string[];
  /** A compile or export is running for the shown document. */
  pending: boolean;
  /** Last state that was not "parsing"; colours the status bar meanwhile. */
  settledState: CompileState;
}

export const compileStore = createStore<CompileStoreState>(() => ({
  analysis: idleAnalysis(),
  missingObjectListNames: [],
  pending: false,
  settledState: "idle",
}));

// Track the last settled state centrally instead of in each component.
compileStore.subscribe((state) => {
  const current = state.pending ? "parsing" : state.analysis.compileState;
  if (current !== "parsing" && current !== state.settledState) {
    compileStore.setState({ settledState: current });
  }
});

/** Status-bar state: "parsing" while a compile runs, else the last result. */
export function selectCompileState(state: CompileStoreState): CompileState {
  return state.pending ? "parsing" : state.analysis.compileState;
}

export function useCompile<T>(selector: (state: CompileStoreState) => T): T {
  return useStore(compileStore, selector);
}

/** Bumped by every analysis start and by `resetCompile`; stale results drop. */
let analysisRun = 0;
/** Same for export / build. */
let exportRun = 0;

function finish(run: number, analysis: SourceAnalysis): boolean {
  if (run !== analysisRun) {
    return false;
  }
  compileStore.setState({ analysis, pending: false });
  writeHotReload(analysis);
  return true;
}

let lastHotReloadBytes: Uint8Array | null = null;

/** MCC on Windows reloads `.mglo` files from a fixed folder while running. */
function writeHotReload(analysis: SourceAnalysis): void {
  const bytes = analysis.mgloBytes;
  if (
    !bytes ||
    bytes === lastHotReloadBytes ||
    (analysis.compileState !== "ok" && analysis.compileState !== "warn")
  ) {
    return;
  }
  const version = getActiveWorkspace()?.megaloVersion ?? DEFAULT_MEGALO_VERSION;
  if (MEGALO_VERSIONS[version]?.flavour !== "mcc" || !isWindowsPlatform()) {
    return;
  }
  lastHotReloadBytes = bytes;
  writeMccHotReloadMglo(bytes).catch((error: unknown) => {
    console.error("Failed to write MCC hot-reload .mglo:", error);
  });
}

async function analyzeObjectList(text: string): Promise<SourceAnalysis> {
  let result: Awaited<ReturnType<typeof lspAnalyzeObjectList>>;
  try {
    result = await lspAnalyzeObjectList(text);
  } catch (error) {
    return failedAnalysis(error);
  }
  const diagnostics = result.diagnostics.map((d) => megaloDiagnosticFromLsp(d));
  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  return {
    ...idleAnalysis(),
    compileState: errorCount > 0 ? "error" : "ok",
    diagnostics,
    errorCount,
    message:
      errorCount > 0
        ? translatePlural("status_object_list_errors", errorCount)
        : translate("status_object_list"),
  };
}

export interface AnalyzeRequest {
  key: string;
  kind: DocumentKind;
  text: string;
}

/**
 * Analyze the shown document. `fresh` is for a document just opened: the
 * previous file's results are replaced right away. Edits (`fresh: false`)
 * keep the last good sidebar identity and sizes until the new result lands.
 */
export async function analyzeDocument(
  { key, kind, text }: AnalyzeRequest,
  { fresh }: { fresh: boolean }
): Promise<void> {
  const run = ++analysisRun;

  if (kind === "text") {
    compileStore.setState({
      analysis: {
        ...idleAnalysis(),
        compileState: "ok",
        message: translate("status_text_file"),
      },
      pending: false,
    });
    return;
  }

  if (kind === "objectList") {
    if (fresh) {
      compileStore.setState({
        analysis: {
          ...idleAnalysis(),
          compileState: "parsing",
          message: translate("status_analyzing_object_list"),
        },
        pending: true,
      });
    }
    const analysis = await analyzeObjectList(text);
    if (finish(run, analysis)) {
      editorHost.setPlainTextMarkers(key, analysis.diagnostics);
    }
    return;
  }

  compileStore.setState((state) => ({
    analysis: fresh
      ? {
          ...idleAnalysis(),
          compileState: "parsing",
          message: translate("status_parsing_megalo_source"),
        }
      : state.analysis,
    pending: true,
  }));
  const result = await requestCompileViaLsp(text, key);
  finish(
    run,
    fresh
      ? result
      : withPreservedCompileArtifacts(compileStore.getState().analysis, result)
  );
}

/** Forget results (no document shown, or the workspace changed). */
export function resetCompile(): void {
  analysisRun += 1;
  exportRun += 1;
  compileStore.setState({
    analysis: idleAnalysis(),
    missingObjectListNames: [],
    pending: false,
  });
}

export function setMissingObjectListNames(names: readonly string[]): void {
  const current = compileStore.getState().missingObjectListNames;
  if (
    current.length === names.length &&
    current.every((name, index) => name === names[index])
  ) {
    return;
  }
  compileStore.setState({ missingObjectListNames: names });
}

/** The LSP recompiles open documents through its config-change listener. */
export function setWorkspaceObjectLists(lists: ObjectLists | null): void {
  lspUpdateConfig({ objectLists: lists });
}

function showError(message: string): void {
  compileStore.setState({
    analysis: {
      ...idleAnalysis(),
      compileState: "error",
      errorCount: 1,
      message,
    },
    pending: false,
  });
}

export interface CompileTarget {
  displayName: string | null;
  key: string | undefined;
  text: string;
}

/** Compile and save the gametype in `format` (save dialog or download). */
export async function exportGametype(
  target: CompileTarget,
  format: GametypeSaveFormat
): Promise<void> {
  if (!(target.displayName || target.text.trim())) {
    showError(translate("status_load_gametype_or_source_first"));
    return;
  }
  const run = ++exportRun;
  compileStore.setState((state) => ({
    analysis: {
      ...state.analysis,
      compileState: "parsing",
      message: translate("status_compiling_for_export"),
    },
    pending: true,
  }));

  const { output, analysis } = await requestCompileDownloadViaLsp(
    target.text,
    format,
    target.key
  );
  if (run !== exportRun) {
    return;
  }
  if (!output) {
    compileStore.setState({ analysis, pending: false });
    return;
  }
  const downloadName = gametypeSaveFileName(target.displayName, format);
  try {
    const saved = await saveGametypeBytes(output, format, downloadName, {
      title: translate("save_gametype_title"),
      filterMegaloVariant: translate("save_filter_megalo_variant"),
      filterAutosaveQueue: translate("save_filter_autosave_queue"),
      filterReachGametype: translate("save_filter_reach_gametype"),
    });
    if (run !== exportRun) {
      return;
    }
    if (!saved.saved) {
      compileStore.setState({
        analysis: {
          ...analysis,
          compileState: "idle",
          message: translate("status_save_cancelled"),
        },
        pending: false,
      });
      return;
    }
    compileStore.setState({
      analysis: {
        ...analysis,
        message: saved.path
          ? translate("status_saved_to_path", { path: saved.path })
          : translate("status_saved_to_downloads", { name: downloadName }),
      },
      pending: false,
    });
  } catch (error) {
    if (run === exportRun) {
      console.error("Failed to save gametype:", error);
      showError(String(error));
    }
  }
}

/** Desktop workspaces with an output folder: write `.mglo` + `.bin` there. */
export async function buildVariant(target: CompileTarget): Promise<void> {
  const workspace = getActiveWorkspace();
  const fileName = target.displayName;
  if (
    !workspace ||
    workspace.type !== "tauri" ||
    !workspace.outputPath?.trim() ||
    !fileName
  ) {
    return;
  }
  const run = ++exportRun;
  compileStore.setState((state) => ({
    analysis: {
      ...state.analysis,
      compileState: "parsing",
      message: translate("status_building_mglo_bin"),
    },
    pending: true,
  }));

  const { output, analysis } = await requestCompileDownloadViaLsp(
    target.text,
    "mglo",
    target.key
  );
  if (run !== exportRun) {
    return;
  }
  if (!output) {
    compileStore.setState({ analysis, pending: false });
    return;
  }
  try {
    await writeBuildOutputsToWorkspace(
      workspace,
      fileName,
      output,
      workspace.megaloVersion ?? DEFAULT_MEGALO_VERSION
    );
    if (run !== exportRun) {
      return;
    }
    compileStore.setState({
      analysis: {
        ...analysis,
        message: translate("status_built_outputs", {
          mglo: gametypeSaveFileName(fileName, "mglo"),
          gvar: gametypeSaveFileName(fileName, "gvar"),
        }),
      },
      pending: false,
    });
    bumpLocalDiskRevision();
  } catch (error) {
    if (run === exportRun) {
      compileStore.setState({
        analysis: {
          ...analysis,
          compileState: "error",
          errorCount: 1,
          message: String(error),
        },
        pending: false,
      });
    }
  }
}

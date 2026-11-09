import type { ObjectLists } from "@megacrow/megalo";
import { MEGALO_VERSIONS } from "@megacrow/megalo";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type CompileState,
  type MegaloIncludeRoot,
  megaloDiagnosticFromLsp,
  requestCompileDownloadViaLsp,
  requestCompileViaLsp,
  type SourceAnalysis,
} from "../compile";
import {
  idleAnalysis,
  withPreservedCompileArtifacts,
} from "../compile/compileAnalysis";
import { writeMccHotReloadMglo } from "../desktop";
import {
  gametypeSaveFileName,
  saveGametypeBytes,
  writeBuildOutputsToWorkspace,
} from "../files";
import type { GametypeSaveFormat } from "../gametype";
import { isObjectListDocument, isObjectListsPath } from "../gametype";
import { translate } from "../localization";
import {
  lspAnalyzeObjectList,
  lspUpdateConfig,
  subscribeLspConfigChanges,
} from "../lsp";
import type { Workspace } from "../workspace";

export interface ActiveDocumentCompileBridge {
  analyzeObjectListDocument: (text: string) => Promise<SourceAnalysis>;
  compileRunRef: RefObject<number>;
  resetCompileState: () => void;
  setAnalysis: (
    analysis: SourceAnalysis | ((current: SourceAnalysis) => SourceAnalysis)
  ) => void;
  setCompileState: (state: CompileState) => void;
}

interface UseCompileOrchestrationOptions {
  activeWorkspace: Workspace | null;
  baselineSource: string | null;
  bumpLocalDiskRevision: () => void;
  compileBridgeRef: RefObject<ActiveDocumentCompileBridge | null>;
  fileName: string | null;
  getEditorSource: () => string;
  includeRoot: MegaloIncludeRoot | null;
  isPlainTextDocument: boolean;
  /** Bumped by every source load; lets the baseline effect consume `skipBaselineCompileRef`. */
  loadRevision: number;
  objectListNames: readonly string[];
  skipBaselineCompileRef: RefObject<boolean>;
  sourceRef: RefObject<string>;
}

export function useCompileOrchestration({
  activeWorkspace,
  baselineSource,
  bumpLocalDiskRevision,
  compileBridgeRef,
  fileName,
  getEditorSource,
  includeRoot,
  isPlainTextDocument,
  loadRevision,
  objectListNames,
  skipBaselineCompileRef,
  sourceRef,
}: UseCompileOrchestrationOptions) {
  const [analysis, setAnalysis] = useState<SourceAnalysis>(idleAnalysis());
  const [compileState, setCompileState] = useState<CompileState>("idle");
  const [compiledSize, setCompiledSize] = useState<number | null>(null);
  const [missingObjectListNames, setMissingObjectListNames] = useState<
    readonly string[]
  >([]);
  /** Bumped when the LSP configuration changes (profile, version, object lists…). */
  const [configEpoch, setConfigEpoch] = useState(0);

  useEffect(
    () => subscribeLspConfigChanges(() => setConfigEpoch((value) => value + 1)),
    []
  );

  const compileRunRef = useRef(0);
  const downloadRunRef = useRef(0);
  const compileParsingRef = useRef(false);

  const analyzeObjectListDocument = useCallback(async (text: string) => {
    const result = await lspAnalyzeObjectList(text);
    const diagnostics = result.diagnostics.map((d) =>
      megaloDiagnosticFromLsp(d)
    );
    const errorCount = diagnostics.filter((d) => d.severity === "error").length;
    return {
      ...idleAnalysis(),
      compileState: (errorCount > 0 ? "error" : "ok") as CompileState,
      errorCount,
      message:
        errorCount > 0
          ? translate(
              errorCount === 1
                ? "status_object_list_errors_one"
                : "status_object_list_errors_other",
              { count: errorCount }
            )
          : translate("status_object_list"),
      diagnostics,
    } satisfies SourceAnalysis;
  }, []);

  const handleObjectListAnalyzeDebounced = useCallback(
    (text: string) => {
      sourceRef.current = text;
      const runId = ++compileRunRef.current;
      void (async () => {
        const next = await analyzeObjectListDocument(text);
        if (runId === compileRunRef.current && text === sourceRef.current) {
          setAnalysis(next);
          setCompileState(next.compileState);
        }
      })();
    },
    [analyzeObjectListDocument, sourceRef]
  );

  const handleCompileDebounced = useCallback(
    (text: string) => {
      sourceRef.current = text;

      const openPath = includeRoot?.absoluteFilePath ?? fileName;

      if (isObjectListDocument(openPath, objectListNames)) {
        handleObjectListAnalyzeDebounced(text);
        return;
      }

      if (isObjectListsPath(openPath)) {
        return;
      }

      compileParsingRef.current = true;
      setCompileState("parsing");

      const runId = ++compileRunRef.current;

      void (async () => {
        const result = await requestCompileViaLsp(text);
        if (runId === compileRunRef.current && text === sourceRef.current) {
          compileParsingRef.current = false;
          setAnalysis((prev) => withPreservedCompileArtifacts(prev, result));
          setCompileState(result.compileState);
        }
      })();
    },
    [
      fileName,
      handleObjectListAnalyzeDebounced,
      includeRoot,
      objectListNames,
      sourceRef,
    ]
  );

  useEffect(() => {
    if (isPlainTextDocument) {
      return;
    }
    if (baselineSource === null) {
      return;
    }
    if (skipBaselineCompileRef.current) {
      skipBaselineCompileRef.current = false;
      return;
    }
    handleCompileDebounced(sourceRef.current ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settings / object lists only
  }, [
    isPlainTextDocument,
    handleCompileDebounced,
    loadRevision,
    baselineSource,
    configEpoch,
  ]);

  const handleWorkspaceObjectListsChange = useCallback(
    (lists: ObjectLists | null) => {
      // Recompiles through `configEpoch` when the lists actually changed.
      lspUpdateConfig({ objectLists: lists });
    },
    []
  );

  const handleMissingObjectListNamesChange = useCallback(
    (names: readonly string[]) => {
      setMissingObjectListNames((prev) => {
        if (
          prev.length === names.length &&
          prev.every((name, index) => name === names[index])
        ) {
          return prev;
        }
        return names;
      });
    },
    []
  );

  useEffect(() => {
    const versionId = activeWorkspace?.megaloVersion ?? "107-mcc";
    const flavour = MEGALO_VERSIONS[versionId]?.flavour;
    const isWindows =
      typeof navigator !== "undefined" &&
      /Win/i.test(navigator.platform || navigator.userAgent);
    if (
      flavour !== "mcc" ||
      !isWindows ||
      (analysis.compileState !== "ok" && analysis.compileState !== "warn") ||
      analysis.compiledByteLength === null ||
      !analysis.mgloBytes
    ) {
      return;
    }
    setCompiledSize(analysis.compiledByteLength);
    void writeMccHotReloadMglo(analysis.mgloBytes).catch((error) => {
      console.error("Failed to write MCC hot-reload .mglo:", error);
    });
  }, [analysis, activeWorkspace?.megaloVersion]);

  const compileDownload = useCallback(
    (format: GametypeSaveFormat) => {
      const source = getEditorSource();
      if (!(fileName || source.trim())) {
        setAnalysis({
          ...idleAnalysis(),
          compileState: "error",
          message: translate("status_load_gametype_or_source_first"),
          errorCount: 1,
        });
        setCompileState("error");
        return;
      }

      const runId = ++downloadRunRef.current;
      setCompileState("parsing");
      setAnalysis((current) => ({
        ...current,
        compileState: "parsing",
        message: translate("status_compiling_for_export"),
      }));

      void (async () => {
        const result = await requestCompileDownloadViaLsp(source, format);

        if (runId !== downloadRunRef.current) {
          return;
        }
        const { output, analysis: nextAnalysis } = result;
        if (output) {
          const downloadName = gametypeSaveFileName(fileName, format);
          const saveResult = await saveGametypeBytes(
            output,
            format,
            downloadName,
            {
              title: translate("save_gametype_title"),
              filterMegaloVariant: translate("save_filter_megalo_variant"),
              filterAutosaveQueue: translate("save_filter_autosave_queue"),
              filterReachGametype: translate("save_filter_reach_gametype"),
            }
          );
          if (saveResult.saved) {
            setCompiledSize(
              nextAnalysis.compiledByteLength ??
                (format === "mglo" ? output.length : null)
            );
            setAnalysis({
              ...nextAnalysis,
              message: saveResult.path
                ? translate("status_saved_to_path", { path: saveResult.path })
                : translate("status_saved_to_downloads", {
                    name: downloadName,
                  }),
            });
          } else {
            setAnalysis({
              ...nextAnalysis,
              compileState: "idle",
              message: translate("status_save_cancelled"),
            });
          }
          setCompileState(
            saveResult.saved ? nextAnalysis.compileState : "idle"
          );
          return;
        }
        setAnalysis(nextAnalysis);
        setCompileState(nextAnalysis.compileState);
      })();
    },
    [fileName, getEditorSource]
  );

  const buildVariant = useCallback(() => {
    if (
      !activeWorkspace ||
      activeWorkspace.type !== "tauri" ||
      !activeWorkspace.outputPath?.trim() ||
      !fileName
    ) {
      return;
    }

    const megaloVersionId = activeWorkspace.megaloVersion ?? "107-mcc";
    const runId = ++downloadRunRef.current;
    const source = getEditorSource();
    setCompileState("parsing");
    setAnalysis((current) => ({
      ...current,
      compileState: "parsing",
      message: translate("status_building_mglo_bin"),
    }));

    void (async () => {
      const result = await requestCompileDownloadViaLsp(source, "mglo");

      if (runId !== downloadRunRef.current) {
        return;
      }

      const { output, analysis: nextAnalysis } = result;
      if (!output) {
        setAnalysis(nextAnalysis);
        setCompileState(nextAnalysis.compileState);
        return;
      }

      try {
        await writeBuildOutputsToWorkspace(
          activeWorkspace,
          fileName,
          output,
          megaloVersionId
        );
        setCompiledSize(nextAnalysis.compiledByteLength ?? output.length);
        setAnalysis({
          ...nextAnalysis,
          message: translate("status_built_outputs", {
            mglo: gametypeSaveFileName(fileName, "mglo"),
            gvar: gametypeSaveFileName(fileName, "gvar"),
          }),
        });
        setCompileState(nextAnalysis.compileState);
        bumpLocalDiskRevision();
      } catch (error) {
        setAnalysis({
          ...nextAnalysis,
          compileState: "error",
          errorCount: 1,
          message: String(error),
        });
        setCompileState("error");
      }
    })();
  }, [activeWorkspace, bumpLocalDiskRevision, fileName, getEditorSource]);

  const resetCompileState = useCallback(() => {
    compileRunRef.current += 1;
    downloadRunRef.current += 1;
    compileParsingRef.current = false;
    setAnalysis(idleAnalysis());
    setCompileState("idle");
    setCompiledSize(null);
    setMissingObjectListNames([]);
  }, []);

  compileBridgeRef.current = {
    analyzeObjectListDocument,
    compileRunRef,
    resetCompileState,
    setAnalysis,
    setCompileState,
  };

  return {
    analysis,
    buildVariant,
    compileDownload,
    compileState,
    compiledSize,
    handleCompileDebounced,
    handleMissingObjectListNamesChange,
    handleObjectListAnalyzeDebounced,
    handleWorkspaceObjectListsChange,
    missingObjectListNames,
  };
}

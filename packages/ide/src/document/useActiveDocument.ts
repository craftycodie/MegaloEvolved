import {
  type RefObject,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MegaloObjectListTarget } from "../compile";
import { type MegaloIncludeRoot, requestCompileViaLsp } from "../compile";
import { idleAnalysis } from "../compile/compileAnalysis";
import type { ActiveDocumentCompileBridge } from "../compile/useCompileOrchestration";
import { isTauriRuntime } from "../desktop";
import {
  EMPTY_FILE_NAV,
  type FileNavEntry,
  type FileNavState,
  resolveOpenablePathReference,
  sourceNavEntry,
} from "../editor";
import { persistOpenSourceFile } from "../files";
import { createPlatformFileProvider } from "../files/fileProvider";
import { joinLogicalPaths } from "../files/fileProvider/paths";
import { isObjectListDocument, isObjectListsPath } from "../gametype";
import { translate } from "../localization";
import { lspConfigureResolveContext, lspResetSession } from "../lsp";
import {
  setMegaloDefinitionOpenHandler,
  setMegaloPathOpenHandler,
} from "../monaco/megalo-language";
import {
  defaultObjectListText,
  isPathInWorkspaceInput,
  type MegacrowSettings,
  materializeObjectListsOnFirstSave,
  type Workspace,
} from "../workspace";

interface UseActiveDocumentOptions {
  activeWorkspace: Workspace | null;
  bumpLocalDiskRevision: () => void;
  commitSettings: (
    next: MegacrowSettings,
    workspaceOverride?: Workspace | null
  ) => Promise<void>;
  compileBridgeRef: RefObject<ActiveDocumentCompileBridge | null>;
  megacrowSettings: MegacrowSettings | null;
  objectListNames: readonly string[];
  recordFileNavOpen: (entry: FileNavEntry) => void;
  setFileNav: (state: FileNavState) => void;
  sourceRef: RefObject<string>;
  suppressFileNavRef: RefObject<boolean>;
  workspacesReady: boolean;
}

export function useActiveDocument({
  activeWorkspace,
  bumpLocalDiskRevision,
  commitSettings,
  compileBridgeRef,
  megacrowSettings,
  objectListNames,
  recordFileNavOpen,
  setFileNav,
  sourceRef,
  suppressFileNavRef,
  workspacesReady,
}: UseActiveDocumentOptions) {
  const [documentContent, setDocumentContent] = useState(
    "; MegaloEvolved — edit Megalo source and compile to .mglo\n"
  );
  const [syncRevision, setSyncRevision] = useState(0);
  const [outlineSource, setOutlineSource] = useState(documentContent);
  const [fileName, setFileName] = useState<string | null>(null);
  const [includeRoot, setIncludeRoot] = useState<MegaloIncludeRoot | null>(
    null
  );
  const [originalBytes, setOriginalBytes] = useState<Uint8Array | null>(null);
  const [loadRevision, setLoadRevision] = useState(0);
  const [baselineSource, setBaselineSource] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorColumn, setCursorColumn] = useState(1);

  const loadRunRef = useRef(0);
  const saveRunRef = useRef(0);
  const lastPersistedSourceRef = useRef<string | null>(null);
  const includeRootRef = useRef(includeRoot);
  const fileNameRef = useRef(fileName);
  const activeWorkspaceRef = useRef(activeWorkspace);
  const objectListNamesRef = useRef(objectListNames);
  includeRootRef.current = includeRoot;
  fileNameRef.current = fileName;
  activeWorkspaceRef.current = activeWorkspace;
  objectListNamesRef.current = objectListNames;
  const skipBaselineCompileRef = useRef(false);

  const editorNavigateRef = useRef<
    ((line: number, column?: number) => void) | null
  >(null);
  const getEditorSourceRef = useRef<() => string>(() => documentContent);

  const openDocumentPath = includeRoot?.absoluteFilePath ?? fileName;
  const isPlainTextDocument = useMemo(
    () => isObjectListsPath(openDocumentPath),
    [openDocumentPath]
  );
  const isObjectListDocumentOpen = useMemo(
    () => isObjectListDocument(openDocumentPath, objectListNames),
    [openDocumentPath, objectListNames]
  );

  const getEditorSource = useCallback(() => getEditorSourceRef.current(), []);

  const applyDocument = useCallback((text: string) => {
    setDocumentContent(text);
    setOutlineSource(text);
    sourceRef.current = text;
    setSyncRevision((n) => n + 1);
  }, []);

  const rememberLastOpenFile = useCallback(
    (absoluteFilePath: string | null) => {
      if (!(megacrowSettings && activeWorkspace)) {
        return;
      }
      const pathToStore =
        absoluteFilePath &&
        isPathInWorkspaceInput(absoluteFilePath, activeWorkspace.inputPath)
          ? absoluteFilePath
          : null;
      const current = megacrowSettings.workspaces.find(
        (workspace) => workspace.id === activeWorkspace.id
      );
      if ((current?.lastOpenFilePath ?? null) === pathToStore) {
        return;
      }
      void commitSettings({
        ...megacrowSettings,
        workspaces: megacrowSettings.workspaces.map((workspace) =>
          workspace.id === activeWorkspace.id
            ? { ...workspace, lastOpenFilePath: pathToStore }
            : workspace
        ),
      });
    },
    [activeWorkspace, commitSettings, megacrowSettings]
  );

  const clearWorkspace = useCallback(() => {
    loadRunRef.current += 1;
    const bridge = compileBridgeRef.current;
    if (bridge) {
      bridge.compileRunRef.current += 1;
    }
    saveRunRef.current += 1;
    skipBaselineCompileRef.current = false;
    suppressFileNavRef.current = false;
    setOriginalBytes(null);
    setBaselineSource(null);
    setFileName(null);
    setIncludeRoot(null);
    setDocumentContent("");
    setOutlineSource("");
    sourceRef.current = "";
    lastPersistedSourceRef.current = null;
    setSyncRevision((n) => n + 1);
    setLoadError(null);
    compileBridgeRef.current?.resetCompileState();
    setFileNav(EMPTY_FILE_NAV);
    void lspResetSession();
  }, [compileBridgeRef, setFileNav, sourceRef, suppressFileNavRef]);

  const loadMegaloSource = useCallback(
    (text: string, name: string, includeRootArg?: MegaloIncludeRoot) => {
      const runId = ++loadRunRef.current;
      saveRunRef.current += 1;
      const openPath = includeRootArg?.absoluteFilePath ?? name;
      const underObjectLists = isObjectListsPath(openPath);
      const objectListDoc = isObjectListDocument(
        openPath,
        objectListNamesRef.current
      );

      rememberLastOpenFile(includeRootArg?.absoluteFilePath ?? null);
      recordFileNavOpen(sourceNavEntry(text, name, includeRootArg));
      applyDocument(text);
      setBaselineSource(text);
      lastPersistedSourceRef.current = text;
      setFileName(name);
      setIncludeRoot(includeRootArg ?? null);
      setOriginalBytes(null);
      setLoadError(null);

      if (objectListDoc) {
        skipBaselineCompileRef.current = true;
        compileBridgeRef.current?.setCompileState("parsing");
        compileBridgeRef.current?.setAnalysis({
          ...idleAnalysis(),
          compileState: "parsing",
          message: translate("status_analyzing_object_list"),
        });
        void (async () => {
          const bridge = compileBridgeRef.current;
          if (!bridge) {
            return;
          }
          const next = await bridge.analyzeObjectListDocument(text);
          if (runId !== loadRunRef.current) {
            return;
          }
          bridge.setAnalysis(next);
          bridge.setCompileState(next.compileState);
        })();
        return;
      }

      if (underObjectLists) {
        skipBaselineCompileRef.current = true;
        compileBridgeRef.current?.setCompileState("ok");
        compileBridgeRef.current?.setAnalysis({
          ...idleAnalysis(),
          compileState: "ok",
          message: translate("status_text_file"),
        });
        return;
      }

      const bridge = compileBridgeRef.current;
      if (!bridge) {
        return;
      }
      const compileId = ++bridge.compileRunRef.current;
      bridge.setCompileState("parsing");
      bridge.setAnalysis({
        ...idleAnalysis(),
        compileState: "parsing",
        message: translate("status_parsing_megalo_source"),
      });
      lspConfigureResolveContext({
        workspace: activeWorkspace,
        filePath: includeRootArg?.absoluteFilePath ?? null,
      });

      // Includes and the base file are resolved by the LSP during compile.
      // This load compiles itself, so the baseline compile effect (triggered
      // by `loadRevision`) must skip once.
      setLoadRevision((n) => n + 1);
      skipBaselineCompileRef.current = true;

      void (async () => {
        const analysisResult = await requestCompileViaLsp(text);

        if (
          runId !== loadRunRef.current ||
          compileId !== bridge.compileRunRef.current
        ) {
          return;
        }

        bridge.setAnalysis(analysisResult);
        bridge.setCompileState(analysisResult.compileState);
      })();
    },
    [
      activeWorkspace,
      applyDocument,
      compileBridgeRef,
      recordFileNavOpen,
      rememberLastOpenFile,
    ]
  );

  const readFileForNav = useCallback(
    async (entry: FileNavEntry) => {
      if (entry.absoluteFilePath) {
        const fileProvider = createPlatformFileProvider(activeWorkspace);
        const fresh = fileProvider
          ? await fileProvider.readText(entry.absoluteFilePath)
          : null;
        if (fresh !== null) {
          return {
            text: fresh,
            name: entry.displayName,
            includeRoot: { absoluteFilePath: entry.absoluteFilePath },
          };
        }
      }
      return null;
    },
    [activeWorkspace]
  );

  const handleActiveFileDeleted = useCallback(
    (deletedName: string) => {
      if (
        fileName !== null &&
        fileName.localeCompare(deletedName, undefined, {
          sensitivity: "accent",
        }) === 0
      ) {
        rememberLastOpenFile(null);
        clearWorkspace();
      }
    },
    [clearWorkspace, fileName, rememberLastOpenFile]
  );

  const handleFileRenamedUpdate = useCallback(
    (oldName: string, newName: string, absoluteFilePath: string) => {
      if (
        fileName !== null &&
        fileName.localeCompare(oldName, undefined, {
          sensitivity: "accent",
        }) === 0
      ) {
        setFileName(newName);
        setIncludeRoot({ absoluteFilePath });
        rememberLastOpenFile(absoluteFilePath);
      }
    },
    [fileName, rememberLastOpenFile]
  );

  const restoredForWorkspaceIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!(workspacesReady && megacrowSettings && activeWorkspace)) {
      return;
    }
    if (restoredForWorkspaceIdRef.current === activeWorkspace.id) {
      return;
    }
    restoredForWorkspaceIdRef.current = activeWorkspace.id;

    const stored = megacrowSettings.workspaces.find(
      (workspace) => workspace.id === activeWorkspace.id
    );
    const absoluteFilePath = stored?.lastOpenFilePath ?? null;
    if (
      !(
        absoluteFilePath &&
        isPathInWorkspaceInput(absoluteFilePath, activeWorkspace.inputPath)
      )
    ) {
      if (absoluteFilePath) {
        rememberLastOpenFile(null);
      }
      return;
    }

    const fileProvider = createPlatformFileProvider(activeWorkspace);
    if (!fileProvider) {
      return;
    }
    void (async () => {
      const text = await fileProvider.readText(absoluteFilePath);
      if (text === null) {
        rememberLastOpenFile(null);
        return;
      }
      if (restoredForWorkspaceIdRef.current !== activeWorkspace.id) {
        return;
      }
      const fileForward = absoluteFilePath.replace(/\\/g, "/");
      const rootForward = activeWorkspace.inputPath
        .replace(/\\/g, "/")
        .replace(/\/+$/, "");
      const relative = fileForward
        .toLowerCase()
        .startsWith(`${rootForward.toLowerCase()}/`)
        ? fileForward.slice(rootForward.length + 1)
        : null;
      const slash = fileForward.lastIndexOf("/");
      const displayName =
        relative ??
        (slash >= 0 ? fileForward.slice(slash + 1) : absoluteFilePath);
      loadMegaloSource(text, displayName, { absoluteFilePath });
    })();
  }, [
    activeWorkspace,
    loadMegaloSource,
    megacrowSettings,
    rememberLastOpenFile,
    workspacesReady,
  ]);

  useEffect(() => {
    void import("../lsp").then(({ lspConfigureResolveContext: configure }) => {
      configure({
        workspace: activeWorkspace,
        filePath: includeRoot?.absoluteFilePath ?? null,
      });
    });
  }, [activeWorkspace, includeRoot]);

  const openObjectListFromDiagnostic = useCallback(
    async (target: MegaloObjectListTarget) => {
      const fileNameForType = `${target.objectType}.txt`;
      const relativePath = `object_lists/${fileNameForType}`;
      const absoluteCandidate = target.file
        ? target.file
        : activeWorkspace?.inputPath
          ? joinLogicalPaths(activeWorkspace.inputPath, relativePath)
          : relativePath;

      const resolved = await resolveOpenablePathReference(
        "include",
        target.file ?? relativePath,
        {
          workspace: activeWorkspace,
          currentFilePath: includeRoot?.absoluteFilePath ?? null,
        }
      );

      if (resolved) {
        loadMegaloSource(resolved.text, resolved.displayName, {
          absoluteFilePath: resolved.absoluteFilePath,
        });
      } else {
        const versionId = activeWorkspace?.megaloVersion ?? "107-mcc";
        const text = defaultObjectListText(fileNameForType, versionId);
        loadMegaloSource(text, relativePath, {
          absoluteFilePath: absoluteCandidate,
        });
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          editorNavigateRef.current?.(target.line, 1);
        });
      });
    },
    [activeWorkspace, includeRoot?.absoluteFilePath, loadMegaloSource]
  );

  const handleNavigateToDiagnostic = useCallback(
    (diagnostic: import("../compile").MegaloDiagnostic) => {
      if (diagnostic.objectList) {
        void openObjectListFromDiagnostic(diagnostic.objectList);
        return;
      }
      if (diagnostic.trayOnly) {
        return;
      }
      editorNavigateRef.current?.(diagnostic.line, diagnostic.column);
    },
    [openObjectListFromDiagnostic]
  );

  const handleSourceDebounced = useCallback(
    (text: string) => {
      sourceRef.current = text;
      startTransition(() => setOutlineSource(text));

      const absoluteFilePath = includeRootRef.current?.absoluteFilePath ?? null;
      const name = fileNameRef.current;
      const opfs = activeWorkspaceRef.current?.type === "opfs";
      if (!(absoluteFilePath || (opfs && name))) {
        return;
      }
      if (!isTauriRuntime() && isObjectListsPath(absoluteFilePath ?? name)) {
        return;
      }
      if (text === lastPersistedSourceRef.current) {
        return;
      }

      const runId = ++saveRunRef.current;
      void (async () => {
        try {
          let saved = false;
          if (absoluteFilePath?.trim() && isObjectListsPath(absoluteFilePath)) {
            saved = await materializeObjectListsOnFirstSave({
              absoluteFilePath: absoluteFilePath.trim(),
              text,
              objectListNames: objectListNamesRef.current,
              megaloVersionId:
                activeWorkspaceRef.current?.megaloVersion ?? "107-mcc",
            });
          }
          if (!saved) {
            saved = await persistOpenSourceFile({
              absoluteFilePath,
              fileName: name,
              opfs,
              text,
            });
          }
          if (
            !saved ||
            runId !== saveRunRef.current ||
            text !== sourceRef.current
          ) {
            return;
          }
          lastPersistedSourceRef.current = text;
          if (isObjectListsPath(absoluteFilePath ?? name)) {
            bumpLocalDiskRevision();
          }
        } catch (error) {
          console.error("Failed to save source file:", error);
        }
      })();
    },
    [bumpLocalDiskRevision]
  );

  useEffect(() => {
    setMegaloPathOpenHandler(async ({ kind, path }) => {
      const resolved = await resolveOpenablePathReference(kind, path, {
        workspace: activeWorkspace,
        currentFilePath: includeRoot?.absoluteFilePath ?? null,
      });
      if (!resolved) {
        console.warn(
          `[megacrow] could not open ${kind} path: ${path}` +
            (kind === "base" ? " (source .txt not found)" : "")
        );
        return;
      }
      loadMegaloSource(resolved.text, resolved.displayName, {
        absoluteFilePath: resolved.absoluteFilePath,
      });
    });
    return () => setMegaloPathOpenHandler(null);
  }, [activeWorkspace, includeRoot, loadMegaloSource]);

  useEffect(() => {
    setMegaloDefinitionOpenHandler(async ({ file, line, column }) => {
      const resolved = await resolveOpenablePathReference("include", file, {
        workspace: activeWorkspace,
        currentFilePath: includeRoot?.absoluteFilePath ?? null,
      });
      if (!resolved) {
        console.warn(`[megacrow] could not open definition file: ${file}`);
        return;
      }
      loadMegaloSource(resolved.text, resolved.displayName, {
        absoluteFilePath: resolved.absoluteFilePath,
      });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          editorNavigateRef.current?.(line, column);
        });
      });
    });
    return () => setMegaloDefinitionOpenHandler(null);
  }, [activeWorkspace, includeRoot, loadMegaloSource]);

  const handleCursorChange = useCallback((line: number, column: number) => {
    setCursorLine(line);
    setCursorColumn(column);
  }, []);

  const handleRegisterNavigate = useCallback(
    (navigate: (line: number, column?: number) => void) => {
      editorNavigateRef.current = navigate;
    },
    []
  );

  const handleRegisterGetValue = useCallback((getValue: () => string) => {
    getEditorSourceRef.current = getValue;
  }, []);

  return {
    baselineSource,
    clearWorkspace,
    cursorColumn,
    cursorLine,
    documentContent,
    fileName,
    getEditorSource,
    handleActiveFileDeleted,
    handleCursorChange,
    handleFileRenamedUpdate,
    handleNavigateToDiagnostic,
    handleRegisterGetValue,
    handleRegisterNavigate,
    handleSourceDebounced,
    includeRoot,
    isObjectListDocumentOpen,
    isPlainTextDocument,
    loadError,
    loadMegaloSource,
    loadRevision,
    originalBytes,
    outlineSource,
    readFileForNav,
    skipBaselineCompileRef,
    syncRevision,
  };
}

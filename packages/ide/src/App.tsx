import {
  MEGACROW_BUILD_STRING,
  MEGACROW_SHOW_WATERMARK,
} from "@megacrow/megalo";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMotd } from "./app/useMotd";
import {
  PROBLEMS_PANE_MAX_HEIGHT,
  PROBLEMS_PANE_MIN_HEIGHT,
  useProblemsPaneHeight,
} from "./app/useProblemsPaneHeight";
import {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  useSidebarWidth,
} from "./app/useSidebarWidth";
import { useUpdateCheck } from "./app/useUpdateCheck";
import type { MegaloIncludeRoot } from "./compile";
import {
  type ActiveDocumentCompileBridge,
  useCompileOrchestration,
} from "./compile/useCompileOrchestration";
import { useDiagnostics } from "./compile/useDiagnostics";
import { DiagnosticsTray } from "./components/DiagnosticsTray";
import { AddWorkspaceModal } from "./components/dialogs/AddWorkspaceModal";
import { MotdDialog } from "./components/dialogs/MotdDialog";
import { UpdateAvailableDialog } from "./components/dialogs/UpdateAvailableDialog";
import { Editor } from "./components/Editor";
import { EditorEmptyState } from "./components/EditorEmptyState";
import { FilesPanel } from "./components/files/FilesPanel";
import { IdePalette } from "./components/IdePalette";
import { PreReleaseWatermark } from "./components/PreReleaseWatermark";
import { SidebarVariantHeader } from "./components/SidebarVariantHeader";
import { StatusBar } from "./components/StatusBar";
import { Toolbar } from "./components/Toolbar";
import { isTauriRuntime } from "./desktop";
import { useDiscordPresence } from "./desktop/useDiscordPresence";
import { useActiveDocument } from "./document/useActiveDocument";
import type { FileNavEntry } from "./editor";
import { type IdePaletteMode, setIdePaletteOpener } from "./editor";
import { useFileNav } from "./editor/useFileNav";
import {
  VARIANT_CAPACITY_BY_MEGALO_VERSION,
  VARIANT_STORAGE_CAPACITY,
} from "./gametype";
import {
  failedToCompileStatus,
  IdeLocaleProvider,
  translate,
} from "./localization";
import { useMegacrowSettings } from "./workspace/useMegacrowSettings";
import { useWorkspaces } from "./workspace/useWorkspaces";

export function App() {
  const {
    activeWorkspace,
    applyWorkspace,
    bootstrapNeedsAddWorkspace,
    commitSettings,
    handleSettingsChange,
    megacrowSettings,
    objectListNames,
    setObjectListNames,
    settings,
    workspacesReady,
  } = useMegacrowSettings();

  const clearWorkspaceRef = useRef<() => void>(() => {});
  const compileBridgeRef = useRef<ActiveDocumentCompileBridge | null>(null);
  const loadMegaloSourceRef = useRef<
    (text: string, name: string, includeRoot?: MegaloIncludeRoot) => void
  >(() => {});
  const readFileForNavRef = useRef<
    (entry: FileNavEntry) => Promise<{
      text: string;
      name: string;
      includeRoot?: MegaloIncludeRoot;
    } | null>
  >(() => Promise.resolve(null));
  const sourceRef = useRef(
    "; MegaloEvolved — edit Megalo source and compile to .mglo\n"
  );
  const suppressFileNavRef = useRef(false);

  const workspaces = useWorkspaces({
    activeWorkspace,
    applyWorkspace,
    bootstrapNeedsAddWorkspace,
    clearWorkspace: () => clearWorkspaceRef.current(),
    commitSettings,
    megacrowSettings,
    setObjectListNames,
    workspacesReady,
  });

  const fileNav = useFileNav({
    activeWorkspaceId: activeWorkspace?.id ?? null,
    loadMegaloSource: (...args) => loadMegaloSourceRef.current(...args),
    readFileForNav: (entry) => readFileForNavRef.current(entry),
    sourceRef,
    suppressFileNavRef,
  });

  const document = useActiveDocument({
    activeWorkspace,
    bumpLocalDiskRevision: workspaces.bumpLocalDiskRevision,
    commitSettings,
    compileBridgeRef,
    megacrowSettings,
    objectListNames,
    recordFileNavOpen: fileNav.recordFileNavOpen,
    setFileNav: fileNav.setFileNav,
    sourceRef,
    suppressFileNavRef,
    workspacesReady,
  });

  loadMegaloSourceRef.current = document.loadMegaloSource;
  readFileForNavRef.current = document.readFileForNav;
  clearWorkspaceRef.current = document.clearWorkspace;

  const compile = useCompileOrchestration({
    activeWorkspace,
    baselineSource: document.baselineSource,
    bumpLocalDiskRevision: workspaces.bumpLocalDiskRevision,
    compileBridgeRef,
    fileName: document.fileName,
    getEditorSource: document.getEditorSource,
    includeRoot: document.includeRoot,
    isPlainTextDocument: document.isPlainTextDocument,
    loadRevision: document.loadRevision,
    objectListNames,
    skipBaselineCompileRef: document.skipBaselineCompileRef,
    sourceRef,
  });

  const { displayDiagnostics, warningCount } = useDiagnostics(
    compile.analysis.diagnostics,
    compile.missingObjectListNames
  );

  const { handleMotdDismiss, motdOpen, showMotdPreview } = useMotd();

  const { handleUpdateDismiss, handleUpdateSkip, updateOpen, updateRelease } =
    useUpdateCheck({
      commitSettings,
      megacrowSettings,
      motdOpen,
      workspacesReady,
    });

  useDiscordPresence({
    compileState: compile.compileState,
    enabled: settings.discordRichPresence,
    fileName: document.fileName,
    locale: settings.locale,
  });

  const [diagnosticsOpen, setDiagnosticsOpen] = useState(true);
  const [idePaletteOpen, setIdePaletteOpen] = useState(false);
  const [idePaletteMode, setIdePaletteMode] = useState<IdePaletteMode>("files");

  const {
    width: sidebarWidth,
    open: sidebarOpen,
    toggleOpen: toggleSidebar,
    onResizeStart: onSidebarResizeStart,
  } = useSidebarWidth();
  const {
    height: problemsPaneHeight,
    onResizeStart: onProblemsPaneResizeStart,
  } = useProblemsPaneHeight();

  useEffect(() => {
    setIdePaletteOpener(({ mode }) => {
      setIdePaletteMode(mode);
      setIdePaletteOpen(true);
    });
    return () => setIdePaletteOpener(null);
  }, []);

  const handleFileDeleted = useCallback(
    (name: string) => {
      workspaces.handleFileDeleted(() =>
        document.handleActiveFileDeleted(name)
      );
    },
    [document, workspaces]
  );

  const handleFileRenamed = useCallback(
    (oldName: string, newName: string, absoluteFilePath: string) => {
      workspaces.bumpLocalDiskRevision();
      fileNav.handleFileRenamed(oldName, newName, absoluteFilePath);
      document.handleFileRenamedUpdate(oldName, newName, absoluteFilePath);
    },
    [document, fileNav, workspaces]
  );

  const megaloVersionId = activeWorkspace?.megaloVersion ?? "107-mcc";
  const variantCapacity = activeWorkspace
    ? VARIANT_STORAGE_CAPACITY
    : VARIANT_CAPACITY_BY_MEGALO_VERSION["107-mcc"];

  const statusMessage =
    compile.compileState === "error" && compile.analysis.diagnostics.length > 0
      ? failedToCompileStatus(compile.analysis.errorCount)
      : (document.loadError ?? compile.analysis.message);

  const variantBytes =
    compile.analysis.compiledByteLength ??
    compile.compiledSize ??
    (document.originalBytes === null ? null : document.originalBytes.length);

  return (
    <IdeLocaleProvider locale={settings.locale}>
      <div className="app">
        {MEGACROW_SHOW_WATERMARK ? <PreReleaseWatermark /> : null}
        <MotdDialog onDismiss={handleMotdDismiss} open={motdOpen} />
        <IdePalette
          mode={idePaletteMode}
          onClose={() => setIdePaletteOpen(false)}
          open={idePaletteOpen}
        />
        <UpdateAvailableDialog
          currentBuildString={MEGACROW_BUILD_STRING}
          onDismiss={handleUpdateDismiss}
          onSkip={handleUpdateSkip}
          open={updateOpen}
          release={updateRelease}
        />
        <AddWorkspaceModal
          initialWorkspace={
            workspaces.editingWorkspaceId
              ? (megacrowSettings?.workspaces.find(
                  (workspace) => workspace.id === workspaces.editingWorkspaceId
                ) ?? null)
              : null
          }
          onCancel={() => {
            workspaces.setAddWorkspaceOpen(false);
            workspaces.setAddWorkspaceRequired(false);
            workspaces.setEditingWorkspaceId(null);
          }}
          onSave={workspaces.handleSaveWorkspace}
          open={workspaces.addWorkspaceOpen && workspacesReady}
          required={workspaces.addWorkspaceRequired}
        />
        <Toolbar
          canBuild={
            !!document.fileName &&
            activeWorkspace?.type === "tauri" &&
            !!activeWorkspace.outputPath?.trim() &&
            !document.isPlainTextDocument
          }
          canExport={!document.isPlainTextDocument}
          canNavigateBack={fileNav.canNavigateBack}
          canNavigateForward={fileNav.canNavigateForward}
          fileName={document.fileName}
          onBuild={compile.buildVariant}
          onCompile={compile.compileDownload}
          onNavigateBack={fileNav.handleNavigateBack}
          onNavigateForward={fileNav.handleNavigateForward}
          onSettingsChange={handleSettingsChange}
          onShowMotd={showMotdPreview}
          onToggleSidebar={toggleSidebar}
          settings={settings}
          sidebarOpen={sidebarOpen}
          workspace={activeWorkspace}
        />
        <div
          className={`main${sidebarOpen ? "" : " main--sidebar-collapsed"}`}
          style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
        >
          <aside
            aria-hidden={!sidebarOpen}
            className="sidebar"
            inert={sidebarOpen ? undefined : true}
          >
            <SidebarVariantHeader
              absoluteFilePath={document.includeRoot?.absoluteFilePath ?? null}
              compiledMetadata={compile.analysis.compiledMetadata}
              fileName={document.fileName}
              objectListNames={objectListNames}
            />
            <div className="sidebar-body">
              <FilesPanel
                activeFileName={document.fileName}
                localDiskRevision={workspaces.localDiskRevision}
                objectListNames={objectListNames}
                onAddWorkspace={workspaces.handleAddWorkspace}
                onClearEditor={document.clearWorkspace}
                onDeleteWorkspace={workspaces.handleDeleteWorkspace}
                onEditWorkspace={workspaces.handleEditWorkspace}
                onFileDeleted={handleFileDeleted}
                onFileRenamed={handleFileRenamed}
                onMissingObjectListNamesChange={
                  compile.handleMissingObjectListNamesChange
                }
                onOpenSource={document.loadMegaloSource}
                onSelectMegaloVersion={
                  isTauriRuntime()
                    ? undefined
                    : workspaces.handleSelectMegaloVersion
                }
                onSelectWorkspace={workspaces.handleSelectWorkspace}
                onWorkspaceObjectListsChange={
                  compile.handleWorkspaceObjectListsChange
                }
                opfsRevision={workspaces.opfsRevision}
                workspace={activeWorkspace}
                workspaceSwitcher={isTauriRuntime()}
                workspaces={megacrowSettings?.workspaces ?? []}
              />
            </div>
          </aside>
          <div
            aria-hidden={!sidebarOpen}
            aria-label={translate("app_resize_sidebar")}
            aria-orientation="vertical"
            aria-valuemax={SIDEBAR_MAX_WIDTH}
            aria-valuemin={SIDEBAR_MIN_WIDTH}
            aria-valuenow={sidebarWidth}
            className="sidebar-resizer"
            inert={sidebarOpen ? undefined : true}
            onPointerDown={sidebarOpen ? onSidebarResizeStart : undefined}
            role="separator"
          />
          <section className="editor-pane">
            <div className="editor-pane-main">
              {document.fileName ? (
                <Editor
                  diagnostics={compile.analysis.diagnostics}
                  documentContent={document.documentContent}
                  editorTheme={settings.editorTheme}
                  editorWordWrap={settings.editorWordWrap}
                  onCompileDebounced={
                    document.isObjectListDocumentOpen
                      ? compile.handleObjectListAnalyzeDebounced
                      : document.isPlainTextDocument
                        ? undefined
                        : compile.handleCompileDebounced
                  }
                  onCursorChange={document.handleCursorChange}
                  onEditorWordWrapChange={(wordWrap) =>
                    handleSettingsChange({ editorWordWrap: wordWrap })
                  }
                  onRegisterGetValue={document.handleRegisterGetValue}
                  onRegisterNavigate={document.handleRegisterNavigate}
                  onSourceDebounced={document.handleSourceDebounced}
                  plainText={document.isPlainTextDocument}
                  readOnly={
                    !isTauriRuntime() && document.isObjectListDocumentOpen
                  }
                  syncRevision={document.syncRevision}
                />
              ) : (
                <EditorEmptyState />
              )}
            </div>
            {document.fileName && diagnosticsOpen && (
              <>
                <div
                  aria-label={translate("app_resize_problems_pane")}
                  aria-orientation="horizontal"
                  aria-valuemax={PROBLEMS_PANE_MAX_HEIGHT}
                  aria-valuemin={PROBLEMS_PANE_MIN_HEIGHT}
                  aria-valuenow={problemsPaneHeight}
                  className="problems-pane-resizer"
                  onPointerDown={onProblemsPaneResizeStart}
                  role="separator"
                />
                <DiagnosticsTray
                  diagnostics={displayDiagnostics}
                  height={problemsPaneHeight}
                  onClose={() => setDiagnosticsOpen(false)}
                  onNavigate={document.handleNavigateToDiagnostic}
                />
              </>
            )}
          </section>
        </div>
        <StatusBar
          byteDiffCount={compile.analysis.byteDiffCount}
          byteIdentical={compile.analysis.byteIdentical}
          column={document.cursorColumn}
          compileState={compile.compileState}
          diagnosticsOpen={diagnosticsOpen}
          errorCount={compile.analysis.errorCount}
          line={document.cursorLine}
          megaCrowVersion={MEGACROW_BUILD_STRING}
          megaloVersionId={megaloVersionId}
          message={statusMessage}
          onToggleDiagnostics={() => setDiagnosticsOpen((open) => !open)}
          variantBytes={variantBytes}
          variantCapacity={variantCapacity}
          variantLimitUsage={compile.analysis.limitUsage ?? null}
          warningCount={warningCount}
        />
      </div>
    </IdeLocaleProvider>
  );
}

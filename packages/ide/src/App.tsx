import {
  MEGACROW_BUILD_STRING,
  MEGACROW_SHOW_WATERMARK,
} from "@megacrow/megalo";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_MEGALO_VERSION } from "./app/constants";
import {
  PROBLEMS_PANE,
  SIDEBAR_OPEN_STORAGE_KEY,
  SIDEBAR_PANE,
} from "./app/paneLayout";
import { useMotd } from "./app/useMotd";
import { useUpdateCheck } from "./app/useUpdateCheck";
import type { MegaloIncludeRoot } from "./compile";
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
import { type IdePaletteMode, setIdePaletteOpener } from "./editor";
import { editorHost } from "./editor/editorHost";
import type { GametypeSaveFormat } from "./gametype";
import {
  VARIANT_CAPACITY_BY_MEGALO_VERSION,
  VARIANT_STORAGE_CAPACITY,
} from "./gametype";
import {
  failedToCompileStatus,
  IdeLocaleProvider,
  translate,
} from "./localization";
import {
  buildVariant,
  type CompileTarget,
  exportGametype,
  selectCompileState,
  setMissingObjectListNames,
  setWorkspaceObjectLists,
  useCompile,
} from "./stores/compileStore";
import {
  closeAllDocuments,
  documentStore,
  handleEntryDeleted,
  handleEntryRenamed,
  navigateToDiagnostic,
  openDocument,
  useDocument,
} from "./stores/documentStore";
import {
  bumpLocalDiskRevision,
  bumpOpfsRevision,
  useRevisions,
} from "./stores/revisionStore";
import { PaneResizer } from "./ui/PaneResizer";
import { booleanCodec, usePersistentState } from "./ui/usePersistentState";
import { useResizablePane } from "./ui/useResizablePane";
import { useMegacrowSettings } from "./workspace/useMegacrowSettings";
import { useWorkspaces } from "./workspace/useWorkspaces";

/** What export and build compile: the shown document's current text. */
function compileTarget(): CompileTarget {
  const active = documentStore.getState().active;
  return {
    displayName: active?.displayName ?? null,
    key: active?.key,
    text: (active && editorHost.getText(active.key)) ?? "",
  };
}

function openSource(
  text: string,
  displayName: string,
  includeRoot?: MegaloIncludeRoot
): void {
  openDocument({
    displayName,
    path: includeRoot?.absoluteFilePath ?? null,
    text,
  });
}

function handleFileDeleted(name: string): void {
  bumpOpfsRevision();
  bumpLocalDiskRevision();
  handleEntryDeleted(name);
}

function handleFileRenamed(
  oldName: string,
  newName: string,
  absoluteFilePath: string
): void {
  bumpLocalDiskRevision();
  handleEntryRenamed(oldName, newName, absoluteFilePath);
}

const handleExport = (format: GametypeSaveFormat) =>
  void exportGametype(compileTarget(), format);
const handleBuild = () => void buildVariant(compileTarget());

export function App() {
  const {
    activeWorkspace,
    bootstrapNeedsAddWorkspace,
    megacrowSettings,
    objectListNames,
    settings,
    workspacesReady,
  } = useMegacrowSettings();

  const workspaces = useWorkspaces({
    activeWorkspace,
    bootstrapNeedsAddWorkspace,
  });

  const activeDocument = useDocument((state) => state.active);
  const analysis = useCompile((state) => state.analysis);
  const compileState = useCompile(selectCompileState);
  const missingObjectListNames = useCompile(
    (state) => state.missingObjectListNames
  );
  const localDiskRevision = useRevisions((state) => state.localDisk);
  const opfsRevision = useRevisions((state) => state.opfs);

  const fileName = activeDocument?.displayName ?? null;
  const isPlainTextDocument =
    activeDocument !== null && activeDocument.kind !== "megalo";

  const { displayDiagnostics, warningCount } = useDiagnostics(
    analysis.diagnostics,
    missingObjectListNames
  );

  const { handleMotdDismiss, motdOpen, showMotdPreview } = useMotd();

  const { handleUpdateDismiss, handleUpdateSkip, updateOpen, updateRelease } =
    useUpdateCheck({
      megacrowSettings,
      motdOpen,
      workspacesReady,
    });

  useDiscordPresence({
    compileState,
    enabled: settings.discordRichPresence,
    fileName,
    locale: settings.locale,
  });

  const [diagnosticsOpen, setDiagnosticsOpen] = useState(true);
  const [idePaletteOpen, setIdePaletteOpen] = useState(false);
  const [idePaletteMode, setIdePaletteMode] = useState<IdePaletteMode>("files");

  const sidebarPane = useResizablePane(SIDEBAR_PANE);
  const [sidebarOpen, setSidebarOpen] = usePersistentState(
    SIDEBAR_OPEN_STORAGE_KEY,
    booleanCodec,
    true
  );
  const toggleSidebar = useCallback(
    () => setSidebarOpen((open) => !open),
    [setSidebarOpen]
  );
  const problemsPane = useResizablePane(PROBLEMS_PANE);

  useEffect(() => {
    setIdePaletteOpener(({ mode }) => {
      setIdePaletteMode(mode);
      setIdePaletteOpen(true);
    });
    return () => setIdePaletteOpener(null);
  }, []);

  const megaloVersionId =
    activeWorkspace?.megaloVersion ?? DEFAULT_MEGALO_VERSION;
  const variantCapacity = activeWorkspace
    ? VARIANT_STORAGE_CAPACITY
    : VARIANT_CAPACITY_BY_MEGALO_VERSION[DEFAULT_MEGALO_VERSION];

  const statusMessage =
    compileState === "error" && analysis.diagnostics.length > 0
      ? failedToCompileStatus(analysis.errorCount)
      : analysis.message;

  const editingWorkspace = workspaces.editingWorkspaceId
    ? (megacrowSettings?.workspaces.find(
        (workspace) => workspace.id === workspaces.editingWorkspaceId
      ) ?? null)
    : null;

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
          initialWorkspace={editingWorkspace}
          // Fresh form state every time it opens or edits another workspace.
          key={`${workspaces.addWorkspaceOpen}:${workspaces.editingWorkspaceId ?? "new"}`}
          onCancel={workspaces.closeWorkspaceModal}
          onSave={workspaces.handleSaveWorkspace}
          open={workspaces.addWorkspaceOpen && workspacesReady}
          required={workspaces.addWorkspaceRequired}
        />
        <Toolbar
          canBuild={
            !!fileName &&
            activeWorkspace?.type === "tauri" &&
            !!activeWorkspace.outputPath?.trim() &&
            !isPlainTextDocument
          }
          canExport={!isPlainTextDocument}
          fileName={fileName}
          onBuild={handleBuild}
          onCompile={handleExport}
          onShowMotd={showMotdPreview}
          onToggleSidebar={toggleSidebar}
          sidebarOpen={sidebarOpen}
        />
        <div
          className={`main${sidebarOpen ? "" : " main--sidebar-collapsed"}`}
          style={
            { "--sidebar-width": `${sidebarPane.size}px` } as CSSProperties
          }
        >
          <aside
            aria-hidden={!sidebarOpen}
            className="sidebar"
            inert={sidebarOpen ? undefined : true}
          >
            <SidebarVariantHeader
              absoluteFilePath={activeDocument?.path ?? null}
              compiledMetadata={analysis.compiledMetadata}
              fileName={fileName}
              objectListNames={objectListNames}
            />
            <div className="sidebar-body">
              <FilesPanel
                activeFileName={fileName}
                // A new workspace starts with fresh tree, menu and dialog state.
                key={activeWorkspace?.id ?? "none"}
                localDiskRevision={localDiskRevision}
                objectListNames={objectListNames}
                onAddWorkspace={workspaces.handleAddWorkspace}
                onClearEditor={closeAllDocuments}
                onDeleteWorkspace={workspaces.handleDeleteWorkspace}
                onEditWorkspace={workspaces.handleEditWorkspace}
                onFileDeleted={handleFileDeleted}
                onFileRenamed={handleFileRenamed}
                onMissingObjectListNamesChange={setMissingObjectListNames}
                onOpenSource={openSource}
                onSelectMegaloVersion={
                  isTauriRuntime()
                    ? undefined
                    : workspaces.handleSelectMegaloVersion
                }
                onSelectWorkspace={workspaces.handleSelectWorkspace}
                onWorkspaceObjectListsChange={setWorkspaceObjectLists}
                opfsRevision={opfsRevision}
                workspace={activeWorkspace}
                workspaceSwitcher={isTauriRuntime()}
                workspaces={megacrowSettings?.workspaces ?? []}
              />
            </div>
          </aside>
          <PaneResizer
            className="sidebar-resizer"
            disabled={!sidebarOpen}
            label={translate("app_resize_sidebar")}
            pane={sidebarPane}
          />
          <section className="editor-pane">
            <div className="editor-pane-main">
              {fileName ? <Editor /> : <EditorEmptyState />}
            </div>
            {fileName && diagnosticsOpen && (
              <>
                <PaneResizer
                  className="problems-pane-resizer"
                  label={translate("app_resize_problems_pane")}
                  pane={problemsPane}
                />
                <DiagnosticsTray
                  diagnostics={displayDiagnostics}
                  height={problemsPane.size}
                  onClose={() => setDiagnosticsOpen(false)}
                  onNavigate={navigateToDiagnostic}
                />
              </>
            )}
          </section>
        </div>
        <StatusBar
          compileState={compileState}
          diagnosticsOpen={diagnosticsOpen}
          errorCount={analysis.errorCount}
          megaCrowVersion={MEGACROW_BUILD_STRING}
          megaloVersionId={megaloVersionId}
          message={statusMessage}
          onToggleDiagnostics={() => setDiagnosticsOpen((open) => !open)}
          variantBytes={analysis.compiledByteLength}
          variantCapacity={variantCapacity}
          variantLimitUsage={analysis.limitUsage ?? null}
          warningCount={warningCount}
        />
      </div>
    </IdeLocaleProvider>
  );
}

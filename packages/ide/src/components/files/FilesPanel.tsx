import type { MegaloVersionId } from "@megacrow/megalo";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_MEGALO_VERSION } from "../../app/constants";
import type { MegaloIncludeRoot } from "../../compile";
import {
  flattenSourceFileNodes,
  setSourceFileQuickOpenEntries,
} from "../../editor";
import { formatLocalDiskPath, pathKey } from "../../files";
import { isObjectListsPath } from "../../gametype";
import { useT } from "../../localization";
import type { StoredWorkspace, Workspace } from "../../workspace";
import { ConfirmDeleteDialog } from "../dialogs/ConfirmDeleteDialog";
import { ConfirmRegenerateObjectListsDialog } from "../dialogs/ConfirmRegenerateObjectListsDialog";
import { ConfirmReplaceDialog } from "../dialogs/ConfirmReplaceDialog";
import { BuildsPane } from "./BuildsPane";
import { FilesContextMenu } from "./FilesContextMenu";
import { FilesPanelHeader } from "./FilesPanelHeader";
import { LocalDiskSection } from "./LocalDiskSection";
import { OpfsFilesSection } from "./OpfsFilesSection";
import { isMegacrowTreeDragActive, MEGACROW_TREE_PATH_MIME } from "./treeUtils";
import { useBuildOutputs } from "./useBuildOutputs";
import { useDiskFileOps } from "./useDiskFileOps";
import { useFilesPanelContextMenu } from "./useFilesPanelContextMenu";
import { useLocalDiskRefresh } from "./useLocalDiskRefresh";
import { useOpfsFileOps } from "./useOpfsFileOps";

interface Props {
  activeFileName: string | null;
  localDiskRevision: number;
  objectListNames?: readonly string[];
  onAddWorkspace?: () => void;
  onClearEditor?: () => void;
  onDeleteWorkspace?: (id: string) => void;
  onEditWorkspace?: (workspace: StoredWorkspace) => void;
  onFileDeleted: (name: string) => void;
  onFileRenamed: (
    oldName: string,
    newName: string,
    absoluteFilePath: string
  ) => void;
  onMissingObjectListNamesChange?: (names: readonly string[]) => void;
  onOpenSource: (
    source: string,
    name: string,
    includeRoot?: MegaloIncludeRoot
  ) => void;
  onSelectMegaloVersion?: (version: MegaloVersionId) => void;
  onSelectWorkspace?: (id: string) => void;
  onWorkspaceObjectListsChange?: (
    lists: import("@megacrow/megalo").ObjectLists | null
  ) => void;
  opfsRevision: number;
  workspace: Workspace | null;
  workspaceSwitcher?: boolean;
  workspaces?: StoredWorkspace[];
}

export function FilesPanel({
  workspace,
  workspaces = [],
  onSelectWorkspace,
  onSelectMegaloVersion,
  onAddWorkspace,
  onEditWorkspace,
  onDeleteWorkspace,
  workspaceSwitcher = false,
  onOpenSource,
  onFileDeleted,
  onFileRenamed,
  activeFileName,
  objectListNames = [],
  onWorkspaceObjectListsChange,
  onMissingObjectListNamesChange,
  onClearEditor,
  opfsRevision,
  localDiskRevision,
}: Props) {
  const t = useT();
  const [renamingPathKey, setRenamingPathKey] = useState<string | null>(null);

  const localRootPath =
    workspace?.type === "tauri" ? workspace.inputPath : null;
  // Stable identity: the watcher and every disk callback depend on it, so a
  // new object per render would re-subscribe the file watcher each render.
  const localRoot = useMemo(
    () => (localRootPath ? { path: localRootPath } : null),
    [localRootPath]
  );
  const outputPath =
    workspace?.type === "tauri" && workspace.outputPath?.trim()
      ? workspace.outputPath.trim()
      : null;
  const megaloVersion = workspace?.megaloVersion ?? DEFAULT_MEGALO_VERSION;
  const storedWorkspace = workspaces.find(
    (entry) => entry.id === workspace?.id
  );
  const editWorkspace =
    onEditWorkspace && storedWorkspace
      ? () => onEditWorkspace(storedWorkspace)
      : undefined;

  const {
    ensureExpandedKeys,
    localDiskAvailable,
    localError,
    localTree,
    refreshLocal,
    rootError,
    setEnsureExpandedKeys,
    setLocalError,
    tauriAvailable,
  } = useLocalDiskRefresh({
    localDiskRevision,
    localRootPath,
    objectListNames,
    onMissingObjectListNamesChange,
    onWorkspaceObjectListsChange,
  });

  const opfsOps = useOpfsFileOps({
    megaloVersion,
    objectListNames,
    onFileDeleted,
    onFileRenamed,
    onOpenSource,
    opfsRevision,
    setEnsureExpandedKeys,
    setRenamingPathKey,
    tauriAvailable,
  });

  const diskOps = useDiskFileOps({
    activeFileName,
    localRoot,
    localRootPath,
    localTree,
    megaloVersion,
    onFileDeleted,
    onFileRenamed,
    onOpenSource,
    outputPath,
    refreshLocal,
    setEnsureExpandedKeys,
    setLocalError,
    setRenamingPathKey,
    tauriAvailable,
  });

  const {
    buildOutputs,
    buildsError,
    outputError,
    refreshBuilds,
    setBuildsError,
  } = useBuildOutputs(outputPath, localDiskRevision);

  const contextMenu = useFilesPanelContextMenu({
    diskOps,
    localRoot,
    localTree,
    opfsOps,
    outputPath,
    refreshBuilds,
    setBuildsError,
    setLocalError,
    setRenamingPathKey,
    tauriAvailable,
  });

  useEffect(() => {
    const next = [
      ...flattenSourceFileNodes(localTree).map((node) => {
        const dir = node.path.slice(0, -1);
        return {
          id: `local:${pathKey(node.path)}`,
          label: node.name,
          description:
            dir.length > 0
              ? formatLocalDiskPath(dir)
              : (workspace?.name ?? "Workspace"),
          open: () => void diskOps.openLocalFile(node.path),
        };
      }),
      ...flattenSourceFileNodes(opfsOps.browserTree).map((node) => ({
        id: `browser:${pathKey(node.path)}`,
        label: node.name,
        description: isObjectListsPath(node.path)
          ? t("files_object_lists")
          : t("files_browser_saves"),
        open: () => opfsOps.openBrowserTreeFile(node.path),
      })),
    ];
    setSourceFileQuickOpenEntries(next);
    return () => setSourceFileQuickOpenEntries([]);
  }, [
    diskOps.openLocalFile,
    localTree,
    opfsOps.browserTree,
    opfsOps.openBrowserTreeFile,
    t,
    workspace?.name,
  ]);

  const { pendingDelete } = contextMenu;

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: drop zone for files dragged in from the OS; the New File buttons are the keyboard path.
    <section
      aria-label={t("files_aria_label")}
      className={`files-panel${opfsOps.dragActive ? " files-panel--drag" : ""}`}
      onDragLeave={(event) => {
        if (
          isMegacrowTreeDragActive() ||
          Array.from(event.dataTransfer.types).includes(MEGACROW_TREE_PATH_MIME)
        ) {
          return;
        }
        opfsOps.setDragActive(false);
      }}
      onDragOver={(event) => {
        if (
          isMegacrowTreeDragActive() ||
          Array.from(event.dataTransfer.types).includes(MEGACROW_TREE_PATH_MIME)
        ) {
          return;
        }
        event.preventDefault();
        opfsOps.setDragActive(true);
      }}
      onDrop={(event) => {
        if (
          isMegacrowTreeDragActive() ||
          Array.from(event.dataTransfer.types).includes(MEGACROW_TREE_PATH_MIME)
        ) {
          return;
        }
        event.preventDefault();
        opfsOps.setDragActive(false);
        opfsOps.handleDroppedFiles(event.dataTransfer.files);
      }}
    >
      <FilesPanelHeader
        onAddWorkspace={onAddWorkspace}
        onDeleteWorkspace={onDeleteWorkspace}
        onEditWorkspace={onEditWorkspace}
        onSelectMegaloVersion={onSelectMegaloVersion}
        onSelectWorkspace={onSelectWorkspace}
        workspace={workspace}
        workspaceSwitcher={workspaceSwitcher}
        workspaces={workspaces}
      />

      <div className="files-panel-body">
        {opfsOps.opfsAvailable ? (
          <OpfsFilesSection
            activeFileName={activeFileName}
            browserTree={opfsOps.browserTree}
            ensureExpandedKeys={ensureExpandedKeys}
            megaloVersion={megaloVersion}
            objectListNames={objectListNames}
            onBeginRename={(path) => setRenamingPathKey(pathKey(path))}
            onCancelRename={() => setRenamingPathKey(null)}
            onCommitRename={(fromName, newName) =>
              void opfsOps.commitOpfsRename(fromName, newName)
            }
            onContextMenu={(event, name) =>
              contextMenu.openContextMenu(
                opfsOps.onOpfsContextMenu(event, name)
              )
            }
            onCreateFile={() => void opfsOps.createOpfsFile()}
            onOpenFile={opfsOps.openBrowserTreeFile}
            opfsError={opfsOps.opfsError}
            opfsFileCount={opfsOps.opfsFiles.length}
            renamingPathKey={renamingPathKey}
          />
        ) : null}

        {localDiskAvailable ? (
          <LocalDiskSection
            activeFileName={activeFileName}
            canRegenerateObjectLists={diskOps.canRegenerateObjectLists}
            ensureExpandedKeys={ensureExpandedKeys}
            localError={localError}
            localRoot={localRoot}
            localRootPath={localRootPath}
            localTree={localTree}
            objectListNames={objectListNames}
            onAddWorkspace={onAddWorkspace}
            onBeginRename={(path) => setRenamingPathKey(pathKey(path))}
            onCancelRename={() => setRenamingPathKey(null)}
            onCommitRename={(path, name) =>
              void diskOps.commitRename(path, name)
            }
            onContextMenu={(event, target, selectedTargets) =>
              contextMenu.openContextMenu(
                diskOps.onTreeContextMenu(event, target, selectedTargets)
              )
            }
            onCreateFile={() => void diskOps.createLocalFile([])}
            onCreateFolder={() => void diskOps.createLocalFolder([])}
            onEditWorkspace={editWorkspace}
            onMoveEntries={(fromPaths, toParentPath) =>
              void diskOps.moveLocalEntries(fromPaths, toParentPath)
            }
            onOpenFile={(path) => void diskOps.openLocalFile(path)}
            onRegenerateObjectLists={diskOps.requestRegenerateObjectLists}
            renamingPathKey={renamingPathKey}
            rootError={rootError}
            workspaceId={workspace?.id}
          />
        ) : null}

        {outputPath ? (
          <BuildsPane
            buildOutputs={buildOutputs}
            buildsError={buildsError}
            editWorkspace={editWorkspace}
            onClearEditor={onClearEditor}
            onContextMenu={(event, name) => {
              event.preventDefault();
              contextMenu.openContextMenu({
                x: event.clientX,
                y: event.clientY,
                source: "builds",
                target: { type: "file", path: [name] },
              });
            }}
            outputError={outputError}
            outputPath={outputPath}
          />
        ) : null}

        {opfsOps.opfsAvailable || localDiskAvailable ? null : (
          <div className="files-empty">
            <p>{t("files_no_file_sources")}</p>
            <span>{t("files_drop_gametype_hint")}</span>
          </div>
        )}
      </div>

      <FilesContextMenu {...contextMenu.contextMenuProps} />

      <ConfirmDeleteDialog
        count={pendingDelete?.targets.length ?? 1}
        name={
          pendingDelete
            ? (pendingDelete.targets[0]?.path.at(-1) ??
              formatLocalDiskPath(pendingDelete.targets[0]?.path ?? []))
            : ""
        }
        onCancel={contextMenu.handleCancelDelete}
        onConfirm={contextMenu.handleConfirmDelete}
        open={pendingDelete !== null}
        targetKind={
          pendingDelete && pendingDelete.targets.length > 1
            ? "mixed"
            : (pendingDelete?.targets[0]?.type ?? "file")
        }
      />

      <ConfirmRegenerateObjectListsDialog
        onCancel={diskOps.cancelRegenerateObjectLists}
        onConfirm={diskOps.confirmRegenerateObjectLists}
        open={diskOps.pendingRegenerateObjectLists}
      />

      <ConfirmReplaceDialog
        name={diskOps.pendingReplace?.displayName ?? ""}
        onCancel={diskOps.cancelReplace}
        onConfirm={diskOps.confirmReplace}
        open={diskOps.pendingReplace !== null}
        targetKind={diskOps.pendingReplace?.targetKind ?? "file"}
      />
    </section>
  );
}

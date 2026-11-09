import type { MouseEvent } from "react";
import type { LocalDiskNode, LocalDiskRoot } from "../../files";
import { tauriFolderLabelFromRoot } from "../../files";
import { useT } from "../../localization";
import { findLocalDiskNode } from "../../workspace";
import { countFiles } from "./countFiles";
import { NewFileGlyph, NewFolderGlyph } from "./FilesGlyphs";
import { FolderErrorCard } from "./FolderErrorCard";
import { LocalDiskTree } from "./LocalDiskTree";
import type { FilesContextTarget } from "./useFilesPanelContextMenu";

interface Props {
  activeFileName: string | null;
  canRegenerateObjectLists: boolean;
  ensureExpandedKeys: readonly string[];
  localError: string | null;
  localRoot: LocalDiskRoot | null;
  localRootPath: string | null;
  localTree: LocalDiskNode[];
  objectListNames: readonly string[];
  onAddWorkspace?: () => void;
  onBeginRename: (path: string[]) => void;
  onCancelRename: () => void;
  onCommitRename: (path: string[], name: string) => void;
  onContextMenu: (
    event: MouseEvent,
    target: { type: "file" | "directory"; path: string[]; virtual?: boolean },
    selectedTargets: FilesContextTarget[]
  ) => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onEditWorkspace?: () => void;
  onMoveEntries: (fromPaths: string[][], toParentPath: string[]) => void;
  onOpenFile: (path: string[]) => void;
  onRegenerateObjectLists: () => void;
  renamingPathKey: string | null;
  rootError: string | null;
  workspaceId?: string;
}

export function LocalDiskSection({
  activeFileName,
  canRegenerateObjectLists,
  ensureExpandedKeys,
  localError,
  localRoot,
  localTree,
  objectListNames,
  onAddWorkspace,
  onBeginRename,
  onCancelRename,
  onCommitRename,
  onContextMenu,
  onCreateFile,
  onCreateFolder,
  onEditWorkspace,
  onMoveEntries,
  onOpenFile,
  onRegenerateObjectLists,
  renamingPathKey,
  rootError,
  workspaceId,
  localRootPath,
}: Props) {
  const t = useT();

  return (
    <div className="files-section files-section--scripts">
      {localRoot ? (
        <div className="files-section-label">
          <span>{`${tauriFolderLabelFromRoot(localRoot)}/`}</span>
          <div className="files-section-label-end">
            {localTree.length > 0 ? (
              <span className="files-section-count">
                {t("files_count", { count: countFiles(localTree) })}
              </span>
            ) : null}
            {rootError ? null : (
              <>
                <button
                  aria-label={t("files_new_file")}
                  className="files-panel-icon-action"
                  onClick={onCreateFile}
                  title={t("files_new_file")}
                  type="button"
                >
                  <NewFileGlyph />
                </button>
                <button
                  aria-label={t("files_new_folder")}
                  className="files-panel-icon-action"
                  onClick={onCreateFolder}
                  title={t("files_new_folder")}
                  type="button"
                >
                  <NewFolderGlyph />
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      <div className="files-section-scroll">
        {localRoot && rootError ? (
          <FolderErrorCard
            error={rootError}
            onEditWorkspace={onEditWorkspace}
            path={localRoot.path}
            title={t("files_workspace_unreadable")}
          />
        ) : localRoot ? (
          <>
            {localError ? (
              <p className="files-hint files-hint--error">{localError}</p>
            ) : null}
            {localTree.length === 0 ? (
              <div className="files-empty">
                <p>{t("files_no_megalo_scripts")}</p>
                <span>{t("files_add_txt_or_new_file")}</span>
              </div>
            ) : (
              <LocalDiskTree
                activeFileName={activeFileName}
                ensureExpandedKeys={ensureExpandedKeys}
                key={workspaceId ?? localRootPath ?? "local"}
                nodes={localTree}
                objectListNames={objectListNames}
                onBeginRename={(path) => {
                  const node = findLocalDiskNode(localTree, path);
                  if (node?.virtual) {
                    return;
                  }
                  onBeginRename(path);
                }}
                onCancelRename={onCancelRename}
                onCommitRename={(path, name) => onCommitRename(path, name)}
                onContextMenu={onContextMenu}
                onMoveEntries={onMoveEntries}
                onOpenFile={onOpenFile}
                onRegenerateObjectLists={
                  canRegenerateObjectLists ? onRegenerateObjectLists : undefined
                }
                renamingPathKey={renamingPathKey}
                treeLabel={t("files_explorer_title")}
              />
            )}
          </>
        ) : (
          <div className="files-empty">
            <p>{t("files_no_workspace")}</p>
            <span>
              {onAddWorkspace
                ? t("files_add_workspace_hint")
                : t("files_select_workspace_hint")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

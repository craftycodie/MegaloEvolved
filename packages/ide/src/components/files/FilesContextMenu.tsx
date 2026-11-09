import { createPortal } from "react-dom";
import { fileManagerRevealLabel } from "../../desktop";
import { useT } from "../../localization";
import { useContextMenuPosition } from "../../ui/useContextMenuPosition";
import type {
  FilesContextMenuState,
  FilesContextSource,
  FilesContextTarget,
} from "./useFilesPanelContextMenu";

export type { FilesContextSource, FilesContextTarget };

interface Props {
  canPaste: boolean;
  menu: FilesContextMenuState | null;
  onClose: () => void;
  onCopy: (path: string[], source: FilesContextSource) => void;
  onCopyPath: (paths: string[][], source: FilesContextSource) => void;
  onDelete: (targets: FilesContextTarget[], source: FilesContextSource) => void;
  onNewFile: (parentPath: string[], source: FilesContextSource) => void;
  onNewFolder?: (parentPath: string[], source: FilesContextSource) => void;
  onPaste: (target: FilesContextTarget, source: FilesContextSource) => void;
  onRename: (path: string[], source: FilesContextSource) => void;
  onReveal?: (path: string[], source: FilesContextSource) => void;
}

const MENU_MIN_WIDTH = 160;

export function FilesContextMenu({
  menu,
  canPaste,
  onClose,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
  onCopy,
  onPaste,
  onCopyPath,
  onReveal,
}: Props) {
  const t = useT();
  const { onKeyDown, panelRef } = useContextMenuPosition(menu, onClose);
  const revealLabel = fileManagerRevealLabel();

  if (!menu) {
    return null;
  }

  const isFile = menu.target.type === "file";
  const isVirtual = menu.target.virtual === true;
  const { source } = menu;
  const selectedTargets = menu.selectedTargets ?? [menu.target];
  const multiSelect = selectedTargets.length > 1;
  const canReveal =
    onReveal !== undefined &&
    !isVirtual &&
    !multiSelect &&
    (source === "local" || source === "builds");
  const canRename =
    !(multiSelect || isVirtual) &&
    source !== "builds" &&
    (isFile || source === "local");
  const canDelete =
    selectedTargets.some((target) => !target.virtual) &&
    (source === "local" || source === "builds" || isFile);
  const canCopy = !multiSelect && isFile && source !== "builds" && !isVirtual;
  const showNewActions =
    !multiSelect && menu.target.type === "directory" && source === "local";
  const deleteTargets = selectedTargets.filter((target) => !target.virtual);

  return createPortal(
    <div
      className="files-context-menu"
      onKeyDown={onKeyDown}
      ref={panelRef}
      role="menu"
      style={{
        position: "fixed",
        left: menu.x,
        top: menu.y,
        minWidth: MENU_MIN_WIDTH,
      }}
    >
      {showNewActions ? (
        <>
          <button
            className="files-context-menu-item"
            onClick={() => {
              onNewFile(menu.target.path, source);
              onClose();
            }}
            role="menuitem"
            type="button"
          >
            {t("context_new_file")}
          </button>
          {onNewFolder ? (
            <button
              className="files-context-menu-item"
              onClick={() => {
                onNewFolder(menu.target.path, source);
                onClose();
              }}
              role="menuitem"
              type="button"
            >
              {t("context_new_folder")}
            </button>
          ) : null}
        </>
      ) : null}
      {canCopy ? (
        <button
          className="files-context-menu-item"
          onClick={() => {
            onCopy(menu.target.path, source);
            onClose();
          }}
          role="menuitem"
          type="button"
        >
          {t("common_copy")}
        </button>
      ) : null}
      {canPaste && source !== "builds" ? (
        <button
          className="files-context-menu-item"
          onClick={() => {
            onPaste(menu.target, source);
            onClose();
          }}
          role="menuitem"
          type="button"
        >
          {t("common_paste")}
        </button>
      ) : null}
      {canRename ? (
        <button
          className="files-context-menu-item"
          onClick={() => {
            onRename(menu.target.path, source);
            onClose();
          }}
          role="menuitem"
          type="button"
        >
          {t("common_rename")}
        </button>
      ) : null}
      <button
        className="files-context-menu-item"
        onClick={() => {
          onCopyPath(
            selectedTargets.map((target) => target.path),
            source
          );
          onClose();
        }}
        role="menuitem"
        type="button"
      >
        {multiSelect ? t("context_copy_paths") : t("context_copy_path")}
      </button>
      {canReveal ? (
        <button
          className="files-context-menu-item"
          onClick={() => {
            onReveal(menu.target.path, source);
            onClose();
          }}
          role="menuitem"
          type="button"
        >
          {revealLabel}
        </button>
      ) : null}
      {canDelete && deleteTargets.length > 0 ? (
        <button
          className="files-context-menu-item files-context-menu-item--danger"
          onClick={() => {
            onDelete(deleteTargets, source);
            onClose();
          }}
          role="menuitem"
          type="button"
        >
          {deleteTargets.length > 1
            ? t("context_delete_n_items", { count: deleteTargets.length })
            : t("common_delete")}
        </button>
      ) : null}
    </div>,
    document.body
  );
}

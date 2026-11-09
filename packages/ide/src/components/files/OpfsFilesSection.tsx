import type { MegaloVersionId } from "@megacrow/megalo";
import type { MouseEvent } from "react";
import type { LocalDiskNode } from "../../files";
import { isObjectListsPath } from "../../gametype";
import { useT } from "../../localization";
import { findLocalDiskNode } from "../../workspace";
import { NewFileGlyph } from "./FilesGlyphs";
import { LocalDiskTree } from "./LocalDiskTree";

interface Props {
  activeFileName: string | null;
  browserTree: LocalDiskNode[];
  ensureExpandedKeys: readonly string[];
  megaloVersion: MegaloVersionId;
  objectListNames: readonly string[];
  onBeginRename: (path: string[]) => void;
  onCancelRename: () => void;
  onCommitRename: (fromName: string, newName: string) => void;
  onContextMenu: (event: MouseEvent, name: string) => void;
  onCreateFile: () => void;
  onOpenFile: (path: string[]) => void;
  opfsError: string | null;
  opfsFileCount: number;
  renamingPathKey: string | null;
}

export function OpfsFilesSection({
  activeFileName,
  browserTree,
  ensureExpandedKeys,
  megaloVersion,
  objectListNames,
  onBeginRename,
  onCancelRename,
  onCommitRename,
  onContextMenu,
  onCreateFile,
  onOpenFile,
  opfsError,
  opfsFileCount,
  renamingPathKey,
}: Props) {
  const t = useT();

  return (
    <div className="files-section">
      <div className="files-section-label">
        <span>{t("files_browser_saves")}</span>
        <div className="files-section-label-end">
          {opfsFileCount > 0 ? (
            <span className="files-section-count">
              {t("files_count", { count: opfsFileCount })}
            </span>
          ) : null}
          <button
            aria-label={t("files_new_file")}
            className="files-panel-icon-action"
            onClick={onCreateFile}
            title={t("files_new_file")}
            type="button"
          >
            <NewFileGlyph />
          </button>
        </div>
      </div>
      <div className="files-section-scroll">
        {opfsError ? (
          <p className="files-hint files-hint--error">{opfsError}</p>
        ) : null}
        {browserTree.length === 0 && !opfsError ? (
          <div className="files-empty">
            <p>{t("files_no_saved_files")}</p>
            <span>{t("files_use_new_file_hint")}</span>
          </div>
        ) : browserTree.length > 0 ? (
          <LocalDiskTree
            activeFileName={activeFileName}
            ensureExpandedKeys={ensureExpandedKeys}
            key={`browser-${megaloVersion}`}
            nodes={browserTree}
            objectListNames={objectListNames}
            onBeginRename={(path) => {
              const node = findLocalDiskNode(browserTree, path);
              if (node?.virtual || isObjectListsPath(path)) {
                return;
              }
              onBeginRename(path);
            }}
            onCancelRename={onCancelRename}
            onCommitRename={(path, name) => {
              const fromName = path.at(-1);
              if (!fromName || isObjectListsPath(path)) {
                onCancelRename();
                return;
              }
              onCommitRename(fromName, name);
            }}
            onContextMenu={(event, target) => {
              if (target.virtual || isObjectListsPath(target.path)) {
                event.preventDefault();
                return;
              }
              const name = target.path.at(-1);
              if (name) {
                onContextMenu(event, name);
              }
            }}
            onOpenFile={onOpenFile}
            renamingPathKey={renamingPathKey}
            treeLabel={t("files_browser_saves")}
          />
        ) : null}
      </div>
    </div>
  );
}

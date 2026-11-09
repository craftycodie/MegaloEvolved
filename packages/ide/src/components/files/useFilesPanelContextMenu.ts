import { useCallback, useState } from "react";
import { revealInFileManager, writeClipboardText } from "../../desktop";
import {
  deleteTauriMegaloFile,
  type FileClipboardPayload,
  type LocalDiskNode,
  type LocalDiskRoot,
  pathKey,
  readFileClipboard,
  resolveTauriMegaloFilePath,
  writeFileClipboard,
} from "../../files";
import { isObjectListsPath } from "../../gametype";
import { findLocalDiskNode } from "../../workspace";
import { fileErrorMessage } from "./fileErrorMessage";
import type { useDiskFileOps } from "./useDiskFileOps";
import type { useOpfsFileOps } from "./useOpfsFileOps";

export type FilesContextTarget =
  | { type: "file"; path: string[]; virtual?: boolean }
  | { type: "directory"; path: string[]; virtual?: boolean };

export type FilesContextSource = "local" | "opfs" | "builds";

export interface FilesContextMenuState {
  selectedTargets?: FilesContextTarget[];
  source: FilesContextSource;
  target: FilesContextTarget;
  x: number;
  y: number;
}

type OpfsOps = ReturnType<typeof useOpfsFileOps>;
type DiskOps = ReturnType<typeof useDiskFileOps>;

export interface PendingDelete {
  /** Deletes the entries once the user confirms. */
  run: () => Promise<void>;
  targets: FilesContextTarget[];
}

interface Options {
  diskOps: DiskOps;
  localRoot: LocalDiskRoot | null;
  localTree: LocalDiskNode[];
  opfsOps: OpfsOps;
  outputPath: string | null;
  refreshBuilds: () => Promise<void>;
  setBuildsError: (error: string | null) => void;
  setLocalError: (error: string | null) => void;
  setRenamingPathKey: (key: string | null) => void;
  tauriAvailable: boolean;
}

export function useFilesPanelContextMenu({
  opfsOps,
  diskOps,
  localRoot,
  localTree,
  outputPath,
  refreshBuilds,
  setBuildsError,
  setLocalError,
  setRenamingPathKey,
  tauriAvailable,
}: Options) {
  const [contextMenu, setContextMenu] = useState<FilesContextMenuState | null>(
    null
  );
  /** Entries waiting for the delete confirmation, from any of the trees. */
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null
  );
  const [pastePayload, setPastePayload] = useState<FileClipboardPayload | null>(
    null
  );

  const refreshPasteFromClipboard = useCallback(() => {
    void readFileClipboard().then(setPastePayload);
  }, []);

  const openContextMenu = useCallback(
    (menu: FilesContextMenuState) => {
      setPastePayload(null);
      setContextMenu(menu);
      refreshPasteFromClipboard();
    },
    [refreshPasteFromClipboard]
  );

  const resolveContextAbsolutePath = useCallback(
    async (
      path: string[],
      source: FilesContextSource
    ): Promise<string | null> => {
      if (source === "builds") {
        if (!outputPath) {
          return null;
        }
        return resolveTauriMegaloFilePath({ path: outputPath }, path);
      }
      if (source === "local") {
        return diskOps.resolveContextAbsolutePath(path);
      }
      return null;
    },
    [diskOps, outputPath]
  );

  const deleteBuildOutputs = useCallback(
    async (paths: string[][]) => {
      if (!outputPath) {
        return;
      }
      try {
        setBuildsError(null);
        for (const path of paths) {
          await deleteTauriMegaloFile({ path: outputPath }, path);
        }
        await refreshBuilds();
      } catch (error) {
        setBuildsError(fileErrorMessage(error));
      }
    },
    [outputPath, refreshBuilds, setBuildsError]
  );

  const handleConfirmDelete = useCallback(() => {
    const pending = pendingDelete;
    setPendingDelete(null);
    void pending?.run();
  }, [pendingDelete]);

  const handleCancelDelete = useCallback(() => {
    setPendingDelete(null);
  }, []);

  const contextMenuProps = {
    canPaste:
      pastePayload !== null &&
      contextMenu !== null &&
      pastePayload.source === contextMenu.source,
    menu: contextMenu,
    onClose: () => {
      setContextMenu(null);
      setPastePayload(null);
    },
    onCopy: (path: string[], source: FilesContextSource) => {
      void (async () => {
        try {
          if (source === "opfs") {
            const name = path[0];
            if (!name) {
              return;
            }
            const payload = { source: "opfs" as const, name };
            await writeFileClipboard(payload);
            setPastePayload(payload);
            return;
          }
          if (source === "builds") {
            return;
          }
          if (!localRoot) {
            return;
          }
          const payload = { source: "local" as const, path: [...path] };
          const absolute = await resolveTauriMegaloFilePath(localRoot, path);
          await writeFileClipboard(payload, { absolutePaths: [absolute] });
          setPastePayload(payload);
        } catch (error) {
          if (source === "opfs") {
            opfsOps.setOpfsError(fileErrorMessage(error));
          } else if (source === "builds") {
            setBuildsError(fileErrorMessage(error));
          } else {
            setLocalError(fileErrorMessage(error));
          }
        }
      })();
    },
    onCopyPath: (paths: string[][], source: FilesContextSource) => {
      if (source === "opfs") {
        const name = paths[0]?.[0];
        if (name) {
          void opfsOps.copyOpfsPath(name);
        }
        return;
      }
      void (async () => {
        try {
          const absolutes: string[] = [];
          for (const path of paths) {
            const absolute = await resolveContextAbsolutePath(path, source);
            if (absolute) {
              absolutes.push(absolute);
            }
          }
          if (absolutes.length === 0) {
            return;
          }
          await writeClipboardText(absolutes.join("\n"));
        } catch (error) {
          if (source === "builds") {
            setBuildsError(fileErrorMessage(error));
          } else {
            setLocalError(fileErrorMessage(error));
          }
        }
      })();
    },
    onDelete: (targets: FilesContextTarget[], source: FilesContextSource) => {
      const deletable = targets.filter((target) => !target.virtual);
      if (deletable.length === 0) {
        return;
      }
      const paths = deletable.map((target) => target.path);
      if (source === "opfs") {
        // Browser storage deletes one file at a time.
        const name = paths[0]?.[0];
        if (name) {
          setPendingDelete({
            run: () => opfsOps.deleteOpfsFile(name),
            targets: deletable.slice(0, 1),
          });
        }
        return;
      }
      setPendingDelete({
        run: () =>
          source === "builds"
            ? deleteBuildOutputs(paths)
            : diskOps.deleteLocalFiles(paths),
        targets: deletable,
      });
    },
    onNewFile: (parentPath: string[], source: FilesContextSource) => {
      if (source === "local") {
        void diskOps.createLocalFile(parentPath);
      }
    },
    onNewFolder: (parentPath: string[], source: FilesContextSource) => {
      if (source === "local") {
        void diskOps.createLocalFolder(parentPath);
      }
    },
    onPaste: (target: FilesContextTarget, source: FilesContextSource) => {
      const payloadSnapshot = pastePayload;
      void (async () => {
        const payload = (await readFileClipboard()) ?? payloadSnapshot;
        if (!payload || payload.source !== source) {
          return;
        }
        if (source === "opfs") {
          await opfsOps.pasteOpfsFile(payload);
          return;
        }
        const parent =
          target.type === "directory" ? target.path : target.path.slice(0, -1);
        await diskOps.pasteLocalFile(parent, payload);
      })();
    },
    onRename: (path: string[], source: FilesContextSource) => {
      if (source === "opfs") {
        if (isObjectListsPath(path)) {
          return;
        }
        setRenamingPathKey(pathKey(path));
        return;
      }
      if (source === "builds") {
        return;
      }
      const node = findLocalDiskNode(localTree, path);
      if (node?.virtual) {
        return;
      }
      setRenamingPathKey(pathKey(path));
    },
    onReveal: tauriAvailable
      ? (path: string[], source: FilesContextSource) => {
          void (async () => {
            try {
              const absolute = await resolveContextAbsolutePath(path, source);
              if (!absolute) {
                return;
              }
              await revealInFileManager(absolute);
            } catch (error) {
              if (source === "builds") {
                setBuildsError(fileErrorMessage(error));
              } else {
                setLocalError(fileErrorMessage(error));
              }
            }
          })();
        }
      : undefined,
  };

  return {
    contextMenuProps,
    handleCancelDelete,
    handleConfirmDelete,
    openContextMenu,
    pendingDelete,
  };
}

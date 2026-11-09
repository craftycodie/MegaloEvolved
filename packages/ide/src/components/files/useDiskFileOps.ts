import type { MegaloVersionId } from "@megacrow/megalo";
import {
  type Dispatch,
  type MouseEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
} from "react";
import type { MegaloIncludeRoot } from "../../compile";
import { regenerateObjectListsWithTool } from "../../desktop";
import {
  createTauriMegaloDirectory,
  createTauriMegaloTextFile,
  deleteTauriMegaloFile,
  duplicateTauriMegaloFile,
  type FileClipboardPayload,
  formatLocalDiskPath,
  type LocalDiskNode,
  type LocalDiskRoot,
  moveTauriMegaloEntry,
  pathKey,
  readTauriMegaloFile,
  renameTauriMegaloFile,
  resolveTauriMegaloFilePath,
} from "../../files";
import { isObjectListsPath } from "../../gametype";
import {
  canRegenerateObjectListsWithTool,
  defaultObjectListText,
  findLocalDiskNode,
  getEditingKitRoot,
} from "../../workspace";
import { fileErrorMessage } from "./fileErrorMessage";
import { pruneNestedPaths } from "./treeUtils";
import type {
  FilesContextMenuState,
  FilesContextTarget,
} from "./useFilesPanelContextMenu";

interface PendingReplace {
  displayName: string;
  fromPath: string[];
  remaining: string[][];
  targetKind: "file" | "directory";
  toParentPath: string[];
}

interface Options {
  activeFileName: string | null;
  localRoot: LocalDiskRoot | null;
  localRootPath: string | null;
  localTree: LocalDiskNode[];
  megaloVersion: MegaloVersionId;
  onFileDeleted: (name: string) => void;
  onFileRenamed: (
    oldName: string,
    newName: string,
    absoluteFilePath: string
  ) => void;
  onOpenSource: (
    source: string,
    name: string,
    includeRoot?: MegaloIncludeRoot
  ) => void;
  outputPath: string | null;
  refreshLocal: () => Promise<void>;
  setEnsureExpandedKeys: Dispatch<SetStateAction<string[]>>;
  setLocalError: (error: string | null) => void;
  setRenamingPathKey: (key: string | null) => void;
  tauriAvailable: boolean;
}

export function useDiskFileOps({
  activeFileName,
  localRoot,
  localRootPath,
  localTree,
  megaloVersion,
  onOpenSource,
  onFileDeleted,
  onFileRenamed,
  outputPath,
  refreshLocal,
  setEnsureExpandedKeys,
  setLocalError,
  setRenamingPathKey,
  tauriAvailable,
}: Options) {
  const [pendingReplace, setPendingReplace] = useState<PendingReplace | null>(
    null
  );
  const [pendingRegenerateObjectLists, setPendingRegenerateObjectLists] =
    useState(false);
  const [editingKitRoot, setEditingKitRoot] = useState<string | undefined>();
  const [canRegenerateObjectLists, setCanRegenerateObjectLists] =
    useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!(tauriAvailable && localRootPath && outputPath)) {
      setEditingKitRoot(undefined);
      setCanRegenerateObjectLists(false);
      return;
    }
    void (async () => {
      const root = await getEditingKitRoot(localRootPath, outputPath);
      if (cancelled) {
        return;
      }
      setEditingKitRoot(root);
      if (!root) {
        setCanRegenerateObjectLists(false);
        return;
      }
      const can = await canRegenerateObjectListsWithTool(root);
      if (!cancelled) {
        setCanRegenerateObjectLists(can);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tauriAvailable, localRootPath, outputPath]);

  const openLocalFile = useCallback(
    async (path: string[]) => {
      if (!localRoot) {
        return;
      }
      try {
        setLocalError(null);
        const absoluteFilePath = await resolveTauriMegaloFilePath(
          localRoot,
          path
        );
        const node = findLocalDiskNode(localTree, path);
        let text: string;
        if (node?.virtual) {
          text = defaultObjectListText(node.name, megaloVersion);
        } else {
          text = await readTauriMegaloFile(localRoot, path);
        }
        onOpenSource(text, formatLocalDiskPath(path), { absoluteFilePath });
      } catch (error) {
        setLocalError(fileErrorMessage(error));
      }
    },
    [localRoot, localTree, megaloVersion, onOpenSource, setLocalError]
  );

  const createLocalFile = useCallback(
    async (parentSegments: string[] = []) => {
      if (!localRoot) {
        return;
      }
      try {
        setLocalError(null);
        const createdPath = await createTauriMegaloTextFile(
          localRoot,
          parentSegments
        );
        const expandKeys = parentSegments.map((_, index) =>
          pathKey(parentSegments.slice(0, index + 1))
        );
        setEnsureExpandedKeys(expandKeys);
        await refreshLocal();
        setRenamingPathKey(pathKey(createdPath));
        await openLocalFile(createdPath);
      } catch (error) {
        setLocalError(fileErrorMessage(error));
      }
    },
    [
      localRoot,
      openLocalFile,
      refreshLocal,
      setEnsureExpandedKeys,
      setLocalError,
      setRenamingPathKey,
    ]
  );

  const createLocalFolder = useCallback(
    async (parentSegments: string[] = []) => {
      if (!localRoot) {
        return;
      }
      try {
        setLocalError(null);
        const createdPath = await createTauriMegaloDirectory(
          localRoot,
          parentSegments
        );
        const expandKeys = [
          ...parentSegments.map((_, index) =>
            pathKey(parentSegments.slice(0, index + 1))
          ),
          pathKey(createdPath),
        ];
        setEnsureExpandedKeys(expandKeys);
        await refreshLocal();
        setRenamingPathKey(pathKey(createdPath));
      } catch (error) {
        setLocalError(fileErrorMessage(error));
      }
    },
    [
      localRoot,
      refreshLocal,
      setEnsureExpandedKeys,
      setLocalError,
      setRenamingPathKey,
    ]
  );

  const commitRename = useCallback(
    async (fromPath: string[], newName: string) => {
      if (!localRoot) {
        setRenamingPathKey(null);
        return;
      }
      const oldDisplay = formatLocalDiskPath(fromPath);
      try {
        setLocalError(null);
        const toPath = await renameTauriMegaloFile(
          localRoot,
          fromPath,
          newName
        );
        setRenamingPathKey(null);
        await refreshLocal();
        const newDisplay = formatLocalDiskPath(toPath);
        if (oldDisplay !== newDisplay) {
          const absoluteFilePath = await resolveTauriMegaloFilePath(
            localRoot,
            toPath
          );
          onFileRenamed(oldDisplay, newDisplay, absoluteFilePath);
        }
      } catch (error) {
        setLocalError(fileErrorMessage(error));
        setRenamingPathKey(null);
      }
    },
    [localRoot, onFileRenamed, refreshLocal, setLocalError, setRenamingPathKey]
  );

  const applyLocalMove = useCallback(
    async (
      fromPath: string[],
      toParentPath: string[],
      options?: { replace?: boolean }
    ): Promise<"moved" | "noop" | "needs_replace" | "error"> => {
      if (!localRoot) {
        return "error";
      }
      const oldDisplay = formatLocalDiskPath(fromPath);
      try {
        setLocalError(null);
        const result = await moveTauriMegaloEntry(
          localRoot,
          fromPath,
          toParentPath,
          options
        );
        if (result.status === "needs_replace") {
          return "needs_replace";
        }
        if (result.status === "noop") {
          return "noop";
        }
        const toPath = result.path;
        const expandKeys = toParentPath.map((_, index) =>
          pathKey(toParentPath.slice(0, index + 1))
        );
        setEnsureExpandedKeys(expandKeys);
        await refreshLocal();
        const newDisplay = formatLocalDiskPath(toPath);
        if (oldDisplay !== newDisplay) {
          const absoluteFilePath = await resolveTauriMegaloFilePath(
            localRoot,
            toPath
          );
          onFileRenamed(oldDisplay, newDisplay, absoluteFilePath);
        }
        return "moved";
      } catch (error) {
        setLocalError(fileErrorMessage(error));
        return "error";
      }
    },
    [
      localRoot,
      onFileRenamed,
      refreshLocal,
      setEnsureExpandedKeys,
      setLocalError,
    ]
  );

  const moveLocalEntries = useCallback(
    async (
      fromPaths: string[][],
      toParentPath: string[],
      options?: { replaceFirst?: boolean }
    ) => {
      const queue = pruneNestedPaths(fromPaths);
      let replaceNext = options?.replaceFirst === true;
      while (queue.length > 0) {
        const fromPath = queue.shift()!;
        const status = await applyLocalMove(fromPath, toParentPath, {
          replace: replaceNext,
        });
        replaceNext = false;
        if (status === "needs_replace") {
          const displayName = fromPath.at(-1) ?? formatLocalDiskPath(fromPath);
          const destPath = [...toParentPath, displayName];
          const destNode = findLocalDiskNode(localTree, destPath);
          setPendingReplace({
            fromPath,
            toParentPath,
            remaining: queue,
            displayName,
            targetKind: destNode?.type === "directory" ? "directory" : "file",
          });
          return;
        }
        if (status === "error") {
          return;
        }
      }
    },
    [applyLocalMove, localTree]
  );

  const deleteLocalFiles = useCallback(
    async (paths: string[][]) => {
      if (!localRoot) {
        return;
      }
      const pruned = pruneNestedPaths(paths);
      if (pruned.length === 0) {
        return;
      }
      try {
        setLocalError(null);
        for (const path of pruned) {
          const display = formatLocalDiskPath(path);
          await deleteTauriMegaloFile(localRoot, path);
          onFileDeleted(display);
        }
        setRenamingPathKey(null);
        await refreshLocal();
      } catch (error) {
        setLocalError(fileErrorMessage(error));
      }
    },
    [localRoot, onFileDeleted, refreshLocal, setLocalError, setRenamingPathKey]
  );

  const pasteLocalFile = useCallback(
    async (parentSegments: string[], payload: FileClipboardPayload) => {
      if (!localRoot || payload.source !== "local") {
        return;
      }
      try {
        setLocalError(null);
        const createdPath = await duplicateTauriMegaloFile(
          localRoot,
          payload.path,
          parentSegments
        );
        const expandKeys = parentSegments.map((_, index) =>
          pathKey(parentSegments.slice(0, index + 1))
        );
        setEnsureExpandedKeys(expandKeys);
        await refreshLocal();
        await openLocalFile(createdPath);
      } catch (error) {
        setLocalError(fileErrorMessage(error));
      }
    },
    [
      localRoot,
      openLocalFile,
      refreshLocal,
      setEnsureExpandedKeys,
      setLocalError,
    ]
  );

  const runRegenerateObjectLists = useCallback(async () => {
    if (!(localRoot && editingKitRoot)) {
      return;
    }
    try {
      setLocalError(null);
      const objectListsDir = await resolveTauriMegaloFilePath(localRoot, [
        "object_lists",
      ]);
      await regenerateObjectListsWithTool(editingKitRoot, objectListsDir);
      await refreshLocal();
      if (activeFileName && isObjectListsPath(activeFileName)) {
        const path = activeFileName
          .replace(/\\/g, "/")
          .split("/")
          .filter((segment) => segment.length > 0);
        if (path.length > 0) {
          const absoluteFilePath = await resolveTauriMegaloFilePath(
            localRoot,
            path
          );
          const text = await readTauriMegaloFile(localRoot, path);
          onOpenSource(text, formatLocalDiskPath(path), { absoluteFilePath });
        }
      }
    } catch (error) {
      setLocalError(fileErrorMessage(error));
    }
  }, [
    activeFileName,
    editingKitRoot,
    localRoot,
    onOpenSource,
    refreshLocal,
    setLocalError,
  ]);

  const confirmReplace = useCallback(() => {
    if (!pendingReplace) {
      return;
    }
    const { fromPath, toParentPath, remaining } = pendingReplace;
    setPendingReplace(null);
    void moveLocalEntries([fromPath, ...remaining], toParentPath, {
      replaceFirst: true,
    });
  }, [moveLocalEntries, pendingReplace]);

  const cancelReplace = useCallback(() => {
    setPendingReplace(null);
  }, []);

  const requestRegenerateObjectLists = useCallback(() => {
    setPendingRegenerateObjectLists(true);
  }, []);

  const confirmRegenerateObjectLists = useCallback(() => {
    setPendingRegenerateObjectLists(false);
    void runRegenerateObjectLists();
  }, [runRegenerateObjectLists]);

  const cancelRegenerateObjectLists = useCallback(() => {
    setPendingRegenerateObjectLists(false);
  }, []);

  const onTreeContextMenu = useCallback(
    (
      event: MouseEvent,
      target: { type: "file" | "directory"; path: string[]; virtual?: boolean },
      selectedTargets: FilesContextTarget[]
    ): FilesContextMenuState => ({
      x: event.clientX,
      y: event.clientY,
      source: "local",
      target,
      selectedTargets,
    }),
    []
  );

  const resolveContextAbsolutePath = useCallback(
    async (path: string[]): Promise<string | null> => {
      if (!localRoot) {
        return null;
      }
      return resolveTauriMegaloFilePath(localRoot, path);
    },
    [localRoot]
  );

  return {
    canRegenerateObjectLists,
    cancelRegenerateObjectLists,
    cancelReplace,
    commitRename,
    confirmRegenerateObjectLists,
    confirmReplace,
    createLocalFile,
    createLocalFolder,
    deleteLocalFiles,
    moveLocalEntries,
    onTreeContextMenu,
    openLocalFile,
    pasteLocalFile,
    pendingRegenerateObjectLists,
    pendingReplace,
    requestRegenerateObjectLists,
    resolveContextAbsolutePath,
  };
}

import type { ObjectLists } from "@megacrow/megalo";
import { useCallback, useEffect, useRef, useState } from "react";
import { isTauriRuntime } from "../../desktop";
import type { LocalDiskNode } from "../../files";
import {
  isTauriDiskSupported,
  type LocalDiskRoot,
  listTauriMegaloTree,
} from "../../files";
import { translateDiskError } from "../../localization";
import {
  loadWorkspaceObjectLists,
  objectListsFolderIsEmpty,
  watchWorkspaceInput,
} from "../../workspace";

interface UseLocalDiskRefreshOptions {
  localDiskRevision: number;
  localRoot: LocalDiskRoot | null;
  localRootPath: string | null;
  objectListNames: readonly string[];
  onMissingObjectListNamesChange?: (names: readonly string[]) => void;
  onWorkspaceObjectListsChange?: (lists: ObjectLists | null) => void;
}

export function useLocalDiskRefresh({
  localDiskRevision,
  localRoot,
  localRootPath,
  objectListNames,
  onMissingObjectListNamesChange,
  onWorkspaceObjectListsChange,
}: UseLocalDiskRefreshOptions) {
  const tauriAvailable = isTauriRuntime();
  const localDiskAvailable = isTauriDiskSupported();
  const [localTree, setLocalTree] = useState<LocalDiskNode[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  /** Set when the workspace input folder itself cannot be listed. */
  const [rootError, setRootError] = useState<string | null>(null);
  const [ensureExpandedKeys, setEnsureExpandedKeys] = useState<string[]>([]);
  const lastObjectListsJsonRef = useRef<string>("");
  const localRootPathRef = useRef<string | null>(null);
  localRootPathRef.current = localRootPath;

  const refreshLocal = useCallback(async () => {
    const rootPath = localRootPathRef.current;
    if (!rootPath) {
      setLocalTree([]);
      onWorkspaceObjectListsChange?.(null);
      onMissingObjectListNamesChange?.([]);
      lastObjectListsJsonRef.current = "";
      return;
    }
    let tree: LocalDiskNode[];
    let missingListNames: readonly string[];
    try {
      setLocalError(null);
      ({ nodes: tree, missingListNames } = await listTauriMegaloTree(
        rootPath,
        objectListNames
      ));
    } catch (error) {
      if (localRootPathRef.current !== rootPath) {
        return;
      }
      setRootError(translateDiskError(error));
      setLocalTree([]);
      onMissingObjectListNamesChange?.([]);
      return;
    }
    if (localRootPathRef.current !== rootPath) {
      return;
    }
    setRootError(null);
    try {
      setLocalTree(tree);
      onMissingObjectListNamesChange?.(missingListNames);
      if (objectListsFolderIsEmpty(tree)) {
        setEnsureExpandedKeys((keys) =>
          keys.includes("object_lists") ? keys : [...keys, "object_lists"]
        );
      }
      const lists = await loadWorkspaceObjectLists(rootPath, objectListNames);
      if (localRootPathRef.current !== rootPath) {
        return;
      }
      const listsJson = JSON.stringify(lists);
      if (listsJson !== lastObjectListsJsonRef.current) {
        lastObjectListsJsonRef.current = listsJson;
        onWorkspaceObjectListsChange?.(lists);
      }
    } catch (error) {
      if (localRootPathRef.current !== rootPath) {
        return;
      }
      setLocalError(translateDiskError(error));
      setLocalTree([]);
      onMissingObjectListNamesChange?.([]);
    }
  }, [
    objectListNames,
    onMissingObjectListNamesChange,
    onWorkspaceObjectListsChange,
  ]);

  useEffect(() => {
    setLocalTree([]);
    setLocalError(null);
    setRootError(null);
    setEnsureExpandedKeys([]);
    lastObjectListsJsonRef.current = "";
    if (!localRootPath) {
      onWorkspaceObjectListsChange?.(null);
      onMissingObjectListNamesChange?.([]);
    }
  }, [
    localRootPath,
    onMissingObjectListNamesChange,
    onWorkspaceObjectListsChange,
  ]);

  useEffect(() => {
    void refreshLocal();
  }, [refreshLocal, localDiskRevision, localRootPath]);

  useEffect(() => {
    if (!(tauriAvailable && localRoot)) {
      return;
    }

    let disposed = false;
    let unwatch: (() => void) | null = null;

    void (async () => {
      try {
        const stop = await watchWorkspaceInput(localRoot.path, () => {
          void refreshLocal();
        });
        unwatch = stop;
        if (disposed) {
          unwatch?.();
          unwatch = null;
        }
      } catch (error) {
        console.error("Failed to watch workspace input folder:", error);
      }
    })();

    return () => {
      disposed = true;
      unwatch?.();
      unwatch = null;
    };
  }, [tauriAvailable, localRoot, refreshLocal]);

  return {
    ensureExpandedKeys,
    localDiskAvailable,
    localError,
    localTree,
    refreshLocal,
    rootError,
    setEnsureExpandedKeys,
    setLocalError,
    tauriAvailable,
  };
}

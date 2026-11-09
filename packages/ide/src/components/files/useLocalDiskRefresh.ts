import type { ObjectLists } from "@megacrow/megalo";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { isTauriRuntime } from "../../desktop";
import type { LocalDiskNode } from "../../files";
import { listTauriMegaloTree } from "../../files";
import {
  loadWorkspaceObjectLists,
  objectListsFolderIsEmpty,
} from "../../workspace";
import { fileErrorMessage } from "./fileErrorMessage";
import { useWatchedListing } from "./useWatchedListing";

interface WorkspaceListing {
  missingListNames: readonly string[];
  /** Parsed object lists, or null when they could not be read. */
  objectLists: ObjectLists | null;
  /** Why the object lists could not be read (the tree is still shown). */
  objectListsError: string | null;
  tree: LocalDiskNode[];
}

const EMPTY_LISTING: WorkspaceListing = {
  missingListNames: [],
  objectLists: null,
  objectListsError: null,
  tree: [],
};

interface UseLocalDiskRefreshOptions {
  localDiskRevision: number;
  localRootPath: string | null;
  objectListNames: readonly string[];
  onMissingObjectListNamesChange?: (names: readonly string[]) => void;
  onWorkspaceObjectListsChange?: (lists: ObjectLists | null) => void;
}

/**
 * The desktop workspace folder as a tree, kept current by the folder watcher
 * and by `localDiskRevision`. Also publishes the workspace's object lists to
 * the compiler and which list files are missing.
 */
export function useLocalDiskRefresh({
  localDiskRevision,
  localRootPath,
  objectListNames,
  onMissingObjectListNamesChange,
  onWorkspaceObjectListsChange,
}: UseLocalDiskRefreshOptions) {
  const tauriAvailable = isTauriRuntime();
  /** Errors from file operations (rename, delete…); listing never clears it. */
  const [localError, setLocalError] = useState<string | null>(null);
  const [ensureExpandedKeys, setEnsureExpandedKeys] = useState<string[]>([]);
  // Another folder: drop the old one's errors and expanded folders. Done
  // while rendering (React's "adjust state when a prop changes" pattern) so
  // the new folder never renders with stale state.
  const [stateRootPath, setStateRootPath] = useState(localRootPath);
  if (stateRootPath !== localRootPath) {
    setStateRootPath(localRootPath);
    setLocalError(null);
    setEnsureExpandedKeys([]);
  }
  const lastObjectListsJsonRef = useRef("");

  const listing = useWatchedListing({
    empty: EMPTY_LISTING,
    list: async (rootPath): Promise<WorkspaceListing> => {
      const { nodes, missingListNames } = await listTauriMegaloTree(
        rootPath,
        objectListNames
      );
      try {
        return {
          missingListNames,
          objectLists: await loadWorkspaceObjectLists(
            rootPath,
            objectListNames
          ),
          objectListsError: null,
          tree: nodes,
        };
      } catch (error) {
        return {
          missingListNames,
          objectLists: null,
          objectListsError: fileErrorMessage(error),
          tree: nodes,
        };
      }
    },
    path: localRootPath,
    // Object list names decide which list files count as missing.
    refreshKey: `${localDiskRevision}:${objectListNames.join(",")}`,
    watch: tauriAvailable,
  });

  const publish = useEffectEvent((data: WorkspaceListing) => {
    onMissingObjectListNamesChange?.(data.missingListNames);
    const listsJson = JSON.stringify(data.objectLists);
    if (listsJson !== lastObjectListsJsonRef.current) {
      lastObjectListsJsonRef.current = listsJson;
      onWorkspaceObjectListsChange?.(data.objectLists);
    }
    if (objectListsFolderIsEmpty(data.tree)) {
      setEnsureExpandedKeys((keys) =>
        keys.includes("object_lists") ? keys : [...keys, "object_lists"]
      );
    }
  });

  // Push each new listing to the compiler (object lists) and the tray.
  useEffect(() => {
    publish(listing.data);
  }, [listing.data]);

  return {
    ensureExpandedKeys,
    localDiskAvailable: tauriAvailable,
    localError:
      localError ?? listing.data.objectListsError ?? listing.watchError,
    localTree: listing.data.tree,
    refreshLocal: listing.refresh,
    rootError: listing.listError,
    setEnsureExpandedKeys,
    setLocalError,
    tauriAvailable,
  };
}

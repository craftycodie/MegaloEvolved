import type { MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type LocalDiskNode, pathKey } from "../../files";
import {
  ancestorPathKeys,
  findFilePathByDisplayName,
  flattenVisibleNodes,
  parsePathKey,
  pruneSelection,
} from "./treeUtils";

interface Options {
  activeFileName: string | null;
  ensureExpandedKeys?: readonly string[];
  nodes: LocalDiskNode[];
  onOpenFile: (path: string[]) => void;
  suppressClickRef: React.MutableRefObject<boolean>;
}

export function useLocalDiskTreeSelection({
  activeFileName,
  ensureExpandedKeys = [],
  nodes,
  onOpenFile,
  suppressClickRef,
}: Options) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set()
  );
  const [storedSelectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  // Drop keys of entries that were deleted, renamed or moved, so multi-select
  // actions never target paths that no longer exist.
  const selectedKeys = useMemo(
    () => pruneSelection(storedSelectedKeys, nodes),
    [nodes, storedSelectedKeys]
  );
  const [selectionAnchorKey, setSelectionAnchorKey] = useState<string | null>(
    null
  );
  const selectedKeysRef = useRef(selectedKeys);
  selectedKeysRef.current = selectedKeys;
  const lastSyncedActiveFileRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeFileName) {
      lastSyncedActiveFileRef.current = null;
      return;
    }
    const path = findFilePathByDisplayName(nodes, activeFileName);
    if (!path) {
      if (lastSyncedActiveFileRef.current !== null) {
        lastSyncedActiveFileRef.current = null;
        setSelectedKeys(new Set());
        setSelectionAnchorKey(null);
      }
      return;
    }
    if (lastSyncedActiveFileRef.current === activeFileName) {
      return;
    }
    lastSyncedActiveFileRef.current = activeFileName;
    const key = pathKey(path);
    setSelectedKeys(new Set([key]));
    setSelectionAnchorKey(key);
    const ancestors = ancestorPathKeys(path);
    if (ancestors.length === 0) {
      return;
    }
    setExpandedPaths((current) => {
      let changed = false;
      const next = new Set(current);
      for (const ancestor of ancestors) {
        if (!next.has(ancestor)) {
          next.add(ancestor);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [activeFileName, nodes]);

  useEffect(() => {
    if (ensureExpandedKeys.length === 0) {
      return;
    }
    setExpandedPaths((current) => {
      let changed = false;
      const next = new Set(current);
      for (const key of ensureExpandedKeys) {
        if (!next.has(key)) {
          next.add(key);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [ensureExpandedKeys]);

  const onToggleDirectory = useCallback(
    (path: string[]) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      const key = pathKey(path);
      setExpandedPaths((current) => {
        const next = new Set(current);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
    },
    [suppressClickRef]
  );

  const onOpenFileGuarded = useCallback(
    (path: string[]) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      onOpenFile(path);
    },
    [onOpenFile, suppressClickRef]
  );

  const onRowActivate = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>, node: LocalDiskNode): boolean => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return false;
      }
      const key = pathKey(node.path);
      if (event.shiftKey) {
        const visible = flattenVisibleNodes(nodes, expandedPaths);
        const anchorKey = selectionAnchorKey ?? key;
        const anchorIndex = visible.findIndex(
          (entry) => pathKey(entry.path) === anchorKey
        );
        const targetIndex = visible.findIndex(
          (entry) => pathKey(entry.path) === key
        );
        if (anchorIndex >= 0 && targetIndex >= 0) {
          const start = Math.min(anchorIndex, targetIndex);
          const end = Math.max(anchorIndex, targetIndex);
          const next = new Set<string>();
          for (let i = start; i <= end; i++) {
            next.add(pathKey(visible[i]!.path));
          }
          setSelectedKeys(next);
        } else {
          setSelectedKeys(new Set([key]));
          setSelectionAnchorKey(key);
        }
        return false;
      }
      if (event.ctrlKey || event.metaKey) {
        setSelectedKeys((current) => {
          const next = new Set(current);
          if (next.has(key)) {
            next.delete(key);
          } else {
            next.add(key);
          }
          return next;
        });
        setSelectionAnchorKey(key);
        return false;
      }
      setSelectedKeys(new Set([key]));
      setSelectionAnchorKey(key);
      return true;
    },
    [expandedPaths, nodes, selectionAnchorKey, suppressClickRef]
  );

  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set());
    setSelectionAnchorKey(null);
  }, []);

  const selectSingleKey = useCallback((key: string) => {
    setSelectedKeys(new Set([key]));
    setSelectionAnchorKey(key);
  }, []);

  const resolveSelectedPaths = useCallback(
    (targetKey: string, targetPath: string[][]): string[][] => {
      if (
        selectedKeysRef.current.has(targetKey) &&
        selectedKeysRef.current.size > 1
      ) {
        return [...selectedKeysRef.current].map(parsePathKey);
      }
      return targetPath;
    },
    []
  );

  return {
    clearSelection,
    expandedPaths,
    onOpenFileGuarded,
    onRowActivate,
    onToggleDirectory,
    resolveSelectedPaths,
    selectSingleKey,
    selectedKeys,
    selectedKeysRef,
  };
}

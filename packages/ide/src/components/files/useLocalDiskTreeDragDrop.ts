import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type LocalDiskNode, pathKey } from "../../files";
import {
  DRAG_THRESHOLD_PX,
  dropParentForPaths,
  findDropTarget,
  flattenVisibleNodes,
  parsePathKey,
  pruneNestedPaths,
  setActiveTreeDragPaths,
} from "./treeUtils";

interface Options {
  clearSelection: () => void;
  expandedPaths: Set<string>;
  nodes: LocalDiskNode[];
  onMoveEntries: (fromPaths: string[][], toParentPath: string[]) => void;
  renamingPathKey: string | null;
  selectedKeysRef: React.RefObject<ReadonlySet<string>>;
  suppressClickRef: React.MutableRefObject<boolean>;
}

export function useLocalDiskTreeDragDrop({
  clearSelection,
  nodes,
  expandedPaths,
  renamingPathKey,
  selectedKeysRef,
  suppressClickRef,
  onMoveEntries,
}: Options) {
  const [draggingKeys, setDraggingKeys] = useState<Set<string>>(
    () => new Set()
  );
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const pendingRef = useRef<{
    path: string[];
    paths: string[][];
    x: number;
    y: number;
  } | null>(null);
  const draggingPathsRef = useRef<string[][] | null>(null);
  const dragOverKeyRef = useRef<string | null>(null);
  const rootDropKey = "";

  const clearDrag = useCallback(() => {
    pendingRef.current = null;
    draggingPathsRef.current = null;
    setActiveTreeDragPaths(null);
    dragOverKeyRef.current = null;
    setDraggingKeys(new Set());
    setDragOverKey(null);
  }, []);

  const onPointerDownRow = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, node: LocalDiskNode) => {
      if (
        event.button !== 0 ||
        node.virtual ||
        renamingPathKey === pathKey(node.path)
      ) {
        return;
      }
      const key = pathKey(node.path);
      const current = selectedKeysRef.current;
      let dragPaths: string[][];
      if (current.has(key) && current.size > 1) {
        const visible = flattenVisibleNodes(nodes, expandedPaths);
        const byKey = new Map(
          visible.map((entry) => [pathKey(entry.path), entry] as const)
        );
        dragPaths = pruneNestedPaths(
          [...current]
            .map(parsePathKey)
            .filter((path) => byKey.get(pathKey(path))?.virtual !== true)
        );
        if (dragPaths.length === 0) {
          dragPaths = [node.path];
        }
      } else {
        dragPaths = [node.path];
      }
      pendingRef.current = {
        path: node.path,
        paths: dragPaths,
        x: event.clientX,
        y: event.clientY,
      };
    },
    [expandedPaths, nodes, renamingPathKey, selectedKeysRef]
  );

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const pending = pendingRef.current;
      if (pending && draggingPathsRef.current === null) {
        const dx = event.clientX - pending.x;
        const dy = event.clientY - pending.y;
        if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
          return;
        }
        const paths = pending.paths;
        draggingPathsRef.current = paths;
        setActiveTreeDragPaths(paths);
        pendingRef.current = null;
        setDraggingKeys(new Set(paths.map((entry) => pathKey(entry))));
        suppressClickRef.current = true;
      }

      const fromPaths = draggingPathsRef.current;
      if (!fromPaths) {
        return;
      }

      event.preventDefault();
      const target = findDropTarget(event.clientX, event.clientY);
      let nextKey: string | null = null;
      if (target) {
        const toParent = dropParentForPaths(target.key, target.type, fromPaths);
        if (toParent !== null) {
          nextKey = target.type === "root" ? rootDropKey : target.key;
        }
      }
      if (dragOverKeyRef.current !== nextKey) {
        dragOverKeyRef.current = nextKey;
        setDragOverKey(nextKey);
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      const fromPaths = draggingPathsRef.current;
      if (!fromPaths) {
        pendingRef.current = null;
        return;
      }

      const target = findDropTarget(event.clientX, event.clientY);
      let toParent: string[] | null = null;
      if (target) {
        toParent = dropParentForPaths(target.key, target.type, fromPaths);
      }

      clearDrag();
      if (toParent !== null) {
        onMoveEntries(fromPaths, toParent);
      }
    };

    const onPointerCancel = () => {
      clearDrag();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (draggingPathsRef.current || pendingRef.current) {
        clearDrag();
        return;
      }
      // Only while the tree has focus: Escape elsewhere (closing a dialog,
      // the editor's suggest widget) must not clear the tree selection.
      const focused = document.activeElement;
      if (focused instanceof Element && focused.closest("[data-tree-root]")) {
        clearSelection();
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [clearDrag, clearSelection, onMoveEntries, suppressClickRef]);

  useEffect(
    () => () => {
      setActiveTreeDragPaths(null);
    },
    []
  );

  return {
    clearDrag,
    draggingKeys,
    dragOverKey,
    onPointerDownRow,
    rootDropKey,
  };
}

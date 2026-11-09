import {
  formatLocalDiskPath,
  type LocalDiskNode,
  pathKey,
} from "../../files/localFolder";
import { planTreeMove } from "../../files/treeMove";

function isSamePath(a: string[], b: string[]): boolean {
  return (
    a.length === b.length && a.every((segment, index) => segment === b[index])
  );
}

function isPathPrefix(prefix: string[], path: string[]): boolean {
  if (prefix.length === 0) {
    return true;
  }
  if (prefix.length > path.length) {
    return false;
  }
  return prefix.every((segment, index) => segment === path[index]);
}

/** Drop nested children when an ancestor is also selected. */
export function pruneNestedPaths(paths: string[][]): string[][] {
  const sorted = [...paths].sort((a, b) => a.length - b.length);
  const kept: string[][] = [];
  for (const path of sorted) {
    if (kept.some((prefix) => isPathPrefix(prefix, path))) {
      continue;
    }
    kept.push(path);
  }
  return kept;
}

export function parsePathKey(key: string): string[] {
  if (key === "") {
    return [];
  }
  return key.split("/");
}

/** Destination parent for a drop path key (files → their parent). */
export function dropParentForPathKey(
  targetKey: string,
  targetType: "file" | "directory" | "root",
  fromPath: string[]
): string[] | null {
  const parent = dropParentCandidate(targetKey, targetType, fromPath);
  if (parent === null) {
    return null;
  }
  // Also rejects drops whose destination is an ancestor of the source
  // (`x/x` onto the root), which "Replace" would turn into deleting the source.
  return planTreeMove(fromPath, parent).kind === "invalid" ? null : parent;
}

function dropParentCandidate(
  targetKey: string,
  targetType: "file" | "directory" | "root",
  fromPath: string[]
): string[] | null {
  if (targetType === "root") {
    if (isPathPrefix(fromPath, [])) {
      return null;
    }
    const fromParent = fromPath.slice(0, -1);
    if (isSamePath(fromParent, [])) {
      return null;
    }
    return [];
  }
  const targetPath = parsePathKey(targetKey);
  if (targetType === "directory") {
    if (isSamePath(fromPath, targetPath)) {
      return null;
    }
    if (isPathPrefix(fromPath, targetPath)) {
      return null;
    }
    return targetPath;
  }
  const parent = targetPath.slice(0, -1);
  if (isPathPrefix(fromPath, parent)) {
    return null;
  }
  return parent;
}

export function dropParentForPaths(
  targetKey: string,
  targetType: "file" | "directory" | "root",
  fromPaths: string[][]
): string[] | null {
  if (fromPaths.length === 0) {
    return null;
  }
  let result: string[] | null = null;
  for (const path of fromPaths) {
    const parent = dropParentForPathKey(targetKey, targetType, path);
    if (parent === null) {
      return null;
    }
    result = parent;
  }
  return result;
}

export function findDropTarget(
  clientX: number,
  clientY: number
): {
  key: string;
  type: "file" | "directory" | "root";
} | null {
  const el = document.elementFromPoint(clientX, clientY);
  if (!(el instanceof Element)) {
    return null;
  }
  const row = el.closest("[data-tree-drop]");
  if (row instanceof HTMLElement) {
    const key = row.dataset.treePath;
    const type = row.dataset.treeDrop;
    if (key === undefined || (type !== "file" && type !== "directory")) {
      return null;
    }
    return { key, type };
  }
  const root = el.closest("[data-tree-root]");
  if (root) {
    return { key: "", type: "root" };
  }
  return null;
}

export const MEGACROW_TREE_PATH_MIME = "application/x-megacrow-tree-path";

const DRAG_THRESHOLD_PX = 5;

export { DRAG_THRESHOLD_PX };

let activeTreeDragPaths: string[][] | null = null;

export function isMegacrowTreeDragActive(): boolean {
  return activeTreeDragPaths !== null;
}

export function setActiveTreeDragPaths(paths: string[][] | null): void {
  activeTreeDragPaths = paths;
}

export function flattenVisibleNodes(
  nodes: readonly LocalDiskNode[],
  expandedPaths: ReadonlySet<string>
): LocalDiskNode[] {
  const out: LocalDiskNode[] = [];
  const walk = (list: readonly LocalDiskNode[]) => {
    for (const node of list) {
      out.push(node);
      if (
        node.type === "directory" &&
        expandedPaths.has(pathKey(node.path)) &&
        node.children &&
        node.children.length > 0
      ) {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return out;
}

export function findFilePathByDisplayName(
  nodes: readonly LocalDiskNode[],
  displayName: string
): string[] | null {
  for (const node of nodes) {
    if (node.type === "file") {
      const displayPath = formatLocalDiskPath(node.path);
      if (
        displayName.localeCompare(displayPath, undefined, {
          sensitivity: "accent",
        }) === 0
      ) {
        return node.path;
      }
    }
    if (node.children && node.children.length > 0) {
      const nested = findFilePathByDisplayName(node.children, displayName);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

export function ancestorPathKeys(path: string[]): string[] {
  const keys: string[] = [];
  for (let i = 1; i < path.length; i++) {
    keys.push(pathKey(path.slice(0, i)));
  }
  return keys;
}

/** Keys of every node in the tree, collapsed folders included. */
export function collectPathKeys(nodes: readonly LocalDiskNode[]): Set<string> {
  const keys = new Set<string>();
  const walk = (list: readonly LocalDiskNode[]) => {
    for (const node of list) {
      keys.add(pathKey(node.path));
      if (node.children) {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return keys;
}

/**
 * `selected` without keys that no longer exist in the tree (deleted, renamed
 * or moved). Returns `selected` itself when nothing was dropped.
 */
export function pruneSelection(
  selected: ReadonlySet<string>,
  nodes: readonly LocalDiskNode[]
): ReadonlySet<string> {
  if (selected.size === 0) {
    return selected;
  }
  const existing = collectPathKeys(nodes);
  const kept = [...selected].filter((key) => existing.has(key));
  return kept.length === selected.size ? selected : new Set(kept);
}

export interface TreeKeyAction {
  /** Row to move focus to. */
  focus?: string;
  /** Folder to expand or collapse. */
  toggle?: string;
}

/**
 * Keyboard navigation in a tree (WAI-ARIA tree pattern): Up/Down move through
 * visible rows, Home/End jump, Right opens a folder or enters it, Left
 * closes a folder or moves to its parent.
 */
export function treeKeyAction(
  key: string,
  currentKey: string,
  nodes: readonly LocalDiskNode[],
  expandedPaths: ReadonlySet<string>
): TreeKeyAction | null {
  const visible = flattenVisibleNodes(nodes, expandedPaths);
  if (visible.length === 0) {
    return null;
  }
  const keys = visible.map((node) => pathKey(node.path));
  const index = keys.indexOf(currentKey);
  const current = visible[index];
  switch (key) {
    case "ArrowDown":
      return index < keys.length - 1 ? { focus: keys[index + 1] } : null;
    case "ArrowUp":
      return index > 0 ? { focus: keys[index - 1] } : null;
    case "Home":
      return { focus: keys[0] };
    case "End":
      return { focus: keys.at(-1) };
    case "ArrowRight": {
      if (current?.type !== "directory") {
        return null;
      }
      if (!expandedPaths.has(currentKey)) {
        return { toggle: currentKey };
      }
      const firstChild = current.children?.[0];
      return firstChild ? { focus: pathKey(firstChild.path) } : null;
    }
    case "ArrowLeft": {
      if (current?.type === "directory" && expandedPaths.has(currentKey)) {
        return { toggle: currentKey };
      }
      const parent = current?.path.slice(0, -1) ?? [];
      return parent.length > 0 ? { focus: pathKey(parent) } : null;
    }
    default:
      return null;
  }
}

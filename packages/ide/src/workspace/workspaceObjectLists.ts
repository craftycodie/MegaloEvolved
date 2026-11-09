import {
  isMegaloVersionId,
  loadObjectListsForVersion,
  MEGALO_VERSIONS,
  type ObjectLists,
  type ObjectListType,
  objectListEntries,
} from "@megacrow/megalo";
import { basename, dirname, join } from "@tauri-apps/api/path";
import {
  exists,
  mkdir,
  readDir,
  readFile,
  writeFile,
} from "@tauri-apps/plugin-fs";
import { DEFAULT_MEGALO_VERSION } from "../app/constants";
import { isTauriRuntime } from "../desktop/tauriRuntime";
import { decodeTextFile, encodeMegaloTextFile } from "../files/decodeTextFile";
import type { LocalDiskNode } from "../files/localFolder";
import { sortLocalDiskNodes } from "../files/localFolder";
import {
  isObjectListsDirectoryName,
  isObjectListsPath,
  isRecognizedObjectListName,
} from "../gametype/objectListsPath";

const OBJECT_LISTS_DIR = "object_lists";

/** Match Megalo object-list parsing: keep blank lines (slot indices); drop a trailing empty from a final newline. */
function parseObjectListLines(text: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\r$/, ""));
  if (lines.length > 0 && lines.at(-1) === "") {
    lines.pop();
  }
  return lines;
}

function findObjectListsFolder(
  nodes: LocalDiskNode[]
): LocalDiskNode | undefined {
  return nodes.find(
    (node) => node.type === "directory" && isObjectListsDirectoryName(node.name)
  );
}

/**
 * Ensure the files tree shows an `object_lists` folder with virtual defaults
 * when the workspace has no recognized lists yet (folder missing or empty).
 *
 * When at least one recognized list exists on disk, missing lists are not
 * injected as virtual files — callers should surface them as warnings instead.
 */
export function withObjectListsFolder(
  nodes: LocalDiskNode[],
  objectListNames: readonly string[] = []
): { nodes: LocalDiskNode[]; missingListNames: readonly string[] } {
  const folder = findObjectListsFolder(nodes);
  const realRecognized = recognizedObjectListChildren(folder, objectListNames);
  const missingListNames =
    realRecognized.length === 0
      ? []
      : objectListNames.filter(
          (name) =>
            !realRecognized.some(
              (child) => child.name.toLowerCase() === name.toLowerCase()
            )
        );

  // Partial workspace lists: keep the on-disk tree as-is (no virtual defaults).
  if (realRecognized.length > 0) {
    return { nodes, missingListNames };
  }

  let next = nodes;
  if (!folder) {
    next = sortLocalDiskNodes([
      ...nodes,
      {
        type: "directory",
        name: OBJECT_LISTS_DIR,
        path: [OBJECT_LISTS_DIR],
        children: [],
      },
    ]);
  }

  if (objectListNames.length === 0) {
    return { nodes: next, missingListNames: [] };
  }

  return {
    nodes: next.map((node) => {
      if (
        !(node.type === "directory" && isObjectListsDirectoryName(node.name))
      ) {
        return node;
      }
      const children = [...(node.children ?? [])];
      const existing = new Set(
        children.map((child) => child.name.toLowerCase())
      );
      for (const name of objectListNames) {
        if (existing.has(name.toLowerCase())) {
          continue;
        }
        children.push({
          type: "file",
          name,
          path: [OBJECT_LISTS_DIR, name],
          virtual: true,
        });
        existing.add(name.toLowerCase());
      }
      return {
        ...node,
        children: sortLocalDiskNodes(children),
      };
    }),
    missingListNames: [],
  };
}

function recognizedObjectListChildren(
  folder: LocalDiskNode | undefined,
  objectListNames: readonly string[]
): LocalDiskNode[] {
  if (!folder || objectListNames.length === 0) {
    return [];
  }
  return (folder.children ?? []).filter(
    (child) =>
      child.type === "file" &&
      child.virtual !== true &&
      isRecognizedObjectListName(child.name, objectListNames)
  );
}

export function objectListsFolderIsEmpty(nodes: LocalDiskNode[]): boolean {
  const folder = findObjectListsFolder(nodes);
  if (!folder) {
    return true;
  }
  const children = folder.children ?? [];
  // Only real (on-disk) children count — virtual defaults keep the folder "empty"
  // for the auto-expand hint.
  return children.every((child) => child.virtual === true);
}

/** Locate a node by relative path segments. */
export function findLocalDiskNode(
  nodes: readonly LocalDiskNode[],
  path: readonly string[]
): LocalDiskNode | undefined {
  if (path.length === 0) {
    return;
  }
  let current: readonly LocalDiskNode[] = nodes;
  let found: LocalDiskNode | undefined;
  for (let i = 0; i < path.length; i++) {
    const segment = path[i]!;
    found = current.find(
      (node) =>
        node.name.localeCompare(segment, undefined, {
          sensitivity: "accent",
        }) === 0
    );
    if (!found) {
      return;
    }
    if (i === path.length - 1) {
      return found;
    }
    current = found.children ?? [];
  }
  return found;
}

/** Bundled default table text for a recognized object list filename. */
export function defaultObjectListText(
  fileName: string,
  megaloVersionId: string
): string {
  const version = isMegaloVersionId(megaloVersionId)
    ? MEGALO_VERSIONS[megaloVersionId]
    : MEGALO_VERSIONS[DEFAULT_MEGALO_VERSION];
  const lists = loadObjectListsForVersion(version);
  const stem = fileName.replace(/\.txt$/i, "").toLowerCase();
  const data = lists[stem as ObjectListType];
  const entries = objectListEntries(data);
  if (entries.length === 0) {
    return "";
  }
  return `${entries.join("\n")}\n`;
}

/**
 * When the first virtual object list is saved, write every recognized default
 * list into `object_lists/` (edited file uses `text`). Returns `true` when this
 * handled the write; `false` when the caller should save only the open file.
 */
export async function materializeObjectListsOnFirstSave(options: {
  absoluteFilePath: string;
  text: string;
  objectListNames: readonly string[];
  megaloVersionId: string;
}): Promise<boolean> {
  const { absoluteFilePath, text, objectListNames, megaloVersionId } = options;
  if (
    !(
      isTauriRuntime() &&
      absoluteFilePath.trim() &&
      isObjectListsPath(absoluteFilePath) &&
      objectListNames.length > 0
    )
  ) {
    return false;
  }

  const dirPath = await dirname(absoluteFilePath);
  const editedName = await basename(absoluteFilePath);
  if (!isRecognizedObjectListName(editedName, objectListNames)) {
    return false;
  }

  let recognizedOnDisk = 0;
  if (await exists(dirPath)) {
    const entries = await readDir(dirPath);
    for (const entry of entries) {
      if (!(entry.isFile && entry.name)) {
        continue;
      }
      if (isRecognizedObjectListName(entry.name, objectListNames)) {
        recognizedOnDisk += 1;
      }
    }
  }

  // Already past virtual mode — only the open file should be written.
  if (recognizedOnDisk > 0) {
    return false;
  }

  await mkdir(dirPath, { recursive: true });
  const editedLower = editedName.toLowerCase();
  await Promise.all(
    objectListNames.map(async (name) => {
      const filePath = await join(dirPath, name);
      const content =
        name.toLowerCase() === editedLower
          ? text
          : defaultObjectListText(name, megaloVersionId);
      await writeFile(filePath, encodeMegaloTextFile(content));
    })
  );
  return true;
}

/**
 * Read recognized object list tables from `<input>/object_lists/`.
 * Returns `null` when the folder is missing or has no recognized lists
 * (caller should keep using bundled defaults).
 */
export async function loadWorkspaceObjectLists(
  inputPath: string,
  recognizedNames: readonly string[]
): Promise<ObjectLists | null> {
  if (!(isTauriRuntime() && inputPath.trim()) || recognizedNames.length === 0) {
    return null;
  }

  const dirPath = await join(inputPath, OBJECT_LISTS_DIR);
  if (!(await exists(dirPath))) {
    return null;
  }

  const entries = await readDir(dirPath);
  const lists: Record<string, { entries: readonly string[]; file: string }> =
    {};
  let loaded = 0;

  for (const entry of entries) {
    if (!(entry.isFile && entry.name)) {
      continue;
    }
    if (!isRecognizedObjectListName(entry.name, recognizedNames)) {
      continue;
    }
    const stem = entry.name.replace(/\.txt$/i, "").toLowerCase();
    if (!stem) {
      continue;
    }
    const filePath = await join(dirPath, entry.name);
    const text = decodeTextFile(await readFile(filePath));
    lists[stem] = {
      entries: parseObjectListLines(text),
      file: filePath,
    };
    loaded += 1;
  }

  if (loaded === 0) {
    return null;
  }

  return lists as ObjectLists;
}

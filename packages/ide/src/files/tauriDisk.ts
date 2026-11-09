import { join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import {
  copyFile,
  exists,
  mkdir,
  readDir,
  readFile,
  remove,
  rename,
  stat,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { withObjectListsFolder } from "../workspace/workspaceObjectLists";
import { decodeTextFile } from "./decodeTextFile";
import { FsError } from "./fsErrors";
import { type LocalDiskNode, sortLocalDiskNodes } from "./localFolder";
import { planTreeMove, treeMoveError } from "./treeMove";
import { allocateNumberedName } from "./uniqueFileName";

export interface LocalDiskRoot {
  path: string;
}

function isMegaloTreeFile(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".txt");
}

export function normalizeMegaloTextFileName(name: string): string | null {
  const trimmed = name.trim();
  if (
    !trimmed ||
    trimmed === "." ||
    trimmed === ".." ||
    /[/\\]/.test(trimmed) ||
    trimmed.includes("\0")
  ) {
    return null;
  }
  return trimmed.toLowerCase().endsWith(".txt") ? trimmed : `${trimmed}.txt`;
}

export function normalizeDirectoryName(name: string): string | null {
  const trimmed = name.trim();
  if (
    !trimmed ||
    trimmed === "." ||
    trimmed === ".." ||
    /[/\\]/.test(trimmed) ||
    trimmed.includes("\0")
  ) {
    return null;
  }
  return trimmed;
}

async function scanDirectory(
  rootPath: string,
  pathPrefix: string[] = []
): Promise<LocalDiskNode[]> {
  const currentPath =
    pathPrefix.length === 0 ? rootPath : await join(rootPath, ...pathPrefix);
  const entries = await readDir(currentPath);
  const nodes: LocalDiskNode[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) {
      const childPath = [...pathPrefix, entry.name];
      const children = await scanDirectory(rootPath, childPath);
      nodes.push({
        type: "directory",
        name: entry.name,
        path: childPath,
        children,
      });
      continue;
    }

    if (entry.isFile && isMegaloTreeFile(entry.name)) {
      nodes.push({
        type: "file",
        name: entry.name,
        path: [...pathPrefix, entry.name],
      });
    }
  }

  return sortLocalDiskNodes(nodes);
}

export async function pickTauriFolder(title?: string): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: title ?? "Select folder",
  });
  return typeof selected === "string" ? selected : null;
}

export async function listTauriMegaloTree(
  rootPath: string,
  objectListNames: readonly string[] = []
): Promise<{ nodes: LocalDiskNode[]; missingListNames: readonly string[] }> {
  return withObjectListsFolder(await scanDirectory(rootPath), objectListNames);
}

export interface BuildOutputEntry {
  name: string;
  updatedAt: number;
}

function isBuildOutputFile(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".mglo") || lower.endsWith(".blf");
}

export async function listTauriBuildOutputs(
  outputPath: string
): Promise<BuildOutputEntry[]> {
  const entries = await readDir(outputPath);
  const outputs: BuildOutputEntry[] = [];

  for (const entry of entries) {
    if (!(entry.isFile && entry.name && isBuildOutputFile(entry.name))) {
      continue;
    }
    const filePath = await join(outputPath, entry.name);
    let updatedAt = 0;
    try {
      const info = await stat(filePath);
      updatedAt = info.mtime?.getTime() ?? 0;
    } catch {
      // ignore stat failures
    }
    outputs.push({ name: entry.name, updatedAt });
  }

  return outputs.sort((a, b) => a.name.localeCompare(b.name));
}

export async function readTauriMegaloFile(
  root: LocalDiskRoot,
  path: string[]
): Promise<string> {
  const filePath = await join(root.path, ...path);
  return decodeTextFile(await readFile(filePath));
}

export function tauriFolderLabel(rootPath: string): string {
  const parts = rootPath.split(/[/\\]/).filter(Boolean);
  return parts.at(-1) ?? rootPath;
}

export function tauriFolderLabelFromRoot(root: LocalDiskRoot): string {
  return tauriFolderLabel(root.path);
}

export async function resolveTauriMegaloFilePath(
  root: LocalDiskRoot,
  path: string[]
): Promise<string> {
  return join(root.path, ...path);
}

async function allocateNewScriptName(directoryPath: string): Promise<string> {
  const base = "new_script";
  let name = `${base}.txt`;
  let n = 2;
  while (await exists(await join(directoryPath, name))) {
    name = `${base}_${n}.txt`;
    n += 1;
  }
  return name;
}

async function allocateNewFolderName(directoryPath: string): Promise<string> {
  const base = "new_folder";
  let name = base;
  let n = 2;
  while (await exists(await join(directoryPath, name))) {
    name = `${base}_${n}`;
    n += 1;
  }
  return name;
}

export async function createTauriMegaloTextFile(
  root: LocalDiskRoot,
  parentSegments: string[] = []
): Promise<string[]> {
  const directoryPath =
    parentSegments.length === 0
      ? root.path
      : await join(root.path, ...parentSegments);
  const fileName = await allocateNewScriptName(directoryPath);
  const filePath = await join(directoryPath, fileName);
  await writeTextFile(filePath, "");
  return [...parentSegments, fileName];
}

export async function createTauriMegaloDirectory(
  root: LocalDiskRoot,
  parentSegments: string[] = []
): Promise<string[]> {
  const directoryPath =
    parentSegments.length === 0
      ? root.path
      : await join(root.path, ...parentSegments);
  const folderName = await allocateNewFolderName(directoryPath);
  const folderPath = await join(directoryPath, folderName);
  await mkdir(folderPath);
  return [...parentSegments, folderName];
}

export async function renameTauriMegaloFile(
  root: LocalDiskRoot,
  fromSegments: string[],
  newName: string
): Promise<string[]> {
  if (fromSegments.length === 0) {
    throw new FsError("rename_root", "Cannot rename the workspace root");
  }
  const fromPath = await join(root.path, ...fromSegments);
  const info = await stat(fromPath);
  const normalized = info.isDirectory
    ? normalizeDirectoryName(newName)
    : normalizeMegaloTextFileName(newName);
  if (normalized === null) {
    throw info.isDirectory
      ? new FsError("invalid_folder_name", "Invalid folder name")
      : new FsError("invalid_file_name", "Invalid file name");
  }
  const parent = fromSegments.slice(0, -1);
  const parentPath =
    parent.length === 0 ? root.path : await join(root.path, ...parent);
  const samePath = (left: string, right: string): boolean =>
    left.replace(/\\/g, "/").toLowerCase() ===
    right.replace(/\\/g, "/").toLowerCase();
  const uniqueName = await allocateNumberedName(
    normalized,
    async (name) => {
      const candidate = await join(parentPath, name);
      if (samePath(candidate, fromPath)) {
        return false;
      }
      return exists(candidate);
    },
    { directory: info.isDirectory === true }
  );
  const toSegments = [...parent, uniqueName];
  const toPath = await join(root.path, ...toSegments);
  if (fromPath === toPath) {
    return toSegments;
  }
  await rename(fromPath, toPath);
  return toSegments;
}

export type MoveTauriMegaloResult =
  | { status: "moved"; path: string[] }
  | { status: "noop"; path: string[] }
  | { status: "needs_replace"; path: string[]; displayName: string };

export async function moveTauriMegaloEntry(
  root: LocalDiskRoot,
  fromSegments: string[],
  toParentSegments: string[],
  options?: { replace?: boolean }
): Promise<MoveTauriMegaloResult> {
  const plan = planTreeMove(fromSegments, toParentSegments);
  if (plan.kind === "invalid") {
    throw treeMoveError(plan.reason);
  }
  if (plan.kind === "noop") {
    return { status: "noop", path: fromSegments };
  }
  const name = fromSegments.at(-1)!;
  const toSegments = plan.toSegments;

  const fromPath = await join(root.path, ...fromSegments);
  const toPath = await join(root.path, ...toSegments);
  if (await exists(toPath)) {
    if (!options?.replace) {
      return { status: "needs_replace", path: toSegments, displayName: name };
    }
    const destInfo = await stat(toPath);
    await remove(toPath, { recursive: destInfo.isDirectory === true });
  }

  await rename(fromPath, toPath);
  return { status: "moved", path: toSegments };
}

export async function deleteTauriMegaloFile(
  root: LocalDiskRoot,
  pathSegments: string[]
): Promise<void> {
  if (pathSegments.length === 0) {
    throw new FsError("delete_root", "Cannot delete the workspace root");
  }
  const filePath = await join(root.path, ...pathSegments);
  const info = await stat(filePath);
  await remove(filePath, { recursive: info.isDirectory === true });
}

async function allocateCopyName(
  directoryPath: string,
  originalName: string
): Promise<string> {
  const dot = originalName.lastIndexOf(".");
  const stem = dot > 0 ? originalName.slice(0, dot) : originalName;
  const ext = dot > 0 ? originalName.slice(dot) : "";
  let candidate = `${stem} copy${ext}`;
  let n = 2;
  while (await exists(await join(directoryPath, candidate))) {
    candidate = `${stem} copy ${n}${ext}`;
    n += 1;
  }
  return candidate;
}

export async function duplicateTauriMegaloFile(
  root: LocalDiskRoot,
  fromSegments: string[],
  parentSegments?: string[]
): Promise<string[]> {
  if (fromSegments.length === 0) {
    throw new FsError("duplicate_root", "Cannot duplicate the workspace root");
  }
  const originalName = fromSegments.at(-1)!;
  const destParent = parentSegments ?? fromSegments.slice(0, -1);
  const directoryPath =
    destParent.length === 0 ? root.path : await join(root.path, ...destParent);
  const copyName = await allocateCopyName(directoryPath, originalName);
  const fromPath = await join(root.path, ...fromSegments);
  const toPath = await join(directoryPath, copyName);
  await copyFile(fromPath, toPath);
  return [...destParent, copyName];
}

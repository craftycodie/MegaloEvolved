import { createPlatformFileProvider } from "../files/fileProvider";
import {
  isAbsoluteLogicalPath,
  normalizeLogicalPath,
} from "../files/fileProvider/paths";
import type { Workspace } from "../workspace/workspace";
import type { PathReferenceKind } from "./pathReferences";

export interface OpenablePathResult {
  absoluteFilePath: string;
  displayName: string;
  text: string;
}

function parentDirectory(filePath: string): string {
  const normalized = normalizeLogicalPath(filePath);
  const index = normalized.lastIndexOf("/");
  if (index <= 0) {
    return ".";
  }
  return normalized.slice(0, index);
}

function basename(filePath: string): string {
  const normalized = normalizeLogicalPath(filePath);
  const parts = normalized.split("/");
  return parts.at(-1) || filePath;
}

/** Path relative to the workspace input folder, else the file name. */
export function workspaceDisplayName(
  absoluteFilePath: string,
  inputPath: string | null | undefined
): string {
  const normalized = normalizeLogicalPath(absoluteFilePath);
  if (inputPath) {
    const root = normalizeLogicalPath(inputPath).replace(/\/+$/, "");
    const prefix = `${root}/`;
    if (normalized.toLowerCase().startsWith(prefix.toLowerCase())) {
      return normalized.slice(prefix.length);
    }
  }
  return basename(absoluteFilePath);
}

function displayNameFor(
  absoluteFilePath: string,
  workspace: Workspace | null
): string {
  return workspaceDisplayName(absoluteFilePath, workspace?.inputPath);
}

function searchDirs(
  workspace: Workspace | null,
  currentFilePath: string | null
): string[] {
  const dirs: string[] = [];
  const add = (dir: string | null | undefined) => {
    if (!dir) {
      return;
    }
    const normalized = normalizeLogicalPath(dir);
    if (!dirs.some((d) => d.toLowerCase() === normalized.toLowerCase())) {
      dirs.push(normalized);
    }
  };
  if (currentFilePath) {
    add(parentDirectory(currentFilePath));
  }
  add(workspace?.inputPath);
  add(workspace?.outputPath);
  return dirs;
}

/** `.mglo` base → sibling `.txt` source path(s) to try. */
export function baseSourcePathCandidates(basePath: string): string[] {
  if (/\.txt$/i.test(basePath)) {
    return [basePath];
  }
  if (/\.mglo$/i.test(basePath)) {
    return [basePath.replace(/\.mglo$/i, ".txt")];
  }
  return [`${basePath}.txt`];
}

async function resolveExistingTextPath(
  relativePath: string,
  dirs: string[],
  workspace: Workspace | null
): Promise<OpenablePathResult | null> {
  const fileProvider = createPlatformFileProvider(workspace);
  if (!fileProvider) {
    return null;
  }
  for (const dir of dirs) {
    const absolute = fileProvider.resolvePath(relativePath, dir);
    const text = await fileProvider.readText(absolute);
    if (text !== null) {
      return {
        absoluteFilePath: absolute,
        displayName: displayNameFor(absolute, workspace),
        text,
      };
    }
  }
  return null;
}

/**
 * Resolve an include/base path to an openable source file.
 * For `base`, only the sibling `.txt` source is opened (never the `.mglo`).
 */
export async function resolveOpenablePathReference(
  kind: PathReferenceKind,
  path: string,
  options: {
    workspace: Workspace | null;
    currentFilePath: string | null;
  }
): Promise<OpenablePathResult | null> {
  const dirs = searchDirs(options.workspace, options.currentFilePath);
  if (dirs.length === 0 && !isAbsoluteLogicalPath(path)) {
    return null;
  }

  const candidates = kind === "base" ? baseSourcePathCandidates(path) : [path];

  for (const candidate of candidates) {
    const hit = await resolveExistingTextPath(
      candidate,
      dirs.length > 0 ? dirs : ["."],
      options.workspace
    );
    if (hit) {
      return hit;
    }
  }
  return null;
}

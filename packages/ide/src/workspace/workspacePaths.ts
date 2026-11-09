import { isWindowsPlatform } from "../app/constants";
/** Normalize path for case-insensitive Windows-friendly comparisons. */
export function normalizePathKey(path: string): string {
  return path.replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
}

/** True when `filePath` is under the workspace input root (or equal to it). */
export function isPathInWorkspaceInput(
  filePath: string,
  workspaceInputPath: string
): boolean {
  const file = normalizePathKey(filePath);
  const root = normalizePathKey(workspaceInputPath);
  return file === root || file.startsWith(`${root}\\`);
}

function stripTrailingSeparators(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

function withNativeSeparators(path: string, sample: string): string {
  return sample.includes("\\") ? path.replace(/\//g, "\\") : path;
}

/**
 * If input/output match an Editing Kit layout, return the kit root.
 * Does not check `project.root` on disk — see {@link getEditingKitRoot}.
 *
 * Layout:
 * - input:  `<root>/data/multiplayer/megalo`
 * - output: `<root>/maps/megalo`
 */
export function guessEditingKitRootFromWorkspacePaths(
  inputPath: string,
  outputPath: string | null | undefined
): string | undefined {
  if (!outputPath?.trim()) {
    return;
  }
  const input = stripTrailingSeparators(inputPath);
  const output = stripTrailingSeparators(outputPath);
  const inputMarker = "/data/multiplayer/megalo";
  const outputMarker = "/maps/megalo";
  const inputLower = input.toLowerCase();
  const outputLower = output.toLowerCase();
  const inputIndex = inputLower.lastIndexOf(inputMarker);
  const outputIndex = outputLower.lastIndexOf(outputMarker);
  if (
    inputIndex < 0 ||
    inputIndex + inputMarker.length !== inputLower.length ||
    outputIndex < 0 ||
    outputIndex + outputMarker.length !== outputLower.length
  ) {
    return;
  }
  const inputRoot = input.slice(0, inputIndex);
  const outputRoot = output.slice(0, outputIndex);
  if (normalizePathKey(inputRoot) !== normalizePathKey(outputRoot)) {
    return;
  }
  return withNativeSeparators(inputRoot, inputPath);
}

/** `<root>/tool.exe` when `root` is an Editing Kit root. */
export function editingKitToolExePath(editingKitRoot: string): string {
  const root = stripTrailingSeparators(editingKitRoot);
  return withNativeSeparators(`${root}/tool.exe`, editingKitRoot);
}

/** `<root>/project.root` when `root` is an Editing Kit root. */
export function editingKitProjectRootPath(editingKitRoot: string): string {
  const root = stripTrailingSeparators(editingKitRoot);
  return withNativeSeparators(`${root}/project.root`, editingKitRoot);
}

/**
 * Editing Kit root when input/output match the HREK layout and
 * `<root>/project.root` exists; otherwise `undefined`.
 */
export async function getEditingKitRoot(
  inputPath: string,
  outputPath: string | null | undefined
): Promise<string | undefined> {
  const root = guessEditingKitRootFromWorkspacePaths(inputPath, outputPath);
  if (!root) {
    return;
  }
  try {
    const { exists } = await import("@tauri-apps/plugin-fs");
    if (!(await exists(editingKitProjectRootPath(root)))) {
      return;
    }
  } catch {
    return;
  }
  return root;
}

/** True on desktop Windows when `<root>/tool.exe` exists. */
export async function canRegenerateObjectListsWithTool(
  editingKitRoot: string
): Promise<boolean> {
  if (!isWindowsPlatform()) {
    return false;
  }
  try {
    const { exists } = await import("@tauri-apps/plugin-fs");
    return await exists(editingKitToolExePath(editingKitRoot));
  } catch {
    return false;
  }
}

/** If scripts path is .../data/multiplayer/megalo, suggest sibling maps/megalo. */
export function guessOutputPathFromScripts(scriptsPath: string): string | null {
  const normalized = scriptsPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const marker = "/data/multiplayer/megalo";
  const lower = normalized.toLowerCase();
  const index = lower.lastIndexOf(marker);
  if (index < 0 || index + marker.length !== lower.length) {
    return null;
  }
  const root = normalized.slice(0, index);
  const suggested = `${root}/maps/megalo`;
  return scriptsPath.includes("\\")
    ? suggested.replace(/\//g, "\\")
    : suggested;
}

/** HREK install root when scripts path is `…/data/multiplayer/megalo`. */
export function guessHrekRootFromScripts(scriptsPath: string): string | null {
  const normalized = scriptsPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const marker = "/data/multiplayer/megalo";
  const lower = normalized.toLowerCase();
  const index = lower.lastIndexOf(marker);
  if (index < 0 || index + marker.length !== lower.length) {
    return null;
  }
  const root = normalized.slice(0, index);
  return scriptsPath.includes("\\") ? root.replace(/\//g, "\\") : root;
}

/**
 * Parse `displayName` (preferred) or `name` from an HREK `project.xml` body.
 */
export function parseProjectXmlDisplayName(xml: string): string | null {
  for (const attr of ["displayName", "name"] as const) {
    const match = new RegExp(`${attr}\\s*=\\s*"([^"]+)"`, "i").exec(xml);
    const value = match?.[1]?.trim();
    if (value) {
      return value;
    }
  }
  return null;
}

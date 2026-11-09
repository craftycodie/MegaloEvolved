import type {
  MegacrowListDirectoryParams,
  MegacrowResolveBaseFileParams,
  MegacrowResolveIncludeParams,
} from "@megacrow/lsp/protocol";
import { createPlatformFileProvider } from "../files/fileProvider";
import { listPathDirectoryEntries } from "../files/listPathDirectory";
import { getActiveWorkspace } from "../stores/settingsStore";
import { getActiveFilePath, isPlaceholderDocumentUri } from "./state";

export type ResolveIncludeParams = MegacrowResolveIncludeParams;
export type ResolveIncludeResult =
  | { text: string; uri: string }
  | { error: string };
export type ResolveBaseFileParams = MegacrowResolveBaseFileParams;
export type ResolveBaseFileResult = { dataBase64: string } | { error: string };
export type ListDirectoryParams = MegacrowListDirectoryParams;
export type ListDirectoryResult =
  | { entries: Array<{ name: string; directory: boolean }> }
  | { error: string };

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function parentDirectory(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  if (index <= 0) {
    return ".";
  }
  const parent = normalized.slice(0, index);
  return /\\/.test(filePath) ? parent.replace(/\//g, "\\") : parent;
}

function uriToPath(uri: string | undefined): string | null {
  if (!uri || isPlaceholderDocumentUri(uri)) {
    return null;
  }
  if (uri.startsWith("file:///")) {
    const rest = uri.slice("file:///".length);
    if (/^[A-Za-z]:\//.test(rest)) {
      return rest.replace(/\//g, "\\");
    }
    return `/${rest}`;
  }
  if (uri.startsWith("file://")) {
    return uri.slice("file://".length);
  }
  if (
    /^[A-Za-z]:[\\/]/.test(uri) ||
    uri.startsWith("/") ||
    uri.startsWith("workspace/")
  ) {
    return uri;
  }
  return null;
}

function resolveSearchDirs(fromUri: string | undefined): string[] {
  const dirs: string[] = [];
  const seen = new Set<string>();
  const add = (dir: string | null | undefined) => {
    if (!dir || dir === ".") {
      return;
    }
    const key = dir.replace(/\\/g, "/").toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    dirs.push(dir);
  };

  const fromPath = uriToPath(fromUri);
  if (fromPath) {
    add(parentDirectory(fromPath));
  }
  const activeFilePath = getActiveFilePath();
  if (activeFilePath) {
    add(parentDirectory(activeFilePath));
  }
  const workspace = getActiveWorkspace();
  add(workspace?.outputPath);
  add(workspace?.inputPath);

  return dirs.length > 0 ? dirs : ["."];
}

export async function handleResolveInclude(
  params: ResolveIncludeParams
): Promise<ResolveIncludeResult> {
  const workspace = getActiveWorkspace();
  const fileProvider = createPlatformFileProvider(workspace);
  if (!fileProvider) {
    return { error: "No file provider available for include resolution" };
  }

  const tried: string[] = [];
  for (const dir of resolveSearchDirs(params.fromUri)) {
    const absolute = fileProvider.resolvePath(params.path, dir);
    tried.push(absolute);
    const text = await fileProvider.readText(absolute);
    if (text !== null) {
      return { text, uri: absolute };
    }
  }
  return {
    error: `Include file not found: ${params.path} (tried ${tried.join(", ")})`,
  };
}

export async function handleResolveBaseFile(
  params: ResolveBaseFileParams
): Promise<ResolveBaseFileResult> {
  const workspace = getActiveWorkspace();
  if (!workspace?.outputPath?.trim()) {
    return {
      error: "Base file resolution disabled (no workspace output folder)",
    };
  }
  const fileProvider = createPlatformFileProvider(workspace);
  if (!fileProvider) {
    return { error: "No file provider available for base file resolution" };
  }

  const tried: string[] = [];
  for (const dir of resolveSearchDirs(params.fromUri)) {
    const absolute = fileProvider.resolvePath(params.path, dir);
    tried.push(absolute);
    const bytes = fileProvider.readBytes
      ? await fileProvider.readBytes(absolute)
      : null;
    if (bytes !== null) {
      return { dataBase64: encodeBase64(bytes) };
    }
  }
  return {
    error: `Base file not found: ${params.path} (tried ${tried.join(", ")})`,
  };
}

export async function handleListDirectory(
  params: ListDirectoryParams
): Promise<ListDirectoryResult> {
  const workspace = getActiveWorkspace();
  const fileProvider = createPlatformFileProvider(workspace);
  if (!fileProvider) {
    return { error: "No file provider available for path completion" };
  }

  const relative = (params.directory ?? "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  const searchDirs = resolveSearchDirs(params.fromUri);
  const baseDir = searchDirs[0];
  if (!baseDir || baseDir === ".") {
    return { error: "No directory available for path completion" };
  }
  const absolute = relative
    ? fileProvider.resolvePath(relative, baseDir)
    : baseDir;
  const entries = await listPathDirectoryEntries(absolute);
  return { entries };
}

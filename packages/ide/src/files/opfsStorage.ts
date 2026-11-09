import { allocateNumberedName } from "./uniqueFileName";

const GAMETYPES_DIR = "gametypes";
const WORKSPACE_ROOT = "workspace";
/** Primary Megalo source extension for browser OPFS files. */
const SOURCE_EXT = ".txt";
/** Pre-rename companion extension; still read/deleted for migration. */
const LEGACY_SOURCE_EXT = ".meg";
/** Legacy compiled save next to a companion source (pre–source-first OPFS). */
const LEGACY_BIN_EXT = ".bin";

export interface OpfsGametypeEntry {
  name: string;
  updatedAt: number;
}

export function isOpfsSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "storage" in navigator &&
    typeof navigator.storage.getDirectory === "function"
  );
}

export function workspaceInputPath(): string {
  return `${WORKSPACE_ROOT}/input`;
}

export function workspaceOutputPath(): string {
  return `${WORKSPACE_ROOT}/output`;
}

async function getRootDirectory(): Promise<FileSystemDirectoryHandle> {
  return navigator.storage.getDirectory();
}

async function getDirectoryHandle(
  path: string,
  create: boolean
): Promise<FileSystemDirectoryHandle | null> {
  const segments = path
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return getRootDirectory();
  }
  let current = await getRootDirectory();
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    const isLast = i === segments.length - 1;
    try {
      current = await current.getDirectoryHandle(segment, {
        create: create && !isLast,
      });
    } catch {
      return null;
    }
  }
  return current;
}

/** List immediate children of a logical OPFS workspace directory. */
export async function listOpfsWorkspaceDirectory(
  logicalDir: string
): Promise<Array<{ name: string; directory: boolean }>> {
  if (!isOpfsSupported()) {
    return [];
  }
  const normalized = logicalDir.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const dir = await getDirectoryHandle(normalized, false);
  if (!dir) {
    return [];
  }
  const result: Array<{ name: string; directory: boolean }> = [];
  for await (const handle of dir.values()) {
    if (handle.kind === "directory") {
      result.push({ name: handle.name, directory: true });
    } else if (handle.kind === "file") {
      result.push({ name: handle.name, directory: false });
    }
  }
  return result;
}

/** Read a file from the OPFS workspace using a logical path (`workspace/input/...`). */
export async function readOpfsWorkspaceBytes(
  logicalPath: string
): Promise<Uint8Array | null> {
  if (!isOpfsSupported()) {
    return null;
  }
  const normalized = logicalPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = normalized
    .split("/")
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return null;
  }
  const fileName = segments.at(-1)!;
  const dirPath = segments.slice(0, -1).join("/");
  const dir = await getDirectoryHandle(dirPath, false);
  if (!dir) {
    return null;
  }
  try {
    const handle = await dir.getFileHandle(fileName);
    const file = await handle.getFile();
    return new Uint8Array(await file.arrayBuffer());
  } catch {
    return null;
  }
}

function isSourceFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(SOURCE_EXT) || lower.endsWith(LEGACY_SOURCE_EXT);
}

function safeSourceFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name;
  const cleaned = base.replace(/[?%*:|"<>]/g, "_").replace(/^\.+/, "");
  if (!cleaned) {
    return `new_script${SOURCE_EXT}`;
  }
  if (isSourceFileName(cleaned)) {
    return cleaned;
  }
  // Renaming a legacy `.bin` entry → `.txt` stem.
  if (cleaned.toLowerCase().endsWith(LEGACY_BIN_EXT)) {
    return `${cleaned.slice(0, -LEGACY_BIN_EXT.length)}${SOURCE_EXT}`;
  }
  return `${cleaned}${SOURCE_EXT}`;
}

function safeBinFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name;
  const cleaned = base.replace(/[?%*:|"<>]/g, "_").replace(/^\.+/, "");
  if (!cleaned) {
    return "gametype.bin";
  }
  return cleaned.toLowerCase().endsWith(".bin") ? cleaned : `${cleaned}.bin`;
}

async function getGametypesDirectory(): Promise<FileSystemDirectoryHandle> {
  const root = await getRootDirectory();
  return root.getDirectoryHandle(GAMETYPES_DIR, { create: true });
}

export async function listOpfsGametypes(): Promise<OpfsGametypeEntry[]> {
  if (!isOpfsSupported()) {
    return [];
  }

  const dir = await getGametypesDirectory();
  const entries: OpfsGametypeEntry[] = [];

  for await (const entry of dir.values()) {
    if (entry.kind !== "file" || !isSourceFileName(entry.name)) {
      continue;
    }
    const fileHandle = entry as FileSystemFileHandle;
    const file = await fileHandle.getFile();
    entries.push({ name: fileHandle.name, updatedAt: file.lastModified });
  }

  return entries.sort((a, b) => b.updatedAt - a.updatedAt);
}

function companionSourceName(
  binName: string,
  ext: typeof SOURCE_EXT | typeof LEGACY_SOURCE_EXT = SOURCE_EXT
): string | null {
  if (!binName.toLowerCase().endsWith(LEGACY_BIN_EXT)) {
    return null;
  }
  return binName.replace(/\.bin$/i, ext);
}

function siblingBinName(sourceName: string): string | null {
  if (!sourceName.toLowerCase().endsWith(SOURCE_EXT)) {
    return null;
  }
  return sourceName.replace(/\.txt$/i, LEGACY_BIN_EXT);
}

async function removeCompanionSources(
  dir: FileSystemDirectoryHandle,
  binName: string
): Promise<void> {
  for (const ext of [SOURCE_EXT, LEGACY_SOURCE_EXT] as const) {
    const companion = companionSourceName(binName, ext);
    if (!companion) {
      continue;
    }
    try {
      await dir.removeEntry(companion);
    } catch {
      // Companion source may not exist.
    }
  }
}

async function removeLegacyBinSibling(
  dir: FileSystemDirectoryHandle,
  sourceName: string
): Promise<void> {
  const binSibling = siblingBinName(sourceName);
  if (!binSibling) {
    return;
  }
  try {
    await dir.removeEntry(binSibling);
  } catch {
    // Legacy `.bin` may not exist.
  }
}

export async function deleteOpfsGametype(name: string): Promise<void> {
  const dir = await getGametypesDirectory();
  await dir.removeEntry(name);
  if (isSourceFileName(name)) {
    await removeLegacyBinSibling(dir, name);
  } else {
    await removeCompanionSources(dir, name);
  }
}

async function fileExistsInDir(
  dir: FileSystemDirectoryHandle,
  name: string
): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

async function renameEntryInDir(
  dir: FileSystemDirectoryHandle,
  from: string,
  to: string
): Promise<void> {
  const handle = await dir.getFileHandle(from);
  const movable = handle as FileSystemFileHandle & {
    move?: (name: string) => Promise<void>;
  };
  if (typeof movable.move === "function") {
    await movable.move(to);
    return;
  }
  const file = await handle.getFile();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const dest = await dir.getFileHandle(to, { create: true });
  const writable = await dest.createWritable();
  await writable.write(bytes as unknown as BlobPart);
  await writable.close();
  await dir.removeEntry(from);
}

/** Rename a Megalo source file (and a legacy sibling `.bin` if present). */
export async function renameOpfsGametype(
  fromName: string,
  toName: string
): Promise<string> {
  const safeTo = safeSourceFileName(toName);
  if (
    fromName.localeCompare(safeTo, undefined, { sensitivity: "accent" }) === 0
  ) {
    return fromName;
  }
  const dir = await getGametypesDirectory();
  const uniqueTo = await allocateNumberedName(
    safeTo,
    async (name) => name !== fromName && fileExistsInDir(dir, name)
  );
  await renameEntryInDir(dir, fromName, uniqueTo);

  const fromBin = siblingBinName(fromName);
  const toBin = siblingBinName(uniqueTo);
  if (fromBin && toBin && (await fileExistsInDir(dir, fromBin))) {
    if (await fileExistsInDir(dir, toBin)) {
      await dir.removeEntry(toBin);
    }
    await renameEntryInDir(dir, fromBin, toBin);
  }
  return uniqueTo;
}

/** Create an empty Megalo `.txt` and return its name. */
export async function createOpfsGametype(): Promise<string> {
  const dir = await getGametypesDirectory();
  let name = `new_script${SOURCE_EXT}`;
  let n = 2;
  while (await fileExistsInDir(dir, name)) {
    name = `new_script_${n}${SOURCE_EXT}`;
    n += 1;
  }
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write("");
  await writable.close();
  return name;
}

/** Read Megalo source for an OPFS entry (`.txt` directly, or companion of a legacy `.bin`). */
export async function readOpfsGametypeSource(
  name: string
): Promise<string | null> {
  const dir = await getGametypesDirectory();
  if (isSourceFileName(name)) {
    try {
      const handle = await dir.getFileHandle(name);
      const file = await handle.getFile();
      return await file.text();
    } catch {
      return null;
    }
  }
  for (const ext of [SOURCE_EXT, LEGACY_SOURCE_EXT] as const) {
    const companion = companionSourceName(name, ext);
    if (!companion) {
      return null;
    }
    try {
      const handle = await dir.getFileHandle(companion);
      const file = await handle.getFile();
      return await file.text();
    } catch {
      // try next extension
    }
  }
  return null;
}

/** Overwrite an OPFS Megalo source `.txt` (or create it). */
export async function writeOpfsGametypeSource(
  name: string,
  source: string
): Promise<void> {
  const safeName = isSourceFileName(name)
    ? name
    : (companionSourceName(safeBinFileName(name), SOURCE_EXT) ??
      `${name}${SOURCE_EXT}`);
  const dir = await getGametypesDirectory();
  const handle = await dir.getFileHandle(safeName, { create: true });
  const writable = await handle.createWritable();
  await writable.write(source);
  await writable.close();
}

export function opfsGametypeLogicalPath(name: string): string {
  return `${GAMETYPES_DIR}/${name}`;
}

async function allocateOpfsCopyName(originalName: string): Promise<string> {
  const dir = await getGametypesDirectory();
  const safeOriginal = isSourceFileName(originalName)
    ? originalName
    : safeSourceFileName(originalName);
  const dot = safeOriginal.lastIndexOf(".");
  const stem = dot > 0 ? safeOriginal.slice(0, dot) : safeOriginal;
  const ext = dot > 0 ? safeOriginal.slice(dot) : SOURCE_EXT;
  let candidate = `${stem} copy${ext}`;
  let n = 2;
  while (await fileExistsInDir(dir, candidate)) {
    candidate = `${stem} copy ${n}${ext}`;
    n += 1;
  }
  return candidate;
}

/** Duplicate a Megalo source file (and a legacy sibling `.bin` if present). */
export async function duplicateOpfsGametype(fromName: string): Promise<string> {
  const dir = await getGametypesDirectory();
  const toName = await allocateOpfsCopyName(fromName);
  const source = (await readOpfsGametypeSource(fromName)) ?? "";

  const sourceHandle = await dir.getFileHandle(toName, { create: true });
  const sourceWritable = await sourceHandle.createWritable();
  await sourceWritable.write(source);
  await sourceWritable.close();

  const fromBin = siblingBinName(fromName);
  const toBin = siblingBinName(toName);
  if (fromBin && toBin && (await fileExistsInDir(dir, fromBin))) {
    const fromHandle = await dir.getFileHandle(fromBin);
    const fromFile = await fromHandle.getFile();
    const bytes = new Uint8Array(await fromFile.arrayBuffer());
    const binHandle = await dir.getFileHandle(toBin, { create: true });
    const binWritable = await binHandle.createWritable();
    await binWritable.write(bytes as unknown as BlobPart);
    await binWritable.close();
  }

  return toName;
}

import { readClipboardText, writeClipboardText } from "../desktop/clipboard";
import { ipcClipboardWriteFiles } from "../desktop/ipc";
import { isTauriRuntime } from "../desktop/tauriRuntime";

export type FileClipboardPayload =
  | { source: "local"; path: string[] }
  | { source: "opfs"; name: string };

const PREFIX = "megacrow-file:";

export function serializeFileClipboard(payload: FileClipboardPayload): string {
  return `${PREFIX}${JSON.stringify({ v: 1, ...payload })}`;
}

export function parseFileClipboard(text: string): FileClipboardPayload | null {
  if (!text.startsWith(PREFIX)) {
    return null;
  }
  try {
    const data: unknown = JSON.parse(text.slice(PREFIX.length));
    if (
      typeof data !== "object" ||
      data === null ||
      !("v" in data) ||
      data.v !== 1 ||
      !("source" in data)
    ) {
      return null;
    }
    if (
      data.source === "opfs" &&
      "name" in data &&
      typeof data.name === "string" &&
      data.name.length > 0
    ) {
      return { source: "opfs", name: data.name };
    }
    if (
      data.source === "local" &&
      "path" in data &&
      Array.isArray(data.path) &&
      data.path.length > 0 &&
      data.path.every((segment) => typeof segment === "string")
    ) {
      return { source: "local", path: data.path as string[] };
    }
  } catch {
    return null;
  }
  return null;
}

export interface WriteFileClipboardOptions {
  /** Absolute disk paths for OS paste (Explorer / Finder). */
  absolutePaths?: string[];
}

/**
 * Place a MegaCrow file copy on the system clipboard.
 * On Tauri/Windows, also sets CF_HDROP so Explorer can Paste the real file(s).
 * In the browser only the text marker is written: browsers accept a single
 * clipboard item and few types, and a `.txt` file blob (`text/plain`) used to
 * overwrite the marker, so Paste never appeared.
 */
export async function writeFileClipboard(
  payload: FileClipboardPayload,
  options?: WriteFileClipboardOptions
): Promise<void> {
  const text = serializeFileClipboard(payload);
  const paths = options?.absolutePaths?.filter((path) => path.length > 0) ?? [];

  if (isTauriRuntime() && paths.length > 0) {
    await ipcClipboardWriteFiles({ paths, text });
    return;
  }

  await writeClipboardText(text);
}

export async function readFileClipboard(): Promise<FileClipboardPayload | null> {
  const text = await readClipboardText();
  return text === null ? null : parseFileClipboard(text);
}

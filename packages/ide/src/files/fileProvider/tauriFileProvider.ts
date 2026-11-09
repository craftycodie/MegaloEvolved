import { sep } from "@tauri-apps/api/path";
import { readFile } from "@tauri-apps/plugin-fs";
import { decodeTextFile } from "../decodeTextFile";
import {
  isAbsoluteLogicalPath,
  joinLogicalPaths,
  normalizeLogicalPath,
} from "./paths";
import type { FileProvider } from "./types";

/** Use the OS separator: `\` on Windows, `/` on macOS and Linux. */
function toNativeSeparators(path: string): string {
  return sep() === "\\" ? path.replace(/\//g, "\\") : path;
}

export function createTauriFileProvider(): FileProvider {
  return {
    /** Returns decoded text, or `null` when the file is missing or unreadable. */
    async readText(filePath: string): Promise<string | null> {
      try {
        return decodeTextFile(await readFile(filePath));
      } catch {
        return null;
      }
    },
    /** Returns file bytes, or `null` when the file is missing or unreadable. */
    async readBytes(filePath: string): Promise<Uint8Array | null> {
      try {
        return await readFile(filePath);
      } catch {
        return null;
      }
    },
    resolvePath(relativePath: string, fromDir: string): string {
      if (isAbsoluteLogicalPath(relativePath)) {
        return toNativeSeparators(normalizeLogicalPath(relativePath));
      }
      const base = fromDir.replace(/[\\/]+$/, "");
      return toNativeSeparators(joinLogicalPaths(base, relativePath));
    },
  };
}

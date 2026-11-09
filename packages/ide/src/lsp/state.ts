import type { MegacrowConfig } from "@megacrow/lsp/protocol";
import { ALL_MEGACROW_EXTENSIONS } from "@megacrow/megalo";
import { DEFAULT_MEGALO_VERSION } from "../app/constants";

/** URI for a document that has no file on disk yet. */
export const DEFAULT_DOC_URI = "file:///megalo/editor.megalo";

/** Latest server configuration; also sent as `initializationOptions` on connect. */
let lspConfig: MegacrowConfig = {
  compilerSettings: {},
  gameBuildNumber: null,
  locale: "en",
  megacrowExtensions: ALL_MEGACROW_EXTENSIONS,
  megaloVersion: DEFAULT_MEGALO_VERSION,
  objectLists: null,
  resolveBaseFile: true,
};

export function getLspConfig(): MegacrowConfig {
  return lspConfig;
}

export function setLspConfig(config: MegacrowConfig): void {
  lspConfig = config;
}

export function pathToDocumentUri(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  if (/^[A-Za-z]:\//.test(normalized)) {
    return `file:///${normalized}`;
  }
  if (normalized.startsWith("/")) {
    return `file://${normalized}`;
  }
  return `file:///${normalized}`;
}

export function isPlaceholderDocumentUri(uri: string): boolean {
  return uri === DEFAULT_DOC_URI || uri.startsWith("file:///megalo/");
}

let activeFilePath: string | null = null;

/** Path of the file shown in the editor (the base for relative includes). */
export function getActiveFilePath(): string | null {
  return activeFilePath;
}

export function setActiveFilePath(path: string | null): void {
  activeFilePath = path;
}

/** URI of the document shown in the editor. */
export function getActiveDocumentUri(): string {
  return activeFilePath ? pathToDocumentUri(activeFilePath) : DEFAULT_DOC_URI;
}

export interface SyncedDocument {
  text: string;
  version: number;
}

/**
 * Documents the server currently has open, by URI, with the text last sent.
 * Cleared when the worker restarts, since the new server knows none of them.
 */
export const syncedDocuments = new Map<string, SyncedDocument>();

let documentVersion = 0;

export function nextDocumentVersion(): number {
  documentVersion += 1;
  return documentVersion;
}

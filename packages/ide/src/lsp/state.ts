import type { MegacrowConfig } from "@megacrow/lsp/protocol";
import { ALL_MEGACROW_EXTENSIONS } from "@megacrow/megalo";
import { getActiveWorkspace, type Workspace } from "../workspace/workspace";

export const DEFAULT_DOC_URI = "file:///megalo/editor.megalo";

let documentVersion = 1;
let documentOpen = false;
let documentUri = DEFAULT_DOC_URI;
let lastSyncedText: string | null = null;
let activeFilePath: string | null = null;
let configuredWorkspace: Workspace | null = null;
/** Latest server configuration; also sent as `initializationOptions` on connect. */
let lspConfig: MegacrowConfig = {
  compilerSettings: {},
  locale: "en",
  megacrowExtensions: ALL_MEGACROW_EXTENSIONS,
  megaloVersion: "107-mcc",
  objectLists: null,
  resolveBaseFile: true,
};

export function getLspConfig(): MegacrowConfig {
  return lspConfig;
}

export function setLspConfig(config: MegacrowConfig): void {
  lspConfig = config;
}

export function getDocumentVersion(): number {
  return documentVersion;
}

export function bumpDocumentVersion(): number {
  documentVersion += 1;
  return documentVersion;
}

export function isDocumentOpen(): boolean {
  return documentOpen;
}

export function setDocumentOpen(open: boolean): void {
  documentOpen = open;
}

export function getDocumentUri(): string {
  return documentUri;
}

export function setDocumentUri(uri: string): void {
  documentUri = uri;
}

export function getLastSyncedText(): string | null {
  return lastSyncedText;
}

export function setLastSyncedText(text: string | null): void {
  lastSyncedText = text;
}

export function getActiveFilePath(): string | null {
  return activeFilePath;
}

export function setActiveFilePath(path: string | null): void {
  activeFilePath = path;
}

export function getConfiguredWorkspace(): Workspace | null {
  return configuredWorkspace;
}

export function setConfiguredWorkspace(workspace: Workspace | null): void {
  configuredWorkspace = workspace;
}

export function getWorkspaceForResolve(): Workspace | null {
  return configuredWorkspace ?? getActiveWorkspace();
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

export function resetDocumentState(): {
  previousUri: string;
  wasOpen: boolean;
} {
  const previousUri = documentUri;
  const wasOpen = documentOpen;
  documentOpen = false;
  lastSyncedText = null;
  documentUri = DEFAULT_DOC_URI;
  activeFilePath = null;
  return { previousUri, wasOpen };
}

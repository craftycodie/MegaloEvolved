/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly TAURI_ENV_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface FileSystemHandle {
  readonly kind: "file" | "directory";
  readonly name: string;
}

interface FileSystemFileHandle extends FileSystemHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
  getFile(): Promise<File>;
  readonly kind: "file";
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<FileSystemDirectoryHandle>;
  getFileHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<FileSystemFileHandle>;
  readonly kind: "directory";
  values(): AsyncIterableIterator<FileSystemHandle>;
}

interface FileSystemWritableFileStream extends WritableStream {
  close(): Promise<void>;
  write(data: BufferSource | Blob | string): Promise<void>;
}

interface StorageManager {
  getDirectory(): Promise<FileSystemDirectoryHandle>;
}

interface Navigator {
  storage: StorageManager;
}

interface Window {
  showDirectoryPicker(options?: {
    mode?: "read" | "readwrite";
  }): Promise<FileSystemDirectoryHandle>;
}

declare module "monaco-editor/esm/vs/editor/standalone/browser/standaloneServices.js" {
  export const StandaloneServices: {
    get(serviceId: unknown): unknown;
    initialize(overrides: Record<string, unknown>): unknown;
  };
}

declare module "monaco-editor/esm/vs/platform/quickinput/common/quickInput.js" {
  export const IQuickInputService: unknown;
}

declare module "monaco-editor/esm/vs/platform/quickinput/common/quickAccess.js" {
  export const Extensions: { Quickaccess: string };
}

declare module "monaco-editor/esm/vs/platform/registry/common/platform.js" {
  export const Registry: {
    as(id: string): unknown;
  };
}

declare module "monaco-editor/esm/vs/base/common/lifecycle.js" {
  export class DisposableStore {
    add(disposable: { dispose: () => void }): unknown;
    dispose(): void;
  }
}

declare module "monaco-editor/esm/vs/platform/quickinput/browser/helpQuickAccess.js" {
  // Ambient shape of Monaco's HelpQuickAccessProvider (static PREFIX only).
  // biome-ignore lint/complexity/noStaticOnlyClass: mirrors monaco export
  export class HelpQuickAccessProvider {
    static PREFIX: string;
  }
}

declare module "monaco-editor/esm/vs/base/common/filters.js" {
  export function matchesFuzzy(
    word: string,
    wordToMatchAgainst: string,
    enableSeparateSubstringMatching?: boolean
  ): { start: number; end: number }[] | null;
}

declare module "monaco-editor/esm/vs/editor/browser/services/codeEditorService.js" {
  export const ICodeEditorService: unknown;
}

declare module "monaco-editor/esm/vs/platform/quickinput/browser/pickerQuickAccess.js" {
  export class PickerQuickAccessProvider {
    static PREFIX: string;
    constructor(
      prefix: string,
      options?: {
        canAcceptInBackground?: boolean;
        noResultsPick?: { label: string };
      }
    );
  }
}

declare module "monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneHelpQuickAccess.js" {}
declare module "monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneCommandsQuickAccess.js" {}
declare module "monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoLineQuickAccess.js" {}
declare module "monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoSymbolQuickAccess.js" {}

/** Version of @blamnetwork/blf, injected by vite.config.ts. */
declare const __BLF_VERSION__: string;

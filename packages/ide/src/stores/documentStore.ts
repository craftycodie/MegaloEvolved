import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { DEFAULT_MEGALO_VERSION } from "../app/constants";
import type { MegaloDiagnostic, MegaloObjectListTarget } from "../compile";
import { isTauriRuntime } from "../desktop/tauriRuntime";
import {
  type DocumentKind,
  documentKeyFor,
  documentKindFor,
} from "../editor/documentKey";
import { editorHost, type HostedDocumentInfo } from "../editor/editorHost";
import {
  canNavigateFileNavBack,
  canNavigateFileNavForward,
  EMPTY_FILE_NAV,
  type FileNavEntry,
  type FileNavState,
  isRemovedByDelete,
  navigateFileNavBack,
  navigateFileNavForward,
  pushFileNavEntry,
  remapPathAfterRename,
  renameFileNavEntries,
  sourceNavEntry,
} from "../editor/fileNavigation";
import {
  type OpenablePathResult,
  resolveOpenablePathReference,
  workspaceDisplayName,
} from "../editor/openPathReference";
import { persistOpenSourceFile } from "../files";
import { createPlatformFileProvider } from "../files/fileProvider";
import { joinLogicalPaths } from "../files/fileProvider/paths";
import { createSaveQueue } from "../files/saveQueue";
import { isObjectListsPath } from "../gametype/objectListsPath";
import { lspResetSession, lspSetActiveFile } from "../lsp";
import {
  defaultObjectListText,
  isPathInWorkspaceInput,
  materializeObjectListsOnFirstSave,
} from "../workspace";
import { analyzeDocument, resetCompile } from "./compileStore";
import { bumpLocalDiskRevision } from "./revisionStore";
import {
  getActiveWorkspace,
  settingsStore,
  updateSettings,
} from "./settingsStore";

export interface OpenDocument {
  /** Name shown in the UI: path relative to the workspace, or file name. */
  displayName: string;
  /** Document key / LSP URI. */
  key: string;
  kind: DocumentKind;
  /** Absolute path, or null for browser-storage files. */
  path: string | null;
}

interface DocumentState {
  active: OpenDocument | null;
  cursor: { column: number; line: number };
  history: FileNavState;
}

export const documentStore = createStore<DocumentState>(() => ({
  active: null,
  cursor: { column: 1, line: 1 },
  history: EMPTY_FILE_NAV,
}));

export function useDocument<T>(selector: (state: DocumentState) => T): T {
  return useStore(documentStore, selector);
}

export const selectCanNavigateBack = (state: DocumentState) =>
  canNavigateFileNavBack(state.history);
export const selectCanNavigateForward = (state: DocumentState) =>
  canNavigateFileNavForward(state.history);

export interface SourceToOpen {
  displayName: string;
  path: string | null;
  text: string;
}

export interface OpenOptions {
  /** False for back/forward, which moves within history instead. */
  recordHistory?: boolean;
  /** Put the cursor here once the document is shown. */
  reveal?: { column?: number; line: number };
}

/** Bumped by every open and close; async opens drop stale results. */
let openTicket = 0;

function activeText(): string | null {
  const active = documentStore.getState().active;
  return active ? editorHost.getText(active.key) : null;
}

function rememberLastOpenFile(path: string | null): void {
  const workspace = getActiveWorkspace();
  if (!workspace) {
    return;
  }
  const pathToStore =
    path && isPathInWorkspaceInput(path, workspace.inputPath) ? path : null;
  updateSettings((current) => {
    const stored = current.workspaces.find(
      (entry) => entry.id === workspace.id
    );
    if (!stored || (stored.lastOpenFilePath ?? null) === pathToStore) {
      return current;
    }
    return {
      ...current,
      workspaces: current.workspaces.map((entry) =>
        entry.id === workspace.id
          ? { ...entry, lastOpenFilePath: pathToStore }
          : entry
      ),
    };
  }).catch(() => {
    // Logged by the settings store.
  });
}

function hostedInfo(document: OpenDocument): HostedDocumentInfo {
  return {
    displayName: document.displayName,
    key: document.key,
    kind: document.kind,
    path: document.path,
  };
}

function describe(source: {
  displayName: string;
  path: string | null;
}): OpenDocument {
  return {
    displayName: source.displayName,
    key: documentKeyFor(source.path, source.displayName),
    kind: documentKindFor(
      source.path,
      source.displayName,
      settingsStore.getState().objectListNames
    ),
    path: source.path,
  };
}

/** Show `source` in the editor (its text is already read). */
export function openDocument(
  source: SourceToOpen,
  options: OpenOptions = {}
): void {
  openTicket += 1;
  const document = describe(source);
  const { history } = documentStore.getState();
  const nextHistory =
    options.recordHistory === false
      ? history
      : pushFileNavEntry(
          history,
          sourceNavEntry(
            source.text,
            source.displayName,
            source.path ? { absoluteFilePath: source.path } : null
          ),
          activeText() ?? undefined
        );

  editorHost.open(hostedInfo(document), source.text);
  editorHost.activate(document.key, options.reveal);
  lspSetActiveFile(document.path);
  documentStore.setState({ active: document, history: nextHistory });
  rememberLastOpenFile(document.path);
  void analyzeDocument(
    {
      key: document.key,
      kind: document.kind,
      text: editorHost.getText(document.key) ?? source.text,
    },
    { fresh: true }
  );
}

/**
 * Open a document whose text is read asynchronously. If another open (or a
 * close) happens before `read` finishes, this one is dropped.
 */
export async function openAsync(
  read: () => Promise<SourceToOpen | null>,
  options?: OpenOptions
): Promise<boolean> {
  const ticket = ++openTicket;
  const source = await read();
  if (!source || ticket !== openTicket) {
    return false;
  }
  openDocument(source, options);
  return true;
}

async function readFromWorkspace(path: string): Promise<string | null> {
  const provider = createPlatformFileProvider(getActiveWorkspace());
  return provider ? provider.readText(path) : null;
}

function resolvedToSource(resolved: OpenablePathResult): SourceToOpen {
  return {
    displayName: resolved.displayName,
    path: resolved.absoluteFilePath,
    text: resolved.text,
  };
}

/** Open an include / base path relative to the shown document. */
export function openPathReference(
  kind: "include" | "localized_include" | "base",
  path: string,
  reveal?: OpenOptions["reveal"]
): Promise<boolean> {
  const currentFilePath = documentStore.getState().active?.path ?? null;
  return openAsync(
    async () => {
      const resolved = await resolveOpenablePathReference(kind, path, {
        workspace: getActiveWorkspace(),
        currentFilePath,
      });
      if (!resolved) {
        console.warn(
          `[megacrow] could not open ${kind} path: ${path}` +
            (kind === "base" ? " (source .txt not found)" : "")
        );
        return null;
      }
      return resolvedToSource(resolved);
    },
    { reveal }
  );
}

/** Open the object list a diagnostic points at (bundled default if missing). */
function openObjectList(target: MegaloObjectListTarget): Promise<boolean> {
  const fileName = `${target.objectType}.txt`;
  const relativePath = `object_lists/${fileName}`;
  const workspace = getActiveWorkspace();
  const fallbackPath =
    target.file ??
    (workspace?.inputPath
      ? joinLogicalPaths(workspace.inputPath, relativePath)
      : relativePath);
  const currentFilePath = documentStore.getState().active?.path ?? null;
  return openAsync(
    async () => {
      const resolved = await resolveOpenablePathReference(
        "include",
        target.file ?? relativePath,
        { workspace, currentFilePath }
      );
      if (resolved) {
        return resolvedToSource(resolved);
      }
      // Not on disk yet: the bundled default is saved on first edit.
      return {
        displayName: relativePath,
        path: fallbackPath,
        text: defaultObjectListText(
          fileName,
          workspace?.megaloVersion ?? DEFAULT_MEGALO_VERSION
        ),
      };
    },
    { reveal: { line: target.line } }
  );
}

export function navigateToDiagnostic(diagnostic: MegaloDiagnostic): void {
  if (diagnostic.objectList) {
    void openObjectList(diagnostic.objectList);
    return;
  }
  if (!diagnostic.trayOnly) {
    editorHost.reveal(diagnostic.line, diagnostic.column);
  }
}

/** Back/forward: show the entry's document, reading it again if closed. */
function openHistoryEntry(entry: FileNavEntry): void {
  const path = entry.absoluteFilePath;
  const key = documentKeyFor(path, entry.displayName);
  if (editorHost.has(key) || !path) {
    openDocument(
      {
        displayName: entry.displayName,
        path,
        text: editorHost.getText(key) ?? entry.text,
      },
      { recordHistory: false }
    );
    return;
  }
  void openAsync(
    async () => ({
      displayName: entry.displayName,
      path,
      text: (await readFromWorkspace(path)) ?? entry.text,
    }),
    { recordHistory: false }
  );
}

export function navigateBack(): void {
  const result = navigateFileNavBack(
    documentStore.getState().history,
    activeText() ?? undefined
  );
  if (result) {
    documentStore.setState({ history: result.state });
    openHistoryEntry(result.entry);
  }
}

export function navigateForward(): void {
  const result = navigateFileNavForward(
    documentStore.getState().history,
    activeText() ?? undefined
  );
  if (result) {
    documentStore.setState({ history: result.state });
    openHistoryEntry(result.entry);
  }
}

/** Close every document and forget history (e.g. switching workspace). */
export function closeAllDocuments(): void {
  openTicket += 1;
  editorHost.flushPendingSaves();
  editorHost.closeAll();
  documentStore.setState({
    active: null,
    cursor: { column: 1, line: 1 },
    history: EMPTY_FILE_NAV,
  });
  lspSetActiveFile(null);
  resetCompile();
  void lspResetSession();
}

/**
 * A file or folder (`oldName`, workspace-relative) was renamed or moved to
 * `newName`; `newAbsolutePath` is the entry's new absolute path. Open
 * documents inside it follow.
 */
export function handleEntryRenamed(
  oldName: string,
  newName: string,
  newAbsolutePath: string
): void {
  const { active, history } = documentStore.getState();
  documentStore.setState({
    history: renameFileNavEntries(history, oldName, newName, newAbsolutePath),
  });
  if (!active) {
    return;
  }
  const remapped = remapPathAfterRename(
    { absoluteFilePath: active.path, displayName: active.displayName },
    oldName,
    newName,
    newAbsolutePath
  );
  if (!remapped) {
    return;
  }
  const next = describe({
    displayName: remapped.displayName,
    path: remapped.absoluteFilePath,
  });
  editorHost.rename(active.key, hostedInfo(next));
  lspSetActiveFile(next.path);
  documentStore.setState({ active: next });
  rememberLastOpenFile(next.path);
}

/** A file or folder (`deletedName`, workspace-relative) was deleted. */
export function handleEntryDeleted(deletedName: string): void {
  const { active } = documentStore.getState();
  editorHost.closeWhere(
    (document) =>
      document.key !== active?.key &&
      isRemovedByDelete(document.displayName, deletedName)
  );
  if (active && isRemovedByDelete(active.displayName, deletedName)) {
    rememberLastOpenFile(null);
    closeAllDocuments();
  }
}

export function setCursor(line: number, column: number): void {
  documentStore.setState({ cursor: { column, line } });
}

/** Re-open the workspace's last file, unless something else opened first. */
export function restoreLastOpenFile(): void {
  const workspace = getActiveWorkspace();
  if (!workspace) {
    return;
  }
  const stored = settingsStore
    .getState()
    .settings.workspaces.find((entry) => entry.id === workspace.id);
  const path = stored?.lastOpenFilePath ?? null;
  if (!(path && isPathInWorkspaceInput(path, workspace.inputPath))) {
    if (path) {
      rememberLastOpenFile(null);
    }
    return;
  }
  void openAsync(async () => {
    const text = await readFromWorkspace(path);
    if (text === null) {
      rememberLastOpenFile(null);
      return null;
    }
    if (getActiveWorkspace()?.id !== workspace.id) {
      return null;
    }
    return {
      displayName: workspaceDisplayName(path, workspace.inputPath),
      path,
      text,
    };
  });
}

const autosaveQueue = createSaveQueue();

/** Write an edited document to disk or browser storage (debounced by the host). */
export function autosave(document: HostedDocumentInfo, text: string): void {
  const { displayName, key, path } = document;
  const opfs = getActiveWorkspace()?.type === "opfs";
  if (!(path || opfs)) {
    return;
  }
  if (!isTauriRuntime() && isObjectListsPath(path ?? displayName)) {
    return;
  }
  if (text === editorHost.getSavedText(key)) {
    return;
  }
  autosaveQueue
    .enqueue(path?.trim() || `opfs:${displayName}`, async () => {
      if (path?.trim() && isObjectListsPath(path)) {
        const materialized = await materializeObjectListsOnFirstSave({
          absoluteFilePath: path.trim(),
          megaloVersionId:
            getActiveWorkspace()?.megaloVersion ?? DEFAULT_MEGALO_VERSION,
          objectListNames: settingsStore.getState().objectListNames,
          text,
        });
        if (materialized) {
          return true;
        }
      }
      return persistOpenSourceFile({
        absoluteFilePath: path,
        fileName: displayName,
        opfs,
        text,
      });
    })
    .then((saved) => {
      if (saved !== true) {
        return;
      }
      editorHost.markSaved(key, text);
      if (isObjectListsPath(path ?? displayName)) {
        bumpLocalDiskRevision();
      }
    })
    .catch((error: unknown) => {
      console.error("Failed to save source file:", error);
    });
}

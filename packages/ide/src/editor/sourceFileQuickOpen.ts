import { _event_error, event } from "@blamnetwork/datamine";
import type { SourceFileQuickOpenEntry } from "./sourceFileQuickOpenEntry";

export type { SourceFileQuickOpenEntry } from "./sourceFileQuickOpenEntry";

export type IdePaletteMode = "files" | "commands";

type IdePaletteOpener = (options: { mode: IdePaletteMode }) => void;

interface MonacoEditorAction {
  alias?: string;
  id: string;
  isSupported(): boolean;
  label: string;
  run(): void | Promise<void>;
}

interface MonacoCodeEditor {
  focus(): void;
  getSupportedActions(): MonacoEditorAction[];
}

interface CodeEditorService {
  getFocusedCodeEditor(): MonacoCodeEditor | null;
  listCodeEditors(): MonacoCodeEditor[];
}

export interface IdePaletteCommand {
  description?: string;
  id: string;
  label: string;
  run: () => void | Promise<void>;
}

let entries: SourceFileQuickOpenEntry[] = [];
let paletteOpener: IdePaletteOpener | null = null;

/** Replace the catalog of source files available to Go to File. */
export function setSourceFileQuickOpenEntries(
  next: readonly SourceFileQuickOpenEntry[]
): void {
  entries = [...next];
}

export function getSourceFileQuickOpenEntries(): readonly SourceFileQuickOpenEntry[] {
  return entries;
}

/** Flatten a LocalDisk-style tree into file nodes only. */
export function flattenSourceFileNodes<
  T extends { children?: T[]; type: "directory" | "file" },
>(nodes: readonly T[]): T[] {
  const files: T[] = [];
  const walk = (list: readonly T[]) => {
    for (const node of list) {
      if (node.type === "file") {
        files.push(node);
      }
      if (node.children && node.children.length > 0) {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return files;
}

/** App shell registers the centered palette UI. */
export function setIdePaletteOpener(opener: IdePaletteOpener | null): void {
  paletteOpener = opener;
}

function openPalette(mode: IdePaletteMode): void {
  if (!paletteOpener) {
    event(_event_error, "ide:editor: Ide palette opener is not registered");
    return;
  }
  paletteOpener({ mode });
}

/** Open Go to File (works with or without an open editor). */
export function showSourceFileQuickOpen(_editor?: { focus(): void }): void {
  openPalette("files");
}

/** Open command mode (Monaco editor actions when a file editor exists). */
export function showCommandPalette(_editor?: { focus(): void }): void {
  openPalette("commands");
}

async function getCodeEditorService(): Promise<CodeEditorService | null> {
  try {
    const [{ StandaloneServices }, { ICodeEditorService }] = await Promise.all([
      import(
        "monaco-editor/esm/vs/editor/standalone/browser/standaloneServices.js"
      ),
      import(
        "monaco-editor/esm/vs/editor/browser/services/codeEditorService.js"
      ),
    ]);
    StandaloneServices.initialize({});
    return StandaloneServices.get(ICodeEditorService) as CodeEditorService;
  } catch {
    return null;
  }
}

/** Prefer the focused file editor; otherwise any live code editor. */
export async function getActiveMonacoEditor(): Promise<MonacoCodeEditor | null> {
  const service = await getCodeEditorService();
  if (!service) {
    return null;
  }
  return service.getFocusedCodeEditor() ?? service.listCodeEditors()[0] ?? null;
}

/**
 * Monaco editor actions for the command palette.
 * Empty when no file editor is mounted (empty state).
 */
export async function getMonacoCommandPaletteEntries(): Promise<
  IdePaletteCommand[]
> {
  const editor = await getActiveMonacoEditor();
  if (!editor) {
    return [];
  }

  const commands: IdePaletteCommand[] = [];
  for (const action of editor.getSupportedActions()) {
    if (!action.isSupported()) {
      continue;
    }
    // Avoid nesting our own palette opener inside the list as a no-op loop.
    if (
      action.id === "megacrow.commandPalette" ||
      action.id === "editor.action.quickCommand"
    ) {
      continue;
    }
    const label = action.label?.trim() || action.id;
    commands.push({
      id: action.id,
      label,
      description:
        action.alias && action.alias !== label ? action.alias : undefined,
      run: () => {
        editor.focus();
        return action.run();
      },
    });
  }

  commands.sort((a, b) => a.label.localeCompare(b.label));
  return commands;
}

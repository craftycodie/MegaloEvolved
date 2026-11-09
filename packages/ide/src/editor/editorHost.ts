import type * as MonacoApi from "monaco-editor";
import { type MegaloDiagnostic, megaloDiagnosticFromLsp } from "../compile";
import {
  lspCloseDocument,
  lspSyncDocument,
  subscribeLspDiagnostics,
} from "../lsp";
import {
  MEGALO_LANGUAGE_ID,
  setMegaloDiagnostics,
} from "../monaco/megalo-language";
import type { DocumentKind } from "./documentKey";
import { registerModelKey, unregisterModelKey } from "./modelRegistry";

type Monaco = typeof MonacoApi;
type CodeEditor = MonacoApi.editor.IStandaloneCodeEditor;
type TextModel = MonacoApi.editor.ITextModel;
type ViewState = MonacoApi.editor.ICodeEditorViewState;

const SAVE_DEBOUNCE_MS = 300;
const COMPILE_DEBOUNCE_MS = 400;

export interface HostedDocumentInfo {
  /** Workspace-relative name (also the browser-storage file name). */
  displayName: string;
  key: string;
  kind: DocumentKind;
  path: string | null;
}

interface HostedDocument extends HostedDocumentInfo {
  compileTimer: number | null;
  contentListener: MonacoApi.IDisposable;
  model: TextModel;
  /** Text last written to (or read from) storage. */
  savedText: string;
  saveTimer: number | null;
  viewState: ViewState | null;
}

/** Why a change listener runs: time to autosave, or time to recompile. */
export type DocumentChangeReason = "save" | "compile";

type ChangeListener = (
  document: HostedDocumentInfo,
  text: string,
  reason: DocumentChangeReason
) => void;

function languageFor(kind: DocumentKind): string {
  return kind === "megalo" ? MEGALO_LANGUAGE_ID : "plaintext";
}

/**
 * Owns the Monaco models: one per open document, keyed by its LSP URI, so
 * every file keeps its own undo history, cursor and scroll position. Shows
 * one of them in the editor, keeps the LSP in sync with each, and reports
 * edits (debounced) to listeners for autosave and compile.
 */
class EditorHost {
  private activeKey: string | null = null;
  private readonly changeListeners = new Set<ChangeListener>();
  private readonly documents = new Map<string, HostedDocument>();
  private editor: CodeEditor | null = null;
  private monaco: Monaco | null = null;
  private pendingReveal: { column: number; line: number } | null = null;

  /** Called once from monacoBootstrap. */
  initialize(monaco: Monaco): void {
    this.monaco = monaco;
    subscribeLspDiagnostics((uri, diagnostics) => {
      const document = this.documents.get(uri);
      if (document?.kind === "megalo") {
        this.applyMarkers(
          document,
          diagnostics.map((d) => megaloDiagnosticFromLsp(d))
        );
      }
    });
  }

  attachEditor(editor: CodeEditor): void {
    this.editor = editor;
    const active = this.activeKey ? this.documents.get(this.activeKey) : null;
    if (active) {
      editor.setModel(active.model);
      if (active.viewState) {
        editor.restoreViewState(active.viewState);
      }
      this.applyPendingReveal();
    }
  }

  detachEditor(editor: CodeEditor): void {
    if (this.editor !== editor) {
      return;
    }
    this.saveActiveViewState();
    this.editor = null;
  }

  getEditor(): CodeEditor | null {
    return this.editor;
  }

  getMonaco(): Monaco {
    if (!this.monaco) {
      throw new Error("EditorHost used before monacoBootstrap ran");
    }
    return this.monaco;
  }

  /**
   * Create the document's model, or bring an existing one up to date with
   * `text` (as an undoable edit, so history survives reopening a file that
   * changed on disk). Does not show it; see `activate`.
   */
  open(info: HostedDocumentInfo, text: string): void {
    const monaco = this.monaco;
    if (!monaco) {
      throw new Error("EditorHost used before monacoBootstrap ran");
    }
    const existing = this.documents.get(info.key);
    if (existing) {
      existing.displayName = info.displayName;
      existing.kind = info.kind;
      existing.path = info.path;
      if (existing.model.getLanguageId() !== languageFor(info.kind)) {
        monaco.editor.setModelLanguage(existing.model, languageFor(info.kind));
      }
      // Unsaved edits win over what storage holds; otherwise take the
      // stored text (the file may have changed outside the IDE).
      const unsaved =
        existing.saveTimer !== null ||
        existing.model.getValue() !== existing.savedText;
      if (!unsaved && existing.model.getValue() !== text) {
        existing.model.pushEditOperations(
          [],
          [{ range: existing.model.getFullModelRange(), text }],
          () => null
        );
        existing.savedText = text;
      }
      return;
    }
    const model = monaco.editor.createModel(
      text,
      languageFor(info.kind),
      monaco.Uri.parse(info.key)
    );
    registerModelKey(model, info.key);
    const document: HostedDocument = {
      ...info,
      compileTimer: null,
      contentListener: model.onDidChangeContent(() => this.onEdit(document)),
      model,
      savedText: text,
      saveTimer: null,
      viewState: null,
    };
    this.documents.set(info.key, document);
    if (info.kind === "megalo") {
      void lspSyncDocument(text, info.key);
    }
  }

  /** Show a document; optionally move the cursor to a position. */
  activate(key: string, reveal?: { column?: number; line: number }): void {
    const document = this.documents.get(key);
    if (!document) {
      return;
    }
    if (this.activeKey !== key) {
      this.saveActiveViewState();
      this.activeKey = key;
      if (this.editor) {
        this.editor.setModel(document.model);
        if (document.viewState) {
          this.editor.restoreViewState(document.viewState);
        }
      }
    }
    if (reveal) {
      this.pendingReveal = { column: reveal.column ?? 1, line: reveal.line };
      this.applyPendingReveal();
    }
  }

  /** Move the cursor in the active document and focus the editor. */
  reveal(line: number, column = 1): void {
    this.pendingReveal = { column, line };
    this.applyPendingReveal();
  }

  /** Show nothing (documents stay open). */
  deactivate(): void {
    this.saveActiveViewState();
    this.activeKey = null;
    this.editor?.setModel(null);
  }

  getText(key: string): string | null {
    return this.documents.get(key)?.model.getValue() ?? null;
  }

  getSavedText(key: string): string | null {
    return this.documents.get(key)?.savedText ?? null;
  }

  /** Record that `text` is now what storage holds for the document. */
  markSaved(key: string, text: string): void {
    const document = this.documents.get(key);
    if (document) {
      document.savedText = text;
    }
  }

  has(key: string): boolean {
    return this.documents.has(key);
  }

  /** Re-key a document after its file was renamed or moved. */
  rename(oldKey: string, next: HostedDocumentInfo): void {
    const document = this.documents.get(oldKey);
    if (!document || oldKey === next.key) {
      if (document) {
        document.displayName = next.displayName;
        document.path = next.path;
      }
      return;
    }
    // A model's URI is fixed, so the renamed file gets a new model (undo
    // history for it starts over).
    const text = document.model.getValue();
    const savedText = document.savedText;
    const wasActive = this.activeKey === oldKey;
    const viewState = wasActive
      ? (this.editor?.saveViewState() ?? null)
      : document.viewState;
    this.close(oldKey);
    this.open(next, text);
    const renamed = this.documents.get(next.key);
    if (renamed) {
      renamed.savedText = savedText;
      renamed.viewState = viewState;
    }
    if (wasActive) {
      this.activate(next.key);
    }
  }

  close(key: string): void {
    const document = this.documents.get(key);
    if (!document) {
      return;
    }
    if (this.activeKey === key) {
      this.activeKey = null;
      this.editor?.setModel(null);
    }
    this.clearTimers(document);
    document.contentListener.dispose();
    unregisterModelKey(document.model);
    document.model.dispose();
    this.documents.delete(key);
    void lspCloseDocument(key);
  }

  closeWhere(predicate: (document: HostedDocumentInfo) => boolean): void {
    for (const document of [...this.documents.values()]) {
      if (predicate(document)) {
        this.close(document.key);
      }
    }
  }

  closeAll(): void {
    this.closeWhere(() => true);
  }

  /** Markers for documents the LSP does not analyze (object lists). */
  setPlainTextMarkers(key: string, diagnostics: MegaloDiagnostic[]): void {
    const document = this.documents.get(key);
    if (document && document.kind !== "megalo") {
      this.applyMarkers(document, diagnostics);
    }
  }

  subscribeChanges(listener: ChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  /** Run pending debounced saves now (e.g. before switching workspace). */
  flushPendingSaves(): void {
    for (const document of this.documents.values()) {
      if (document.saveTimer !== null) {
        window.clearTimeout(document.saveTimer);
        document.saveTimer = null;
        this.emit(document, "save");
      }
    }
  }

  private onEdit(document: HostedDocument): void {
    if (document.kind === "megalo") {
      void lspSyncDocument(document.model.getValue(), document.key);
    }
    this.clearTimers(document);
    document.saveTimer = window.setTimeout(() => {
      document.saveTimer = null;
      this.emit(document, "save");
    }, SAVE_DEBOUNCE_MS);
    document.compileTimer = window.setTimeout(() => {
      document.compileTimer = null;
      this.emit(document, "compile");
    }, COMPILE_DEBOUNCE_MS);
  }

  private emit(document: HostedDocument, reason: DocumentChangeReason): void {
    const text = document.model.getValue();
    const info: HostedDocumentInfo = {
      displayName: document.displayName,
      key: document.key,
      kind: document.kind,
      path: document.path,
    };
    for (const listener of this.changeListeners) {
      listener(info, text, reason);
    }
  }

  private clearTimers(document: HostedDocument): void {
    if (document.saveTimer !== null) {
      window.clearTimeout(document.saveTimer);
      document.saveTimer = null;
    }
    if (document.compileTimer !== null) {
      window.clearTimeout(document.compileTimer);
      document.compileTimer = null;
    }
  }

  private applyMarkers(
    document: HostedDocument,
    diagnostics: MegaloDiagnostic[]
  ): void {
    if (this.monaco) {
      setMegaloDiagnostics(this.monaco, document.model, diagnostics);
    }
  }

  private saveActiveViewState(): void {
    const active = this.activeKey ? this.documents.get(this.activeKey) : null;
    if (active && this.editor?.getModel() === active.model) {
      active.viewState = this.editor.saveViewState();
    }
  }

  private applyPendingReveal(): void {
    const reveal = this.pendingReveal;
    const editor = this.editor;
    if (!(reveal && editor?.getModel())) {
      return;
    }
    this.pendingReveal = null;
    editor.revealLineInCenter(reveal.line);
    editor.setPosition({
      column: Math.max(1, reveal.column),
      lineNumber: reveal.line,
    });
    editor.focus();
  }
}

export const editorHost = new EditorHost();

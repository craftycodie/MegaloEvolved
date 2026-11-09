import { useEffect, useRef } from "react";
import { isTauriRuntime } from "../desktop/tauriRuntime";
import {
  EDITOR_FONT_FAMILY,
  EDITOR_FONT_SIZE,
  EDITOR_LINE_HEIGHT,
} from "../editor/editorFont";
import { editorHost } from "../editor/editorHost";
import {
  showCommandPalette,
  showSourceFileQuickOpen,
} from "../editor/sourceFileQuickOpen";
import { translate } from "../localization";
import {
  clearActiveMegaloEditor,
  MEGALO_LANGUAGE_ID,
  setActiveMegaloEditor,
} from "../monaco/megalo-language";
import { applyEditorTheme, MEGALO_THEME_ID } from "../monaco/theme";
import { setCursor, useDocument } from "../stores/documentStore";
import {
  settingsStore,
  updateAppSettings,
  useSettings,
} from "../stores/settingsStore";

const CURSOR_DEBOUNCE_MS = 120;

const EDITOR_OPTIONS = {
  acceptSuggestionOnCommitCharacter: false,
  automaticLayout: true,
  disableMonospaceOptimizations: true,
  fixedOverflowWidgets: true,
  folding: true,
  fontFamily: EDITOR_FONT_FAMILY,
  fontLigatures: false,
  fontSize: EDITOR_FONT_SIZE,
  insertSpaces: false,
  lineHeight: EDITOR_LINE_HEIGHT,
  links: true,
  minimap: { enabled: false },
  padding: { bottom: 8, top: 10 },
  quickSuggestions: { comments: false, other: true, strings: false },
  quickSuggestionsDelay: 0,
  scrollBeyondLastLine: false,
  "semanticHighlighting.enabled": true,
  showFoldingControls: "mouseover",
  suggest: {
    filterGraceful: true,
    localityBonus: false,
    matchOnWordStartOnly: false,
    preview: false,
    selectionMode: "always",
    showKeywords: true,
    showSnippets: false,
    snippetsPreventQuickSuggestions: false,
  },
  suggestOnTriggerCharacters: true,
  tabSize: 4,
  wordBasedSuggestions: "off",
} as const;

/**
 * After typing a space, `.` or `_` (or deleting back into a word), Monaco
 * would close the suggest widget; reopen it so completions follow the cursor
 * through Megalo syntax. Returns which kind of edit asks for that.
 */
function suggestRetrigger(
  changes: readonly { rangeLength: number; text: string }[]
): "typed" | "deleted" | null {
  if (changes.some((change) => /[\r\n]/.test(change.text))) {
    return null;
  }
  if (changes.some((c) => c.text === " " || c.text === "." || c.text === "_")) {
    return "typed";
  }
  return changes.some((c) => c.text === "" && c.rangeLength > 0)
    ? "deleted"
    : null;
}

/** The one Monaco editor; documents (models) are swapped in by editorHost. */
export function Editor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorTheme = useSettings((state) => state.appSettings.editorTheme);
  const wordWrap = useSettings((state) => state.appSettings.editorWordWrap);
  const readOnly = useDocument(
    (state) => !isTauriRuntime() && state.active?.kind === "objectList"
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const monaco = editorHost.getMonaco();
    const { appSettings } = settingsStore.getState();
    const editor = monaco.editor.create(container, {
      ...EDITOR_OPTIONS,
      model: null,
      theme: MEGALO_THEME_ID,
      wordWrap: appSettings.editorWordWrap ? "on" : "off",
    });
    applyEditorTheme(monaco, appSettings.editorTheme);
    setActiveMegaloEditor(editor);

    editor.addAction({
      id: "megacrow.goToFile",
      label: translate("editor_command_go_to_file"),
      run: () => showSourceFileQuickOpen(editor),
    });
    editor.addAction({
      id: "megacrow.commandPalette",
      label: translate("editor_command_show_all_commands"),
      run: () => showCommandPalette(editor),
    });
    editor.addAction({
      id: "megacrow.toggleWordWrap",
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.KeyZ],
      label: translate("editor_command_toggle_word_wrap"),
      run: () => {
        const next = !settingsStore.getState().appSettings.editorWordWrap;
        updateAppSettings({ editorWordWrap: next }).catch(() => {
          // Logged by the settings store.
        });
      },
    });

    let cursorTimer: number | null = null;
    const cursorListener = editor.onDidChangeCursorPosition((event) => {
      if (cursorTimer !== null) {
        window.clearTimeout(cursorTimer);
      }
      const { column, lineNumber } = event.position;
      cursorTimer = window.setTimeout(() => {
        cursorTimer = null;
        setCursor(lineNumber, column);
      }, CURSOR_DEBOUNCE_MS);
    });

    const contentListener = editor.onDidChangeModelContent((event) => {
      const model = editor.getModel();
      const retrigger = suggestRetrigger(event.changes);
      if (model?.getLanguageId() !== MEGALO_LANGUAGE_ID || !retrigger) {
        return;
      }
      // Wait for Monaco to move the cursor past the edit.
      queueMicrotask(() => {
        const position = editor.getPosition();
        if (editor.getModel() !== model || !position) {
          return;
        }
        const before = model
          .getLineContent(position.lineNumber)
          .slice(0, position.column - 1);
        if (retrigger === "deleted" && !/[A-Za-z0-9_]$/.test(before)) {
          return;
        }
        editor.trigger("megacrow", "editor.action.triggerSuggest", {
          auto: true,
        });
      });
    });

    editorHost.attachEditor(editor);
    return () => {
      if (cursorTimer !== null) {
        window.clearTimeout(cursorTimer);
      }
      cursorListener.dispose();
      contentListener.dispose();
      editorHost.detachEditor(editor);
      clearActiveMegaloEditor(editor);
      editor.dispose();
    };
  }, []);

  useEffect(() => {
    applyEditorTheme(editorHost.getMonaco(), editorTheme);
  }, [editorTheme]);

  useEffect(() => {
    editorHost
      .getEditor()
      ?.updateOptions({ wordWrap: wordWrap ? "on" : "off" });
  }, [wordWrap]);

  useEffect(() => {
    editorHost.getEditor()?.updateOptions({ readOnly });
  }, [readOnly]);

  return <div className="code-editor" ref={containerRef} />;
}

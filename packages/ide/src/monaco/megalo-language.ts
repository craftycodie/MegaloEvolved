import {
  SEMANTIC_TOKEN_MODIFIERS,
  SEMANTIC_TOKEN_TYPES,
} from "@megacrow/megalo";
import type * as MonacoApi from "monaco-editor";
import type {
  Hover,
  MarkedString,
  MarkupContent,
} from "vscode-languageserver-protocol";
import { diagnosticHasEditorSpan, type MegaloDiagnostic } from "../compile";
import {
  findPathReferences,
  getMegaloFoldRanges,
  REGION_END,
  REGION_START,
} from "../editor";
import { documentKeyForModel } from "../editor/modelRegistry";
import type { Monaco } from "../editor/monacoTypes";
import {
  lspCompletions,
  lspDefinition,
  lspHover,
  lspSemanticTokens,
} from "../lsp";

const MEGALO_LANGUAGE_ID = "megalo";
type MegaloCodeEditor = ReturnType<typeof MonacoApi.editor.getEditors>[number];
type MegaloTextModel = MonacoApi.editor.ITextModel;
type MegaloPosition = MonacoApi.IPosition;
type MegaloUri = MonacoApi.Uri;
type MegaloCancellationToken = MonacoApi.CancellationToken;

/** Plain text of an LSP hover, whatever shape the server used. */
function hoverText(contents: Hover["contents"]): string {
  const part = (item: MarkedString | MarkupContent): string =>
    typeof item === "string" ? item : item.value;
  return Array.isArray(contents)
    ? contents.map(part).join("\n\n")
    : part(contents);
}

let languageBasicsRegistered = false;
let semanticTokensDisposable: { dispose(): void } | undefined;
let hoverDisposable: { dispose(): void } | undefined;
let definitionDisposable: { dispose(): void } | undefined;
let completionDisposable: { dispose(): void } | undefined;
let blockSnippetCommandDisposable: { dispose(): void } | undefined;
let linkDisposable: { dispose(): void } | undefined;
let linkOpenerDisposable: { dispose(): void } | undefined;
let editorOpenerDisposable: { dispose(): void } | undefined;
let activeMegaloEditor: MegaloCodeEditor | null = null;

/** After a block insert, move onto the indented body and reopen suggest. */
const BLOCK_SNIPPET_COMMAND = "megacrow.enterBlockBodyAndSuggest";

export function setActiveMegaloEditor(editor: MegaloCodeEditor | null): void {
  activeMegaloEditor = editor;
}

export function clearActiveMegaloEditor(editor: MegaloCodeEditor): void {
  if (activeMegaloEditor === editor) {
    activeMegaloEditor = null;
  }
}

/** Custom scheme for Ctrl+Click include / base path links. */
export const MEGACROW_PATH_SCHEME = "megacrow-path";

/** Custom scheme for go-to-definition into another Megalo source file. */
export const MEGACROW_DEFINITION_SCHEME = "megacrow-definition";

export type MegaloPathOpenHandler = (payload: {
  kind: "include" | "localized_include" | "base";
  path: string;
}) => void | Promise<void>;

export type MegaloDefinitionOpenHandler = (payload: {
  file: string;
  line: number;
  column: number;
}) => void | Promise<void>;

let pathOpenHandler: MegaloPathOpenHandler | null = null;
let definitionOpenHandler: MegaloDefinitionOpenHandler | null = null;

export function setMegaloPathOpenHandler(
  handler: MegaloPathOpenHandler | null
): void {
  pathOpenHandler = handler;
}

export function setMegaloDefinitionOpenHandler(
  handler: MegaloDefinitionOpenHandler | null
): void {
  definitionOpenHandler = handler;
}

function encodePathLinkUrl(
  monaco: Monaco,
  kind: "include" | "localized_include" | "base",
  path: string
): MonacoApi.Uri {
  return monaco.Uri.from({
    scheme: MEGACROW_PATH_SCHEME,
    path: `/${kind}`,
    query: `path=${encodeURIComponent(path)}`,
  });
}

function decodePathLinkUrl(
  uri: MonacoApi.Uri
): { kind: "include" | "localized_include" | "base"; path: string } | null {
  if (uri.scheme !== MEGACROW_PATH_SCHEME) {
    return null;
  }
  const kind = uri.path.replace(/^\//, "") as
    | "include"
    | "localized_include"
    | "base";
  if (kind !== "include" && kind !== "localized_include" && kind !== "base") {
    return null;
  }
  const params = new URLSearchParams(uri.query);
  const path = params.get("path");
  if (!path) {
    return null;
  }
  return { kind, path };
}

function decodeDefinitionUrl(
  uri: MonacoApi.Uri
): { file: string; line: number; column: number } | null {
  if (uri.scheme !== MEGACROW_DEFINITION_SCHEME) {
    return null;
  }
  const params = new URLSearchParams(uri.query);
  const file = params.get("file");
  const line = Number(params.get("line"));
  const character = Number(params.get("character"));
  if (
    !(file && Number.isFinite(line) && Number.isFinite(character)) ||
    line < 0 ||
    character < 0
  ) {
    return null;
  }
  return { file, line: line + 1, column: character + 1 };
}

/** Decode, clip to live model line lengths, and re-encode semantic tokens. */
function clipSemanticTokenDataToModel(
  model: MonacoApi.editor.ITextModel,
  data: number[]
): number[] {
  const absolute: {
    line: number;
    character: number;
    length: number;
    type: number;
    modifiers: number;
  }[] = [];
  let line = 0;
  let character = 0;
  for (let i = 0; i + 4 < data.length; i += 5) {
    const lineDelta = data[i]!;
    const charDelta = data[i + 1]!;
    let length = data[i + 2]!;
    const tokenType = data[i + 3]!;
    const tokenModifiers = data[i + 4]!;
    if (lineDelta > 0) {
      line += lineDelta;
      character = charDelta;
    } else {
      character += charDelta;
    }
    if (line + 1 > model.getLineCount()) {
      continue;
    }
    const lineLength = model.getLineLength(line + 1);
    if (character >= lineLength) {
      continue;
    }
    length = Math.min(length, lineLength - character);
    if (length <= 0) {
      continue;
    }
    absolute.push({
      line,
      character,
      length,
      type: tokenType,
      modifiers: tokenModifiers,
    });
  }

  const relative: number[] = [];
  let prevLine = 0;
  let prevChar = 0;
  for (const token of absolute) {
    const lineDelta = token.line - prevLine;
    const charDelta =
      lineDelta === 0 ? token.character - prevChar : token.character;
    relative.push(
      lineDelta,
      charDelta,
      token.length,
      token.type,
      token.modifiers
    );
    prevLine = token.line;
    prevChar = token.character;
  }
  return relative;
}

export type { MegaloDiagnostic } from "../compile";

function diagnosticToMarker(
  monaco: Monaco,
  model: MonacoApi.editor.ITextModel,
  diagnostic: MegaloDiagnostic
): MonacoApi.editor.IMarkerData {
  const lineCount = model.getLineCount();
  const startLine = Math.min(Math.max(1, diagnostic.line), lineCount);
  const endLineNumber = Math.min(
    Math.max(startLine, diagnostic.endLine ?? startLine),
    lineCount
  );
  const startLineLength = model.getLineLength(startLine);
  const endLineLength = model.getLineLength(endLineNumber);
  const startColumn = Math.min(
    Math.max(1, diagnostic.column),
    startLineLength + 1
  );

  let endColumn = diagnostic.endColumn ?? startColumn + 1;
  if (endLineNumber === startLine) {
    endColumn = Math.min(
      Math.max(endColumn, startColumn + 1),
      startLineLength + 1
    );
  } else {
    endColumn = Math.min(Math.max(1, endColumn), endLineLength + 1);
  }

  if (
    diagnostic.offset !== undefined &&
    diagnostic.length !== undefined &&
    diagnostic.length > 0
  ) {
    const valueLength = model.getValueLength();
    const startOffset = Math.min(Math.max(0, diagnostic.offset), valueLength);
    const endOffset = Math.min(startOffset + diagnostic.length, valueLength);
    const start = model.getPositionAt(startOffset);
    const end = model.getPositionAt(endOffset);
    return {
      severity:
        diagnostic.severity === "warning"
          ? monaco.MarkerSeverity.Warning
          : monaco.MarkerSeverity.Error,
      startLineNumber: start.lineNumber,
      startColumn: start.column,
      endLineNumber: end.lineNumber,
      endColumn: Math.max(end.column, start.column + 1),
      message: diagnostic.message,
      source: "megalo",
    };
  }

  return {
    severity:
      diagnostic.severity === "warning"
        ? monaco.MarkerSeverity.Warning
        : monaco.MarkerSeverity.Error,
    startLineNumber: startLine,
    startColumn,
    endLineNumber,
    endColumn,
    message: diagnostic.message,
    source: "megalo",
  };
}

/** Map LSP CompletionItemKind → Monaco CompletionItemKind. */
const monacoCompletionKind = (
  monaco: Monaco,
  lspKind: number | undefined
): number => {
  const Kind = monaco.languages.CompletionItemKind;
  switch (lspKind) {
    case 14: // Keyword
      return Kind.Keyword;
    case 3: // Function
      return Kind.Function;
    case 6: // Variable
      return Kind.Variable;
    case 10: // Property
      return Kind.Property;
    case 7: // Class
      return Kind.Class;
    case 20: // EnumMember
      return Kind.EnumMember;
    case 21: // Constant
      return Kind.Constant;
    case 17: // File
      return Kind.File;
    case 19: // Folder
      return Kind.Folder;
    case 1: // Text
      return Kind.Text;
    case 15: // Snippet
      return Kind.Snippet;
    default:
      return Kind.Text;
  }
};

/**
 * Hop onto the blank body line of a just-inserted `header / indent / end` block,
 * whether the cursor stayed on the header or landed after `end`.
 */
const isBlankIndentLine = (text: string): boolean => /^\s*$/.test(text);

const moveCursorIntoInsertedBlockBody = (editor: MegaloCodeEditor): void => {
  const model = editor.getModel();
  const pos = editor.getPosition();
  if (!model) {
    return;
  }
  if (!pos) {
    return;
  }
  const line = pos.lineNumber;
  const headerCandidates = [line, line - 2];
  for (const headerLine of headerCandidates) {
    if (headerLine < 1 || headerLine + 2 > model.getLineCount()) {
      continue;
    }
    const body = model.getLineContent(headerLine + 1);
    const closer = model.getLineContent(headerLine + 2);
    if (!isBlankIndentLine(body) || closer.trim() !== "end") {
      continue;
    }
    // `trigger` / `for_each` still need a type on the header; `variables`
    // still needs a scope; named blocks still need a same-line name.
    // Leave the cursor there so the user (or suggest) can fill it in.
    const header = model.getLineContent(headerLine);
    if (
      /^\s*(trigger|for_each|variables|map_object|loadout|loadout_palette|requisition_palette|string_table)(\s+\S*)?\s*$/i.test(
        header
      )
    ) {
      continue;
    }
    editor.setPosition({
      lineNumber: headerLine + 1,
      column: body.length + 1,
    });
    return;
  }
};

/** `${1:name}` / `$1` placeholders → the default text (or empty). */
const stripSnippetPlaceholders = (text: string): string =>
  text.replace(/\$\{\d+:([^}]*)\}/g, "$1").replace(/\$\d+/g, "");

/** Prefix continuation lines so nested `end` matches the header indent. */
const indentBlockInsert = (text: string, lineIndent: string): string => {
  if (lineIndent === "") {
    return text;
  }
  const lines = text.split("\n");
  return lines
    .map((line, index) => (index === 0 ? line : `${lineIndent}${line}`))
    .join("\n");
};

/** Register language + theme before the editor mounts. */
let featuresRegistered = false;

/**
 * Register the Megalo language and its LSP-backed features. Runs once, from
 * monacoBootstrap; later calls do nothing. On hot reload the old module's
 * providers are disposed (see the bottom of this file) and the new module
 * registers fresh ones.
 */
export function registerMegaloLanguage(monaco: Monaco): void {
  if (featuresRegistered) {
    return;
  }
  featuresRegistered = true;
  if (!languageBasicsRegistered) {
    languageBasicsRegistered = true;
    monaco.languages.register({ id: MEGALO_LANGUAGE_ID });

    monaco.languages.setLanguageConfiguration(MEGALO_LANGUAGE_ID, {
      comments: {
        lineComment: ";",
      },
      folding: {
        markers: {
          start: REGION_START,
          end: REGION_END,
        },
      },
      wordPattern: /(-?\d*\.\d\w*)|([a-zA-Z_][\w]*)/g,
      // Megalo has no bracket syntax. Declare none explicitly (Monaco falls
      // back to ()/[]/{} otherwise), so there is no bracket-pair colouring
      // or matching.
      brackets: [],
      colorizedBracketPairs: [],
      autoClosingPairs: [{ open: '"', close: '"' }],
      surroundingPairs: [{ open: '"', close: '"' }],
    });

    monaco.languages.registerFoldingRangeProvider(MEGALO_LANGUAGE_ID, {
      provideFoldingRanges(model: MegaloTextModel) {
        const lines = model.getLinesContent();
        return getMegaloFoldRanges(lines).map((range) => ({
          start: range.start,
          end: range.end,
          kind: monaco.languages.FoldingRangeKind.Region,
        }));
      },
    });
  }

  if (!blockSnippetCommandDisposable) {
    blockSnippetCommandDisposable = monaco.editor.registerCommand(
      BLOCK_SNIPPET_COMMAND,
      () => {
        const editor =
          activeMegaloEditor ??
          monaco.editor
            .getEditors()
            .find((item: MegaloCodeEditor) => item.hasTextFocus()) ??
          monaco.editor.getEditors().at(-1);
        if (!editor) {
          return;
        }
        window.setTimeout(() => {
          moveCursorIntoInsertedBlockBody(editor);
          editor.trigger("megacrow", "editor.action.triggerSuggest", {
            auto: true,
          });
        }, 0);
      }
    );
  }

  semanticTokensDisposable?.dispose();
  semanticTokensDisposable =
    monaco.languages.registerDocumentSemanticTokensProvider(
      MEGALO_LANGUAGE_ID,
      {
        getLegend() {
          return {
            tokenTypes: [...SEMANTIC_TOKEN_TYPES],
            tokenModifiers: [...SEMANTIC_TOKEN_MODIFIERS],
          };
        },
        async provideDocumentSemanticTokens(
          model: MegaloTextModel,
          _lastResultId: string | null,
          token: MegaloCancellationToken
        ) {
          const data = await lspSemanticTokens(model.getValue(), {
            token,
            uri: documentKeyForModel(model),
          });
          return {
            data: new Uint32Array(clipSemanticTokenDataToModel(model, data)),
          };
        },
        releaseDocumentSemanticTokens() {
          // Full-document tokens only; nothing to release.
        },
      }
    );

  hoverDisposable?.dispose();
  hoverDisposable = monaco.languages.registerHoverProvider(MEGALO_LANGUAGE_ID, {
    async provideHover(
      model: MegaloTextModel,
      position: MegaloPosition,
      token: MegaloCancellationToken
    ) {
      try {
        const hover = await lspHover(
          model.getValue(),
          { line: position.lineNumber - 1, character: position.column - 1 },
          { token, uri: documentKeyForModel(model) }
        );
        if (!hover) {
          return null;
        }
        const value = hoverText(hover.contents);
        return {
          contents: [{ value }],
          range: hover.range
            ? {
                startLineNumber: hover.range.start.line + 1,
                startColumn: hover.range.start.character + 1,
                endLineNumber: hover.range.end.line + 1,
                endColumn: hover.range.end.character + 1,
              }
            : undefined,
        };
      } catch (error) {
        console.error("[megalo] hover failed", error);
        return null;
      }
    },
  });

  definitionDisposable?.dispose();
  definitionDisposable = monaco.languages.registerDefinitionProvider(
    MEGALO_LANGUAGE_ID,
    {
      async provideDefinition(
        model: MegaloTextModel,
        position: MegaloPosition,
        token: MegaloCancellationToken
      ) {
        try {
          const locations = await lspDefinition(
            model.getValue(),
            { line: position.lineNumber - 1, character: position.column - 1 },
            { token, uri: documentKeyForModel(model) }
          );
          return locations.map((location) => {
            if (location.uri.startsWith(`${MEGACROW_DEFINITION_SCHEME}:`)) {
              return {
                uri: monaco.Uri.parse(location.uri),
                range: {
                  startLineNumber: location.range.start.line + 1,
                  startColumn: location.range.start.character + 1,
                  endLineNumber: location.range.end.line + 1,
                  endColumn: location.range.end.character + 1,
                },
              };
            }
            return {
              uri: model.uri,
              range: {
                startLineNumber: location.range.start.line + 1,
                startColumn: location.range.start.character + 1,
                endLineNumber: location.range.end.line + 1,
                endColumn: location.range.end.character + 1,
              },
            };
          });
        } catch (error) {
          console.error("[megalo] definition failed", error);
          return [];
        }
      },
    }
  );

  completionDisposable?.dispose();
  completionDisposable = monaco.languages.registerCompletionItemProvider(
    MEGALO_LANGUAGE_ID,
    {
      triggerCharacters: [" ", ".", "_", '"', "/"],
      async provideCompletionItems(
        model: MegaloTextModel,
        position: MegaloPosition,
        _context: unknown,
        token: MegaloCancellationToken
      ) {
        try {
          const items = await lspCompletions(
            model.getValue(),
            { line: position.lineNumber - 1, character: position.column - 1 },
            { token, uri: documentKeyForModel(model) }
          );
          const word = model.getWordUntilPosition(position);
          const lineContent = model.getLineContent(position.lineNumber);
          const before = lineContent.slice(0, position.column - 1);
          const defaultRange = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };
          // Path segments may include `.` (e.g. `script.txt`); replace from the
          // last `/` or opening `"` through the cursor.
          const pathSegStart = Math.max(
            before.lastIndexOf("/"),
            before.lastIndexOf('"')
          );
          const pathRange = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: pathSegStart + 2,
            endColumn: position.column,
          };
          const lineIndent = /^[\t ]*/.exec(lineContent)?.[0] ?? "";
          const suggestions = items.map((item) => {
            const isPath =
              item.kind === 17 /* File */ || item.kind === 19 /* Folder */;
            const rawInsert = item.insertText ?? item.label;
            const isSnippet = item.insertTextFormat === 2 /* Snippet */;
            const hasNamedTabstop = /\$\{\d+/.test(rawInsert);
            // `${1:name}` already seeds the header; don't reopen suggest on it.
            const hasPlaceholderDefault = /\$\{\d+:/.test(rawInsert);
            // Monaco does not reliably place `$1` on a new line. Insert the
            // block as plain text and move the cursor in BLOCK_SNIPPET_COMMAND.
            // Named header tabstops (`${1}` / `${1:name}`) stay as snippets so
            // the cursor lands on the name/kind field instead of jumping to the body.
            const insertText =
              isSnippet && !hasNamedTabstop
                ? indentBlockInsert(
                    stripSnippetPlaceholders(rawInsert),
                    lineIndent
                  )
                : rawInsert;
            let command:
              | {
                  id: string;
                  title: string;
                  arguments?: unknown[];
                }
              | undefined;
            if (isSnippet && !hasNamedTabstop) {
              command = {
                id: BLOCK_SNIPPET_COMMAND,
                title: "Move into block body",
              };
            } else if (item.command && !hasPlaceholderDefault) {
              command = {
                id: item.command.command,
                title: item.command.title,
                arguments: item.command.arguments ?? [{ auto: true }],
              };
            }
            return {
              label: item.label,
              kind: monacoCompletionKind(monaco, item.kind),
              detail: item.detail,
              documentation:
                typeof item.documentation === "string"
                  ? item.documentation
                  : item.documentation?.value,
              insertText,
              filterText: item.filterText ?? item.label,
              range: isPath ? pathRange : defaultRange,
              ...(isSnippet && hasNamedTabstop
                ? {
                    insertTextRules:
                      monaco.languages.CompletionItemInsertTextRule
                        .InsertAsSnippet,
                  }
                : {}),
              ...(command ? { command } : {}),
            };
          });
          // Empty results: don't keep the widget open / incomplete-loading.
          if (suggestions.length === 0) {
            return { suggestions: [], incomplete: false };
          }
          return {
            suggestions,
            // Re-query as the user keeps typing so 1-char prefixes aren't stuck.
            incomplete: true,
          };
        } catch (error) {
          console.error("[megalo] completions failed", error);
          return { suggestions: [] };
        }
      },
    }
  );

  linkDisposable?.dispose();
  linkDisposable = monaco.languages.registerLinkProvider(MEGALO_LANGUAGE_ID, {
    provideLinks(model: MegaloTextModel) {
      const references = findPathReferences(model.getValue());
      return {
        links: references.map((ref) => ({
          range: ref.range,
          url: encodePathLinkUrl(monaco, ref.kind, ref.path),
          tooltip:
            ref.kind === "base"
              ? `Open source for base "${ref.path}"`
              : `Open ${ref.path}`,
        })),
      };
    },
  });

  if (!linkOpenerDisposable) {
    linkOpenerDisposable = monaco.editor.registerLinkOpener({
      async open(resource: MegaloUri) {
        const pathDecoded = decodePathLinkUrl(resource);
        if (pathDecoded && pathOpenHandler) {
          await pathOpenHandler(pathDecoded);
          return true;
        }
        const definitionDecoded = decodeDefinitionUrl(resource);
        if (definitionDecoded && definitionOpenHandler) {
          await definitionOpenHandler(definitionDecoded);
          return true;
        }
        return false;
      },
    });
  }

  if (!editorOpenerDisposable) {
    editorOpenerDisposable = monaco.editor.registerEditorOpener({
      async openCodeEditor(_source: MegaloCodeEditor, resource: MegaloUri) {
        const definitionDecoded = decodeDefinitionUrl(resource);
        if (!(definitionDecoded && definitionOpenHandler)) {
          return false;
        }
        await definitionOpenHandler(definitionDecoded);
        return true;
      },
    });
  }

  // After a hot reload, re-tokenize open models with the new providers.
  for (const model of monaco.editor.getModels()) {
    if (model.getLanguageId() === MEGALO_LANGUAGE_ID) {
      monaco.editor.setModelLanguage(model, "plaintext");
      monaco.editor.setModelLanguage(model, MEGALO_LANGUAGE_ID);
    }
  }
}

export function setMegaloDiagnostics(
  monaco: Monaco,
  model: MonacoApi.editor.ITextModel,
  diagnostics: MegaloDiagnostic[]
): void {
  monaco.editor.setModelMarkers(
    model,
    "megalo",
    diagnostics
      .filter((d) => diagnosticHasEditorSpan(d))
      .map((d) => diagnosticToMarker(monaco, model, d))
  );
}

export { MEGALO_LANGUAGE_ID };

function disposeMegaloLanguageFeatures(): void {
  for (const disposable of [
    semanticTokensDisposable,
    hoverDisposable,
    definitionDisposable,
    completionDisposable,
    blockSnippetCommandDisposable,
    linkDisposable,
    linkOpenerDisposable,
    editorOpenerDisposable,
  ]) {
    disposable?.dispose();
  }
  featuresRegistered = false;
}

if (import.meta.hot) {
  import.meta.hot.dispose(disposeMegaloLanguageFeatures);
}

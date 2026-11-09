// biome-ignore lint/performance/noNamespaceImport: the app hands the Monaco API namespace to editorHost and the language setup.
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { registerMegaloLanguage } from "../monaco/megalo-language";
import { applyEditorTheme } from "../monaco/theme";
import { editorHost } from "./editorHost";

self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};

// Monaco cancels internal delayed work (folding, code lens) when the editor
// switches models, and some of those promises reject with a "Canceled"
// error nobody awaits. Monaco treats it as expected; keep it out of the
// console as an unhandled rejection.
window.addEventListener("unhandledrejection", (event) => {
  const reason: unknown = event.reason;
  if (
    reason instanceof Error &&
    reason.name === "Canceled" &&
    reason.message === "Canceled"
  ) {
    event.preventDefault();
  }
});

// Language features talk to the LSP; register them once for the whole app.
registerMegaloLanguage(monaco);
editorHost.initialize(monaco);
// Define the default theme before the first editor mounts with it; the
// editor switches to the user's theme on mount.
applyEditorTheme(monaco);

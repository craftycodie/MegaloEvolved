import { documentKindFor } from "../editor/documentKey";
import { editorHost } from "../editor/editorHost";
import { EMPTY_FILE_NAV } from "../editor/fileNavigation";
import { installFileNavShortcuts } from "../editor/fileNavShortcuts";
import { subscribeLspConfigChanges } from "../lsp";
import {
  setMegaloDefinitionOpenHandler,
  setMegaloPathOpenHandler,
} from "../monaco/megalo-language";
import { analyzeDocument } from "./compileStore";
import {
  autosave,
  documentStore,
  navigateBack,
  navigateForward,
  openPathReference,
  restoreLastOpenFile,
  selectCanNavigateBack,
  selectCanNavigateForward,
} from "./documentStore";
import { settingsStore } from "./settingsStore";

function recompileActive(): void {
  const active = documentStore.getState().active;
  const text = active ? editorHost.getText(active.key) : null;
  if (!active || text === null || active.kind === "text") {
    return;
  }
  void analyzeDocument(
    { key: active.key, kind: active.kind, text },
    { fresh: false }
  );
}

/**
 * Wire documents to the rest of the app: autosave and recompile on edits,
 * recompile when the LSP configuration changes, restore the last file when a
 * workspace becomes active, and open include / definition links. Call once
 * at startup; returns a function that stops everything.
 */
export function installDocumentEffects(): () => void {
  const stops: (() => void)[] = [];

  stops.push(
    editorHost.subscribeChanges((document, text, reason) => {
      if (reason === "save") {
        autosave(document, text);
        return;
      }
      if (document.key === documentStore.getState().active?.key) {
        void analyzeDocument(
          { key: document.key, kind: document.kind, text },
          { fresh: false }
        );
      }
    })
  );

  stops.push(subscribeLspConfigChanges(recompileActive));

  let restoredWorkspaceId: string | null = null;
  const onSettings = () => {
    const { activeWorkspace, status } = settingsStore.getState();
    if (status !== "ready" || !activeWorkspace) {
      return;
    }
    if (activeWorkspace.id !== restoredWorkspaceId) {
      restoredWorkspaceId = activeWorkspace.id;
      documentStore.setState({ history: EMPTY_FILE_NAV });
      restoreLastOpenFile();
    }
  };
  stops.push(settingsStore.subscribe(onSettings));
  onSettings();

  // Object list names arrive per Megalo version; a shown `object_lists/`
  // file may turn from plain text into an analyzed list (or back).
  stops.push(
    settingsStore.subscribe((state, previous) => {
      if (state.objectListNames === previous.objectListNames) {
        return;
      }
      const active = documentStore.getState().active;
      if (!active) {
        return;
      }
      const kind = documentKindFor(
        active.path,
        active.displayName,
        state.objectListNames
      );
      if (kind === active.kind) {
        return;
      }
      const text = editorHost.getText(active.key) ?? "";
      const next = { ...active, kind };
      editorHost.open(next, text);
      documentStore.setState({ active: next });
      void analyzeDocument({ key: next.key, kind, text }, { fresh: true });
    })
  );

  // Mouse back/forward buttons and browser keys move through file history.
  stops.push(
    installFileNavShortcuts({
      canGoBack: () => selectCanNavigateBack(documentStore.getState()),
      canGoForward: () => selectCanNavigateForward(documentStore.getState()),
      goBack: navigateBack,
      goForward: navigateForward,
    })
  );

  setMegaloPathOpenHandler(async ({ kind, path }) => {
    await openPathReference(kind, path);
  });
  setMegaloDefinitionOpenHandler(async ({ column, file, line }) => {
    await openPathReference("include", file, { column, line });
  });
  stops.push(() => {
    setMegaloPathOpenHandler(null);
    setMegaloDefinitionOpenHandler(null);
  });

  return () => {
    for (const stop of stops) {
      stop();
    }
  };
}

import {
  _event_error,
  _event_status,
  _event_verbose,
  event,
} from "@blamnetwork/datamine";
import { setLocale as setCompilerLocale } from "@megacrow/megalo";
import {
  compilerSettingsFromApp,
  preloadCompileClient,
  syncMegaloCompilerSettings,
  syncMegaloWorkspace,
} from "../compile";
import { setIdeLocale } from "../localization";
import { lspUpdateConfig, lspVersionConfiguration } from "../lsp";
import type { AppSettings } from "../workspace/appSettings";
import {
  type SettingsState,
  setObjectListNames,
  settingsStore,
} from "./settingsStore";

function syncAppSettings(appSettings: AppSettings): void {
  const compilerSettings = compilerSettingsFromApp(appSettings);
  syncMegaloCompilerSettings(compilerSettings);
  const locale = appSettings.locale === "ja" ? "ja" : "en";
  setCompilerLocale(locale);
  setIdeLocale(locale);
  // Sent only when the merged server configuration changes, so unrelated
  // settings saves (e.g. `lastOpenFilePath`) do not re-analyze documents.
  lspUpdateConfig({
    locale,
    megacrowExtensions: compilerSettings.megacrowExtensions,
    compilerSettings: {
      strictStringLiterals: compilerSettings.strictStringLiterals,
      creatorGamertag: compilerSettings.creatorGamertag,
    },
  });
}

function logWorkspace(workspace: SettingsState["activeWorkspace"]): void {
  if (!workspace) {
    event(_event_status, "ide:settings: no active workspace");
    return;
  }
  event(
    _event_status,
    "ide:settings: active workspace %s (%s, Megalo %s) at %s",
    workspace.name,
    workspace.type,
    workspace.megaloVersion,
    workspace.inputPath
  );
}

let objectListRequest = 0;

/** Object list names for the active version; only the newest request lands. */
function loadObjectListNames(
  workspace: SettingsState["activeWorkspace"]
): void {
  const request = ++objectListRequest;
  const megaloVersion = workspace?.megaloVersion;
  if (!megaloVersion) {
    return;
  }
  lspVersionConfiguration(megaloVersion)
    .then((config) => {
      if (request === objectListRequest) {
        event(
          _event_verbose,
          "ide:settings: Megalo %s has %d object lists",
          megaloVersion,
          config.objectListNames.length
        );
        setObjectListNames(config.objectListNames);
      }
    })
    .catch((error: unknown) => {
      event(
        _event_error,
        "ide:settings: Failed to load Megalo version configuration: %s",
        String(error)
      );
    });
}

/**
 * Push settings to the compiler, the LSP and the locale whenever they change.
 * Call once at startup; returns a function that stops listening.
 */
export function installSettingsEffects(): () => void {
  preloadCompileClient();
  const initial = settingsStore.getState();
  syncAppSettings(initial.appSettings);
  syncMegaloWorkspace(initial.activeWorkspace);
  loadObjectListNames(initial.activeWorkspace);

  return settingsStore.subscribe((state, previous) => {
    if (state.appSettings !== previous.appSettings) {
      syncAppSettings(state.appSettings);
    }
    if (state.activeWorkspace !== previous.activeWorkspace) {
      if (state.activeWorkspace?.id !== previous.activeWorkspace?.id) {
        logWorkspace(state.activeWorkspace);
      }
      syncMegaloWorkspace(state.activeWorkspace);
      if (
        state.activeWorkspace?.megaloVersion !==
        previous.activeWorkspace?.megaloVersion
      ) {
        loadObjectListNames(state.activeWorkspace);
      }
    }
  });
}

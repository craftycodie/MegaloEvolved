import {
  _event_error,
  _event_status,
  _event_warning,
  event,
} from "@blamnetwork/datamine";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { APP_NAME } from "../app/constants";
import { isTauriRuntime } from "../desktop/tauriRuntime";
import { createSaveQueue } from "../files/saveQueue";
import type { AppSettings } from "../workspace/appSettings";
import {
  appSettingsFromMegacrow,
  bootstrapMegacrowSettings,
  defaultMegacrowSettings,
  type MegacrowSettings,
  mergeAppSettings,
  persistMegacrowSettings,
} from "../workspace/megacrowSettings";
import { resolveActiveWorkspace, type Workspace } from "../workspace/workspace";

export interface SettingsState {
  /** The active workspace (derived from settings, or a session override). */
  activeWorkspace: Workspace | null;
  /** App preferences, derived from `settings`; stable between updates. */
  appSettings: AppSettings;
  /** Bootstrap found no workspace; the IDE asks the user to add one. */
  needsAddWorkspace: boolean;
  /** Object list table names for the active workspace's Megalo version. */
  objectListNames: readonly string[];
  settings: MegacrowSettings;
  status: "loading" | "ready";
}

export interface UpdateSettingsOptions {
  /**
   * Use this workspace instead of the one `activeWorkspaceId` names. The
   * browser workspace is not part of `settings.workspaces`, so changing its
   * Megalo version is passed this way.
   */
  activeWorkspace?: Workspace | null;
}

const initialSettings = defaultMegacrowSettings();

export const settingsStore = createStore<SettingsState>(() => ({
  activeWorkspace: null,
  appSettings: appSettingsFromMegacrow(initialSettings),
  needsAddWorkspace: false,
  objectListNames: [],
  settings: initialSettings,
  status: "loading",
}));

const persistQueue = createSaveQueue();

function applySettings(
  next: MegacrowSettings,
  options: UpdateSettingsOptions = {}
): void {
  const previous = settingsStore.getState();
  let activeWorkspace =
    options.activeWorkspace === undefined
      ? resolveActiveWorkspace(next.workspaces, next.activeWorkspaceId)
      : options.activeWorkspace;
  // The browser workspace is not saved in `settings.workspaces`, so its
  // session changes (Megalo version) would be lost on every later update.
  if (
    options.activeWorkspace === undefined &&
    previous.activeWorkspace?.type === "opfs" &&
    activeWorkspace?.type === "opfs" &&
    activeWorkspace.id === previous.activeWorkspace.id
  ) {
    activeWorkspace = previous.activeWorkspace;
  }
  settingsStore.setState({
    activeWorkspace: sameWorkspace(previous.activeWorkspace, activeWorkspace)
      ? previous.activeWorkspace
      : activeWorkspace,
    appSettings: sameAppSettings(previous.settings, next)
      ? previous.appSettings
      : appSettingsFromMegacrow(next),
    settings: next,
  });
}

/**
 * Change settings from the latest state and save them. Saves run one at a
 * time and the newest wins, so two quick updates cannot overwrite each other
 * or land on disk out of order.
 */
export function updateSettings(
  update: (current: MegacrowSettings) => MegacrowSettings,
  options?: UpdateSettingsOptions
): Promise<void> {
  const state = settingsStore.getState();
  if (state.status !== "ready") {
    // Saving now would overwrite the real settings file with defaults.
    event(
      _event_warning,
      "ide:settings: Ignoring a settings update before settings finished loading"
    );
    return Promise.resolve();
  }
  const current = state.settings;
  const next = update(current);
  if (next === current && options?.activeWorkspace === undefined) {
    return Promise.resolve();
  }
  applySettings(next, options);
  return persistQueue
    .enqueue("settings", () =>
      persistMegacrowSettings(settingsStore.getState().settings)
    )
    .then(() => undefined)
    .catch((error: unknown) => {
      event(
        _event_error,
        "ide:settings: Failed to persist %s settings: %s",
        APP_NAME,
        String(error)
      );
      throw error;
    });
}

export function updateAppSettings(patch: Partial<AppSettings>): Promise<void> {
  return updateSettings((current) => mergeAppSettings(current, patch));
}

/** Session-only workspace change (no save); see `UpdateSettingsOptions`. */
export function setActiveWorkspaceOverride(workspace: Workspace | null): void {
  applySettings(settingsStore.getState().settings, {
    activeWorkspace: workspace,
  });
}

export function setObjectListNames(names: readonly string[]): void {
  const current = settingsStore.getState().objectListNames;
  if (
    current.length === names.length &&
    current.every((name, index) => name === names[index])
  ) {
    return;
  }
  settingsStore.setState({ objectListNames: names });
}

let bootstrapPromise: Promise<void> | null = null;

/** Load (or discover) settings once per app session. */
export function bootstrapSettings(): Promise<void> {
  bootstrapPromise ??= bootstrapMegacrowSettings()
    .then(({ settings, needsAddWorkspace }) => {
      event(
        _event_status,
        "ide:settings: loaded settings: %d workspaces%s",
        settings.workspaces.length,
        needsAddWorkspace ? ", asking for one" : ""
      );
      applySettings(settings);
      settingsStore.setState({ needsAddWorkspace, status: "ready" });
    })
    .catch((error: unknown) => {
      event(
        _event_error,
        "ide:settings: Failed to bootstrap %s settings: %s",
        APP_NAME,
        String(error)
      );
      applySettings(defaultMegacrowSettings(), { activeWorkspace: null });
      settingsStore.setState({
        needsAddWorkspace: isTauriRuntime(),
        status: "ready",
      });
    });
  return bootstrapPromise;
}

/** Active workspace for code outside React (LSP resolvers, file helpers). */
export function getActiveWorkspace(): Workspace | null {
  return settingsStore.getState().activeWorkspace;
}

/** Subscribe a React component to part of the settings state. */
export function useSettings<T>(selector: (state: SettingsState) => T): T {
  return useStore(settingsStore, selector);
}

function sameWorkspace(a: Workspace | null, b: Workspace | null): boolean {
  if (a === b) {
    return true;
  }
  if (!(a && b)) {
    return false;
  }
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.name === b.name &&
    a.megaloVersion === b.megaloVersion &&
    a.gameBuildNumber === b.gameBuildNumber &&
    a.gameLaunchCommand === b.gameLaunchCommand &&
    a.inputPath === b.inputPath &&
    a.outputPath === b.outputPath
  );
}

function sameAppSettings(a: MegacrowSettings, b: MegacrowSettings): boolean {
  return (
    a.compilerProfile === b.compilerProfile &&
    a.compilerStrictness === b.compilerStrictness &&
    a.discordRichPresence === b.discordRichPresence &&
    a.editorTheme === b.editorTheme &&
    a.editorWordWrap === b.editorWordWrap &&
    a.gamertag === b.gamertag &&
    a.locale === b.locale &&
    a.skippedUpdateVersion === b.skippedUpdateVersion
  );
}

import { useSettings } from "../stores/settingsStore";

/**
 * React view of the settings store (stores/settingsStore.ts), in the shape
 * App.tsx uses. Change settings with `updateSettings` / `updateAppSettings`.
 */
export function useMegacrowSettings() {
  const ready = useSettings((state) => state.status === "ready");
  const settingsState = useSettings((state) => state.settings);
  const activeWorkspace = useSettings((state) => state.activeWorkspace);
  const settings = useSettings((state) => state.appSettings);
  const objectListNames = useSettings((state) => state.objectListNames);
  const needsAddWorkspace = useSettings((state) => state.needsAddWorkspace);

  return {
    activeWorkspace,
    bootstrapNeedsAddWorkspace: ready ? needsAddWorkspace : null,
    megacrowSettings: ready ? settingsState : null,
    objectListNames,
    settings,
    workspacesReady: ready,
  };
}

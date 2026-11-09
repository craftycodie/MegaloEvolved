import { setLocale } from "@megacrow/megalo";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  compilerSettingsFromApp,
  preloadCompileClient,
  syncMegaloCompilerSettings,
  syncMegaloWorkspace,
} from "../compile";
import { isTauriRuntime } from "../desktop";
import { setIdeLocale } from "../localization";
import { lspUpdateConfig, lspVersionConfiguration } from "../lsp";
import {
  type AppSettings,
  appSettingsFromMegacrow,
  bootstrapMegacrowSettings,
  defaultMegacrowSettings,
  type MegacrowSettings,
  mergeAppSettings,
  persistMegacrowSettings,
  resolveActiveWorkspace,
  setActiveWorkspace,
  type Workspace,
} from "../workspace";

export function useMegacrowSettings() {
  const [megacrowSettings, setMegacrowSettings] =
    useState<MegacrowSettings | null>(null);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(
    null
  );
  const [workspacesReady, setWorkspacesReady] = useState(false);
  const [bootstrapNeedsAddWorkspace, setBootstrapNeedsAddWorkspace] = useState<
    boolean | null
  >(null);
  const [objectListNames, setObjectListNames] = useState<readonly string[]>([]);

  const settings = useMemo(
    () =>
      megacrowSettings
        ? appSettingsFromMegacrow(megacrowSettings)
        : appSettingsFromMegacrow(defaultMegacrowSettings()),
    [megacrowSettings]
  );

  const applyWorkspace = useCallback((workspace: Workspace | null) => {
    setActiveWorkspace(workspace);
    setActiveWorkspaceState(workspace);
  }, []);

  const commitSettings = useCallback(
    async (next: MegacrowSettings, workspaceOverride?: Workspace | null) => {
      setMegacrowSettings(next);
      const workspace =
        workspaceOverride === undefined
          ? resolveActiveWorkspace(next.workspaces, next.activeWorkspaceId)
          : workspaceOverride;
      applyWorkspace(workspace);
      try {
        await persistMegacrowSettings(next);
      } catch (error) {
        console.error("Failed to persist MegaloEvolved settings:", error);
        throw error;
      }
    },
    [applyWorkspace]
  );

  const handleSettingsChange = useCallback(
    (patch: Partial<AppSettings>) => {
      if (!megacrowSettings) {
        return;
      }
      const next = mergeAppSettings(megacrowSettings, patch);
      void commitSettings(next);
    },
    [commitSettings, megacrowSettings]
  );

  useEffect(() => {
    let cancelled = false;
    void lspVersionConfiguration()
      .then((result) => {
        if (!cancelled) {
          setObjectListNames(result.objectListNames);
        }
      })
      .catch((error) => {
        console.error("Failed to load Megalo version configuration:", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void bootstrapMegacrowSettings()
      .then(({ settings: bootstrapped, needsAddWorkspace }) => {
        if (cancelled) {
          return;
        }
        setMegacrowSettings(bootstrapped);
        applyWorkspace(
          resolveActiveWorkspace(
            bootstrapped.workspaces,
            bootstrapped.activeWorkspaceId
          )
        );
        setBootstrapNeedsAddWorkspace(needsAddWorkspace);
        setWorkspacesReady(true);
      })
      .catch((error) => {
        console.error("Failed to bootstrap MegaloEvolved settings:", error);
        if (!cancelled) {
          const fallback = defaultMegacrowSettings();
          setMegacrowSettings(fallback);
          applyWorkspace(null);
          setBootstrapNeedsAddWorkspace(isTauriRuntime());
          setWorkspacesReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [applyWorkspace]);

  useEffect(() => {
    preloadCompileClient();
  }, []);

  useEffect(() => {
    syncMegaloWorkspace(activeWorkspace);
  }, [activeWorkspace]);

  useEffect(() => {
    const version = activeWorkspace?.megaloVersion;
    if (!version) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        // The version itself reaches the server via `syncMegaloWorkspace`.
        const config = await lspVersionConfiguration(version);
        if (!cancelled) {
          setObjectListNames(config.objectListNames);
        }
      } catch (error) {
        console.error("Failed to sync Megalo version to LSP:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspace?.megaloVersion]);

  useEffect(() => {
    const compilerSettings = compilerSettingsFromApp(settings);
    syncMegaloCompilerSettings(compilerSettings);
    const locale = settings.locale === "ja" ? "ja" : "en";
    setLocale(locale);
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
  }, [
    settings.gamertag,
    settings.compilerStrictness,
    settings.compilerProfile,
    settings.locale,
    settings,
  ]);

  return {
    activeWorkspace,
    applyWorkspace,
    bootstrapNeedsAddWorkspace,
    commitSettings,
    handleSettingsChange,
    megacrowSettings,
    objectListNames,
    setObjectListNames,
    settings,
    workspacesReady,
  };
}

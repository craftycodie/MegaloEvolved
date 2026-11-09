import { _event_status, event } from "@blamnetwork/datamine";
import { MEGACROW_BUILD_STRING } from "@megacrow/megalo";
import { useCallback, useEffect, useRef, useState } from "react";
import { isTauriRuntime } from "../desktop";
import { updateAppSettings } from "../stores/settingsStore";
import type { MegacrowSettings } from "../workspace";
import { checkForAppUpdate, type GithubReleaseInfo } from "./updateCheck";

interface UseUpdateCheckOptions {
  megacrowSettings: MegacrowSettings | null;
  motdOpen: boolean;
  workspacesReady: boolean;
}

export function useUpdateCheck({
  megacrowSettings,
  motdOpen,
  workspacesReady,
}: UseUpdateCheckOptions) {
  const [updateRelease, setUpdateRelease] = useState<GithubReleaseInfo | null>(
    null
  );
  const updateCheckStartedRef = useRef(false);
  const skippedUpdateVersion = megacrowSettings?.skippedUpdateVersion ?? null;
  const settingsLoaded = megacrowSettings !== null;

  // Check once per app session, as soon as settings are loaded. There is no
  // cleanup cancel on purpose: settings commit on every file open, and a
  // cancel tied to those re-renders (or to StrictMode's double effect run)
  // dropped the result while the started flag blocked a retry.
  useEffect(() => {
    if (updateCheckStartedRef.current || !workspacesReady || !settingsLoaded) {
      return;
    }
    updateCheckStartedRef.current = true;
    if (!isTauriRuntime()) {
      return;
    }
    void checkForAppUpdate({
      currentBuildString: MEGACROW_BUILD_STRING,
      skippedUpdateVersion,
    }).then((result) => {
      event(
        _event_status,
        "ide:app: update check: %s",
        result.kind === "available" ? result.release.tagName : "up to date"
      );
      if (result.kind === "available") {
        setUpdateRelease(result.release);
      }
    });
  }, [settingsLoaded, skippedUpdateVersion, workspacesReady]);

  // Wait until the MOTD is closed before showing the update dialog.
  const updateOpen = updateRelease !== null && !motdOpen;

  const handleUpdateDismiss = useCallback(() => {
    setUpdateRelease(null);
  }, []);

  const handleUpdateSkip = useCallback(() => {
    if (updateRelease) {
      updateAppSettings({ skippedUpdateVersion: updateRelease.tagName }).catch(
        () => {
          // Already logged by the settings store.
        }
      );
    }
    setUpdateRelease(null);
  }, [updateRelease]);

  return {
    handleUpdateDismiss,
    handleUpdateSkip,
    updateOpen,
    updateRelease,
  };
}

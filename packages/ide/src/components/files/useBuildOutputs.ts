import { useCallback, useEffect, useState } from "react";
import { isTauriRuntime } from "../../desktop";
import type { BuildOutputEntry } from "../../files";
import { listTauriBuildOutputs } from "../../files";
import { translateDiskError } from "../../localization";
import { watchWorkspaceInput } from "../../workspace";

export function useBuildOutputs(
  outputPath: string | null,
  localDiskRevision: number
) {
  const tauriAvailable = isTauriRuntime();
  const [buildOutputs, setBuildOutputs] = useState<BuildOutputEntry[]>([]);
  const [buildsError, setBuildsError] = useState<string | null>(null);
  /** Set when the output folder itself cannot be listed. */
  const [outputError, setOutputError] = useState<string | null>(null);

  const refreshBuilds = useCallback(async () => {
    if (!outputPath) {
      setBuildOutputs([]);
      setBuildsError(null);
      setOutputError(null);
      return;
    }
    try {
      setBuildsError(null);
      setBuildOutputs(await listTauriBuildOutputs(outputPath));
      setOutputError(null);
    } catch (error) {
      setOutputError(translateDiskError(error));
      setBuildOutputs([]);
    }
  }, [outputPath]);

  useEffect(() => {
    void refreshBuilds();
  }, [refreshBuilds, localDiskRevision]);

  useEffect(() => {
    if (!(tauriAvailable && outputPath)) {
      return;
    }

    let disposed = false;
    let unwatch: (() => void) | null = null;

    void (async () => {
      try {
        const stop = await watchWorkspaceInput(outputPath, () => {
          void refreshBuilds();
        });
        unwatch = stop;
        if (disposed) {
          unwatch?.();
          unwatch = null;
        }
      } catch (error) {
        console.error("Failed to watch workspace output folder:", error);
      }
    })();

    return () => {
      disposed = true;
      unwatch?.();
      unwatch = null;
    };
  }, [tauriAvailable, outputPath, refreshBuilds]);

  return {
    buildOutputs,
    buildsError,
    outputError,
    refreshBuilds,
    setBuildsError,
  };
}

import { useState } from "react";
import { isTauriRuntime } from "../../desktop";
import type { BuildOutputEntry } from "../../files";
import { listTauriBuildOutputs } from "../../files";
import { useWatchedListing } from "./useWatchedListing";

const NO_OUTPUTS: BuildOutputEntry[] = [];

/** Built gametypes in the workspace output folder, kept current. */
export function useBuildOutputs(
  outputPath: string | null,
  localDiskRevision: number
) {
  /** Errors from actions on build outputs (delete, copy…). */
  const [buildsError, setBuildsError] = useState<string | null>(null);
  const listing = useWatchedListing({
    empty: NO_OUTPUTS,
    list: listTauriBuildOutputs,
    path: outputPath,
    refreshKey: localDiskRevision,
    watch: isTauriRuntime(),
  });

  return {
    buildOutputs: listing.data,
    buildsError: buildsError ?? listing.watchError,
    outputError: listing.listError,
    refreshBuilds: listing.refresh,
    setBuildsError,
  };
}

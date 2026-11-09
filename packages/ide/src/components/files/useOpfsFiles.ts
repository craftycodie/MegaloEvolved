import { useCallback, useEffect, useState } from "react";
import { isTauriRuntime } from "../../desktop";
import {
  isOpfsSupported,
  listOpfsGametypes,
  type OpfsGametypeEntry,
} from "../../files";
import { translateDiskError } from "../../localization";

export function useOpfsFiles(opfsRevision: number) {
  const opfsAvailable = isOpfsSupported() && !isTauriRuntime();
  const [opfsFiles, setOpfsFiles] = useState<OpfsGametypeEntry[]>([]);
  const [opfsError, setOpfsError] = useState<string | null>(null);

  const refreshOpfs = useCallback(async () => {
    if (!opfsAvailable) {
      setOpfsFiles([]);
      return;
    }
    try {
      setOpfsError(null);
      setOpfsFiles(await listOpfsGametypes());
    } catch (error) {
      setOpfsError(translateDiskError(error));
      setOpfsFiles([]);
    }
  }, [opfsAvailable]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `opfsRevision` is the re-list signal (bumped after writes); its value is not read.
  useEffect(() => {
    void refreshOpfs();
  }, [refreshOpfs, opfsRevision]);

  return {
    opfsAvailable,
    opfsError,
    opfsFiles,
    refreshOpfs,
    setOpfsError,
  };
}

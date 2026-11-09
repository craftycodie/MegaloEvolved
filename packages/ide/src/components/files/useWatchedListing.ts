import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { translateDiskError } from "../../localization";
import { watchWorkspaceInput } from "../../workspace";

export interface WatchedListing<T> {
  data: T;
  /** The folder itself could not be listed. */
  listError: string | null;
  /** Re-read now. Calls during a read are merged into one more read. */
  refresh: () => Promise<void>;
  /** The folder watcher failed to start; changes made outside are not seen. */
  watchError: string | null;
}

/**
 * List `path` with `list`, re-list when `refreshKey` changes or when the folder
 * changes on disk (desktop only), and drop results for a folder that is no
 * longer current. Refreshes never overlap: requests that arrive during a
 * read are coalesced into a single follow-up read.
 */
export function useWatchedListing<T>(options: {
  empty: T;
  list: (path: string) => Promise<T>;
  path: string | null;
  /** Any change re-lists (e.g. a counter bumped after writes). */
  refreshKey: unknown;
  watch: boolean;
}): WatchedListing<T> {
  const { empty, path, refreshKey, watch } = options;
  const [data, setData] = useState<T>(empty);
  const [listError, setListError] = useState<string | null>(null);
  const [watchError, setWatchError] = useState<string | null>(null);
  const pathRef = useRef(path);
  const runningRef = useRef<Promise<void> | null>(null);
  const againRef = useRef(false);

  const listLatest = useEffectEvent((target: string) => options.list(target));

  const readOnce = useCallback(async () => {
    const target = pathRef.current;
    if (!target) {
      return;
    }
    try {
      const next = await listLatest(target);
      if (pathRef.current === target) {
        setData(next);
        setListError(null);
      }
    } catch (error) {
      if (pathRef.current === target) {
        setData(empty);
        setListError(translateDiskError(error));
      }
    }
  }, [empty]);

  const refresh = useCallback((): Promise<void> => {
    if (runningRef.current) {
      againRef.current = true;
      return runningRef.current;
    }
    const run = (async () => {
      do {
        againRef.current = false;
        await readOnce();
      } while (againRef.current);
    })().finally(() => {
      runningRef.current = null;
    });
    runningRef.current = run;
    return run;
  }, [readOnce]);

  // New folder: forget the old one's data before listing.
  useEffect(() => {
    pathRef.current = path;
    setData(empty);
    setListError(null);
    setWatchError(null);
  }, [empty, path]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `refreshKey` is the re-list signal itself; its value is not read.
  useEffect(() => {
    if (path) {
      void refresh();
    }
  }, [path, refresh, refreshKey]);

  useEffect(() => {
    if (!(watch && path)) {
      return;
    }
    let disposed = false;
    let unwatch: (() => void) | null = null;
    watchWorkspaceInput(path, () => void refresh())
      .then((stop) => {
        if (disposed) {
          stop?.();
        } else {
          unwatch = stop;
        }
      })
      .catch((error: unknown) => {
        console.error(`Failed to watch ${path}:`, error);
        if (!disposed) {
          setWatchError(translateDiskError(error));
        }
      });
    return () => {
      disposed = true;
      unwatch?.();
    };
  }, [path, refresh, watch]);

  return { data, listError, refresh, watchError };
}

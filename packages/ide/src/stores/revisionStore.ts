import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

interface RevisionState {
  /** Bumped when the desktop workspace folder changed and should re-list. */
  localDisk: number;
  /** Bumped when browser storage changed and should re-list. */
  opfs: number;
}

/** Counters the file panels watch to re-read their folders. */
export const revisionStore = createStore<RevisionState>(() => ({
  localDisk: 0,
  opfs: 0,
}));

export function bumpLocalDiskRevision(): void {
  revisionStore.setState((state) => ({ localDisk: state.localDisk + 1 }));
}

export function bumpOpfsRevision(): void {
  revisionStore.setState((state) => ({ opfs: state.opfs + 1 }));
}

export function useRevisions<T>(selector: (state: RevisionState) => T): T {
  return useStore(revisionStore, selector);
}

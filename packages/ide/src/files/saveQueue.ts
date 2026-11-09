/**
 * Runs writes one at a time per key (a file path), latest wins.
 *
 * While a write for a key is running, a newer write for the same key waits;
 * if an even newer one arrives first, the waiting one is dropped. So writes
 * for one file never overlap and the last text written is the newest.
 */
export interface SaveQueue {
  /**
   * Queue `write` for `key`. Resolves to the write's result, or to
   * `"superseded"` when a newer write for the key replaced it before it ran.
   */
  enqueue<T>(key: string, write: () => Promise<T>): Promise<T | "superseded">;
  /** Resolves once nothing is running or waiting for `key`. */
  idle(key: string): Promise<void>;
}

interface PendingWrite {
  run: () => Promise<void>;
  supersede: () => void;
}

interface KeyState {
  pending: PendingWrite | null;
  running: Promise<void> | null;
}

export function createSaveQueue(): SaveQueue {
  const states = new Map<string, KeyState>();

  const drain = (key: string, state: KeyState): void => {
    const next = state.pending;
    if (!next) {
      states.delete(key);
      return;
    }
    state.pending = null;
    state.running = next.run().finally(() => {
      state.running = null;
      drain(key, state);
    });
  };

  return {
    enqueue<T>(key: string, write: () => Promise<T>) {
      return new Promise<T | "superseded">((resolve, reject) => {
        let state = states.get(key);
        if (!state) {
          state = { pending: null, running: null };
          states.set(key, state);
        }
        state.pending?.supersede();
        state.pending = {
          run: () => write().then(resolve, reject),
          supersede: () => resolve("superseded"),
        };
        if (!state.running) {
          drain(key, state);
        }
      });
    },
    async idle(key: string) {
      for (;;) {
        const state = states.get(key);
        if (!state?.running) {
          return;
        }
        await state.running.catch(() => undefined);
      }
    },
  };
}

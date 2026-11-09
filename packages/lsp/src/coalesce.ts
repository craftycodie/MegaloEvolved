export interface Coalescer<T> {
  clearPending: () => void;
  schedule: (job: T) => void;
}

/**
 * Runs jobs one at a time, keeping only the latest pending job per key.
 * Scheduling key A never drops a pending job for key B (one pending slot per
 * document URI, not one for the whole server).
 */
export const createCoalescer = <T>(
  keyOf: (job: T) => string,
  processor: (job: T) => Promise<void>
): Coalescer<T> => {
  // Insertion-ordered: a key keeps its queue position when its job is replaced.
  const pending = new Map<string, T>();
  let busy = false;

  const drain = async (): Promise<void> => {
    if (busy) {
      return;
    }
    busy = true;
    try {
      for (let next = pending.entries().next(); !next.done; ) {
        const [key, job] = next.value;
        pending.delete(key);
        try {
          await processor(job);
        } catch (error) {
          console.error("[megacrow-lsp] coalesced job failed", error);
        }
        next = pending.entries().next();
      }
    } finally {
      busy = false;
      if (pending.size > 0) {
        void drain();
      }
    }
  };

  return {
    schedule: (job: T) => {
      pending.set(keyOf(job), job);
      void drain();
    },
    clearPending: () => {
      pending.clear();
    },
  };
};

export interface PromiseCoalescer<TJob, TResult> {
  clearPending: (staleResult: TResult) => void;
  enqueue: (job: TJob) => Promise<TResult>;
}

export interface PromiseCoalescerOptions<TResult> {
  captureEpoch?: () => unknown;
  isEpochStale?: (epoch: unknown) => boolean;
  onSuperseded: (previous: {
    job: unknown;
    resolve: (value: TResult) => void;
  }) => void;
  staleResult: () => TResult;
}

export const createPromiseCoalescer = <TJob, TResult>(
  processor: (job: TJob) => Promise<TResult>,
  options: PromiseCoalescerOptions<TResult>
): PromiseCoalescer<TJob, TResult> => {
  let pending: {
    job: TJob;
    resolve: (value: TResult) => void;
    reject: (reason: unknown) => void;
  } | null = null;
  let busy = false;

  const drain = async (): Promise<void> => {
    if (busy) {
      return;
    }
    busy = true;
    try {
      while (pending) {
        const job = pending;
        pending = null;
        const epochAtStart = options.captureEpoch?.();
        try {
          const result = await processor(job.job);
          if ((options.isEpochStale?.(epochAtStart) ?? false) || pending) {
            job.resolve(options.staleResult());
          } else {
            job.resolve(result);
          }
        } catch (error) {
          if ((options.isEpochStale?.(epochAtStart) ?? false) || pending) {
            job.resolve(options.staleResult());
          } else {
            job.reject(error);
          }
        }
      }
    } finally {
      busy = false;
      if (pending) {
        void drain();
      }
    }
  };

  return {
    enqueue: (job: TJob) =>
      new Promise((resolve, reject) => {
        if (pending) {
          options.onSuperseded(pending);
        }
        pending = { job, resolve, reject };
        void drain();
      }),
    clearPending: (staleResult: TResult) => {
      if (pending) {
        pending.resolve(staleResult);
        pending = null;
      }
    },
  };
};

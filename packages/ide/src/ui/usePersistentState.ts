import { useCallback, useState } from "react";

/** How a value is stored as a string in `localStorage`. */
export interface StorageCodec<T> {
  /** Return `undefined` for a stored string that is not a valid value. */
  parse: (raw: string) => T | undefined;
  serialize: (value: T) => string;
}

export const booleanCodec: StorageCodec<boolean> = {
  parse: (raw) => raw !== "0" && raw !== "false",
  serialize: (value) => (value ? "1" : "0"),
};

export const numberCodec: StorageCodec<number> = {
  parse: (raw) => {
    const value = Number(raw);
    return raw.trim() !== "" && Number.isFinite(value) ? value : undefined;
  },
  serialize: (value) => String(value),
};

/**
 * Read a stored value. Storage can be unavailable (private mode, blocked
 * site data) or hold junk; both give `fallback`.
 */
export function readStoredValue<T>(
  key: string,
  codec: StorageCodec<T>,
  fallback: T
): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return fallback;
    }
    return codec.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Store a value; failures (quota, private mode) are ignored. */
export function writeStoredValue<T>(
  key: string,
  codec: StorageCodec<T>,
  value: T
): void {
  try {
    localStorage.setItem(key, codec.serialize(value));
  } catch {
    // Persisting UI preferences is best effort.
  }
}

/**
 * `useState` backed by `localStorage`. The stored value is read once on
 * mount, and every update is written straight away (inside the setter, not
 * in an effect).
 */
export function usePersistentState<T>(
  key: string,
  codec: StorageCodec<T>,
  fallback: T
): [T, (next: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState(() =>
    readStoredValue(key, codec, fallback)
  );

  const update = useCallback(
    (next: T | ((current: T) => T)) => {
      setValue((current) => {
        const resolved =
          typeof next === "function"
            ? (next as (current: T) => T)(current)
            : next;
        if (!Object.is(resolved, current)) {
          writeStoredValue(key, codec, resolved);
        }
        return resolved;
      });
    },
    [codec, key]
  );

  return [value, update];
}

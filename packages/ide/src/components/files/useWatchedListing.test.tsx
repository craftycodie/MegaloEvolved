// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../workspace", () => ({
  watchWorkspaceInput: () => Promise.resolve(null),
}));

const { useWatchedListing } = await import("./useWatchedListing");

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const EMPTY: string[] = [];

describe("useWatchedListing", () => {
  it("merges refreshes requested during a read into one more read", async () => {
    const reads: ReturnType<typeof deferred<string[]>>[] = [];
    const list = vi.fn(() => {
      const next = deferred<string[]>();
      reads.push(next);
      return next.promise;
    });
    const { result } = renderHook(() =>
      useWatchedListing({
        empty: EMPTY,
        list,
        path: "C:/ws",
        refreshKey: 0,
        watch: false,
      })
    );
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    act(() => {
      void result.current.refresh();
      void result.current.refresh();
      void result.current.refresh();
    });
    await act(async () => {
      reads[0]?.resolve(["old"]);
    });
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    await act(async () => {
      reads[1]?.resolve(["new"]);
    });
    expect(result.current.data).toEqual(["new"]);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("drops a slow result for a folder that is no longer shown", async () => {
    const slow = deferred<string[]>();
    const list = vi.fn((path: string) =>
      path === "C:/a" ? slow.promise : Promise.resolve(["b-file"])
    );
    const { rerender, result } = renderHook(
      ({ path }) =>
        useWatchedListing({
          empty: EMPTY,
          list,
          path,
          refreshKey: 0,
          watch: false,
        }),
      { initialProps: { path: "C:/a" } }
    );
    rerender({ path: "C:/b" });
    await act(async () => {
      slow.resolve(["a-file"]);
    });
    await waitFor(() => expect(result.current.data).toEqual(["b-file"]));
  });

  it("reports a folder that cannot be listed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const list = () => Promise.reject(new Error("Access denied"));
    const { result } = renderHook(() =>
      useWatchedListing({
        empty: EMPTY,
        list,
        path: "C:/ws",
        refreshKey: 0,
        watch: false,
      })
    );
    await waitFor(() => expect(result.current.listError).toBe("Access denied"));
    expect(result.current.data).toBe(EMPTY);
  });
});

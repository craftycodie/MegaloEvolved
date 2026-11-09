import type { AnalysisSnapshot } from "@megacrow/megalo";
import { describe, expect, it, vi } from "vitest";
import { analyzeDocumentSnapshot } from "../src/artifacts";
import { createCoalescer } from "../src/coalesce";
import { MegacrowSession } from "../src/sessionSettings";
import { SnapshotCache } from "../src/snapshotCache";

vi.mock("../src/artifacts", () => ({
  analyzeDocumentSnapshot: vi.fn(),
  semanticTokensFromSnapshot: () => [],
}));

const analyzeMock = vi.mocked(analyzeDocumentSnapshot);

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const fakeSnapshot = (label: string) =>
  ({ source: label }) as unknown as AnalysisSnapshot;

describe("SnapshotCache epochs", () => {
  it("does not cache an analysis that finishes after clear()", async () => {
    const cache = new SnapshotCache();
    const session = new MegacrowSession();
    const pending = deferred<AnalysisSnapshot>();
    analyzeMock.mockReturnValueOnce(pending.promise);

    const refresh = cache.refresh("file:///a.txt", "old", 1, session, {
      resolvers: {},
    });
    cache.clear();
    pending.resolve(fakeSnapshot("built with old settings"));

    const entry = await refresh;
    expect(entry.epoch).not.toBe(cache.epoch);
    expect(cache.get("file:///a.txt")).toBeUndefined();
  });

  it("starts a fresh analysis after clear() instead of joining the old one", async () => {
    const cache = new SnapshotCache();
    const session = new MegacrowSession();
    const stale = deferred<AnalysisSnapshot>();
    analyzeMock.mockReturnValueOnce(stale.promise);
    analyzeMock.mockResolvedValueOnce(fakeSnapshot("fresh"));

    const first = cache.refresh("file:///a.txt", "text", 1, session, {
      resolvers: {},
    });
    cache.clear();
    const second = await cache.refresh("file:///a.txt", "text", 1, session, {
      resolvers: {},
    });
    stale.resolve(fakeSnapshot("stale"));
    await first;

    expect(second.snapshot.source).toBe("fresh");
    expect(cache.get("file:///a.txt")?.snapshot.source).toBe("fresh");
  });
});

describe("createCoalescer", () => {
  it("keeps one pending job per key", async () => {
    const gate = deferred<void>();
    const ran: string[] = [];
    const coalescer = createCoalescer<{ key: string; value: number }>(
      (job) => job.key,
      async (job) => {
        ran.push(`${job.key}${job.value}`);
        if (ran.length === 1) {
          await gate.promise;
        }
      }
    );

    coalescer.schedule({ key: "a", value: 1 }); // starts running
    coalescer.schedule({ key: "b", value: 1 });
    coalescer.schedule({ key: "c", value: 1 });
    coalescer.schedule({ key: "b", value: 2 }); // replaces b1, keeps its slot
    gate.resolve();

    await vi.waitFor(() => expect(ran).toEqual(["a1", "b2", "c1"]));
  });
});

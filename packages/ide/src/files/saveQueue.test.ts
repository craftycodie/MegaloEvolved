import { describe, expect, it } from "vitest";
import { createSaveQueue } from "./saveQueue";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("createSaveQueue", () => {
  it("never overlaps writes for one key and drops superseded waiting writes", async () => {
    const queue = createSaveQueue();
    const written: string[] = [];
    let active = 0;
    let maxActive = 0;
    const gate = deferred();

    const write = (text: string, wait?: Promise<void>) => async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await wait;
      written.push(text);
      active -= 1;
      return text;
    };

    const first = queue.enqueue("a.txt", write("v1", gate.promise));
    const second = queue.enqueue("a.txt", write("v2"));
    const third = queue.enqueue("a.txt", write("v3"));
    gate.resolve();

    expect(await first).toBe("v1");
    expect(await second).toBe("superseded");
    expect(await third).toBe("v3");
    expect(written).toEqual(["v1", "v3"]);
    expect(maxActive).toBe(1);
  });

  it("runs different keys independently", async () => {
    const queue = createSaveQueue();
    const gate = deferred();
    const order: string[] = [];
    const slow = queue.enqueue("a.txt", async () => {
      await gate.promise;
      order.push("a");
    });
    await queue.enqueue("b.txt", async () => {
      order.push("b");
    });
    gate.resolve();
    await slow;
    expect(order).toEqual(["b", "a"]);
  });

  it("keeps going after a failed write", async () => {
    const queue = createSaveQueue();
    const failed = queue.enqueue("a.txt", () =>
      Promise.reject(new Error("disk full"))
    );
    const next = queue.enqueue("a.txt", () => Promise.resolve("ok"));
    await expect(failed).rejects.toThrow("disk full");
    expect(await next).toBe("ok");
    await queue.idle("a.txt");
  });
});

import { describe, expect, it } from "vitest";
import { planTreeMove } from "./treeMove";

describe("planTreeMove", () => {
  it("moves a file into another folder", () => {
    expect(planTreeMove(["a", "f.txt"], ["b"])).toEqual({
      kind: "move",
      toSegments: ["b", "f.txt"],
    });
  });

  it("moves an entry up to the root", () => {
    expect(planTreeMove(["a", "f.txt"], [])).toEqual({
      kind: "move",
      toSegments: ["f.txt"],
    });
  });

  it("is a no-op inside the same folder", () => {
    expect(planTreeMove(["a", "f.txt"], ["a"])).toEqual({ kind: "noop" });
    expect(planTreeMove(["f.txt"], [])).toEqual({ kind: "noop" });
  });

  it("refuses to move the root", () => {
    expect(planTreeMove([], ["a"])).toEqual({
      kind: "invalid",
      reason: "root",
    });
  });

  it("refuses to move a folder into itself or a descendant", () => {
    expect(planTreeMove(["a"], ["a", "b"])).toEqual({
      kind: "invalid",
      reason: "into-self",
    });
    expect(planTreeMove(["A"], ["a", "b"])).toEqual({
      kind: "invalid",
      reason: "into-self",
    });
  });

  it("refuses a destination that is an ancestor of the source", () => {
    // `x/x` dropped on the root targets `x`, the source's own parent.
    expect(planTreeMove(["x", "x"], [])).toEqual({
      kind: "invalid",
      reason: "onto-ancestor",
    });
    expect(planTreeMove(["x", "y", "x"], [])).toEqual({
      kind: "invalid",
      reason: "onto-ancestor",
    });
    // Same folder on a case-insensitive file system.
    expect(planTreeMove(["X", "x"], [])).toEqual({
      kind: "invalid",
      reason: "onto-ancestor",
    });
  });

  it("allows a same-named entry that is not an ancestor", () => {
    expect(planTreeMove(["a", "x", "f.txt"], ["x"])).toEqual({
      kind: "move",
      toSegments: ["x", "f.txt"],
    });
  });
});

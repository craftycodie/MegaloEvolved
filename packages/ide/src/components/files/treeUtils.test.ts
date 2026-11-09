import { describe, expect, it } from "vitest";
import type { LocalDiskNode } from "../../files/localFolder";
import {
  ancestorPathKeys,
  dropParentForPathKey,
  dropParentForPaths,
  findFilePathByDisplayName,
  flattenVisibleNodes,
  parsePathKey,
  pruneNestedPaths,
  pruneSelection,
  treeKeyAction,
} from "./treeUtils";

const file = (...path: string[]): LocalDiskNode => ({
  name: path.at(-1) ?? "",
  path,
  type: "file",
});

const dir = (
  path: string[],
  children: LocalDiskNode[] = []
): LocalDiskNode => ({
  children,
  name: path.at(-1) ?? "",
  path,
  type: "directory",
});

describe("pruneNestedPaths", () => {
  it("drops children of selected ancestors", () => {
    expect(
      pruneNestedPaths([["a", "b"], ["a"], ["c"], ["a", "b", "c"]])
    ).toEqual([["a"], ["c"]]);
  });

  it("keeps siblings that only share a name prefix", () => {
    expect(pruneNestedPaths([["ab"], ["a"]])).toEqual([["ab"], ["a"]]);
  });
});

describe("parsePathKey", () => {
  it("splits keys and maps the root key to an empty path", () => {
    expect(parsePathKey("")).toEqual([]);
    expect(parsePathKey("a/b")).toEqual(["a", "b"]);
  });
});

describe("dropParentForPathKey", () => {
  it("drops onto a folder", () => {
    expect(dropParentForPathKey("dest", "directory", ["src", "f.txt"])).toEqual(
      ["dest"]
    );
  });

  it("drops onto a file means its parent folder", () => {
    expect(
      dropParentForPathKey("dest/g.txt", "file", ["src", "f.txt"])
    ).toEqual(["dest"]);
  });

  it("drops onto the root", () => {
    expect(dropParentForPathKey("", "root", ["src", "f.txt"])).toEqual([]);
  });

  it("rejects a drop that would not move anything", () => {
    expect(dropParentForPathKey("", "root", ["f.txt"])).toBeNull();
    expect(dropParentForPathKey("src", "directory", ["src"])).toBeNull();
  });

  it("rejects moving a folder into itself or a descendant", () => {
    expect(dropParentForPathKey("src/inner", "directory", ["src"])).toBeNull();
    expect(dropParentForPathKey("src/inner/g.txt", "file", ["src"])).toBeNull();
  });
});

describe("dropParentForPaths", () => {
  it("returns null when any path is rejected", () => {
    expect(
      dropParentForPaths("src/inner", "directory", [["other.txt"], ["src"]])
    ).toBeNull();
  });

  it("returns the shared destination", () => {
    expect(
      dropParentForPaths("dest", "directory", [["a.txt"], ["sub", "b.txt"]])
    ).toEqual(["dest"]);
  });
});

describe("flattenVisibleNodes", () => {
  const tree = [
    dir(
      ["a"],
      [file("a", "1.txt"), dir(["a", "b"], [file("a", "b", "2.txt")])]
    ),
    file("root.txt"),
  ];

  it("walks only expanded folders", () => {
    expect(
      flattenVisibleNodes(tree, new Set(["a"])).map((node) =>
        node.path.join("/")
      )
    ).toEqual(["a", "a/1.txt", "a/b", "root.txt"]);
  });

  it("returns only top-level nodes when nothing is expanded", () => {
    expect(
      flattenVisibleNodes(tree, new Set()).map((node) => node.path.join("/"))
    ).toEqual(["a", "root.txt"]);
  });
});

describe("findFilePathByDisplayName", () => {
  it("matches the slash-joined path, ignoring case", () => {
    const tree = [dir(["Sub"], [file("Sub", "Main.txt")])];
    expect(findFilePathByDisplayName(tree, "sub/main.txt")).toEqual([
      "Sub",
      "Main.txt",
    ]);
    expect(findFilePathByDisplayName(tree, "missing.txt")).toBeNull();
  });
});

describe("ancestorPathKeys", () => {
  it("lists every ancestor folder key", () => {
    expect(ancestorPathKeys(["a", "b", "c.txt"])).toEqual(["a", "a/b"]);
    expect(ancestorPathKeys(["c.txt"])).toEqual([]);
  });
});

describe("dropParentForPathKey ancestor guard", () => {
  it("rejects dropping x/x onto the root, whose target is its own parent", () => {
    expect(dropParentForPathKey("", "root", ["x", "x"])).toBeNull();
    expect(dropParentForPathKey("other.txt", "file", ["x", "x"])).toBeNull();
  });

  it("still allows other drops from nested folders onto the root", () => {
    expect(dropParentForPathKey("", "root", ["x", "y"])).toEqual([]);
  });
});

describe("pruneSelection", () => {
  const tree = [dir(["a"], [file("a", "1.txt")]), file("b.txt")];

  it("keeps the same set when every key still exists", () => {
    const selected = new Set(["a/1.txt", "b.txt"]);
    expect(pruneSelection(selected, tree)).toBe(selected);
  });

  it("drops keys of removed entries, including inside collapsed folders", () => {
    const selected = new Set(["a/1.txt", "gone.txt", "a/gone"]);
    expect([...pruneSelection(selected, tree)]).toEqual(["a/1.txt"]);
  });
});

describe("treeKeyAction", () => {
  const tree = [
    dir(
      ["a"],
      [file("a", "1.txt"), dir(["a", "b"], [file("a", "b", "2.txt")])]
    ),
    file("root.txt"),
  ];
  const expanded = new Set(["a"]);

  it("moves through visible rows", () => {
    expect(treeKeyAction("ArrowDown", "a", tree, expanded)).toEqual({
      focus: "a/1.txt",
    });
    expect(treeKeyAction("ArrowUp", "a/1.txt", tree, expanded)).toEqual({
      focus: "a",
    });
    expect(treeKeyAction("ArrowDown", "root.txt", tree, expanded)).toBeNull();
    expect(treeKeyAction("Home", "a/b", tree, expanded)).toEqual({
      focus: "a",
    });
    expect(treeKeyAction("End", "a", tree, expanded)).toEqual({
      focus: "root.txt",
    });
  });

  it("opens a closed folder, then enters it", () => {
    expect(treeKeyAction("ArrowRight", "a/b", tree, expanded)).toEqual({
      toggle: "a/b",
    });
    expect(treeKeyAction("ArrowRight", "a", tree, expanded)).toEqual({
      focus: "a/1.txt",
    });
    expect(treeKeyAction("ArrowRight", "a/1.txt", tree, expanded)).toBeNull();
  });

  it("closes an open folder, else moves to the parent", () => {
    expect(treeKeyAction("ArrowLeft", "a", tree, expanded)).toEqual({
      toggle: "a",
    });
    expect(treeKeyAction("ArrowLeft", "a/1.txt", tree, expanded)).toEqual({
      focus: "a",
    });
    expect(treeKeyAction("ArrowLeft", "root.txt", tree, expanded)).toBeNull();
  });
});

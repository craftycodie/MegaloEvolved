// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LocalDiskNode } from "../../files";
import { LocalDiskTree } from "./LocalDiskTree";

const nodes: LocalDiskNode[] = [
  {
    children: [
      { name: "main.txt", path: ["scripts", "main.txt"], type: "file" },
    ],
    name: "scripts",
    path: ["scripts"],
    type: "directory",
  },
  { name: "readme.txt", path: ["readme.txt"], type: "file" },
];

const noop = () => undefined;

function renderTree() {
  return render(
    <LocalDiskTree
      activeFileName={null}
      nodes={nodes}
      onBeginRename={noop}
      onCancelRename={noop}
      onCommitRename={noop}
      onContextMenu={noop}
      onOpenFile={noop}
      renamingPathKey={null}
      treeLabel="Workspace files"
    />
  );
}

describe("LocalDiskTree keyboard", () => {
  it("is one tab stop with tree roles", () => {
    renderTree();
    const tree = screen.getByRole("tree", { name: "Workspace files" });
    const rows = screen.getAllByRole("treeitem");
    expect(tree.getAttribute("aria-multiselectable")).toBe("true");
    expect(rows.map((row) => row.tabIndex)).toEqual([0, -1]);
    expect(rows[0]?.getAttribute("aria-level")).toBe("1");
  });

  it("expands with ArrowRight and moves down into the folder", () => {
    renderTree();
    const folder = screen.getByRole("treeitem", { name: /scripts/ });
    folder.focus();
    fireEvent.keyDown(folder, { key: "ArrowRight" });
    expect(folder.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(folder, { key: "ArrowDown" });
    const child = screen.getByRole("treeitem", { name: /main\.txt/ });
    expect(document.activeElement).toBe(child);
    expect(child.tabIndex).toBe(0);
    expect(child.getAttribute("aria-level")).toBe("2");
  });
});

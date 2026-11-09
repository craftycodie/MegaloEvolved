// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { PaneResizer } from "./PaneResizer";
import {
  type ResizablePaneOptions,
  useResizablePane,
} from "./useResizablePane";

const BOTTOM_PANE: ResizablePaneOptions = {
  axis: "y",
  defaultSize: 100,
  direction: -1,
  max: 300,
  min: 50,
  storageKey: "test.pane",
};

function Pane({ options = BOTTOM_PANE }: { options?: ResizablePaneOptions }) {
  const pane = useResizablePane(options);
  return <PaneResizer className="handle" label="resize" pane={pane} />;
}

const handle = () => screen.getByRole("separator", { name: "resize" });
const size = () => Number(handle().getAttribute("aria-valuenow"));

describe("useResizablePane", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.style.cursor = "";
  });

  it("reads and clamps the stored size", () => {
    localStorage.setItem("test.pane", "9999");
    render(<Pane />);
    expect(size()).toBe(300);
    expect(handle().getAttribute("aria-valuenow")).toBe("300");
  });

  it("falls back to the default for junk in storage", () => {
    localStorage.setItem("test.pane", "abc");
    render(<Pane />);
    expect(size()).toBe(100);
  });

  it("drags a bottom pane taller when moving up and stores on release", () => {
    render(<Pane />);
    fireEvent.pointerDown(handle(), { button: 0, clientY: 500, pointerId: 1 });
    expect(document.body.style.cursor).toBe("row-resize");
    fireEvent.pointerMove(handle(), { clientY: 460, pointerId: 1 });
    expect(size()).toBe(140);
    expect(localStorage.getItem("test.pane")).toBeNull();
    fireEvent.pointerUp(handle(), { pointerId: 1 });
    expect(localStorage.getItem("test.pane")).toBe("140");
    expect(document.body.style.cursor).toBe("");
  });

  it("restores the cursor when unmounted mid-drag", () => {
    const { unmount } = render(<Pane />);
    fireEvent.pointerDown(handle(), { button: 0, clientY: 500, pointerId: 1 });
    unmount();
    expect(document.body.style.cursor).toBe("");
  });

  it("resizes with the arrow keys in the direction the separator moves", () => {
    render(<Pane />);
    fireEvent.keyDown(handle(), { key: "ArrowUp" });
    expect(size()).toBe(116);
    fireEvent.keyDown(handle(), { key: "ArrowDown" });
    expect(size()).toBe(100);
    fireEvent.keyDown(handle(), { key: "End" });
    expect(size()).toBe(300);
    expect(localStorage.getItem("test.pane")).toBe("300");
  });
});

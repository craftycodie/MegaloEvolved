import type { ResizablePaneOptions } from "../ui/useResizablePane";

/** Left sidebar width; dragging right grows it. */
export const SIDEBAR_PANE: ResizablePaneOptions = {
  axis: "x",
  defaultSize: 280,
  direction: 1,
  max: 480,
  min: 200,
  storageKey: "megacrow.sidebarWidth",
};
export const SIDEBAR_OPEN_STORAGE_KEY = "megacrow.sidebarOpen";

/** Problems pane under the editor; dragging its top edge up grows it. */
export const PROBLEMS_PANE: ResizablePaneOptions = {
  axis: "y",
  defaultSize: 180,
  direction: -1,
  max: 480,
  // Leave room for the toolbar, editor and status bar.
  maxViewportFraction: 0.55,
  min: 96,
  storageKey: "megacrow.problemsPaneHeight",
};

/** "Built gametypes" pane at the bottom of the files sidebar. */
export const BUILDS_PANE: ResizablePaneOptions = {
  axis: "y",
  defaultSize: 112,
  direction: -1,
  max: 360,
  min: 72,
  storageKey: "megacrow.buildsPaneHeight",
};
export const BUILDS_OPEN_STORAGE_KEY = "megacrow.buildsPaneOpen";

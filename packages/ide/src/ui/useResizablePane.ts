import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import {
  numberCodec,
  readStoredValue,
  writeStoredValue,
} from "./usePersistentState";

export interface ResizablePaneOptions {
  /** `x` resizes a width (vertical separator), `y` a height. */
  axis: "x" | "y";
  defaultSize: number;
  /**
   * +1 when dragging toward larger coordinates grows the pane (a sidebar on
   * the left), -1 when it shrinks it (a panel along the bottom).
   */
  direction: 1 | -1;
  max: number;
  /** Optional cap as a fraction of the window size, applied on resize too. */
  maxViewportFraction?: number;
  min: number;
  storageKey: string;
}

const KEYBOARD_STEP_PX = 16;

function viewportSize(axis: "x" | "y"): number {
  if (typeof window === "undefined") {
    return Number.POSITIVE_INFINITY;
  }
  return axis === "x" ? window.innerWidth : window.innerHeight;
}

export function clampPaneSize(
  size: number,
  { axis, max, maxViewportFraction, min }: ResizablePaneOptions
): number {
  const viewportMax =
    maxViewportFraction === undefined
      ? max
      : Math.min(
          max,
          Math.max(min, Math.round(viewportSize(axis) * maxViewportFraction))
        );
  return Math.min(viewportMax, Math.max(min, Math.round(size)));
}

/**
 * Size state for a pane with a drag handle (and arrow keys) that resizes it.
 * The size is stored in `localStorage` when a drag ends, not on every move.
 * Listeners and the body cursor are cleaned up if the drag is cancelled or
 * the component unmounts mid-drag.
 */
export function useResizablePane(options: ResizablePaneOptions) {
  const { axis, direction, max, maxViewportFraction, min, storageKey } =
    options;

  const [size, setSize] = useState(() =>
    clampPaneSize(
      readStoredValue(storageKey, numberCodec, options.defaultSize),
      options
    )
  );
  const endDragRef = useRef<(() => void) | null>(null);

  // Event-time reads of the latest props and size, without re-binding
  // listeners whenever they change.
  const clamp = useEffectEvent((next: number) => clampPaneSize(next, options));
  const currentSize = useEffectEvent(() => size);

  const commit = useCallback((next: number) => {
    const clamped = clamp(next);
    setSize(clamped);
    return clamped;
  }, []);

  useEffect(() => {
    if (maxViewportFraction === undefined) {
      return;
    }
    const onResize = () => setSize((current) => clamp(current));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [maxViewportFraction]);

  // A drag in progress when the pane unmounts must not leave listeners or
  // the resize cursor behind.
  useEffect(() => () => endDragRef.current?.(), []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      endDragRef.current?.();

      const handle = event.currentTarget;
      const pointerId = event.pointerId;
      const start = axis === "x" ? event.clientX : event.clientY;
      const startSize = currentSize();
      let latest = startSize;

      const onMove = (moveEvent: PointerEvent) => {
        const position = axis === "x" ? moveEvent.clientX : moveEvent.clientY;
        latest = commit(startSize + direction * (position - start));
      };
      const end = () => {
        endDragRef.current = null;
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", end);
        handle.removeEventListener("pointercancel", end);
        handle.removeEventListener("lostpointercapture", end);
        if (handle.hasPointerCapture?.(pointerId)) {
          handle.releasePointerCapture(pointerId);
        }
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        writeStoredValue(storageKey, numberCodec, latest);
      };

      endDragRef.current = end;
      // Pointer capture keeps move/up events on the handle even when the
      // pointer leaves it or the window.
      handle.setPointerCapture?.(pointerId);
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", end);
      handle.addEventListener("pointercancel", end);
      handle.addEventListener("lostpointercapture", end);
      document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [axis, commit, direction, storageKey]
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      const grow = axis === "x" ? "ArrowRight" : "ArrowDown";
      const shrink = axis === "x" ? "ArrowLeft" : "ArrowUp";
      let next: number | null = null;
      if (event.key === grow) {
        next = currentSize() + direction * KEYBOARD_STEP_PX;
      } else if (event.key === shrink) {
        next = currentSize() - direction * KEYBOARD_STEP_PX;
      } else if (event.key === "Home") {
        next = min;
      } else if (event.key === "End") {
        next = max;
      }
      if (next === null) {
        return;
      }
      event.preventDefault();
      writeStoredValue(storageKey, numberCodec, commit(next));
    },
    [axis, commit, direction, max, min, storageKey]
  );

  return { axis, max, min, onKeyDown, onPointerDown, size };
}

export type ResizablePane = ReturnType<typeof useResizablePane>;

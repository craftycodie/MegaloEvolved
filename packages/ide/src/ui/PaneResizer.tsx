import type { ResizablePane } from "./useResizablePane";

interface Props {
  className: string;
  /** Hidden and not interactive, e.g. while its pane is collapsed. */
  disabled?: boolean;
  label: string;
  pane: ResizablePane;
}

/** Drag handle (and arrow-key target) for a `useResizablePane` pane. */
export function PaneResizer({
  className,
  disabled = false,
  label,
  pane,
}: Props) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a focusable splitter (separator widget); <hr> cannot take focus or keys.
    <div
      aria-hidden={disabled || undefined}
      aria-label={label}
      aria-orientation={pane.axis === "x" ? "vertical" : "horizontal"}
      aria-valuemax={pane.max}
      aria-valuemin={pane.min}
      aria-valuenow={pane.size}
      className={className}
      inert={disabled || undefined}
      onKeyDown={pane.onKeyDown}
      onPointerDown={pane.onPointerDown}
      role="separator"
      tabIndex={0}
    />
  );
}

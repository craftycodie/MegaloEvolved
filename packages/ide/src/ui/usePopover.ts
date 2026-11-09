import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { handleMenuArrowKeys, MENU_ITEM_SELECTOR } from "./menuKeyboard";
import {
  type PopoverPositionOptions,
  usePopoverPosition,
} from "./usePopoverPosition";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface PopoverOptions extends PopoverPositionOptions {
  /**
   * `menu`: a list of actions; arrow keys move between items.
   * `panel`: free content (buttons, links); Tab moves through it.
   */
  kind: "menu" | "panel";
}

/**
 * Open state, placement and keyboard behavior for a dropdown attached to a
 * trigger button: focus moves into the panel when it opens, Escape or a
 * click outside closes it, and focus goes back to the trigger.
 */
export function usePopover({ kind, ...position }: PopoverOptions) {
  const [open, setOpen] = useState(false);
  const placement = usePopoverPosition(open, position);
  const { panelRef, rootRef, triggerRef } = placement;

  const close = useCallback(
    (options?: { restoreFocus?: boolean }) => {
      setOpen(false);
      if (options?.restoreFocus !== false) {
        triggerRef.current?.focus();
      }
    },
    [triggerRef]
  );

  const toggle = useCallback(() => setOpen((value) => !value), []);

  // Focus the first item once the panel is in the DOM.
  useEffect(() => {
    if (!open) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      const selector =
        kind === "menu" ? MENU_ITEM_SELECTOR : FOCUSABLE_SELECTOR;
      panelRef.current?.querySelector<HTMLElement>(selector)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [kind, open, panelRef]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      // Clicked elsewhere: leave focus where the click put it.
      close({ restoreFocus: false });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open, panelRef, rootRef]);

  /** Menus: arrow keys / Home / End between items; Tab closes the menu. */
  const onPanelKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (kind !== "menu") {
        return;
      }
      if (event.key === "Tab") {
        close();
        return;
      }
      handleMenuArrowKeys(event);
    },
    [close, kind]
  );

  return { ...placement, close, onPanelKeyDown, open, setOpen, toggle };
}

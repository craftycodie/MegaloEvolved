import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
} from "react";
import { focusFirstMenuItem, handleMenuArrowKeys } from "./menuKeyboard";

export interface ContextMenuPositionOptions {
  closeOnResize?: boolean;
  closeOnScroll?: boolean;
}

/**
 * Place a context menu at the pointer (kept inside the window), focus its
 * first item, close it on Escape / outside click / scroll / resize, and give
 * focus back to whatever had it before the menu opened.
 */
export function useContextMenuPosition(
  menu: { x: number; y: number } | null,
  onClose: () => void,
  {
    closeOnResize = true,
    closeOnScroll = true,
  }: ContextMenuPositionOptions = {}
): {
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
  panelRef: RefObject<HTMLDivElement | null>;
} {
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useEffectEvent(() => onClose());
  const isOpen = menu !== null;

  useLayoutEffect(() => {
    if (!(menu && panelRef.current)) {
      return;
    }
    const rect = panelRef.current.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
    const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
    panelRef.current.style.left = `${Math.min(menu.x, maxLeft)}px`;
    panelRef.current.style.top = `${Math.min(menu.y, maxTop)}px`;
  }, [menu]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    focusFirstMenuItem(panelRef.current);

    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        close();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    const onViewportChange = () => close();

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    if (closeOnScroll) {
      window.addEventListener("scroll", onViewportChange, true);
    }
    if (closeOnResize) {
      window.addEventListener("resize", onViewportChange);
    }
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
      // Back to the row (or editor) the menu was opened from, if still there.
      if (
        previousFocus?.isConnected &&
        document.activeElement === document.body
      ) {
        previousFocus.focus();
      }
    };
  }, [closeOnResize, closeOnScroll, isOpen]);

  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Tab") {
      event.preventDefault();
      close();
      return;
    }
    handleMenuArrowKeys(event);
  }, []);

  return { onKeyDown, panelRef };
}

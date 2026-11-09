import type { KeyboardEvent as ReactKeyboardEvent } from "react";

export const MENU_ITEM_SELECTOR =
  '[role="menuitem"]:not([disabled]), [role="menuitemradio"]:not([disabled]), [role="menuitemcheckbox"]:not([disabled])';

/** Focus the first enabled item of a menu. */
export function focusFirstMenuItem(menu: HTMLElement | null): void {
  menu?.querySelector<HTMLElement>(MENU_ITEM_SELECTOR)?.focus();
}

/**
 * Arrow keys / Home / End move between the menu's items (wrapping), as in
 * the WAI-ARIA menu pattern. Returns true when the key was handled.
 */
export function handleMenuArrowKeys(
  event: ReactKeyboardEvent<HTMLElement>
): boolean {
  const items = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR),
  ];
  if (items.length === 0) {
    return false;
  }
  const index = items.indexOf(document.activeElement as HTMLElement);
  let next: number | null = null;
  if (event.key === "ArrowDown") {
    next = index < 0 ? 0 : (index + 1) % items.length;
  } else if (event.key === "ArrowUp") {
    next = index <= 0 ? items.length - 1 : index - 1;
  } else if (event.key === "Home") {
    next = 0;
  } else if (event.key === "End") {
    next = items.length - 1;
  }
  if (next === null) {
    return false;
  }
  event.preventDefault();
  items[next]?.focus();
  return true;
}

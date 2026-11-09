import { afterEach } from "vitest";
import { startEventLog } from "../log";

startEventLog();

// jsdom has no PointerEvent, so `fireEvent.pointerDown` would build a plain
// Event without `button`, `clientX` or `pointerId`. A MouseEvent subclass is
// enough for the pointer handlers under test.
if (typeof window !== "undefined" && !("PointerEvent" in window)) {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? "mouse";
    }
  }
  Object.defineProperty(window, "PointerEvent", {
    configurable: true,
    value: PointerEventPolyfill,
  });
}

// jsdom has <dialog> without showModal/close; enough to toggle `open`.
if (
  typeof HTMLDialogElement !== "undefined" &&
  typeof HTMLDialogElement.prototype.showModal !== "function"
) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
}

// Component tests opt into jsdom per file (`// @vitest-environment jsdom`).
// Unmount rendered trees between tests there; plain `.test.ts` files run in
// node and skip this.
afterEach(async () => {
  if (typeof document === "undefined") {
    return;
  }
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});

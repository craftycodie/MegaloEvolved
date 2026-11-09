import {
  type ReactNode,
  type RefObject,
  useEffect,
  useEffectEvent,
  useRef,
} from "react";

type Label =
  /** id of the dialog's visible title. */
  | { "aria-label"?: never; "aria-labelledby": string }
  /** Name for a dialog without a visible title. */
  | { "aria-label": string; "aria-labelledby"?: never };

type Props = Label & {
  /** id of the element describing the dialog (body text). */
  "aria-describedby"?: string;
  children: ReactNode;
  /** Class of the panel inside the dialog. */
  className?: string;
  /** Focused when the dialog opens; default: the browser's first focusable. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Escape, a backdrop click, or a close button. */
  onClose: () => void;
  open: boolean;
};

/**
 * Modal dialog on the native `<dialog>` element. `showModal()` puts it in the
 * browser's top layer (no z-index), makes the rest of the page inert, traps
 * Tab inside, closes on Escape and returns focus to where it was.
 */
export function Dialog({
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children,
  className,
  initialFocusRef,
  onClose,
  open,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  /** The pointer went down on the backdrop (not a drag out of the panel). */
  const pressedBackdropRef = useRef(false);
  const requestClose = useEffectEvent(() => onClose());

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!(dialog && open)) {
      return;
    }
    if (!dialog.open) {
      dialog.showModal();
    }
    initialFocusRef?.current?.focus();
    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, [initialFocusRef, open]);

  if (!open) {
    return null;
  }

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: mouse handlers detect backdrop clicks; Escape (onCancel) is the keyboard equivalent.
    <dialog
      aria-describedby={describedBy}
      aria-label={label}
      aria-labelledby={labelledBy}
      className="ui-dialog"
      onCancel={(event) => {
        // Escape: let React state close the dialog, not the browser.
        event.preventDefault();
        requestClose();
      }}
      onMouseDown={(event) => {
        pressedBackdropRef.current = event.target === event.currentTarget;
      }}
      onMouseUp={(event) => {
        // The panel fills the element, so a target of the <dialog> itself
        // means the ::backdrop was clicked.
        if (
          pressedBackdropRef.current &&
          event.target === event.currentTarget
        ) {
          requestClose();
        }
        pressedBackdropRef.current = false;
      }}
      ref={dialogRef}
    >
      <div className={className}>{children}</div>
    </dialog>
  );
}

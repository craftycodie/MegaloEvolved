import { useId, useRef } from "react";
import { useT } from "../localization";
import { Dialog } from "./Dialog";

interface Props {
  body: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
  /** `danger` for destructive actions (delete, replace). */
  tone?: "danger" | "primary";
}

/**
 * Yes/no confirmation. Cancel has focus when it opens, so pressing Enter by
 * reflex never runs a destructive action.
 */
export function ConfirmDialog({
  body,
  confirmLabel,
  onCancel,
  onConfirm,
  open,
  title,
  tone = "primary",
}: Props) {
  const t = useT();
  const id = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      aria-describedby={`${id}-body`}
      aria-labelledby={`${id}-title`}
      className="confirm-dialog"
      initialFocusRef={cancelRef}
      onClose={onCancel}
      open={open}
    >
      <h2 className="confirm-dialog-title" id={`${id}-title`}>
        {title}
      </h2>
      <p className="confirm-dialog-body" id={`${id}-body`}>
        {body}
      </p>
      <div className="confirm-dialog-footer">
        <button
          className="confirm-dialog-secondary"
          onClick={onCancel}
          ref={cancelRef}
          type="button"
        >
          {t("common_cancel")}
        </button>
        <button
          className={
            tone === "danger"
              ? "confirm-dialog-danger"
              : "confirm-dialog-primary"
          }
          onClick={onConfirm}
          type="button"
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

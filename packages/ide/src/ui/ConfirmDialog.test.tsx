// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

function renderDialog(open = true) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  const view = render(
    <ConfirmDialog
      body="Delete main.txt?"
      confirmLabel="Delete"
      onCancel={onCancel}
      onConfirm={onConfirm}
      open={open}
      title="Delete file"
      tone="danger"
    />
  );
  return { ...view, onCancel, onConfirm };
}

describe("ConfirmDialog", () => {
  it("is a labelled dialog with Cancel focused", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog", { name: "Delete file" });
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Cancel" })
    );
  });

  it("confirms and cancels", () => {
    const { onCancel, onConfirm } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("cancels on Escape (the dialog's cancel event)", () => {
    const { onCancel } = renderDialog();
    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { cancelable: true })
    );
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("renders nothing while closed", () => {
    renderDialog(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

import { useT } from "../../localization";
import { ConfirmDialog } from "../../ui/ConfirmDialog";

interface Props {
  /** When > 1, show a multi-item delete prompt. */
  count?: number;
  /** File or folder name shown in the prompt (single-item delete). */
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  /** Folders mention their contents in the prompt. */
  targetKind?: "file" | "directory" | "mixed";
}

export function ConfirmDeleteDialog({
  count = 1,
  name,
  onCancel,
  onConfirm,
  open,
  targetKind = "file",
}: Props) {
  const t = useT();
  const multi = count > 1;
  const folder = targetKind === "directory";
  return (
    <ConfirmDialog
      body={
        multi
          ? t("delete_items_body", { count })
          : t(folder ? "delete_folder_body" : "delete_file_body", { name })
      }
      confirmLabel={t("common_delete")}
      onCancel={onCancel}
      onConfirm={onConfirm}
      open={open}
      title={
        multi
          ? t("delete_items_title")
          : t(folder ? "delete_folder_title" : "delete_file_title")
      }
      tone="danger"
    />
  );
}

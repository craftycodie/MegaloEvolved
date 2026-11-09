import { useT } from "../../localization";
import { ConfirmDialog } from "../../ui/ConfirmDialog";

interface Props {
  /** File or folder name shown in the prompt. */
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  /** Folders mention their contents in the prompt. */
  targetKind?: "file" | "directory";
}

export function ConfirmReplaceDialog({
  name,
  onCancel,
  onConfirm,
  open,
  targetKind = "file",
}: Props) {
  const t = useT();
  const folder = targetKind === "directory";
  return (
    <ConfirmDialog
      body={t(folder ? "replace_folder_body" : "replace_file_body", { name })}
      confirmLabel={t("common_replace")}
      onCancel={onCancel}
      onConfirm={onConfirm}
      open={open}
      title={t(folder ? "replace_folder_title" : "replace_file_title")}
      tone="danger"
    />
  );
}

import { useT } from "../../localization";
import { ConfirmDialog } from "../../ui/ConfirmDialog";

interface Props {
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
}

export function ConfirmRegenerateObjectListsDialog({
  onCancel,
  onConfirm,
  open,
}: Props) {
  const t = useT();
  return (
    <ConfirmDialog
      body={t("files_regenerate_object_lists_body")}
      confirmLabel={t("files_regenerate_object_lists_confirm")}
      onCancel={onCancel}
      onConfirm={onConfirm}
      open={open}
      title={t("files_regenerate_object_lists_title")}
    />
  );
}

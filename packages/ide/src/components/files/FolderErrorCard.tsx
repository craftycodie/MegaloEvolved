import { useT } from "../../localization";

interface Props {
  /** Disk error message, already translated. */
  error: string;
  /** Opens the workspace editor so the folder path can be fixed. */
  onEditWorkspace?: () => void;
  path: string;
  title: string;
}

/** Shown in place of a folder's listing when the folder cannot be read. */
export function FolderErrorCard({
  error,
  onEditWorkspace,
  path,
  title,
}: Props) {
  const t = useT();

  return (
    <div className="files-error-card" role="alert">
      <p className="files-error-card-title">{title}</p>
      <p className="files-error-card-path">{path}</p>
      <p className="files-error-card-detail">{error}</p>
      {onEditWorkspace ? (
        <button
          className="files-error-card-action"
          onClick={onEditWorkspace}
          type="button"
        >
          {t("workspace_modal_edit_title")}
        </button>
      ) : null}
    </div>
  );
}

import { useRef } from "react";
import type { GithubReleaseInfo } from "../../app/updateCheck";
import { openExternalUrl } from "../../desktop";
import { useT } from "../../localization";
import { Dialog } from "../../ui/Dialog";

interface Props {
  currentBuildString: string;
  onDismiss: () => void;
  onSkip: () => void;
  open: boolean;
  release: GithubReleaseInfo | null;
}

export function UpdateAvailableDialog({
  currentBuildString,
  open,
  release,
  onDismiss,
  onSkip,
}: Props) {
  const t = useT();
  const downloadButtonRef = useRef<HTMLButtonElement>(null);

  if (!(open && release)) {
    return null;
  }

  const availableVersion = release.tagName;
  const descriptionLines = t("update_description", {
    version: availableVersion,
    current: currentBuildString,
  }).split("\n");

  return (
    <Dialog
      aria-describedby="update-description"
      aria-labelledby="update-title"
      className="update-dialog"
      initialFocusRef={downloadButtonRef}
      onClose={onDismiss}
      open={open}
    >
      <h2 className="update-title" id="update-title">
        {t("update_title")}
      </h2>
      <p className="update-description" id="update-description">
        {descriptionLines.map((line, index) => (
          <span key={index}>
            {index > 0 ? <br /> : null}
            {line}
          </span>
        ))}
      </p>

      <div className="update-actions">
        <button className="update-skip" onClick={onSkip} type="button">
          {t("update_skip")}
        </button>
        <button
          className="update-download"
          onClick={() => {
            void openExternalUrl(release.htmlUrl);
          }}
          ref={downloadButtonRef}
          type="button"
        >
          {t("update_download")}
        </button>
      </div>
    </Dialog>
  );
}

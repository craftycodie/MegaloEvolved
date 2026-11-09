import { MEGACROW_BUILD_STRING } from "@megacrow/megalo";
import { type MouseEvent, useRef } from "react";
import { APP_NAME } from "../../app/constants";
import { openExternalUrl } from "../../desktop";
import { useT } from "../../localization";
import { Dialog } from "../../ui/Dialog";

const BUG_REPORT_URL =
  "https://github.com/craftycodie/MegaCrow/issues/new?template=bug_report.yml";

interface Props {
  onClose: () => void;
  onVersionClick?: () => void;
  open: boolean;
}

export function AboutDialog({ open, onClose, onVersionClick }: Props) {
  const t = useT();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const handleExternalLink = (
    event: MouseEvent<HTMLAnchorElement>,
    url: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    void openExternalUrl(url);
  };

  const handleReportBug = () => {
    void openExternalUrl(BUG_REPORT_URL);
  };

  return (
    <Dialog
      aria-describedby="about-description"
      aria-labelledby="about-title"
      className="about-dialog"
      initialFocusRef={closeButtonRef}
      onClose={onClose}
      open={open}
    >
      <div className="about-header">
        <img
          alt=""
          className="about-icon"
          height={64}
          src={`${import.meta.env.BASE_URL}megacrow-icon.png`}
          width={64}
        />
        <h2 className="about-name" id="about-title">
          {APP_NAME}
        </h2>
      </div>

      <p className="about-tagline" id="about-description">
        {t("about_tagline")}
      </p>

      <dl className="about-details">
        <div className="about-detail">
          <dt>{APP_NAME}</dt>
          <dd>
            <button
              className="about-version"
              onClick={() => onVersionClick?.()}
              type="button"
            >
              {MEGACROW_BUILD_STRING}
            </button>
          </dd>
        </div>
        <div className="about-detail">
          <dt>@blamnetwork/blf</dt>
          <dd>{__BLF_VERSION__}</dd>
        </div>
        <div className="about-detail">
          <dt>{t("about_publisher")}</dt>
          <dd>
            <a
              className="about-link"
              href="https://blam.network"
              onClick={(event) =>
                handleExternalLink(event, "https://blam.network")
              }
              rel="noopener noreferrer"
              target="_blank"
            >
              blam.network
            </a>
          </dd>
        </div>
      </dl>

      <section aria-labelledby="about-credits-title" className="about-credits">
        <h3 className="about-credits-title" id="about-credits-title">
          {t("about_credits")}
        </h3>
        <div className="about-credits-group">
          <h4 className="about-credits-heading">{t("about_testers")}</h4>
          <p className="about-credits-names">
            General Izna, spartan 566, Matthew
          </p>
        </div>
        <div className="about-credits-group">
          <h4 className="about-credits-heading">{t("about_documentation")}</h4>
          <p className="about-credits-names">Sofasleeper5</p>
        </div>
      </section>

      <p className="about-credit">
        {t("about_made_with")}{" "}
        <a
          className="about-link"
          href="https://github.com/craftycodie"
          onClick={(event) =>
            handleExternalLink(event, "https://github.com/craftycodie")
          }
          rel="noopener noreferrer"
          target="_blank"
        >
          @craftycodie
        </a>
      </p>

      <div className="about-actions">
        <button
          className="about-report-bug"
          onClick={handleReportBug}
          type="button"
        >
          {t("about_report_bug")}
        </button>
        <button
          className="about-close"
          onClick={onClose}
          ref={closeButtonRef}
          type="button"
        >
          {t("common_close")}
        </button>
      </div>
    </Dialog>
  );
}

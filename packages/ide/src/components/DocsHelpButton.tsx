import { _event_warning, event } from "@blamnetwork/datamine";
import { DOCS_PATHS, openDocs } from "../desktop";
import { useT } from "../localization";

function InfoIcon() {
  return (
    <svg aria-hidden="true" height="14" viewBox="0 0 16 16" width="14">
      <circle
        cx="8"
        cy="8"
        fill="none"
        r="5.5"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path
        d="M8 7.25v3.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.25"
      />
      <circle cx="8" cy="5.25" fill="currentColor" r="0.75" />
    </svg>
  );
}

interface Props {
  /** Accessible name / tooltip. Defaults to a generic “Open docs” string. */
  label?: string;
  /** Docs path under `public/docs/` (e.g. `megacrow/settings`). */
  path: string;
}

export function DocsHelpButton({ path, label }: Props) {
  const t = useT();
  const resolvedLabel = label ?? t("docs_open_help");

  return (
    <button
      aria-label={resolvedLabel}
      className="docs-help-btn"
      onClick={(click) => {
        click.preventDefault();
        click.stopPropagation();
        void openDocs(path).catch((error: unknown) => {
          event(
            _event_warning,
            "ide:desktop: Failed to open docs page %s: %s",
            path,
            String(error)
          );
        });
      }}
      onPointerDown={(event) => {
        // Keep parent menus from treating this as an outside dismiss.
        event.stopPropagation();
      }}
      title={resolvedLabel}
      type="button"
    >
      <InfoIcon />
    </button>
  );
}

export { DOCS_PATHS };

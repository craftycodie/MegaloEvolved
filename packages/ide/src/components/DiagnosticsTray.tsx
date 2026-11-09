import { type MouseEvent, useState } from "react";
import { createPortal } from "react-dom";
import {
  diagnosticCanNavigate,
  diagnosticSeverity,
  formatAllDiagnosticsCopy,
  formatDiagnosticCopy,
  type MegaloDiagnostic,
  objectListDisplayName,
  sortDiagnosticsForTray,
} from "../compile";
import { writeClipboardText } from "../desktop";
import { useT, useTPlural } from "../localization";
import { useContextMenuPosition } from "../ui/useContextMenuPosition";

interface Props {
  diagnostics: MegaloDiagnostic[];
  height?: number;
  onClose: () => void;
  onNavigate: (diagnostic: MegaloDiagnostic) => void;
}

interface ContextMenuState {
  text: string;
  x: number;
  y: number;
}

function SeverityIcon({ severity }: { severity: "error" | "warning" }) {
  if (severity === "warning") {
    return (
      <svg
        aria-hidden="true"
        className="diagnostics-tray-icon diagnostics-tray-icon--warn"
        viewBox="0 0 16 16"
      >
        <path
          d="M8.86 2.49a1 1 0 0 0-1.72 0L1.2 12.26A1 1 0 0 0 2.06 13.8h11.88a1 1 0 0 0 .86-1.54L8.86 2.49ZM8 5.6a.7.7 0 0 1 .7.7v2.8a.7.7 0 1 1-1.4 0V6.3A.7.7 0 0 1 8 5.6Zm0 6.3a.85.85 0 1 1 0-1.7.85.85 0 0 1 0 1.7Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      className="diagnostics-tray-icon diagnostics-tray-icon--error"
      viewBox="0 0 16 16"
    >
      <path
        d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM5.4 5.4a.75.75 0 0 1 1.06 0L8 6.94l1.54-1.54a.75.75 0 1 1 1.06 1.06L9.06 8l1.54 1.54a.75.75 0 1 1-1.06 1.06L8 9.06l-1.54 1.54a.75.75 0 1 1-1.06-1.06L6.94 8 5.4 6.46a.75.75 0 0 1 0-1.06Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DiagnosticsContextMenu({
  menu,
  onClose,
}: {
  menu: ContextMenuState | null;
  onClose: () => void;
}) {
  const t = useT();
  const { onKeyDown, panelRef } = useContextMenuPosition(menu, onClose);

  if (!menu) {
    return null;
  }

  return createPortal(
    <div
      className="files-context-menu"
      onKeyDown={onKeyDown}
      ref={panelRef}
      role="menu"
      style={{
        position: "fixed",
        left: menu.x,
        top: menu.y,
        minWidth: 120,
      }}
    >
      <button
        className="files-context-menu-item"
        onClick={() => {
          void writeClipboardText(menu.text);
          onClose();
        }}
        role="menuitem"
        type="button"
      >
        {t("common_copy")}
      </button>
    </div>,
    document.body
  );
}

export function DiagnosticsTray({
  diagnostics,
  onNavigate,
  onClose,
  height,
}: Props) {
  const t = useT();
  const tPlural = useTPlural();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const errorCount = diagnostics.filter(
    (d) => diagnosticSeverity(d) === "error"
  ).length;
  const warningCount = diagnostics.length - errorCount;

  const sorted = sortDiagnosticsForTray(diagnostics);

  const onItemContextMenu = (
    event: MouseEvent,
    diagnostic: MegaloDiagnostic
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      text: formatDiagnosticCopy(diagnostic),
    });
  };

  return (
    <section
      aria-label={t("diagnostics_aria_label")}
      className="diagnostics-tray"
      style={height === undefined ? undefined : { height }}
    >
      <div className="diagnostics-tray-header">
        <div className="diagnostics-tray-title">
          <span>{t("diagnostics_title")}</span>
          <span className="diagnostics-tray-counts">
            {errorCount > 0 && (
              <span className="diagnostics-tray-count diagnostics-tray-count--error">
                {tPlural("diagnostics_error", errorCount)}
              </span>
            )}
            {warningCount > 0 && (
              <span className="diagnostics-tray-count diagnostics-tray-count--warn">
                {tPlural("diagnostics_warning", warningCount)}
              </span>
            )}
            {diagnostics.length === 0 && (
              <span className="diagnostics-tray-count">
                {t("diagnostics_no_problems")}
              </span>
            )}
          </span>
        </div>
        <div className="diagnostics-tray-actions">
          <button
            aria-label={t("diagnostics_copy_all_aria")}
            className="diagnostics-tray-action"
            disabled={sorted.length === 0}
            onClick={() => {
              void writeClipboardText(formatAllDiagnosticsCopy(sorted));
            }}
            title={t("diagnostics_copy_all")}
            type="button"
          >
            {t("diagnostics_copy_all")}
          </button>
          <button
            aria-label={t("diagnostics_close_aria")}
            className="diagnostics-tray-close"
            onClick={onClose}
            title={t("diagnostics_close")}
            type="button"
          >
            ×
          </button>
        </div>
      </div>
      <ul className="diagnostics-tray-list">
        {sorted.length === 0 ? (
          <li className="diagnostics-tray-empty">{t("diagnostics_empty")}</li>
        ) : (
          sorted.map((diagnostic, index) => {
            const severity = diagnosticSeverity(diagnostic);
            const canNavigate = diagnosticCanNavigate(diagnostic);
            const locationLabel = diagnostic.objectList
              ? t("diagnostics_location_object_list", {
                  file: objectListDisplayName(diagnostic.objectList),
                  line: diagnostic.objectList.line,
                })
              : canNavigate
                ? t("diagnostics_location", {
                    line: diagnostic.line,
                    column: diagnostic.column,
                  })
                : null;
            return (
              <li
                key={`${diagnostic.objectList ? `ol:${diagnostic.objectList.objectType}:${diagnostic.objectList.line}` : diagnostic.trayOnly ? "tray" : `${diagnostic.line}:${diagnostic.column}`}:${index}`}
              >
                <button
                  aria-disabled={!canNavigate}
                  className={`diagnostics-tray-item diagnostics-tray-item--${severity}${canNavigate ? "" : " diagnostics-tray-item--no-nav"}`}
                  onClick={() => {
                    if (canNavigate) {
                      onNavigate(diagnostic);
                    }
                  }}
                  onContextMenu={(event) =>
                    onItemContextMenu(event, diagnostic)
                  }
                  type="button"
                >
                  <SeverityIcon severity={severity} />
                  <span className="diagnostics-tray-message">
                    {diagnostic.message}
                  </span>
                  {locationLabel ? (
                    <span className="diagnostics-tray-location">
                      {locationLabel}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })
        )}
      </ul>
      <DiagnosticsContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
      />
    </section>
  );
}

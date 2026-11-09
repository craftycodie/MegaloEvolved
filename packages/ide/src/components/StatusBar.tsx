import type { VariantLimitUsage } from "@megacrow/megalo";
import { APP_NAME } from "../app/constants";
import type { CompileState } from "../compile";
import { type IdeLocaleContextValue, useIdeLocale } from "../localization";
import { useCompile } from "../stores/compileStore";
import { useDocument } from "../stores/documentStore";
import { StatusIcon } from "./StatusIcon";
import { VariantCapacityMeter } from "./VariantCapacityMeter";

interface Props {
  compileState: CompileState;
  diagnosticsOpen: boolean;
  errorCount: number;
  megaCrowVersion: string;
  megaloVersionId: string;
  message: string;
  onToggleDiagnostics: () => void;
  variantBytes: number | null;
  variantCapacity: number;
  variantLimitUsage: VariantLimitUsage | null;
  warningCount: number;
}

function statusToggleLabel(
  { t, tPlural }: Pick<IdeLocaleContextValue, "t" | "tPlural">,
  state: CompileState,
  errorCount: number,
  warningCount: number
): string {
  switch (state) {
    case "idle":
      return t("status_ready");
    case "parsing":
      return t("status_compiling_ellipsis");
    case "ok":
      return t("status_ok");
    case "warn":
      return tPlural("status_warning", warningCount);
    case "error": {
      const errors = tPlural("status_error", errorCount);
      if (warningCount > 0) {
        return `${errors} ${tPlural("status_warning", warningCount)}`;
      }
      return errors;
    }
  }
}

export function StatusBar({
  compileState,
  message,
  errorCount,
  warningCount,
  megaCrowVersion,
  megaloVersionId,
  variantBytes,
  variantCapacity,
  variantLimitUsage,
  diagnosticsOpen,
  onToggleDiagnostics,
}: Props) {
  const localeContext = useIdeLocale();
  const { t } = localeContext;
  // While compiling, keep the colour of the last result instead of flashing.
  const barColorState = useCompile((state) => state.settledState);
  const { column, line } = useDocument((state) => state.cursor);
  const label = statusToggleLabel(
    localeContext,
    compileState,
    errorCount,
    warningCount
  );

  return (
    <footer className={`status-bar status-bar--${barColorState}`}>
      <div className="status-bar-left">
        <button
          aria-pressed={diagnosticsOpen}
          className="status-problems"
          onClick={onToggleDiagnostics}
          title={
            diagnosticsOpen
              ? t("status_hide_problems")
              : t("status_show_problems")
          }
          type="button"
        >
          <StatusIcon state={compileState} />
          <span className={`status-label status-label--${compileState}`}>
            {label}
          </span>
        </button>
      </div>
      {/* Only an error message opens the problems pane. */}
      {compileState === "error" && message ? (
        <div className="status-bar-center">
          <button
            aria-pressed={diagnosticsOpen}
            className="status-problems status-message"
            onClick={onToggleDiagnostics}
            title={message}
            type="button"
          >
            <span className="status-message-text">{message}</span>
          </button>
        </div>
      ) : (
        <div className="status-bar-center" title={message}>
          {message}
        </div>
      )}
      <div className="status-bar-right">
        <VariantCapacityMeter
          capacityBytes={variantCapacity}
          limitUsage={variantLimitUsage}
          usedBytes={variantBytes}
        />
        <span>{t("status_ln_col", { line, column })}</span>
        <span title={`${APP_NAME} ${megaCrowVersion}`}>
          {APP_NAME} {megaCrowVersion}
        </span>
        <span title={`Megalo ${megaloVersionId}`}>
          Megalo {megaloVersionId}
        </span>
      </div>
    </footer>
  );
}

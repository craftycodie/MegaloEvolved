import type { VariantLimitUsage } from "@megacrow/megalo";
import { useRef } from "react";
import type { CompileState } from "../compile";
import { type IdeMessageKey, useT } from "../localization";
import { StatusIcon } from "./StatusIcon";
import { VariantCapacityMeter } from "./VariantCapacityMeter";

interface Props {
  byteDiffCount: number | null;
  byteIdentical: boolean | null;
  column: number;
  compileState: CompileState;
  diagnosticsOpen: boolean;
  errorCount: number;
  line: number;
  megaCrowVersion: string;
  megaloVersionId: string;
  message: string;
  onToggleDiagnostics: () => void;
  variantBytes: number | null;
  variantCapacity: number;
  variantLimitUsage: VariantLimitUsage | null;
  warningCount: number;
}

function isTransientCompileState(state: CompileState): boolean {
  return state === "parsing";
}

function useBarColorState(compileState: CompileState): CompileState {
  const lastSettledState = useRef<CompileState>("idle");
  if (!isTransientCompileState(compileState)) {
    lastSettledState.current = compileState;
  }
  return isTransientCompileState(compileState)
    ? lastSettledState.current
    : compileState;
}

type Translate = (
  key: IdeMessageKey,
  params?: Record<string, string | number>
) => string;

function formatWarningCount(t: Translate, count: number): string {
  return t(count === 1 ? "status_warning_one" : "status_warning_other", {
    count,
  });
}

function formatErrorCount(t: Translate, count: number): string {
  return t(count === 1 ? "status_error_one" : "status_error_other", {
    count,
  });
}

function statusToggleLabel(
  t: Translate,
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
      return formatWarningCount(t, warningCount);
    case "error": {
      const errors = formatErrorCount(t, errorCount);
      if (warningCount > 0) {
        return `${errors} ${formatWarningCount(t, warningCount)}`;
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
  byteIdentical,
  byteDiffCount,
  megaCrowVersion,
  megaloVersionId,
  line,
  column,
  variantBytes,
  variantCapacity,
  variantLimitUsage,
  diagnosticsOpen,
  onToggleDiagnostics,
}: Props) {
  const t = useT();
  const barColorState = useBarColorState(compileState);
  const label = statusToggleLabel(t, compileState, errorCount, warningCount);

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
        {byteIdentical === true && (
          <span className="status-chip status-chip--ok">
            {t("status_byte_identical")}
          </span>
        )}
        {byteIdentical === false &&
          byteDiffCount !== null &&
          byteDiffCount > 0 && (
            <span className="status-chip status-chip--warn">
              {t("status_byte_diff", { count: byteDiffCount })}
            </span>
          )}
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
        <span title={`MegaloEvolved ${megaCrowVersion}`}>
          MegaloEvolved {megaCrowVersion}
        </span>
        <span title={`Megalo ${megaloVersionId}`}>
          Megalo {megaloVersionId}
        </span>
      </div>
    </footer>
  );
}

import { translate } from "../localization";
import {
  diagnosticCanNavigate,
  type MegaloDiagnostic,
  objectListDisplayName,
} from "./diagnostics";

/** Diagnostics without a severity count as errors. */
export function diagnosticSeverity(d: MegaloDiagnostic): "error" | "warning" {
  return d.severity === "warning" ? "warning" : "error";
}

function sortLine(d: MegaloDiagnostic): number {
  return d.objectList?.line ?? d.line;
}

/** One diagnostic as a line of text for the clipboard. */
export function formatDiagnosticCopy(diagnostic: MegaloDiagnostic): string {
  const severity =
    diagnosticSeverity(diagnostic) === "warning"
      ? translate("diagnostics_severity_warning")
      : translate("diagnostics_severity_error");
  if (diagnostic.objectList) {
    return translate("diagnostics_copy_object_list", {
      severity,
      file: objectListDisplayName(diagnostic.objectList),
      line: diagnostic.objectList.line,
      message: diagnostic.message,
    });
  }
  if (diagnostic.trayOnly) {
    return translate("diagnostics_copy_tray_only", {
      severity,
      message: diagnostic.message,
    });
  }
  return translate("diagnostics_copy_line", {
    severity,
    line: diagnostic.line,
    column: diagnostic.column,
    message: diagnostic.message,
  });
}

export function formatAllDiagnosticsCopy(
  diagnostics: MegaloDiagnostic[]
): string {
  return diagnostics.map(formatDiagnosticCopy).join("\n");
}

/**
 * Problems tray order: errors before warnings, ones that jump to a location
 * before tray-only ones, then by line and column.
 */
export function sortDiagnosticsForTray(
  diagnostics: readonly MegaloDiagnostic[]
): MegaloDiagnostic[] {
  return [...diagnostics].sort((a, b) => {
    const aSeverity = diagnosticSeverity(a);
    const bSeverity = diagnosticSeverity(b);
    if (aSeverity !== bSeverity) {
      return aSeverity === "error" ? -1 : 1;
    }
    const aNav = diagnosticCanNavigate(a);
    const bNav = diagnosticCanNavigate(b);
    if (aNav !== bNav) {
      return aNav ? -1 : 1;
    }
    const aLine = sortLine(a);
    const bLine = sortLine(b);
    return aLine === bLine ? a.column - b.column : aLine - bLine;
  });
}

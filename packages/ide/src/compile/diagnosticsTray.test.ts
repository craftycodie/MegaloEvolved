import { describe, expect, it } from "vitest";
import type { MegaloDiagnostic } from "./diagnostics";
import {
  formatDiagnosticCopy,
  sortDiagnosticsForTray,
} from "./diagnosticsTray";

const diag = (overrides: Partial<MegaloDiagnostic>): MegaloDiagnostic => ({
  column: 1,
  line: 1,
  message: "m",
  severity: "error",
  ...overrides,
});

describe("sortDiagnosticsForTray", () => {
  it("puts errors first, then navigable ones, then by position", () => {
    const sorted = sortDiagnosticsForTray([
      diag({ line: 9, message: "warn", severity: "warning" }),
      diag({ line: 0, message: "tray", trayOnly: true }),
      diag({ line: 5, message: "late" }),
      diag({ line: 2, message: "early" }),
    ]);
    expect(sorted.map((d) => d.message)).toEqual([
      "early",
      "late",
      "tray",
      "warn",
    ]);
  });
});

describe("formatDiagnosticCopy", () => {
  it("includes position and message", () => {
    const text = formatDiagnosticCopy(
      diag({ column: 4, line: 3, message: "bad" })
    );
    expect(text).toContain("3");
    expect(text).toContain("4");
    expect(text).toContain("bad");
  });
});

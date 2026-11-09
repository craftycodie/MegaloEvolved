import { describe, expect, it } from "vitest";
import { failedToCompileStatus, translatePlural } from "./index";

describe("translatePlural", () => {
  it("picks the English one/other form and passes count", () => {
    expect(translatePlural("status_error", 1, undefined, "en")).toBe("1 Error");
    expect(translatePlural("status_error", 3, undefined, "en")).toBe(
      "3 Errors"
    );
    expect(translatePlural("status_error", 0, undefined, "en")).toBe(
      "0 Errors"
    );
  });

  it("uses the other form for Japanese, which has no singular", () => {
    expect(translatePlural("status_error", 1, undefined, "ja")).toBe(
      "エラー 1"
    );
  });

  it("formats the failed-to-compile status with at least one error", () => {
    expect(failedToCompileStatus(0)).toBe("Failed to compile with 1 error");
  });
});

import { describe, expect, it } from "vitest";
import {
  isAbsoluteLogicalPath,
  joinLogicalPaths,
  normalizeLogicalPath,
} from "./paths";

describe("normalizeLogicalPath", () => {
  it("uses forward slashes and collapses repeats", () => {
    expect(normalizeLogicalPath("C:\\hrek\\\\scripts\\")).toBe(
      "C:/hrek/scripts/"
    );
    expect(normalizeLogicalPath("/home//me/x.txt")).toBe("/home/me/x.txt");
  });

  it("keeps the leading pair of a UNC path", () => {
    expect(normalizeLogicalPath("\\\\server\\share\\x.txt")).toBe(
      "//server/share/x.txt"
    );
    expect(isAbsoluteLogicalPath("\\\\server\\share")).toBe(true);
  });
});

describe("joinLogicalPaths", () => {
  it("joins with one separator", () => {
    expect(joinLogicalPaths("C:\\hrek\\", "/sub/x.txt")).toBe(
      "C:/hrek/sub/x.txt"
    );
    expect(joinLogicalPaths("\\\\server\\share", "x.txt")).toBe(
      "//server/share/x.txt"
    );
  });
});

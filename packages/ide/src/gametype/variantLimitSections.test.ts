import type { VariantLimitItem } from "@megacrow/megalo";
import { describe, expect, it } from "vitest";
import {
  buildVariantLimitSections,
  formatLimitValue,
} from "./variantLimitSections";

const item = (
  section: VariantLimitItem["section"],
  label: string,
  used = 1,
  max = 4
): VariantLimitItem =>
  ({ format: "count", label, max, section, used }) as VariantLimitItem;

const t = ((key: string, params?: Record<string, unknown>) =>
  params ? `${key}(${JSON.stringify(params)})` : key) as never;

describe("buildVariantLimitSections", () => {
  it("orders sections and groups variables by scope", () => {
    const sections = buildVariantLimitSections(
      [
        item("declarations", "Labels"),
        item("variables", "Player Number"),
        item("variables", "Global Number"),
        item("variables", "Custom Thing"),
        item("storage", "Size"),
      ],
      t
    );
    expect(sections.map((section) => section.id)).toEqual([
      "storage",
      "variables-Global",
      "variables-Player",
      "variables-Custom",
      "declarations",
    ]);
    expect(sections[1]?.items[0]?.label).toBe("Number");
  });

  it("leaves out empty sections", () => {
    expect(buildVariantLimitSections([], t)).toEqual([]);
  });
});

describe("formatLimitValue", () => {
  it("formats counts in the given locale", () => {
    expect(formatLimitValue(item("script", "Actions", 1234, 5000), "en")).toBe(
      "1,234 / 5,000"
    );
  });
});

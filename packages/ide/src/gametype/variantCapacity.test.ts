import { describe, expect, it } from "vitest";
import { exceededLimits, variantMeterLevel } from "./variantCapacity";

describe("variantMeterLevel", () => {
  it("follows the encoded size when every limit is within range", () => {
    expect(variantMeterLevel(1000, 20_480, [{ max: 16, used: 16 }])).toBe("ok");
    expect(variantMeterLevel(19_000, 20_480, [])).toBe("warn");
  });

  it("is danger when any limit is over its maximum, even with room to spare", () => {
    // e.g. 17 / 16 loadout palettes in a small variant
    expect(variantMeterLevel(1000, 20_480, [{ max: 16, used: 17 }])).toBe(
      "danger"
    );
  });

  it("ignores rows without a maximum", () => {
    expect(exceededLimits([{ max: 0, used: 3 }])).toEqual([]);
  });
});

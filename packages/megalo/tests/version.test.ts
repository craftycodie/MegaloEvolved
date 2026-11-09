import { describe, expect, it } from "vitest";
import {
  getFullDescription,
  getGameName,
  getLabel,
  getShortDescription,
  MEGALO_VERSIONS,
} from "../src/version";

describe("version metadata", () => {
  it("returns Halo: Reach for all current encodings", () => {
    for (const info of Object.values(MEGALO_VERSIONS)) {
      expect(getGameName(info)).toBe("Halo: Reach");
    }
  });

  it("maps short and full descriptions", () => {
    expect(getShortDescription(MEGALO_VERSIONS["107-mcc"])).toBe("MCC");
    expect(getFullDescription(MEGALO_VERSIONS["107-mcc"])).toBe(
      "The Master Chief Collection"
    );
    expect(getShortDescription(MEGALO_VERSIONS["107"])).toBe("TU 1");
    expect(getFullDescription(MEGALO_VERSIONS["107"])).toBe("Title Update 1");
    expect(getShortDescription(MEGALO_VERSIONS["106"])).toBe("Release");
    expect(getFullDescription(MEGALO_VERSIONS["106"])).toBe("Release");
    expect(getShortDescription(MEGALO_VERSIONS["73"])).toBe("Beta");
    expect(getFullDescription(MEGALO_VERSIONS["73"])).toBe("Beta");
    expect(getShortDescription(MEGALO_VERSIONS["49"])).toBe("Alpha");
    expect(getFullDescription(MEGALO_VERSIONS["49"])).toBe("Alpha");
  });

  it("composes getLabel from game name and full description", () => {
    expect(getLabel(MEGALO_VERSIONS["107-mcc"])).toBe(
      "Halo: Reach - The Master Chief Collection"
    );
  });
});

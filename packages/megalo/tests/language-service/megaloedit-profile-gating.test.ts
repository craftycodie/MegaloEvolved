import { describe, expect, it } from "vitest";
import {
  analyzeDocument,
  completionsAtPosition,
  hoverAtPosition,
} from "../../src/language-service";
import {
  ALL_MEGACROW_EXTENSIONS,
  DEFAULT_MEGACROW_EXTENSIONS,
} from "../../src/megacrow-extensions";
import { MEGALO_VERSIONS } from "../../src/version";

const version = MEGALO_VERSIONS["107-mcc"];

const sample = `trigger initialization
\t
\taction set_score current_player 1
end
`;

/** Character index near the middle of `needle` on the given 0-based line. */
const onToken = (source: string, line: number, needle: string): number => {
  const lineText = source.split(/\n/)[line] ?? "";
  const index = lineText.indexOf(needle);
  expect(index).toBeGreaterThanOrEqual(0);
  return index + Math.floor(needle.length / 2);
};

describe("MegaloEdit profile language-service gating", () => {
  it("disables completions and hover when reservedKeywords is off", async () => {
    const snapshot = await analyzeDocument(sample, {
      version,
      megacrowExtensions: DEFAULT_MEGACROW_EXTENSIONS,
    });
    expect(snapshot.megacrowExtensions.reservedKeywords).toBe(false);

    const bodyPosition = { line: 1, character: 1 };
    expect(completionsAtPosition(snapshot, bodyPosition)).toEqual([]);

    const actionPosition = {
      line: 2,
      character: onToken(sample, 2, "set_score"),
    };
    expect(hoverAtPosition(snapshot, actionPosition)).toBeNull();
  });

  it("keeps completions and hover when reservedKeywords is on", async () => {
    const snapshot = await analyzeDocument(sample, {
      version,
      megacrowExtensions: ALL_MEGACROW_EXTENSIONS,
    });
    expect(snapshot.megacrowExtensions.reservedKeywords).toBe(true);

    const bodyPosition = { line: 1, character: 1 };
    const labels = completionsAtPosition(snapshot, bodyPosition).map(
      (item) => item.label
    );
    expect(labels).toContain("action");
    expect(labels).toContain("condition");

    const actionPosition = {
      line: 2,
      character: onToken(sample, 2, "set_score"),
    };
    const hover = hoverAtPosition(snapshot, actionPosition);
    expect(hover).not.toBeNull();
    expect(hover!.contents.value).toContain("set_score");
  });
});

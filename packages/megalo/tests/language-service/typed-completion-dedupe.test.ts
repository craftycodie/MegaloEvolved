import { describe, expect, it } from "vitest";
import {
  analyzeDocument,
  completionsAtPosition,
} from "../../src/language-service";
import { MEGALO_VERSIONS } from "../../src/version";

const version = MEGALO_VERSIONS["107-mcc"];

const PRELUDE = `variables global
\tnetworked number n 0
end
`;

const labelsAtEndOfLine = async (statement: string): Promise<string[]> => {
  const source = `${PRELUDE}trigger player
\t${statement}
end
`;
  const snapshot = await analyzeDocument(source, { version });
  return completionsAtPosition(snapshot, {
    // PRELUDE's lines, then `trigger player`, then the statement.
    line: PRELUDE.split("\n").length,
    character: `\t${statement}`.length,
  }).map((item) => item.label);
};

describe("typed completion dedupe", () => {
  it("lists local_player only once when Player and Object slots are unioned", async () => {
    // `set`'s right-hand side accepts Integer | Timer | Team | Player | Object.
    const labels = await labelsAtEndOfLine("action set n set_to ");
    expect(labels.filter((label) => label === "local_player")).toHaveLength(1);
    expect(labels.filter((label) => label === "current_player")).toHaveLength(
      1
    );
    expect(labels.filter((label) => label === "none")).toHaveLength(1);
  });

  it("omits read-only built-ins from set's writable left-hand side", async () => {
    const labels = await labelsAtEndOfLine("action set ");
    expect(labels).not.toContain("local_player");
    expect(labels).not.toContain("current_player");
  });
});

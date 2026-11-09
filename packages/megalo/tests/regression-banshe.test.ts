import { describe, expect, it } from "vitest";
import { compileSource } from "../src/compile-source";
import { DiagnosticSeverity } from "../src/diagnostics";
import { MEGALO_VERSIONS } from "../src/version";

const version = MEGALO_VERSIONS["107-mcc"];

const wrap = (body: string): string => `string_table english
\tname "Custom Game"
end
engine_data
\tname name
end

${body}
`;

describe("unresolved identifiers in if comparisons", () => {
  it("rejects object == unknown type name (banshe)", async () => {
    const result = await compileSource(
      wrap(`trigger player
\ttemporary object current_ride none
\taction player_get_vehicle current_player current_ride
\tcondition if current_ride == banshe
end
`),
      { version }
    );

    expect(result.bytes).toBeUndefined();
    expect(
      result.diagnostics.some((d) =>
        d.message.includes("Unresolved identifier 'banshe'")
      )
    ).toBe(true);
  });

  it("still accepts object == none", async () => {
    const result = await compileSource(
      wrap(`trigger player
\ttemporary object current_ride none
\taction player_get_vehicle current_player current_ride
\tcondition if current_ride == none
end
`),
      { version }
    );

    expect(
      result.diagnostics.filter((d) => d.severity === DiagnosticSeverity.Error)
    ).toHaveLength(0);
    expect(result.bytes).toBeDefined();
  });

  it("still accepts numeric comparisons", async () => {
    const result = await compileSource(
      wrap(`trigger player
\ttemporary number score 0
\tcondition if score == 0
end
`),
      { version }
    );

    expect(
      result.diagnostics.filter((d) => d.severity === DiagnosticSeverity.Error)
    ).toHaveLength(0);
    expect(result.bytes).toBeDefined();
  });
});

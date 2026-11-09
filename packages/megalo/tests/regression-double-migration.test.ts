import { describe, expect, it } from "vitest";
import { compileSource } from "../src/compile-source";
import { DiagnosticSeverity, SourceLocationType } from "../src/diagnostics";
import { MEGALO_VERSIONS } from "../src/version";

const wrap = (body: string): string => `string_table english
\tname "Custom Game"
end
engine_data
\tname name
end

${body}
`;

describe("double_migration version support", () => {
  it("errors on Alpha (49) at the trigger name", async () => {
    const result = await compileSource(
      wrap(`trigger double_migration
end
`),
      { version: MEGALO_VERSIONS["49"] }
    );
    const errors = result.diagnostics.filter(
      (d) => d.severity === DiagnosticSeverity.Error
    );
    expect(errors.map((d) => d.message)).toEqual([
      "Trigger type 'double_migration' is not supported by Halo: Reach - Alpha.",
    ]);
    expect(errors[0]?.location.type).toBe(SourceLocationType.SOURCE_CODE);
    if (errors[0]?.location.type === SourceLocationType.SOURCE_CODE) {
      // 0-based line of `trigger double_migration` in the wrapped source.
      expect(errors[0].location.start.line).toBe(8);
    }
  });

  it("errors on Beta (73) at the trigger name", async () => {
    const result = await compileSource(
      wrap(`trigger double_migration
end
`),
      { version: MEGALO_VERSIONS["73"] }
    );
    const errors = result.diagnostics.filter(
      (d) => d.severity === DiagnosticSeverity.Error
    );
    expect(errors.map((d) => d.message)).toEqual([
      "Trigger type 'double_migration' is not supported by Halo: Reach - Beta.",
    ]);
    expect(errors[0]?.location.type).toBe(SourceLocationType.SOURCE_CODE);
  });

  it("accepts on Release (106)", async () => {
    const result = await compileSource(
      wrap(`trigger double_migration
end
`),
      { version: MEGALO_VERSIONS["106"] }
    );
    expect(
      result.diagnostics.filter((d) => d.severity === DiagnosticSeverity.Error)
    ).toEqual([]);
  });
});

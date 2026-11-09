import { describe, expect, it } from "vitest";
import { compileSource } from "../src/compile-source";
import { DiagnosticSeverity, SourceLocationType } from "../src/diagnostics";
import { getLabel, MEGALO_VERSIONS } from "../src/version";

const v49 = MEGALO_VERSIONS["49"];
const v73 = MEGALO_VERSIONS["73"];
const v106 = MEGALO_VERSIONS["106"];

const minimalScript = `string_table english
\tname "Custom Game"
end
engine_data
\tname name
end
`;

const scriptWith = (body: string) => `${minimalScript}
trigger initialization
${body}
end
`;

describe("49 / 73 smoke compile", () => {
  it.each([
    ["49", v49],
    ["73", v73],
  ] as const)("compiles a minimal script on %s", async (_id, version) => {
    const result = await compileSource(minimalScript, { version });
    expect(
      result.diagnostics.filter((d) => d.severity === DiagnosticSeverity.Error)
    ).toEqual([]);
    expect(result.bytes).toBeDefined();
    expect(result.bytes!.length).toBeGreaterThan(0);
  });
});

describe("pre-release action / comparison gates", () => {
  it("rejects MCC-only hide_object on 49 and 73", async () => {
    const source = scriptWith("\taction hide_object none true\n");
    for (const version of [v49, v73]) {
      const result = await compileSource(source, { version });
      expect(
        result.diagnostics.some((d) =>
          d.message.includes(
            `Action 'hide_object' is not supported by ${getLabel(version)}`
          )
        )
      ).toBe(true);
      expect(result.bytes).toBeUndefined();
    }
  });

  it("rejects 106+ object_face_object on 49 and 73", async () => {
    const source = scriptWith(
      "\taction object_face_object none none true 0 0 0\n"
    );
    for (const version of [v49, v73]) {
      const result = await compileSource(source, { version });
      expect(
        result.diagnostics.some((d) => d.message.includes("not supported"))
      ).toBe(true);
    }
  });

  it("rejects <= comparison on 49, accepts on 73", async () => {
    const source = `string_table english
\tname "Custom Game"
end
engine_data
\tname name
end
variables global
\tlocal number a 0
end
trigger initialization
\tcondition if a <= 0
\taction set a = 1
end
`;
    const alpha = await compileSource(source, { version: v49 });
    expect(
      alpha.diagnostics.some(
        (d) =>
          d.message.includes("<=") ||
          d.message.includes("not supported") ||
          d.message.toLowerCase().includes("comparison")
      )
    ).toBe(true);

    const delta = await compileSource(source, { version: v73 });
    expect(
      delta.diagnostics.filter((d) => d.severity === DiagnosticSeverity.Error)
    ).toEqual([]);
  });

  it("rewrites != to negated == on 49, keeps native != on 73", async () => {
    const source = `string_table english
\tname "Custom Game"
end
engine_data
\tname name
end
variables global
\tlocal number a 0
end
trigger initialization
\tcondition if a != 0
\taction set a = 1
end
`;
    const alpha = await compileSource(source, { version: v49 });
    expect(
      alpha.diagnostics.filter((d) => d.severity === DiagnosticSeverity.Error)
    ).toEqual([]);
    expect(alpha.bytes).toBeDefined();

    const alphaNot = await compileSource(
      source.replace("condition if a != 0", "condition not if a != 0"),
      { version: v49 }
    );
    expect(
      alphaNot.diagnostics.filter(
        (d) => d.severity === DiagnosticSeverity.Error
      )
    ).toEqual([]);
    expect(alphaNot.bytes).toBeDefined();

    const delta = await compileSource(source, { version: v73 });
    expect(
      delta.diagnostics.filter((d) => d.severity === DiagnosticSeverity.Error)
    ).toEqual([]);
    expect(delta.bytes).toBeDefined();
  });

  it("accepts keyword and positional create_object on 49", async () => {
    const keyword = scriptWith(`\ttemporary object respawner none
\taction create_object "monitor" at none set respawner never_garbage
`);
    const keywordResult = await compileSource(keyword, { version: v49 });
    expect(
      keywordResult.diagnostics.filter(
        (d) => d.severity === DiagnosticSeverity.Error
      )
    ).toEqual([]);
    expect(keywordResult.bytes).toBeDefined();

    const positional = scriptWith(`\ttemporary object respawner none
\taction create_object "monitor" respawner none never_garbage
`);
    const positionalResult = await compileSource(positional, { version: v49 });
    expect(
      positionalResult.diagnostics.filter(
        (d) => d.severity === DiagnosticSeverity.Error
      )
    ).toEqual([]);
    expect(positionalResult.bytes).toBeDefined();
  });

  it("checks writability on positional create_object out, not place_at", async () => {
    const placeAtCurrent = scriptWith(`\ttemporary object respawner none
\taction create_object "monitor" respawner current_object
`);
    const placeAtOk = await compileSource(placeAtCurrent, { version: v49 });
    expect(
      placeAtOk.diagnostics.filter(
        (d) => d.severity === DiagnosticSeverity.Error
      )
    ).toEqual([]);

    const outCurrent = scriptWith(
      `\taction create_object "monitor" current_object none\n`
    );
    const outBad = await compileSource(outCurrent, { version: v49 });
    expect(
      outBad.diagnostics.some(
        (d) =>
          d.severity === DiagnosticSeverity.Error &&
          d.message.includes("Object reference must be writable")
      )
    ).toBe(true);
  });

  it("rejects create_object offset on 49, accepts on 73", async () => {
    const source = scriptWith(`\ttemporary object spawned none
\taction create_object "monitor" at none set spawned offset 0 0 0
`);
    const alpha = await compileSource(source, { version: v49 });
    expect(
      alpha.diagnostics.some(
        (d) =>
          d.severity === DiagnosticSeverity.Error &&
          d.message.includes("offset")
      )
    ).toBe(true);

    const delta = await compileSource(source, { version: v73 });
    expect(
      delta.diagnostics.filter((d) => d.severity === DiagnosticSeverity.Error)
    ).toEqual([]);
  });

  it("accepts bare object trigger execution mode on 49 and 73", async () => {
    const source = `string_table english
\tname "Custom Game"
end
engine_data
\tname name
end
trigger object
end
`;
    const alpha = await compileSource(source, { version: v49 });
    expect(
      alpha.diagnostics.filter((d) => d.severity === DiagnosticSeverity.Error)
    ).toEqual([]);
    expect(alpha.bytes).toBeDefined();

    const delta = await compileSource(source, { version: v73 });
    expect(
      delta.diagnostics.filter((d) => d.severity === DiagnosticSeverity.Error)
    ).toEqual([]);
    expect(delta.bytes).toBeDefined();
  });

  it("accepts named map_object filter triggers on 49", async () => {
    const source = `string_table english
\tname "Custom Game"
end
engine_data
\tname name
end
map_object respawn_pads
\tlabel "respawn"
end
trigger respawn_pads
end
`;
    const alpha = await compileSource(source, { version: v49 });
    expect(
      alpha.diagnostics.filter((d) => d.severity === DiagnosticSeverity.Error)
    ).toEqual([]);
    expect(alpha.bytes).toBeDefined();
  });

  it("accepts alpha-only object_set_minimap_visibility on 49 only", async () => {
    const source = scriptWith(
      "\taction object_set_minimap_visibility none true\n"
    );
    const alpha = await compileSource(source, { version: v49 });
    expect(
      alpha.diagnostics.filter((d) => d.severity === DiagnosticSeverity.Error)
    ).toEqual([]);

    const delta = await compileSource(source, { version: v73 });
    expect(
      delta.diagnostics.some((d) => d.message.includes("not supported"))
    ).toBe(true);
  });
});

describe("pre-release loadout palette object lists", () => {
  it("resolves set_loadout_palette from loadout_palettes.txt on 49/73", async () => {
    const source = scriptWith(
      "\taction set_loadout_palette player current_player slayer_loadouts\n"
    );
    for (const version of [v49, v73]) {
      const result = await compileSource(source, { version });
      expect(
        result.diagnostics.filter(
          (d) => d.severity === DiagnosticSeverity.Error
        )
      ).toEqual([]);
      expect(result.bytes).toBeDefined();
    }
  });

  it("still requires a declared palette / tier on 106+", async () => {
    const source = scriptWith(
      "\taction set_loadout_palette player current_player slayer_loadouts\n"
    );
    const result = await compileSource(source, { version: v106 });
    expect(
      result.diagnostics.some((d) => d.severity === DiagnosticSeverity.Error)
    ).toBe(true);
  });
});

describe("pre-release lock / hide capabilities", () => {
  it("does not treat override-without-lock as baseVariantParametersLocked usage", async () => {
    const source = `string_table english
\tname "Custom Game"
end
engine_data
\tname name
end
game_options
\toverride teams_enabled true
\toverride score_to_win_round 25
end
`;
    for (const version of [v49, v73]) {
      const result = await compileSource(source, { version });
      expect(
        result.diagnostics.filter(
          (d) =>
            d.severity === DiagnosticSeverity.Error &&
            d.message.includes("baseVariantParametersLocked")
        )
      ).toEqual([]);
    }
  });

  it("rejects lock on 49/73 at the lock keyword", async () => {
    const source = `string_table english
\tname "Custom Game"
end
engine_data
\tname name
end
game_options
\tlock override teams_enabled true
end
`;
    for (const version of [v49, v73]) {
      const result = await compileSource(source, { version });
      const locked = result.diagnostics.find(
        (d) =>
          d.severity === DiagnosticSeverity.Error &&
          d.message.includes('"lock teams_enabled" is not supported')
      );
      expect(locked).toBeDefined();
      expect(locked!.location.type).toBe(SourceLocationType.SOURCE_CODE);
      if (locked!.location.type === SourceLocationType.SOURCE_CODE) {
        expect(locked!.location.start.line).toBeGreaterThan(1);
      }
    }
  });
});

describe("requisition palettes", () => {
  it("parses and compiles numeric costs + enabled items on 49/73", async () => {
    const source = `string_table english
\tname "Custom Game"
end
engine_data
\tname name
end
requisition_palette covy_palette_gold
\tbaseline empty
\titem "needler" 100
\titem "ghost" enabled
end
trigger initialization
\taction player_set_requisition_palette current_player covy_palette_gold
end
`;
    for (const version of [v49, v73]) {
      const result = await compileSource(source, { version });
      expect(
        result.diagnostics.filter(
          (d) => d.severity === DiagnosticSeverity.Error
        )
      ).toEqual([]);
      expect(result.bytes).toBeDefined();
    }
  });

  it("rejects requisition_palette on 106+", async () => {
    const source = `string_table english
\tname "Custom Game"
end
engine_data
\tname name
end
requisition_palette covy_palette_gold
\tbaseline empty
\titem "needler" enabled
end
`;
    const result = await compileSource(source, { version: v106 });
    expect(
      result.diagnostics.some((d) => d.severity === DiagnosticSeverity.Error)
    ).toBe(true);
  });
});

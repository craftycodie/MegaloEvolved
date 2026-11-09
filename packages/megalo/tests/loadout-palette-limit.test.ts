import { describe, expect, it } from "vitest";
import { compileSource } from "../src/compile-source";
import { MEGALO_VERSIONS } from "../src/version";

const version = MEGALO_VERSIONS["107-mcc"];

const loadout = `loadout loadout_scout
	name loadout_name_scout
	primary_weapon assault_rifle
	backpack_weapon magnum
	equipment sprint_equipment
	grenades 2 frag
end
`;

const palettes = (count: number) =>
  Array.from(
    { length: count },
    (_, index) =>
      `loadout_palette palette_${index}\n\titem loadout_scout\nend\n`
  ).join("\n");

describe("loadout palette limit", () => {
  it("accepts the version's maximum number of declared palettes", async () => {
    const result = await compileSource(loadout + palettes(16), { version });
    expect(
      result.diagnostics.filter((d) => /loadout palette/i.test(d.message))
    ).toEqual([]);
  });

  // MegaloEdit refuses stock 3nvasion.txt for this: 16 palettes from
  // includes/multiplayer_loadouts.txt plus one unused palette in the script.
  it("rejects one declared palette over the limit, used or not", async () => {
    const result = await compileSource(loadout + palettes(17), { version });
    const errors = result.diagnostics.filter((d) =>
      /Too many megalo-defined loadout palettes/.test(d.message)
    );
    expect(errors).toHaveLength(1);
    expect(result.bytes).toBeUndefined();
  });

  it("counts a re-declared name once", async () => {
    const source =
      loadout +
      palettes(16) +
      "loadout_palette palette_3\n\titem loadout_scout\nend\n";
    const result = await compileSource(source, { version });
    expect(
      result.diagnostics.filter((d) => /loadout palette/i.test(d.message))
    ).toEqual([]);
  });
});

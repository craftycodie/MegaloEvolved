import { describe, expect, it } from "vitest";
import { compileSource } from "../src/compile-source";
import { MEGALO_VERSIONS } from "../src/version";

// Limits checked against MegaloEdit (HREK, MCC): 32 loadouts compile and 33
// fail with "Too many megalo-defined loadouts"; 16 player trait sets compile
// and 17 fail with "Too many player traits".
const version = MEGALO_VERSIONS["107-mcc"];

const loadouts = (count: number) =>
  Array.from(
    { length: count },
    (_, index) => `loadout l${index}\n\tprimary_weapon assault_rifle\nend\n`
  ).join("\n");

const traitSets = (count: number) => {
  const strings = Array.from(
    { length: count },
    (_, index) =>
      `\ttn${index} "Traits ${index}"\n\ttd${index} "Description ${index}"\n`
  ).join("");
  const sets = Array.from(
    { length: count },
    (_, index) =>
      `\tplayer_traits t${index}\n\t\ttn${index}\n\t\ttd${index}\n\t\tspeed 75\n\tend\n`
  ).join("");
  return `string_table english\n${strings}end\n\ngame_options\n${sets}end\n`;
};

const errorsMatching = (
  result: Awaited<ReturnType<typeof compileSource>>,
  pattern: RegExp
) => result.diagnostics.filter((d) => pattern.test(d.message));

describe("loadout limit", () => {
  it("allows 32 declared loadouts", async () => {
    const result = await compileSource(loadouts(32), { version });
    expect(errorsMatching(result, /Too many megalo-defined loadouts/)).toEqual(
      []
    );
  });

  it("rejects the 33rd declared loadout", async () => {
    const result = await compileSource(loadouts(33), { version });
    expect(
      errorsMatching(result, /Too many megalo-defined loadouts/)
    ).toHaveLength(1);
    expect(result.bytes).toBeUndefined();
  });
});

describe("player traits limit", () => {
  it("allows 16 player trait sets", async () => {
    const result = await compileSource(traitSets(16), { version });
    expect(errorsMatching(result, /Too many player traits/)).toEqual([]);
  });

  it("rejects the 17th player trait set", async () => {
    const result = await compileSource(traitSets(17), { version });
    expect(errorsMatching(result, /Too many player traits/)).toHaveLength(1);
    expect(result.bytes).toBeUndefined();
  });
});

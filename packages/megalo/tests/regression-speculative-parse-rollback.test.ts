import { describe, expect, it } from "vitest";
import type { SymbolTableEntry } from "../src/frontend/symbol-table";
import { analyzeDocument } from "../src/language-service";
import { MEGALO_VERSIONS } from "../src/version";

const version = MEGALO_VERSIONS["107-mcc"];

const referencesTo = async (
  source: string,
  name: string
): Promise<SymbolTableEntry["references"]> => {
  const snapshot = await analyzeDocument(source, { version });
  const entry = (snapshot.ast.symbolTable.toArray() as SymbolTableEntry[]).find(
    (symbol) => symbol.name === name
  );
  expect(entry).toBeDefined();
  return entry!.references;
};

/**
 * `set_score` tries `everyone`, then `player <p>`, then `team <t>` after the
 * shared `<op> <value>` prefix. Failed attempts must not leave references to
 * `<value>` behind in the symbol table.
 */
describe("speculative parameter parse rollback", () => {
  it("records one reference when a later signature matches", async () => {
    const references = await referencesTo(
      `variables global
\tlocal number points 0
end

trigger player
\taction set_score add points team current_team
end
`,
      "points"
    );
    expect(references).toHaveLength(1);
  });

  it("records one reference when no signature matches exactly", async () => {
    const references = await referencesTo(
      `variables global
\tlocal number points 0
end

trigger player
\taction set_score add points nonsense current_player
end
`,
      "points"
    );
    expect(references).toHaveLength(1);
  });
});

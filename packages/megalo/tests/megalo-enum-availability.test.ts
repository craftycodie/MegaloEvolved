import { SourceLocationType } from "src/diagnostics";
import { SyntaxKind } from "src/frontend/abstract-syntax-tree/kinds";
import type { ASTKeywordParameterNode } from "src/frontend/abstract-syntax-tree/parameters";
import { megaloEnum } from "src/frontend/intermediate-representation/megaloEnum";
import { highlightEnumKeyword } from "src/language-service/highlighting/helpers";
import { runWithHighlightVersion } from "src/language-service/highlighting/session";
import type { SemanticToken } from "src/language-service/highlighting/types";
import { MEGALO_VERSIONS, type SupportedMegaloVersion } from "src/version";
import { describe, expect, it, vi } from "vitest";

const mcc = MEGALO_VERSIONS["107-mcc"];
const retail107 = MEGALO_VERSIONS["107"];

describe("megaloEnum version availability", () => {
  it("returns the full member set when the second arg is omitted", () => {
    const e = megaloEnum(["a", "b"] as const);
    expect([...e.supportedMembers(mcc)]).toEqual(["a", "b"]);
    expect([...e.supportedMembers(retail107)]).toEqual(["a", "b"]);
  });

  it("lazily invokes allowedForVersion once per distinct version", () => {
    const allowedForVersion = vi.fn((v: SupportedMegaloVersion) =>
      v.flavour === "mcc"
        ? new Set(["always", "mcc_only"] as const)
        : new Set(["always"] as const)
    );
    const e = megaloEnum(["always", "mcc_only"] as const, allowedForVersion);

    expect(allowedForVersion).not.toHaveBeenCalled();

    expect(e.supportedMembers(mcc).has("always")).toBe(true);
    expect(e.supportedMembers(mcc).has("mcc_only")).toBe(true);
    expect(allowedForVersion).toHaveBeenCalledTimes(1);
    expect(allowedForVersion).toHaveBeenCalledWith(mcc);

    expect(e.supportedMembers(mcc).has("mcc_only")).toBe(true);
    expect(allowedForVersion).toHaveBeenCalledTimes(1);

    expect(e.supportedMembers(retail107).has("mcc_only")).toBe(false);
    expect(e.supportedMembers(retail107).has("always")).toBe(true);
    expect(allowedForVersion).toHaveBeenCalledTimes(2);
    expect(allowedForVersion).toHaveBeenLastCalledWith(retail107);

    expect(e.supportedMembers(retail107).has("always")).toBe(true);
    expect(allowedForVersion).toHaveBeenCalledTimes(2);
  });

  it("returns canonical names only (aliases are not in the set)", () => {
    const e = megaloEnum(
      ["canonical", { name: "alias", aliasOf: "canonical" }, "gated"] as const,
      (v) =>
        v.flavour === "mcc"
          ? new Set(["canonical", "gated"])
          : new Set(["canonical"])
    );

    expect(e.parse("alias")).toBe("canonical");
    expect(e.supportedMembers(mcc).has("canonical")).toBe(true);
    // Aliases are not members of the supported set (typed as canonical names).
    expect((e.supportedMembers(mcc) as ReadonlySet<string>).has("alias")).toBe(
      false
    );
    expect(e.supportedMembers(retail107).has("gated")).toBe(false);
  });

  it("still parses members that are unavailable on a version", () => {
    const e = megaloEnum(["always", "mcc_only"] as const, (v) =>
      v.flavour === "mcc"
        ? new Set(["always", "mcc_only"])
        : new Set(["always"])
    );

    expect(e.parse("mcc_only")).toBe("mcc_only");
    expect(e.has("mcc_only")).toBe(true);
    expect(e.supportedMembers(retail107).has("mcc_only")).toBe(false);
  });
});

const keywordNode = (value: string): ASTKeywordParameterNode => ({
  kind: SyntaxKind.KEYWORD,
  value,
  location: {
    type: SourceLocationType.SOURCE_CODE,
    start: { line: 1, column: 1, absoluteOffset: 0, localOffset: 0 },
    end: {
      line: 1,
      column: 1 + value.length,
      absoluteOffset: value.length,
      localOffset: value.length,
    },
  },
});

describe("highlightEnumKeyword deprecated modifier", () => {
  it("emits deprecated when a member is unavailable for the session version", () => {
    const e = megaloEnum(["always", "mcc_only"] as const, (v) =>
      v.flavour === "mcc"
        ? new Set(["always", "mcc_only"])
        : new Set(["always"])
    );
    const out: SemanticToken[] = [];

    runWithHighlightVersion(retail107, () => {
      highlightEnumKeyword(out, keywordNode("mcc_only"), e);
      highlightEnumKeyword(out, keywordNode("always"), e);
    });

    expect(out).toHaveLength(2);
    expect(out[0]!.modifiers).toEqual(["deprecated"]);
    expect(out[1]!.modifiers).toEqual([]);
  });

  it("emits deprecated for statically deprecated members", () => {
    const e = megaloEnum(["ok", { name: "old", deprecated: true }] as const);
    const out: SemanticToken[] = [];

    runWithHighlightVersion(mcc, () => {
      highlightEnumKeyword(out, keywordNode("old"), e);
      highlightEnumKeyword(out, keywordNode("ok"), e);
    });

    expect(out[0]!.modifiers).toEqual(["deprecated"]);
    expect(out[1]!.modifiers).toEqual([]);
  });

  it("does not apply availability when allowed is a plain string list", () => {
    const out: SemanticToken[] = [];
    runWithHighlightVersion(retail107, () => {
      highlightEnumKeyword(out, keywordNode("mcc_only"), ["mcc_only"]);
    });
    expect(out[0]!.modifiers).toEqual([]);
  });
});

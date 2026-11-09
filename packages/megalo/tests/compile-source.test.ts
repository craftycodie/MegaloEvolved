import { bitstream } from "@blamnetwork/blf";
import { c_game_engine_custom_variant as AlphaCustomVariant } from "@blamnetwork/blf/haloreach/v08516_10_02_19_1607_omaha_alpha";
import { afterEach, describe, expect, it, vi } from "vitest";
import { compileSource } from "../src/compile-source";
import { MegaloCompilerContext } from "../src/context";
import {
  DiagnosticSeverity,
  Diagnostics,
  SourceLocationType,
} from "../src/diagnostics";
import { Parser } from "../src/frontend/abstract-syntax-tree";
import { ElementKind } from "../src/frontend/abstract-syntax-tree/elements";
import { Lexer } from "../src/frontend/tokens";
import { MEGALO_VERSIONS } from "../src/version";

const { c_bitstream_writer, e_bitstream_byte_order } = bitstream;

const version = MEGALO_VERSIONS["107-mcc"];
const frontend = new MegaloCompilerContext(version);

const encodeAlphaMglo = (): Uint8Array => {
  const gametype = new AlphaCustomVariant();
  gametype.initialize();
  const writer = c_bitstream_writer.new(
    0,
    e_bitstream_byte_order._bitstream_byte_order_big_endian
  );
  writer.begin_writing();
  gametype.encode(writer);
  writer.finish_writing();
  return writer.get_data();
};

const minimalScript = `string_table english
\tname "Custom Game"
end
engine_data
\tname name
end
`;

describe("compileSource includes", () => {
  it("expands includes so later symbols can see included declarations", async () => {
    const files = new Map<string, string>([
      [
        "shared.txt",
        `constants
\tnumber shared_flag 1
end
`,
      ],
    ]);

    const result = await compileSource(
      `include "shared.txt"
constants
\tnumber local_flag shared_flag
end
`,
      {
        version,
        resolveInclude: (path) => {
          const text = files.get(path);
          return text ? { text, uri: path } : null;
        },
      }
    );

    expect(
      result.diagnostics.some((d) => d.message.includes("shared_flag"))
    ).toBe(false);
  });

  it("counts included triggers in limitUsage from the same compile", async () => {
    const files = new Map<string, string>([
      [
        "extra.txt",
        `trigger general
\taction set n set_to 1
end
`,
      ],
    ]);

    const result = await compileSource(
      `include "extra.txt"
variables global
\tlocal number n 0
end
trigger general
\taction set n set_to 2
end
`,
      {
        version,
        resolveInclude: (path) => {
          const text = files.get(path);
          return text ? { text, uri: path } : null;
        },
      }
    );

    expect(result.limitUsage).toBeDefined();
    expect(
      result.limitUsage?.items.find((item) => item.id === "triggers")?.used
    ).toBe(2);
    expect(
      result.limitUsage?.items.find((item) => item.id === "actions")?.used
    ).toBeGreaterThanOrEqual(2);
  });

  it("omits limitUsage when includeLimitUsage is false", async () => {
    const result = await compileSource(minimalScript, {
      version,
      includeLimitUsage: false,
    });
    expect(result.limitUsage).toBeUndefined();
  });

  it("blames unresolved include DX on the include line", async () => {
    const source = `include "missing.txt"
`;
    const result = await compileSource(source, {
      version,
      resolveInclude: () => Promise.resolve(null),
    });

    const error = result.diagnostics.find((d) =>
      d.message.includes('Could not resolve include "missing.txt"')
    );
    expect(error).toBeDefined();
    expect(error?.location.type).toBe(SourceLocationType.SOURCE_CODE);
    if (error?.location.type === SourceLocationType.SOURCE_CODE) {
      expect(error?.location.start.line).toBe(1);
    }
  });

  it("warns on missing localized_include when not strict", async () => {
    const result = await compileSource(
      `localized_include "missing.txt"
${minimalScript}`,
      {
        version,
        resolveInclude: () => Promise.resolve(null),
      }
    );

    const warning = result.diagnostics.find(
      (d) =>
        d.severity === DiagnosticSeverity.Warning &&
        d.message.includes('localized_include "missing.txt"')
    );
    expect(warning).toBeDefined();
    expect(
      result.diagnostics.some(
        (d) =>
          d.severity === DiagnosticSeverity.Error &&
          d.message.includes("localized_include")
      )
    ).toBe(false);
  });

  it("errors on missing localized_include when strictStringLiterals", async () => {
    const result = await compileSource(
      `localized_include "missing.txt"
${minimalScript}`,
      {
        version,
        compilerSettings: { strictStringLiterals: true },
        resolveInclude: () => Promise.resolve(null),
      }
    );

    const error = result.diagnostics.find(
      (d) =>
        d.severity === DiagnosticSeverity.Error &&
        d.message.includes('localized_include "missing.txt"')
    );
    expect(error).toBeDefined();
  });

  it("errors on string literals when strictStringLiterals", async () => {
    const result = await compileSource(
      `string_table english
\tname "Custom Game"
end
engine_data
\tname "Custom Game"
end
`,
      {
        version,
        compilerSettings: { strictStringLiterals: true },
      }
    );

    const error = result.diagnostics.find(
      (d) =>
        d.severity === DiagnosticSeverity.Error &&
        d.message.includes("String literals are not allowed")
    );
    expect(error).toBeDefined();
  });

  it("tags nested include parse errors as IncludeLocation on the outer include", async () => {
    const files = new Map<string, string>([
      ["outer.txt", `include "inner.txt"\n`],
      ["inner.txt", "this_is_not_a_valid_element\n"],
    ]);

    const source = `include "outer.txt"
`;
    const result = await compileSource(source, {
      version,
      resolveInclude: (path) => {
        const text = files.get(path);
        return text ? { text, uri: path } : null;
      },
    });

    const includeErrors = result.diagnostics.filter(
      (d) => d.location.type === SourceLocationType.INCLUDE
    );
    expect(includeErrors.length).toBeGreaterThan(0);
    for (const d of includeErrors) {
      if (d.location.type === SourceLocationType.INCLUDE) {
        expect(d.location.declaration.start.line).toBe(1);
        expect(d.location.file).toBe("inner.txt");
        expect(d.location.source.type).toBe(SourceLocationType.SOURCE_CODE);
        expect(d.location.source.start.line).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("does not warn when overriding unused values from includes", async () => {
    const files = new Map<string, string>([
      [
        "shared.txt",
        `string_table english
\tname "From Include"
end
engine_data
\tname name
end
`,
      ],
    ]);

    const result = await compileSource(
      `include "shared.txt"
string_table english
\tname "From Root"
end
engine_data
\tname name
end
`,
      {
        version,
        resolveInclude: (path) => {
          const text = files.get(path);
          return text ? { text, uri: path } : null;
        },
      }
    );

    const unused = result.diagnostics.filter(
      (d) =>
        d.severity === DiagnosticSeverity.Warning &&
        d.message.toLowerCase().includes("unused")
    );
    expect(unused).toEqual([]);
  });

  it("summarizes remaining include diagnostics into one problem per include directive", async () => {
    const { summarizeIncludeDiagnostics } = await import(
      "../src/diagnostics/summarizeInclude"
    );
    // Force an include-scoped parse error (not an unused-override) so summarize
    // still collapses opaque include noise.
    const files = new Map<string, string>([
      [
        "shared.txt",
        `not_a_real_element oops
`,
      ],
    ]);

    const source = `include "shared.txt"
engine_data
\tname name
end
`;
    const result = await compileSource(source, {
      version,
      resolveInclude: (path) => {
        const text = files.get(path);
        return text ? { text, uri: path } : null;
      },
    });

    const summarized = summarizeIncludeDiagnostics(result.diagnostics, source);
    const includeSummaries = summarized.filter(
      (d) => d.location.type === SourceLocationType.INCLUDE
    );
    expect(includeSummaries.length).toBeGreaterThanOrEqual(1);
    expect(includeSummaries[0]?.message).toMatch(
      /^include shared\.txt contains \d+ (error|errors|warning|warnings)/
    );
  });

  it("errors when the same string token is redefined for a language across includes", async () => {
    const files = new Map<string, string>([
      [
        "a.txt",
        `string_table french
\tfoo "un"
end
`,
      ],
      [
        "b.txt",
        `string_table french
\tfoo "deux"
end
`,
      ],
    ]);

    const result = await compileSource(
      `include "a.txt"
include "b.txt"
`,
      {
        version,
        resolveInclude: (path) => {
          const text = files.get(path);
          return text ? { text, uri: path } : null;
        },
      }
    );

    expect(
      result.diagnostics.some((d) =>
        d.message.includes("already has a string for token foo")
      )
    ).toBe(true);
  });

  it("expands a repeated include path only once (MegaloEdit parity)", async () => {
    let resolveCount = 0;
    const result = await compileSource(
      `include "shared.txt"
include "shared.txt"
constants
\tnumber x once
end
`,
      {
        version,
        resolveInclude: () => {
          resolveCount += 1;
          return {
            text: `constants
\tnumber once 1
end
`,
            uri: "shared.txt",
          };
        },
      }
    );

    expect(resolveCount).toBe(1);
    expect(result.diagnostics.some((d) => d.message.includes("once"))).toBe(
      false
    );
  });
});

describe("compileSource base files", () => {
  it("reports DX when more than one base is present", async () => {
    const result = await compileSource(
      `base "a.mglo"
base "b.mglo"
`,
      { version }
    );

    const multi = result.diagnostics.filter((d) =>
      d.message.includes("Only one base directive is allowed")
    );
    expect(multi.length).toBeGreaterThanOrEqual(1);
    expect(result.bytes).toBeUndefined();
  });

  it("compiles with a matching encoding base file", async () => {
    const baseResult = await compileSource(minimalScript, { version });
    expect(baseResult.bytes).toBeDefined();

    const result = await compileSource(`base "base.mglo"\n${minimalScript}`, {
      version,
      resolveBaseFile: async () => baseResult.bytes!,
    });

    expect(
      result.diagnostics.filter((d) =>
        d.message.toLowerCase().includes("encoding version")
      )
    ).toHaveLength(0);
    expect(result.bytes).toBeDefined();
  });

  it("reports DX when base encoding version does not match", async () => {
    const alphaBytes = encodeAlphaMglo();
    const result = await compileSource(`base "alpha.mglo"\n${minimalScript}`, {
      version,
      resolveBaseFile: async () => alphaBytes,
    });

    const mismatch = result.diagnostics.find((d) =>
      d.message.includes("encoding version")
    );
    expect(mismatch).toBeDefined();
    expect(result.bytes).toBeUndefined();
  });

  it("JIT-compiles a sibling .txt when the .mglo is missing", async () => {
    const files = new Map<string, string>([["base.txt", minimalScript]]);
    const progress: string[] = [];

    const result = await compileSource(`base "base.mglo"\n${minimalScript}`, {
      version,
      megacrowExtensions: { compileMissingBaseFromSource: true },
      onCompileProgress: (message) => progress.push(message),
      resolveBaseFile: () => null,
      resolveInclude: (path) => {
        const text = files.get(path);
        return text ? { text, uri: path } : null;
      },
    });

    expect(
      progress.some((m) => m.includes("Compiling base file base.txt"))
    ).toBe(true);
    expect(result.bytes).toBeDefined();
    expect(
      result.diagnostics.some(
        (d) =>
          d.severity === DiagnosticSeverity.Warning &&
          d.message ===
            "No base file was found, base.txt was compiled from source."
      )
    ).toBe(true);
  });

  it("JIT-compiles sibling .txt silently when resolveBaseFile is omitted", async () => {
    const files = new Map<string, string>([["base.txt", minimalScript]]);

    const result = await compileSource(`base "base.mglo"\n${minimalScript}`, {
      version,
      megacrowExtensions: { compileMissingBaseFromSource: true },
      resolveInclude: (path) => {
        const text = files.get(path);
        return text ? { text, uri: path } : null;
      },
    });

    expect(result.bytes).toBeDefined();
    expect(
      result.diagnostics.some(
        (d) =>
          d.severity === DiagnosticSeverity.Warning &&
          d.message.includes("was compiled from source")
      )
    ).toBe(false);
  });

  it("does not JIT-compile a sibling .txt unless the extension is enabled", async () => {
    const files = new Map<string, string>([["base.txt", minimalScript]]);

    const result = await compileSource(`base "base.mglo"\n${minimalScript}`, {
      version,
      resolveBaseFile: () => null,
      resolveInclude: (path) => {
        const text = files.get(path);
        return text ? { text, uri: path } : null;
      },
    });

    expect(result.bytes).toBeUndefined();
    expect(
      result.diagnostics.some(
        (d) => d.message === 'No base file was found "base.mglo"'
      )
    ).toBe(true);
  });

  it("DX errors when neither .mglo nor sibling .txt exist", async () => {
    const result = await compileSource(
      `base "missing.mglo"\n${minimalScript}`,
      {
        version,
        megacrowExtensions: { compileMissingBaseFromSource: true },
        resolveBaseFile: () => null,
        resolveInclude: () => null,
      }
    );

    const error = result.diagnostics.find((d) =>
      d.message.includes('No base file was found "missing.mglo"')
    );
    expect(error).toBeDefined();
    expect(error?.message).not.toContain("could not compile from source");
    expect(result.bytes).toBeUndefined();
    if (error?.location.type === SourceLocationType.SOURCE_CODE) {
      expect(error.location.start.line).toBe(1);
    }
  });

  it("DX errors on the base line when JIT .txt compile fails", async () => {
    const files = new Map<string, string>([
      ["broken.txt", "this_is_not_a_valid_element\n"],
    ]);

    const result = await compileSource(`base "broken.mglo"\n${minimalScript}`, {
      version,
      megacrowExtensions: { compileMissingBaseFromSource: true },
      resolveBaseFile: () => null,
      resolveInclude: (path) => {
        const text = files.get(path);
        return text ? { text, uri: path } : null;
      },
    });

    const error = result.diagnostics.find((d) =>
      d.message.includes(
        'No base file was found "broken.mglo" and we could not compile from source'
      )
    );
    expect(error).toBeDefined();
    expect(result.bytes).toBeUndefined();
    if (error?.location.type === SourceLocationType.SOURCE_CODE) {
      expect(error.location.start.line).toBe(1);
    }
  });

  it("surfaces a single JIT summary warning on the base directive", async () => {
    const baseWithEofWarning = `string_table english
\tname "Custom Game"
end
engine_data
\tname name
end
trigger initialization
\taction set current_player.score = 1
`;

    const files = new Map<string, string>([
      ["warn_base.txt", baseWithEofWarning],
    ]);

    const result = await compileSource(
      `base "warn_base.mglo"\n${minimalScript}`,
      {
        version,
        megacrowExtensions: { compileMissingBaseFromSource: true },
        resolveBaseFile: () => null,
        resolveInclude: (path) => {
          const text = files.get(path);
          return text ? { text, uri: path } : null;
        },
      }
    );

    expect(result.bytes).toBeDefined();
    const warnings = result.diagnostics.filter(
      (d) => d.severity === DiagnosticSeverity.Warning
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toMatch(
      /No base file was found, warn_base\.txt was compiled from source with \d+ warnings?\./
    );
    if (warnings[0]?.location.type === SourceLocationType.SOURCE_CODE) {
      expect(warnings[0].location.start.line).toBe(1);
      expect(warnings[0].location.start.column).toBe(1);
      expect(warnings[0].location.end.column).toBeGreaterThan(
        warnings[0].location.start.column
      );
    }
  });

  it("blames JIT base diagnostics on the base directive span when not on line 1", async () => {
    const files = new Map<string, string>([["late_base.txt", minimalScript]]);

    const result = await compileSource(
      `; preamble\nbase "late_base.mglo"\n${minimalScript}`,
      {
        version,
        megacrowExtensions: { compileMissingBaseFromSource: true },
        resolveBaseFile: () => null,
        resolveInclude: (path) => {
          const text = files.get(path);
          return text ? { text, uri: path } : null;
        },
      }
    );

    expect(result.bytes).toBeDefined();
    const warnings = result.diagnostics.filter(
      (d) => d.severity === DiagnosticSeverity.Warning
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.location.type).toBe(SourceLocationType.SOURCE_CODE);
    if (warnings[0]?.location.type === SourceLocationType.SOURCE_CODE) {
      expect(warnings[0].location.start.line).toBe(2);
      expect(warnings[0].location.start.column).toBe(1);
      expect(warnings[0].location.start.localOffset).toBe(
        "; preamble\n".length
      );
      expect(warnings[0].location.end.localOffset).toBe(
        '; preamble\nbase "late_base.mglo"'.length
      );
    }
  });

  it("summarizes clean JIT compiles without a warning count", async () => {
    const files = new Map<string, string>([["clean_base.txt", minimalScript]]);

    const result = await compileSource(
      `base "clean_base.mglo"\n${minimalScript}`,
      {
        version,
        megacrowExtensions: { compileMissingBaseFromSource: true },
        resolveBaseFile: () => null,
        resolveInclude: (path) => {
          const text = files.get(path);
          return text ? { text, uri: path } : null;
        },
      }
    );

    expect(result.bytes).toBeDefined();
    const warnings = result.diagnostics.filter(
      (d) => d.severity === DiagnosticSeverity.Warning
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toBe(
      "No base file was found, clean_base.txt was compiled from source."
    );
  });

  it("reuses the in-memory JIT base cache for the same .txt", async () => {
    const { clearCompiledBaseSourceCache } = await import(
      "../src/compile-source"
    );
    clearCompiledBaseSourceCache();

    const files = new Map<string, string>([["shared_base.txt", minimalScript]]);
    let progressHits = 0;

    const options = {
      version,
      megacrowExtensions: { compileMissingBaseFromSource: true },
      onCompileProgress: () => {
        progressHits += 1;
      },
      resolveBaseFile: () => null,
      resolveInclude: (path: string) => {
        const text = files.get(path);
        return text ? { text, uri: path } : null;
      },
    };

    const first = await compileSource(
      `base "shared_base.mglo"\n${minimalScript}`,
      options
    );
    const second = await compileSource(
      `base "shared_base.mglo"\n${minimalScript}`,
      options
    );

    expect(first.bytes).toBeDefined();
    expect(second.bytes).toBeDefined();
    // Second hit uses cache — progress only fires for the real compile.
    expect(progressHits).toBe(1);
  });
});

describe("compileSource object lists", () => {
  it("loads bundled defaults so known object-list names resolve", async () => {
    const source = `map_object health_packs
\ttype "health_station"
end
`;

    const withDefaults = await compileSource(source, { version });
    const withoutDefaults = await compileSource(source, {
      version,
      objectLists: {},
    });

    expect(
      withDefaults.diagnostics.some((d) =>
        d.message.includes("not a valid object type")
      )
    ).toBe(false);
    expect(
      withoutDefaults.diagnostics.some((d) =>
        d.message.includes("not a valid object type")
      )
    ).toBe(true);
  });
});

describe("Parser.parseAsync include expansion", () => {
  it("splices included elements into the parent AST", async () => {
    const diagnostics = new Diagnostics();
    const tokens = new Lexer(frontend).lex(
      `include "c.txt"
constants
\tnumber x 1
end
`,
      diagnostics
    );

    const ast = await new Parser(frontend).parseAsync(tokens, diagnostics, {
      resolveInclude: () => ({
        text: `constants
\tnumber y 2
end
`,
        uri: "c.txt",
      }),
    });

    expect(diagnostics.hasErrors()).toBe(false);
    expect(ast.elements.length).toBeGreaterThanOrEqual(2);
    expect(
      ast.elements.some((e) => e.elementKind === ElementKind.INCLUDE)
    ).toBe(true);
    expect(
      ast.elements.some((e) => e.elementKind === ElementKind.CONSTANTS)
    ).toBe(true);
  });
});

describe("compileFromSnapshot", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("matches compileSource bytes without re-lexing", async () => {
    const { ALL_MEGACROW_EXTENSIONS } = await import(
      "../src/megacrow-extensions"
    );
    const { analyzeDocument } = await import("../src/language-service/analyze");
    const { compileFromSnapshot, compileSource } = await import(
      "../src/compile-source"
    );

    // Each compile stamps the current time and a random content unique id
    // into the metadata; pin both so the two outputs are comparable.
    vi.useFakeTimers({
      toFake: ["Date"],
      now: new Date("2026-01-01T00:00:00Z"),
    });
    vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation(
      <T extends ArrayBufferView | null>(array: T): T => {
        if (array) {
          new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(
            7
          );
        }
        return array;
      }
    );

    const options = {
      version,
      megacrowExtensions: ALL_MEGACROW_EXTENSIONS,
    };
    const fromSource = await compileSource(minimalScript, options);
    expect(fromSource.bytes).toBeDefined();

    const snapshot = await analyzeDocument(minimalScript, { version });
    const fromSnapshot = await compileFromSnapshot(snapshot, options);

    expect(fromSnapshot.bytes).toBeDefined();
    expect(Array.from(fromSnapshot.bytes!)).toEqual(
      Array.from(fromSource.bytes!)
    );
  });

  it("reuses one analysis snapshot for tokens and mglo", async () => {
    const { ALL_MEGACROW_EXTENSIONS } = await import(
      "../src/megacrow-extensions"
    );
    const { analyzeDocument } = await import("../src/language-service/analyze");
    const { getSemanticTokens } = await import(
      "../src/language-service/highlighting"
    );
    const { compileFromSnapshot } = await import("../src/compile-source");

    const snapshot = await analyzeDocument(minimalScript, { version });
    const tokens = getSemanticTokens(snapshot);
    const compiled = await compileFromSnapshot(snapshot, {
      megacrowExtensions: ALL_MEGACROW_EXTENSIONS,
    });

    expect(tokens.length).toBeGreaterThan(0);
    expect(compiled.bytes).toBeDefined();
    expect(
      compiled.diagnostics.filter(
        (d) => d.severity === DiagnosticSeverity.Error
      )
    ).toHaveLength(0);
  });
});

describe("compileSource unexpected tokens", () => {
  it.each([
    "fuck!",
    "!!!",
    "@",
  ])("rejects top-level garbage %j", async (source) => {
    const result = await compileSource(source, { version });
    expect(result.bytes).toBeUndefined();
    expect(
      result.diagnostics.some(
        (d) =>
          d.severity === DiagnosticSeverity.Error &&
          d.message.includes("Unrecognized element")
      )
    ).toBe(true);
  });

  it("still rejects unknown identifiers", async () => {
    const result = await compileSource("fuck", { version });
    expect(result.bytes).toBeUndefined();
    expect(
      result.diagnostics.some((d) =>
        d.message.includes("Unrecognized element 'fuck'")
      )
    ).toBe(true);
  });
});

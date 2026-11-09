import { describe, expect, it, vi } from "vitest";
import type { SourceAnalysis } from "../compile";

const compiles: {
  resolve: (analysis: SourceAnalysis) => void;
  text: string;
}[] = [];

vi.mock("../compile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../compile")>();
  return {
    ...actual,
    requestCompileViaLsp: (text: string) =>
      new Promise<SourceAnalysis>((resolve) => {
        compiles.push({ resolve, text });
      }),
  };
});
vi.mock("../editor/editorHost", () => ({
  editorHost: { setPlainTextMarkers: () => undefined },
}));
vi.mock("../lsp", () => ({
  lspAnalyzeObjectList: () => Promise.resolve({ diagnostics: [] }),
  lspUpdateConfig: () => undefined,
}));
vi.mock("../desktop/mccHotReload", () => ({
  writeMccHotReloadMglo: () => Promise.resolve(),
}));

const { idleAnalysis } = await import("../compile");
const { analyzeDocument, compileStore, resetCompile, selectCompileState } =
  await import("./compileStore");

const result = (message: string, overrides: Partial<SourceAnalysis> = {}) => ({
  ...idleAnalysis(),
  compileState: "ok" as const,
  message,
  ...overrides,
});

describe("compileStore", () => {
  it("shows parsing while a compile runs and keeps only the newest result", async () => {
    const doc = { key: "file:///a", kind: "megalo" as const };
    const first = analyzeDocument({ ...doc, text: "v1" }, { fresh: true });
    expect(selectCompileState(compileStore.getState())).toBe("parsing");
    const second = analyzeDocument({ ...doc, text: "v2" }, { fresh: false });

    compiles[1]?.resolve(result("v2 done"));
    await second;
    compiles[0]?.resolve(result("v1 done"));
    await first;

    const state = compileStore.getState();
    expect(state.analysis.message).toBe("v2 done");
    expect(selectCompileState(state)).toBe("ok");
  });

  it("keeps the last good size while an edit fails to compile", async () => {
    const doc = { key: "file:///a", kind: "megalo" as const };
    const good = analyzeDocument({ ...doc, text: "ok" }, { fresh: true });
    compiles.at(-1)?.resolve(result("ok", { compiledByteLength: 1234 }));
    await good;

    const bad = analyzeDocument({ ...doc, text: "broken" }, { fresh: false });
    compiles
      .at(-1)
      ?.resolve(result("failed", { compileState: "error", errorCount: 1 }));
    await bad;

    const { analysis } = compileStore.getState();
    expect(analysis.compileState).toBe("error");
    expect(analysis.compiledByteLength).toBe(1234);
  });

  it("ignores a result that arrives after a reset", async () => {
    const pending = analyzeDocument(
      { key: "file:///a", kind: "megalo", text: "x" },
      { fresh: true }
    );
    resetCompile();
    compiles.at(-1)?.resolve(result("late"));
    await pending;
    expect(compileStore.getState().analysis.compileState).toBe("idle");
    expect(compileStore.getState().pending).toBe(false);
  });

  it("marks plain object_lists files as text without compiling", async () => {
    const before = compiles.length;
    await analyzeDocument(
      { key: "file:///notes", kind: "text", text: "hello" },
      { fresh: true }
    );
    expect(compiles.length).toBe(before);
    expect(compileStore.getState().analysis.compileState).toBe("ok");
  });
});

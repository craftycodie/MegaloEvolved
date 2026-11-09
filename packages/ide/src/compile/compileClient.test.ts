import { describe, expect, it, vi } from "vitest";

const lspRequestArtifacts = vi.fn();
const lspCompileSource = vi.fn();

vi.mock("../lsp", () => ({ lspCompileSource, lspRequestArtifacts }));

const { requestCompileDownloadViaLsp, requestCompileViaLsp } = await import(
  "./compileClient"
);

describe("requestCompileViaLsp", () => {
  it("resolves with an error analysis when the LSP request throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    lspRequestArtifacts.mockRejectedValueOnce(new Error("worker crashed"));
    const analysis = await requestCompileViaLsp("source");
    expect(analysis.compileState).toBe("error");
    expect(analysis.errorCount).toBe(1);
  });
});

describe("requestCompileDownloadViaLsp", () => {
  it("resolves with no output when the LSP request throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    lspCompileSource.mockRejectedValueOnce(new Error("worker crashed"));
    const result = await requestCompileDownloadViaLsp("source", "mglo");
    expect(result.output).toBeNull();
    expect(result.analysis.compileState).toBe("error");
  });
});

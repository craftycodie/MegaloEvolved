import { describe, expect, it, vi } from "vitest";

const sendNotification = vi.fn();
const sendRequest = vi.fn();
const lspSyncDocument = vi.fn(() => Promise.resolve());

vi.mock("./connection", () => ({
  getConnection: () => Promise.resolve({ sendNotification, sendRequest }),
  lspSyncDocument,
}));

const {
  lspCompletions,
  lspDefinition,
  lspHover,
  lspUpdateConfig,
  subscribeLspConfigChanges,
} = await import("./requests");
const { getLspConfig, setActiveFilePath } = await import("./state");

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("lspUpdateConfig", () => {
  it("sends the whole configuration only when it changes", async () => {
    lspUpdateConfig({ locale: "en" });
    await flush();
    expect(sendNotification).toHaveBeenCalledTimes(1);

    // Same values again (e.g. an unrelated settings save): nothing sent.
    lspUpdateConfig({ locale: "en", megaloVersion: "107-mcc" });
    await flush();
    expect(sendNotification).toHaveBeenCalledTimes(1);

    lspUpdateConfig({ locale: "ja" });
    await flush();
    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(sendNotification).toHaveBeenLastCalledWith(
      "workspace/didChangeConfiguration",
      { settings: { megacrow: getLspConfig() } }
    );
    expect(getLspConfig().locale).toBe("ja");
    expect(getLspConfig().megaloVersion).toBe("107-mcc");
  });

  it("notifies subscribers only for real changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLspConfigChanges(listener);

    lspUpdateConfig({ megaloVersion: "106" });
    lspUpdateConfig({ megaloVersion: "106" });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    lspUpdateConfig({ megaloVersion: "107" });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("document requests", () => {
  const position = { line: 0, character: 1 };

  it("syncs and queries the given URI and forwards the cancellation token", async () => {
    const token = {
      isCancellationRequested: false,
      onCancellationRequested: vi.fn(),
    };
    sendRequest.mockResolvedValueOnce(null);
    await lspHover("text", position, { token, uri: "file:///C:/ws/a.txt" });
    expect(lspSyncDocument).toHaveBeenLastCalledWith(
      "text",
      "file:///C:/ws/a.txt"
    );
    expect(sendRequest).toHaveBeenLastCalledWith(
      "textDocument/hover",
      { position, textDocument: { uri: "file:///C:/ws/a.txt" } },
      token
    );
  });

  it("defaults to the active document", async () => {
    setActiveFilePath("C:\\ws\\main.txt");
    sendRequest.mockResolvedValueOnce({ items: [{ label: "x" }] });
    const items = await lspCompletions("text", position);
    expect(items).toEqual([{ label: "x" }]);
    expect(lspSyncDocument).toHaveBeenLastCalledWith(
      "text",
      "file:///C:/ws/main.txt"
    );
    setActiveFilePath(null);
  });

  it("normalizes definition locations and links", async () => {
    const range = { start: position, end: position };
    sendRequest.mockResolvedValueOnce([
      {
        targetRange: range,
        targetSelectionRange: range,
        targetUri: "file:///b",
      },
    ]);
    expect(await lspDefinition("text", position)).toEqual([
      { range, uri: "file:///b" },
    ]);
    sendRequest.mockResolvedValueOnce({ range, uri: "file:///c" });
    expect(await lspDefinition("text", position)).toEqual([
      { range, uri: "file:///c" },
    ]);
  });
});

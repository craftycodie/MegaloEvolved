import { describe, expect, it, vi } from "vitest";

const sendNotification = vi.fn();

vi.mock("./connection", () => ({
  getConnection: () => Promise.resolve({ sendNotification }),
  lspDocumentUri: () => "file:///megalo/editor.megalo",
  lspSyncDocument: () => Promise.resolve(),
}));

// `state.ts` imports the workspace module, which pulls in Monaco themes.
vi.mock("../workspace/workspace", () => ({ getActiveWorkspace: () => null }));

const { lspUpdateConfig, subscribeLspConfigChanges } = await import(
  "./requests"
);
const { getLspConfig } = await import("./state");

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

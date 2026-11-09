import { MEGALO_VERSIONS } from "@megacrow/megalo";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MEGACROW_CONFIG,
  parseConfig,
  sameConfig,
} from "../src/config";
import { versionConfigurationFor } from "../src/diagnostics";
import {
  MEGACROW_CONFIGURATION_SECTION,
  MEGACROW_VERSION_CONFIGURATION_METHOD,
  type MegacrowConfig,
  type MegacrowVersionConfigurationResult,
} from "../src/protocol";
import {
  openDocument,
  startTestServer,
  type TestServer,
  VALID_SOURCE,
} from "./harness";

const settle = () => new Promise((resolve) => setTimeout(resolve, 250));

const sendConfig = (server: TestServer, config: unknown) =>
  server.client.sendNotification("workspace/didChangeConfiguration", {
    settings: { [MEGACROW_CONFIGURATION_SECTION]: config },
  });

describe("parseConfig / sameConfig", () => {
  it("accepts the defaults and rejects an unknown version", () => {
    expect(parseConfig(DEFAULT_MEGACROW_CONFIG).ok).toBe(true);
    const bad = parseConfig({
      ...DEFAULT_MEGACROW_CONFIG,
      megaloVersion: "999",
    });
    expect(bad.ok).toBe(false);
    expect(bad.ok ? "" : bad.error).toContain("megaloVersion");
  });

  it("rejects a config with a missing extension flag", () => {
    const { reservedKeywords: _omit, ...partialFlags } =
      DEFAULT_MEGACROW_CONFIG.megacrowExtensions;
    expect(
      parseConfig({
        ...DEFAULT_MEGACROW_CONFIG,
        megacrowExtensions: partialFlags,
      }).ok
    ).toBe(false);
  });

  it("compares structurally, ignoring key order", () => {
    const reordered = Object.fromEntries(
      Object.entries(DEFAULT_MEGACROW_CONFIG).reverse()
    ) as unknown as MegacrowConfig;
    expect(sameConfig(DEFAULT_MEGACROW_CONFIG, reordered)).toBe(true);
    expect(
      sameConfig(DEFAULT_MEGACROW_CONFIG, {
        ...DEFAULT_MEGACROW_CONFIG,
        locale: "ja",
      })
    ).toBe(false);
  });
});

describe("server configuration", () => {
  let server: TestServer | undefined;

  afterEach(() => {
    server?.dispose();
    server = undefined;
    vi.restoreAllMocks();
  });

  it("applies initializationOptions before the first document is analyzed", async () => {
    const alpha = versionConfigurationFor(MEGALO_VERSIONS["49"]);
    const mcc = versionConfigurationFor(MEGALO_VERSIONS["107-mcc"]);
    expect(alpha.objectListNames).not.toEqual(mcc.objectListNames);

    server = await startTestServer({
      config: { ...DEFAULT_MEGACROW_CONFIG, megaloVersion: "49" },
    });
    const configured = (await server.client.sendRequest(
      MEGACROW_VERSION_CONFIGURATION_METHOD,
      {}
    )) as MegacrowVersionConfigurationResult;
    expect(configured.objectListNames).toEqual(alpha.objectListNames);

    const uri = "file:///test/init.txt";
    await openDocument(server.client, uri, VALID_SOURCE);
    await vi.waitFor(() =>
      expect(server!.published.some((p) => p.uri === uri)).toBe(true)
    );
    await settle();
    // Analyzed once, with the right version from the start.
    expect(server.published.filter((p) => p.uri === uri)).toHaveLength(1);
  });

  it("answers versionConfiguration for an explicit version", async () => {
    server = await startTestServer();
    const result = (await server.client.sendRequest(
      MEGACROW_VERSION_CONFIGURATION_METHOD,
      { megaloVersion: "49" }
    )) as MegacrowVersionConfigurationResult;
    expect(result.objectListNames).toEqual(
      versionConfigurationFor(MEGALO_VERSIONS["49"]).objectListNames
    );
  });

  it("does not republish when the same configuration is sent again", async () => {
    server = await startTestServer({ config: DEFAULT_MEGACROW_CONFIG });
    const uri = "file:///test/same.txt";
    await openDocument(server.client, uri, VALID_SOURCE);
    await vi.waitFor(() => expect(server!.published).toHaveLength(1));

    await sendConfig(server, DEFAULT_MEGACROW_CONFIG);
    await sendConfig(server, { ...DEFAULT_MEGACROW_CONFIG });
    await settle();
    expect(server.published).toHaveLength(1);
  });

  it("republishes once when one field changes", async () => {
    server = await startTestServer({ config: DEFAULT_MEGACROW_CONFIG });
    const uri = "file:///test/locale.txt";
    await openDocument(server.client, uri, VALID_SOURCE);
    await vi.waitFor(() => expect(server!.published).toHaveLength(1));

    await sendConfig(server, { ...DEFAULT_MEGACROW_CONFIG, locale: "ja" });
    await vi.waitFor(() => expect(server!.published).toHaveLength(2));
    await settle();
    expect(server.published).toHaveLength(2);
  });

  it("ignores an invalid configuration and keeps the current one", async () => {
    const errors = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    server = await startTestServer({ config: DEFAULT_MEGACROW_CONFIG });
    const uri = "file:///test/invalid.txt";
    await openDocument(server.client, uri, VALID_SOURCE);
    await vi.waitFor(() => expect(server!.published).toHaveLength(1));

    await sendConfig(server, {
      ...DEFAULT_MEGACROW_CONFIG,
      megaloVersion: "999",
    });
    await vi.waitFor(() =>
      expect(errors).toHaveBeenCalledWith(
        expect.stringContaining("ignored invalid configuration")
      )
    );
    await settle();
    expect(server.published).toHaveLength(1);

    const configured = (await server.client.sendRequest(
      MEGACROW_VERSION_CONFIGURATION_METHOD,
      {}
    )) as MegacrowVersionConfigurationResult;
    expect(configured.objectListNames).toEqual(
      versionConfigurationFor(MEGALO_VERSIONS["107-mcc"]).objectListNames
    );
  });
});

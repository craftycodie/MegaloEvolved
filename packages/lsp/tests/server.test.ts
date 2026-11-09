import {
  compileFromSnapshot,
  DEFAULT_MEGACROW_EXTENSIONS,
} from "@megacrow/megalo";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MEGACROW_CONFIG } from "../src/config";
import {
  MEGACROW_CONFIGURATION_SECTION,
  MEGACROW_REQUEST_ARTIFACTS_METHOD,
  type MegacrowRequestArtifactsResult,
} from "../src/protocol";
import {
  openDocument,
  startTestServer,
  type TestServer,
  VALID_SOURCE,
} from "./harness";

vi.mock("@megacrow/megalo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@megacrow/megalo")>();
  return { ...actual, compileFromSnapshot: vi.fn(actual.compileFromSnapshot) };
});

const compileSpy = vi.mocked(compileFromSnapshot);

const publishedUris = (server: TestServer): Set<string> =>
  new Set(server.published.map((p) => p.uri));

describe("megacrow language server", () => {
  let server: TestServer | undefined;

  afterEach(() => {
    server?.dispose();
    server = undefined;
    compileSpy.mockClear();
  });

  it("compiles a document version once for the publish and requestArtifacts", async () => {
    server = await startTestServer();
    const uri = "file:///test/once.txt";

    await openDocument(server.client, uri, VALID_SOURCE);
    await vi.waitFor(() => expect(publishedUris(server!)).toContain(uri));
    expect(compileSpy).toHaveBeenCalledTimes(1);

    const result = (await server.client.sendRequest(
      MEGACROW_REQUEST_ARTIFACTS_METHOD,
      {
        textDocument: { uri },
        artifacts: ["semanticTokens", "diagnostics", "mglo"],
      }
    )) as MegacrowRequestArtifactsResult;

    expect(result.ok).toBe(true);
    expect(result.dataBase64).toBeTruthy();
    expect(result.semanticTokens?.length).toBeGreaterThan(0);
    expect(compileSpy).toHaveBeenCalledTimes(1);
  });

  it("still compiles gvar separately (different container)", async () => {
    server = await startTestServer();
    const uri = "file:///test/gvar.txt";

    await openDocument(server.client, uri, VALID_SOURCE);
    await vi.waitFor(() => expect(publishedUris(server!)).toContain(uri));

    const result = (await server.client.sendRequest(
      MEGACROW_REQUEST_ARTIFACTS_METHOD,
      { textDocument: { uri }, artifacts: ["diagnostics", "gvar"] }
    )) as MegacrowRequestArtifactsResult;

    expect(result.ok).toBe(true);
    expect(compileSpy).toHaveBeenCalledTimes(2);
  });

  it("republishes every open document after a settings change", async () => {
    server = await startTestServer();
    const uris = [1, 2, 3].map((n) => `file:///test/doc${n}.txt`);

    for (const uri of uris) {
      await openDocument(server.client, uri, VALID_SOURCE);
    }
    await vi.waitFor(() => expect(publishedUris(server!).size).toBe(3));

    server.published.length = 0;
    await server.client.sendNotification("workspace/didChangeConfiguration", {
      settings: {
        [MEGACROW_CONFIGURATION_SECTION]: {
          ...DEFAULT_MEGACROW_CONFIG,
          megacrowExtensions: DEFAULT_MEGACROW_EXTENSIONS,
        },
      },
    });

    await vi.waitFor(() =>
      expect(publishedUris(server!)).toEqual(new Set(uris))
    );
  });
});

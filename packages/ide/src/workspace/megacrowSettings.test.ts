import { describe, expect, it } from "vitest";
import { DEFAULT_APP_SETTINGS } from "./appSettings";
import {
  defaultMegacrowSettings,
  MEGACROW_SETTINGS_VERSION,
  mergeAppSettings,
  mergeDiscoveredWorkspaces,
  normalizeMegacrowSettings,
  type StoredWorkspace,
} from "./megacrowSettings";

const workspace = (
  overrides: Partial<StoredWorkspace> = {}
): StoredWorkspace => ({
  gameBuildNumber: null,
  gameLaunchCommand: null,
  id: "ws1",
  inputPath: "C:/hrek/scripts",
  lastOpenFilePath: null,
  megaloVersion: "107-mcc",
  name: "Reach",
  outputPath: null,
  ...overrides,
});

describe("normalizeMegacrowSettings", () => {
  it("fills defaults for empty input", () => {
    expect(normalizeMegacrowSettings(null)).toEqual(
      defaultMegacrowSettings(DEFAULT_APP_SETTINGS)
    );
  });

  it("rejects bad preference values", () => {
    const settings = normalizeMegacrowSettings({
      editorWordWrap: "yes" as unknown as boolean,
      gamertag: "   ",
      locale: "fr" as unknown as "en",
      skippedUpdateVersion: 5 as unknown as string,
    });
    expect(settings.editorWordWrap).toBe(true);
    expect(settings.gamertag).toBe(DEFAULT_APP_SETTINGS.gamertag);
    expect(settings.locale).toBe("en");
    expect(settings.skippedUpdateVersion).toBeNull();
  });

  it("truncates the gamertag to 16 characters", () => {
    const settings = normalizeMegacrowSettings({
      gamertag: "  abcdefghijklmnopqrstuvwxyz ",
    });
    expect(settings.gamertag).toBe("abcdefghijklmnop");
  });

  it("drops invalid workspaces and picks the first as active", () => {
    const settings = normalizeMegacrowSettings({
      activeWorkspaceId: "missing",
      workspaces: [
        { id: 1 } as unknown as StoredWorkspace,
        workspace({ id: "a" }),
        workspace({ id: "b", inputPath: "D:/other" }),
      ],
    });
    expect(settings.workspaces.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(settings.activeWorkspaceId).toBe("a");
    expect(settings.version).toBe(MEGACROW_SETTINGS_VERSION);
  });

  it("clears a last-open path outside the workspace input folder", () => {
    const settings = normalizeMegacrowSettings({
      workspaces: [
        workspace({ lastOpenFilePath: "D:/elsewhere/file.txt" }),
        workspace({
          id: "ws2",
          lastOpenFilePath: "C:/hrek/scripts/sub/file.txt",
        }),
      ],
    });
    expect(settings.workspaces[0]?.lastOpenFilePath).toBeNull();
    expect(settings.workspaces[1]?.lastOpenFilePath).toBe(
      "C:/hrek/scripts/sub/file.txt"
    );
  });

  it("migrates a legacy top-level last-open path onto the active workspace", () => {
    const settings = normalizeMegacrowSettings({
      activeWorkspaceId: "ws1",
      lastOpenFilePath: "C:/hrek/scripts/main.txt",
      workspaces: [workspace()],
    });
    expect(settings.workspaces[0]?.lastOpenFilePath).toBe(
      "C:/hrek/scripts/main.txt"
    );
  });

  it("falls back to the default Megalo version and trims output paths", () => {
    const settings = normalizeMegacrowSettings({
      workspaces: [
        workspace({
          megaloVersion: "nope" as unknown as StoredWorkspace["megaloVersion"],
          outputPath: "  ",
        }),
      ],
    });
    expect(settings.workspaces[0]?.megaloVersion).toBe("107-mcc");
    expect(settings.workspaces[0]?.outputPath).toBeNull();
  });
});

describe("mergeAppSettings", () => {
  it("normalizes patched fields and keeps the rest", () => {
    const base = normalizeMegacrowSettings({ workspaces: [workspace()] });
    const next = mergeAppSettings(base, { gamertag: "  x  ", locale: "ja" });
    expect(next.gamertag).toBe("x");
    expect(next.locale).toBe("ja");
    expect(next.workspaces).toBe(base.workspaces);
  });
});

describe("mergeDiscoveredWorkspaces", () => {
  it("skips discovered workspaces whose input path is already registered", () => {
    const existing = [workspace({ inputPath: "C:\\HREK\\Scripts\\" })];
    const merged = mergeDiscoveredWorkspaces(existing, [
      workspace({ id: "dup", inputPath: "c:/hrek/scripts" }),
      workspace({ id: "new", inputPath: "D:/other" }),
    ]);
    expect(merged.map((entry) => entry.id)).toEqual(["ws1", "new"]);
  });
});

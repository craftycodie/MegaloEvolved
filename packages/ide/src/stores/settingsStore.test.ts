import { describe, expect, it, vi } from "vitest";
import type {
  MegacrowSettings,
  StoredWorkspace,
} from "../workspace/megacrowSettings";

const persisted: MegacrowSettings[] = [];
let releasePersist: (() => void) | null = null;

vi.mock("../workspace/megacrowSettings", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../workspace/megacrowSettings")>();
  return {
    ...actual,
    bootstrapMegacrowSettings: () =>
      Promise.resolve({
        needsAddWorkspace: false,
        settings: actual.normalizeMegacrowSettings({
          workspaces: [workspace("a"), workspace("b")],
        }),
      }),
    persistMegacrowSettings: (settings: MegacrowSettings) =>
      new Promise<void>((resolve) => {
        persisted.push(settings);
        releasePersist = resolve;
      }),
  };
});
vi.mock("../desktop/tauriRuntime", () => ({ isTauriRuntime: () => true }));

function workspace(id: string): StoredWorkspace {
  return {
    gameBuildNumber: null,
    gameLaunchCommand: null,
    id,
    inputPath: `C:/ws/${id}`,
    lastOpenFilePath: null,
    megaloVersion: "107-mcc",
    name: id,
    outputPath: null,
  };
}

const { bootstrapSettings, settingsStore, updateAppSettings, updateSettings } =
  await import("./settingsStore");

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("settingsStore", () => {
  it("ignores updates until settings have loaded", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await updateAppSettings({ gamertag: "early" });
    expect(persisted).toHaveLength(0);
    expect(settingsStore.getState().status).toBe("loading");
  });

  it("derives the active workspace once loaded", async () => {
    await bootstrapSettings();
    const state = settingsStore.getState();
    expect(state.status).toBe("ready");
    expect(state.activeWorkspace?.id).toBe("a");
  });

  it("applies quick successive updates on top of each other", async () => {
    const first = updateSettings((current) => ({
      ...current,
      activeWorkspaceId: "b",
    }));
    const second = updateAppSettings({ gamertag: "Codie" });
    const state = settingsStore.getState();
    expect(state.settings.activeWorkspaceId).toBe("b");
    expect(state.appSettings.gamertag).toBe("Codie");
    expect(state.activeWorkspace?.id).toBe("b");

    // Saves run one at a time; the waiting one writes the latest state.
    expect(persisted).toHaveLength(1);
    releasePersist?.();
    await first;
    await flush();
    expect(persisted).toHaveLength(2);
    expect(persisted[1]?.gamertag).toBe("Codie");
    releasePersist?.();
    await second;
  });

  it("keeps derived objects stable when unrelated fields change", async () => {
    const before = settingsStore.getState();
    const done = updateSettings((current) => ({
      ...current,
      workspaces: current.workspaces.map((entry) =>
        entry.id === "a"
          ? { ...entry, lastOpenFilePath: "C:/ws/a/x.txt" }
          : entry
      ),
    }));
    const after = settingsStore.getState();
    expect(after.appSettings).toBe(before.appSettings);
    expect(after.activeWorkspace).toBe(before.activeWorkspace);
    releasePersist?.();
    await done;
  });
});

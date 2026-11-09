import { describe, expect, it } from "vitest";
import {
  canNavigateFileNavBack,
  canNavigateFileNavForward,
  EMPTY_FILE_NAV,
  isRemovedByDelete,
  navigateFileNavBack,
  navigateFileNavForward,
  pushFileNavEntry,
  remapPathAfterRename,
  renameFileNavEntries,
  sourceNavEntry,
} from "./fileNavigation";

describe("fileNavigation", () => {
  it("pushes opens and supports back/forward", () => {
    let state = EMPTY_FILE_NAV;
    state = pushFileNavEntry(state, sourceNavEntry("a", "a.txt"));
    state = pushFileNavEntry(state, sourceNavEntry("b", "b.txt"), "a-edited");
    expect(state.entries).toHaveLength(2);
    expect(state.entries[0]?.text).toBe("a-edited");
    expect(canNavigateFileNavBack(state)).toBe(true);
    expect(canNavigateFileNavForward(state)).toBe(false);

    const back = navigateFileNavBack(state, "b-edited");
    expect(back?.entry.displayName).toBe("a.txt");
    expect(back?.state.entries[1]?.text).toBe("b-edited");
    state = back!.state;
    expect(canNavigateFileNavForward(state)).toBe(true);

    const forward = navigateFileNavForward(state);
    expect(forward?.entry.displayName).toBe("b.txt");
    expect(forward?.entry.text).toBe("b-edited");
  });

  it("does not duplicate the current file", () => {
    let state = pushFileNavEntry(
      EMPTY_FILE_NAV,
      sourceNavEntry("a", "a.txt", { absoluteFilePath: "C:/a.txt" })
    );
    state = pushFileNavEntry(
      state,
      sourceNavEntry("a2", "a.txt", { absoluteFilePath: "C:/a.txt" })
    );
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]?.text).toBe("a2");
  });

  it("drops the forward branch when opening a new file", () => {
    let state = EMPTY_FILE_NAV;
    state = pushFileNavEntry(state, sourceNavEntry("a", "a.txt"));
    state = pushFileNavEntry(state, sourceNavEntry("b", "b.txt"));
    state = navigateFileNavBack(state)!.state;
    state = pushFileNavEntry(state, sourceNavEntry("c", "c.txt"));
    expect(state.entries.map((entry) => entry.displayName)).toEqual([
      "a.txt",
      "c.txt",
    ]);
    expect(canNavigateFileNavForward(state)).toBe(false);
  });

  it("renames history entries by name or path", () => {
    let state = pushFileNavEntry(
      EMPTY_FILE_NAV,
      sourceNavEntry("a", "old.txt", { absoluteFilePath: "C:/ws/old.txt" })
    );
    state = pushFileNavEntry(state, sourceNavEntry("b", "b.txt"));
    const renamed = renameFileNavEntries(
      state,
      "old.txt",
      "new.txt",
      "C:/ws/new.txt"
    );
    expect(renamed.entries[0]).toMatchObject({
      absoluteFilePath: "C:/ws/new.txt",
      displayName: "new.txt",
    });
    expect(renamed.entries[1]).toBe(state.entries[1]);
    expect(renameFileNavEntries(state, "x.txt", "y.txt")).toBe(state);
  });
});

describe("remapPathAfterRename", () => {
  const open = {
    absoluteFilePath: "C:\\ws\\Sub\\inner\\main.txt",
    displayName: "Sub/inner/main.txt",
  };

  it("follows a renamed file", () => {
    expect(
      remapPathAfterRename(
        open,
        "sub/inner/main.txt",
        "Sub/inner/renamed.txt",
        "C:\\ws\\Sub\\inner\\renamed.txt"
      )
    ).toEqual({
      absoluteFilePath: "C:\\ws\\Sub\\inner\\renamed.txt",
      displayName: "Sub/inner/renamed.txt",
    });
  });

  it("follows a renamed or moved parent folder", () => {
    expect(
      remapPathAfterRename(open, "Sub", "Other/Sub2", "C:\\ws\\Other\\Sub2")
    ).toEqual({
      absoluteFilePath: "C:\\ws\\Other\\Sub2\\inner\\main.txt",
      displayName: "Other/Sub2/inner/main.txt",
    });
    expect(
      remapPathAfterRename(
        { absoluteFilePath: "/ws/a/b.txt", displayName: "a/b.txt" },
        "a",
        "c",
        "/ws/c/"
      )
    ).toEqual({ absoluteFilePath: "/ws/c/b.txt", displayName: "c/b.txt" });
  });

  it("ignores folders that only share a name prefix", () => {
    expect(remapPathAfterRename(open, "Su", "X", "C:\\ws\\X")).toBeNull();
    expect(
      remapPathAfterRename(open, "Sub/inner/main.txt.bak", "y", "C:\\ws\\y")
    ).toBeNull();
  });
});

describe("isRemovedByDelete", () => {
  it("matches the file itself and any parent folder", () => {
    expect(isRemovedByDelete("Sub/main.txt", "sub/main.txt")).toBe(true);
    expect(isRemovedByDelete("Sub/main.txt", "Sub")).toBe(true);
    expect(isRemovedByDelete("Sub/main.txt", "Su")).toBe(false);
    expect(isRemovedByDelete("Sub/main.txt", "Sub/main")).toBe(false);
  });
});

describe("renameFileNavEntries with folders", () => {
  it("rewrites every history entry inside a renamed folder", () => {
    let state = pushFileNavEntry(
      EMPTY_FILE_NAV,
      sourceNavEntry("a", "dir/a.txt", { absoluteFilePath: "/ws/dir/a.txt" })
    );
    state = pushFileNavEntry(
      state,
      sourceNavEntry("b", "b.txt", { absoluteFilePath: "/ws/b.txt" })
    );
    const renamed = renameFileNavEntries(state, "dir", "dir2", "/ws/dir2");
    expect(renamed.entries[0]).toMatchObject({
      absoluteFilePath: "/ws/dir2/a.txt",
      displayName: "dir2/a.txt",
    });
    expect(renamed.entries[1]).toBe(state.entries[1]);
  });
});

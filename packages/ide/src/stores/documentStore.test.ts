import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the Monaco-backed editor host.
const models = new Map<
  string,
  { displayName: string; path: string | null; text: string }
>();
let activeKey: string | null = null;
vi.mock("../editor/editorHost", () => ({
  editorHost: {
    activate: (key: string) => {
      activeKey = key;
    },
    close: (key: string) => models.delete(key),
    closeAll: () => {
      models.clear();
      activeKey = null;
    },
    closeWhere: (
      predicate: (document: { displayName: string; key: string }) => boolean
    ) => {
      for (const [key, model] of [...models]) {
        if (predicate({ ...model, key })) {
          models.delete(key);
        }
      }
    },
    flushPendingSaves: () => undefined,
    getSavedText: () => null,
    getText: (key: string) => models.get(key)?.text ?? null,
    has: (key: string) => models.has(key),
    markSaved: () => undefined,
    open: (
      info: { displayName: string; key: string; path: string | null },
      text: string
    ) => {
      models.set(info.key, {
        displayName: info.displayName,
        path: info.path,
        text,
      });
    },
    rename: (
      oldKey: string,
      next: { displayName: string; key: string; path: string | null }
    ) => {
      const model = models.get(oldKey);
      models.delete(oldKey);
      if (model) {
        models.set(next.key, {
          ...model,
          displayName: next.displayName,
          path: next.path,
        });
      }
      if (activeKey === oldKey) {
        activeKey = next.key;
      }
    },
    reveal: () => undefined,
  },
}));
vi.mock("../lsp", () => ({
  lspResetSession: () => Promise.resolve(),
  lspSetActiveFile: () => undefined,
}));
const analyzeDocument = vi.fn(() => Promise.resolve());
vi.mock("./compileStore", () => ({
  analyzeDocument,
  resetCompile: () => undefined,
}));

const {
  closeAllDocuments,
  documentStore,
  handleEntryDeleted,
  handleEntryRenamed,
  navigateBack,
  openAsync,
  openDocument,
} = await import("./documentStore");

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const source = (name: string) => ({
  displayName: name,
  path: `C:/ws/${name}`,
  text: `; ${name}`,
});

describe("documentStore", () => {
  beforeEach(() => {
    closeAllDocuments();
    analyzeDocument.mockClear();
  });

  it("opens a document, records history and starts a fresh analysis", () => {
    openDocument(source("a.txt"));
    const { active, history } = documentStore.getState();
    expect(active).toMatchObject({
      displayName: "a.txt",
      key: "file:///C:/ws/a.txt",
      kind: "megalo",
    });
    expect(history.entries).toHaveLength(1);
    expect(analyzeDocument).toHaveBeenCalledWith(
      { key: "file:///C:/ws/a.txt", kind: "megalo", text: "; a.txt" },
      { fresh: true }
    );
  });

  it("drops a slow async open when a newer open finished first", async () => {
    const slow = deferred<ReturnType<typeof source>>();
    const first = openAsync(() => slow.promise);
    const second = openAsync(() => Promise.resolve(source("b.txt")));
    expect(await second).toBe(true);
    slow.resolve(source("a.txt"));
    expect(await first).toBe(false);
    expect(documentStore.getState().active?.displayName).toBe("b.txt");
  });

  it("drops an async open when the documents were closed meanwhile", async () => {
    const slow = deferred<ReturnType<typeof source>>();
    const pending = openAsync(() => slow.promise);
    closeAllDocuments();
    slow.resolve(source("a.txt"));
    expect(await pending).toBe(false);
    expect(documentStore.getState().active).toBeNull();
  });

  it("goes back to the previous document without a new history entry", () => {
    openDocument(source("a.txt"));
    openDocument(source("b.txt"));
    navigateBack();
    const { active, history } = documentStore.getState();
    expect(active?.displayName).toBe("a.txt");
    expect(history.entries).toHaveLength(2);
    expect(history.index).toBe(0);
  });

  it("follows the shown document when its folder is renamed", () => {
    openDocument({
      displayName: "dir/a.txt",
      path: "C:/ws/dir/a.txt",
      text: "",
    });
    handleEntryRenamed("dir", "dir2", "C:/ws/dir2");
    expect(documentStore.getState().active).toMatchObject({
      displayName: "dir2/a.txt",
      key: "file:///C:/ws/dir2/a.txt",
      path: "C:/ws/dir2/a.txt",
    });
    expect(models.has("file:///C:/ws/dir2/a.txt")).toBe(true);
  });

  it("closes the shown document when its folder is deleted", () => {
    openDocument({
      displayName: "dir/a.txt",
      path: "C:/ws/dir/a.txt",
      text: "",
    });
    handleEntryDeleted("dir");
    expect(documentStore.getState().active).toBeNull();
    expect(models.size).toBe(0);
  });

  it("keeps the shown document when an unrelated file is deleted", () => {
    openDocument(source("a.txt"));
    handleEntryDeleted("ab.txt");
    expect(documentStore.getState().active?.displayName).toBe("a.txt");
  });
});

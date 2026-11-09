import { emit, listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { APP_NAME } from "../app/constants";
import { getIdeLocale } from "../localization";
import { isTauriRuntime } from "./tauriRuntime";

const DOCS_LABEL = "docs";
/** Frameless shell with window chrome; VitePress loads in an iframe. */
const DOCS_APP_URL = "docs-window.html";
export const DOCS_NAVIGATE_EVENT = "megacrow://docs-navigate";

/** Bundled VitePress paths (no leading slash, no `.html`). */
export const DOCS_PATHS = {
  megacrow: "megacrow/index",
  workspaces: "megacrow/workspaces",
  export: "megacrow/export",
  settings: "megacrow/settings",
  megaloHeadaches: "language/megalo-headaches",
} as const;

export type DocsPath = (typeof DOCS_PATHS)[keyof typeof DOCS_PATHS] | string;

export function normalizeDocsPath(path?: string | null): string | null {
  if (!path) {
    return null;
  }
  const clean = path
    .trim()
    .replace(/^\/+/, "")
    .replace(/\.html$/i, "")
    .replace(/\/+$/, "");
  return clean.length > 0 ? clean : null;
}

/**
 * Prefer Japanese docs when the IDE locale is `ja`.
 * Paths already under `ja/` are left unchanged.
 */
export function localizedDocsPath(path?: string | null): string | null {
  const clean = normalizeDocsPath(path);
  if (getIdeLocale() !== "ja") {
    return clean;
  }
  if (!clean || clean === "index") {
    return "ja/index";
  }
  if (clean === "ja" || clean.startsWith("ja/")) {
    return clean === "ja" ? "ja/index" : clean;
  }
  return `ja/${clean}`;
}

/** Absolute URL to a packaged docs HTML page. */
export function docsPageUrl(path?: string | null): string {
  const base = `${import.meta.env.BASE_URL}docs/`;
  // Prefer an already-localized path (e.g. from the docs shell query) as-is.
  const clean =
    normalizeDocsPath(path)?.startsWith("ja/") ||
    normalizeDocsPath(path) === "ja/index"
      ? normalizeDocsPath(path)
      : localizedDocsPath(path);
  if (!clean || clean === "index") {
    return `${base}index.html`;
  }
  // Prefer `.html` so Tauri static serving (no Vite clean-URL middleware) works.
  // Missing files must not 404 into the IDE SPA — rebuild docs after adding pages.
  return `${base}${clean}.html`;
}

function docsShellUrl(path?: string | null): string {
  const clean = localizedDocsPath(path);
  if (!clean) {
    return DOCS_APP_URL;
  }
  return `${DOCS_APP_URL}?path=${encodeURIComponent(clean)}`;
}

export async function openDocs(path?: string | null): Promise<void> {
  const clean = localizedDocsPath(path);

  if (!isTauriRuntime()) {
    // Same window name reuses the tab and navigates when the URL differs.
    window.open(docsPageUrl(path), "megacrow-docs");
    return;
  }

  const existing = await WebviewWindow.getByLabel(DOCS_LABEL);
  if (existing) {
    if (clean) {
      await emit(DOCS_NAVIGATE_EVENT, { path: clean });
    }
    await existing.setFocus();
    return;
  }

  const webview = new WebviewWindow(DOCS_LABEL, {
    url: docsShellUrl(path),
    title: `${APP_NAME} Docs`,
    width: 1100,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    center: true,
    focus: true,
    decorations: false,
    resizable: true,
    // Match CSS `--bg-app` so the window isn't white before the page paints.
    backgroundColor: "#1e1e1e",
  });

  await new Promise<void>((resolve, reject) => {
    void webview.once("tauri://created", () => resolve());
    void webview.once("tauri://error", (event) => {
      reject(
        new Error(
          typeof event.payload === "string"
            ? event.payload
            : "Failed to open docs window"
        )
      );
    });
  });
}

/** Used by the docs shell to react to deep-link navigations. */
export async function listenDocsNavigate(
  onNavigate: (path: string) => void
): Promise<() => void> {
  const unlisten = await listen<{ path?: string }>(
    DOCS_NAVIGATE_EVENT,
    (event) => {
      const next = normalizeDocsPath(event.payload?.path);
      if (next) {
        onNavigate(next);
      }
    }
  );
  return unlisten;
}

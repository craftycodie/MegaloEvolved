import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import type { Connect, Plugin } from "vite";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;
const megaloSrc = resolve(import.meta.dirname, "../megalo/src");
const docsPublicRoot = resolve(import.meta.dirname, "public/docs");
const repoRoot = resolve(import.meta.dirname, "../..");
const monacoThemesDir = resolve(
  import.meta.dirname,
  "../../node_modules/monaco-themes/themes"
);
const tauriApiDir = resolve(
  import.meta.dirname,
  "../../node_modules/@tauri-apps/api"
);

function resolveExistingFile(base: string): string | null {
  const asFile = (path: string) =>
    existsSync(path) && statSync(path).isFile() ? path : null;

  return (
    asFile(base) ||
    asFile(`${base}.ts`) ||
    asFile(`${base}.tsx`) ||
    asFile(`${base}.js`) ||
    asFile(`${base}.mjs`) ||
    asFile(resolve(base, "index.ts")) ||
    asFile(resolve(base, "index.tsx")) ||
    asFile(resolve(base, "index.js"))
  );
}

function normalizeBase(value: string | undefined): string {
  const raw = (value ?? "/").trim() || "/";
  // Relative bases (e.g. `./`) so one CI artifact works at /repo/ and /repo/<branch>/.
  if (raw.startsWith(".")) {
    return raw.endsWith("/") ? raw : `${raw}/`;
  }
  const withLeading = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}

const appBase = normalizeBase(process.env.MEGACROW_BASE);

/** Resolve megalo's `src/...` path alias when Vite bundles @megacrow/megalo sources. */
function megaloSrcAlias(): Plugin {
  return {
    name: "megalo-src-alias",
    enforce: "pre",
    resolveId(id, importer) {
      if (id !== "src" && !id.startsWith("src/")) {
        return null;
      }
      if (!importer) {
        return null;
      }
      const norm = importer.replace(/\\/g, "/");
      if (!norm.includes("/packages/megalo/")) {
        return null;
      }
      const sub = id === "src" ? "" : id.slice("src/".length);
      return resolveExistingFile(resolve(megaloSrc, sub));
    },
  };
}

/**
 * Serve VitePress under {base}docs.
 * Vite's publicDir sirv does not auto-serve directory indexes (extensions: []),
 * so /docs/ falls through to the IDE SPA index.html without this rewrite.
 */
function docsCleanUrlFallback(): Plugin {
  // Dev server request paths are always origin-absolute. Relative MEGACROW_BASE
  // (`./`) still serves docs at `/docs` from `public/docs`.
  const docsPrefix = appBase.startsWith(".")
    ? "/docs"
    : `${appBase}docs`.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/docs";
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    const raw = req.url;
    if (
      !(
        raw?.startsWith(`${docsPrefix}/`) ||
        raw?.startsWith(`${docsPrefix}?`) ||
        raw === docsPrefix
      )
    ) {
      next();
      return;
    }

    const qIndex = raw.indexOf("?");
    const pathname = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
    const query = qIndex >= 0 ? raw.slice(qIndex) : "";

    if (pathname.includes(".", pathname.lastIndexOf("/") + 1)) {
      next();
      return;
    }

    const relative =
      pathname === docsPrefix || pathname === `${docsPrefix}/`
        ? ""
        : pathname.slice(docsPrefix.length).replace(/^\//, "");

    const candidates = relative
      ? [
          resolve(docsPublicRoot, `${relative}.html`),
          resolve(docsPublicRoot, relative, "index.html"),
        ]
      : [resolve(docsPublicRoot, "index.html")];

    for (const file of candidates) {
      if (existsSync(file) && statSync(file).isFile()) {
        const rewritten = file
          .slice(resolve(import.meta.dirname, "public").length)
          .replace(/\\/g, "/");
        req.url = `${rewritten.startsWith("/") ? rewritten : `/${rewritten}`}${query}`;
        break;
      }
    }

    next();
  };

  return {
    name: "megacrow-docs-clean-urls",
    configureServer(server) {
      // Run before Vite's SPA fallback so /docs is not the IDE shell.
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

// https://v2.tauri.app/start/frontend/vite/
/** Shown in the About dialog. The package does not export its package.json. */
const blfVersion: string = JSON.parse(
  readFileSync(
    resolve(repoRoot, "node_modules/@blamnetwork/blf/package.json"),
    "utf8"
  )
).version;

export default defineConfig({
  define: {
    __BLF_VERSION__: JSON.stringify(blfVersion),
  },
  base: appBase,
  plugins: [react(), megaloSrcAlias(), docsCleanUrlFallback()],
  clearScreen: false,
  resolve: {
    alias: {
      "@monaco-themes": monacoThemesDir,
      "@tauri-apps/api": tauriApiDir,
    },
    dedupe: ["@tauri-apps/api", "monaco-editor"],
  },
  server: {
    port: 5173,
    strictPort: true,
    host,
    fs: {
      allow: [repoRoot, resolve(import.meta.dirname)],
    },
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: process.env.TAURI_ENV_DEBUG ? false : "esbuild",
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        cli: resolve(import.meta.dirname, "cli.html"),
        "docs-window": resolve(import.meta.dirname, "docs-window.html"),
      },
    },
  },
  optimizeDeps: {
    include: [
      "@tauri-apps/api",
      "@tauri-apps/plugin-clipboard-manager",
      "@tauri-apps/plugin-dialog",
      "@tauri-apps/plugin-fs",
      "@tauri-apps/plugin-opener",
      // CJS; without this, excluding @blamnetwork/blf serves src/sha1.js raw
      // and `import { sha1 } from "js-sha1"` fails in the browser.
      "js-sha1",
      "@blamnetwork/blf > js-sha1",
      "@megacrow/megalo > @blamnetwork/blf > js-sha1",
    ],
    // Keep workspace/file: packages out of the dep optimizer so local blf
    // rebuilds are picked up without a stale .vite/deps snapshot.
    exclude: ["@megacrow/lsp", "@megacrow/megalo", "@blamnetwork/blf"],
  },
  // Worker bundles do not inherit root `plugins` — register the megalo alias here too.
  worker: {
    format: "es",
    plugins: () => [megaloSrcAlias()],
  },
  ssr: {
    noExternal: [/@megacrow\/.*/, /@blamnetwork\/.*/],
  },
});

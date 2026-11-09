import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const megaloSrc = resolve(import.meta.dirname, "../megalo/src");

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

/** Resolve megalo's `src/...` path alias when Vitest bundles @megacrow/megalo sources. */
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

export default defineConfig({
  plugins: [megaloSrcAlias()],
  resolve: {
    alias: {
      "@monaco-themes": resolve(
        import.meta.dirname,
        "../../node_modules/monaco-themes/themes"
      ),
      "@craftycodie/cstruct/dist/advanced": resolve(
        import.meta.dirname,
        "../../node_modules/@craftycodie/cstruct/dist/advanced/index.js"
      ),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
    testTimeout: 600_000,
    server: {
      deps: {
        inline: [
          /@craftycodie\/cstruct/,
          /@blamnetwork\/blf/,
          /@megacrow\/megalo/,
        ],
      },
    },
  },
  ssr: {
    noExternal: [/@blamnetwork\/.*/, /@megacrow\/.*/],
  },
});

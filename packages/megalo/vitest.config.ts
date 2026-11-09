import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * @blamnetwork/blf / @craftycodie/cstruct ship ESM with bare directory re-exports.
 * Vite must resolve those to index.js for vitest (same fix as debugger vite config).
 */
const resolvePackageRoots = (packageName: string): string[] => {
  const candidates = [
    path.resolve(root, `node_modules/${packageName}`),
    path.resolve(root, `../node_modules/${packageName}`),
    path.resolve(root, `../../node_modules/${packageName}`),
    path.resolve(root, `../../../node_modules/${packageName}`),
    // Linked blf-ts dependency tree
    path.resolve(root, `../../../blf/blf-ts/node_modules/${packageName}`),
  ];
  const roots: string[] = [];
  for (const candidate of candidates) {
    try {
      roots.push(fs.realpathSync(candidate).replace(/\\/g, "/"));
    } catch {
      // optional
    }
  }
  return roots;
};

const packageRoots = [
  ...resolvePackageRoots("@blamnetwork/blf"),
  ...resolvePackageRoots("@craftycodie/cstruct"),
];

const stripViteId = (id: string): string => {
  const withoutQuery = id.replace(/\\/g, "/").split("?")[0] ?? id;
  return withoutQuery.split("#")[0] ?? withoutQuery;
};

const isPackageImporter = (importer: string): boolean => {
  const importerPath = stripViteId(importer);
  if (
    importerPath.includes("/node_modules/@blamnetwork/blf/") ||
    importerPath.includes("/@blamnetwork/blf/") ||
    importerPath.includes("/node_modules/@craftycodie/cstruct/") ||
    importerPath.includes("/@craftycodie/cstruct/")
  ) {
    return true;
  }
  let realImporter = importerPath;
  try {
    realImporter = fs.realpathSync(importerPath).replace(/\\/g, "/");
  } catch {
    // keep logical path
  }
  return packageRoots.some(
    (rootPath) =>
      realImporter === rootPath || realImporter.startsWith(`${rootPath}/`)
  );
};

const resolveDirectoryIndex = (candidate: string): string | null => {
  const resolved = stripViteId(candidate);
  try {
    if (!fs.statSync(resolved).isDirectory()) {
      return null;
    }
  } catch {
    return null;
  }
  const indexJs = path.join(resolved, "index.js");
  return fs.existsSync(indexJs) ? indexJs : null;
};

const directoryIndexPlugin = (): Plugin => ({
  name: "directory-index",
  enforce: "pre",
  resolveId(source, importer) {
    if (!source.startsWith(".")) {
      if (isPackageImporter(source)) {
        return resolveDirectoryIndex(source);
      }
      return null;
    }
    if (!(importer && isPackageImporter(importer))) {
      return null;
    }
    return resolveDirectoryIndex(
      path.resolve(path.dirname(stripViteId(importer)), source)
    );
  },
  load(id) {
    const indexJs = resolveDirectoryIndex(id);
    if (indexJs === null) {
      return null;
    }
    return fs.readFileSync(indexJs, "utf8");
  },
});

export default defineConfig({
  plugins: [directoryIndexPlugin()],
  test: {
    include: ["tests/**/*.test.ts"],
    // Compile tests load the full compiler (and BLF) per file; the 5s default
    // is too tight when the whole suite runs in parallel.
    testTimeout: 30_000,
    server: {
      deps: {
        // datamine imports cstruct, whose ESM build plain Node cannot load.
        inline: [
          "@blamnetwork/blf",
          "@blamnetwork/datamine",
          "@craftycodie/cstruct",
        ],
      },
    },
  },
});

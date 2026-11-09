import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const HREK_ROOT =
  process.env.HREK_ROOT ??
  "C:\\Program Files (x86)\\Steam\\steamapps\\common\\HREK";

export const HREK_MEGALO = path.join(
  HREK_ROOT,
  "data",
  "multiplayer",
  "megalo"
);

export const HREK_OUTPUT = path.join(HREK_ROOT, "maps", "megalo");

export const MEGALOEDIT_EXE = path.join(HREK_ROOT, "MegaloEdit.exe");

export const ARTIFACTS_ROOT = path.resolve(
  here,
  "../../../test-artifacts/hrek-compare"
);

export const isHrekAvailable = (): boolean =>
  fs.existsSync(HREK_MEGALO) &&
  fs.statSync(HREK_MEGALO).isDirectory() &&
  fs.existsSync(MEGALOEDIT_EXE);

/** Read a text file, honoring UTF-16 LE BOM (common in HREK Megalo sources). */
export const readTextFile = (filePath: string): string => {
  const raw = fs.readFileSync(filePath);
  if (raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe) {
    return raw.toString("utf16le").replace(/^\uFEFF/, "");
  }
  if (raw.length >= 2 && raw[0] === 0xfe && raw[1] === 0xff) {
    // Rare UTF-16 BE — swap bytes then decode as LE.
    const swapped = Buffer.alloc(raw.length - 2);
    for (let i = 2; i + 1 < raw.length; i += 2) {
      swapped[i - 2] = raw[i + 1]!;
      swapped[i - 1] = raw[i]!;
    }
    return swapped.toString("utf16le");
  }
  return raw.toString("utf8").replace(/^\uFEFF/, "");
};

/** Scripts intentionally excluded from MegaloEdit parity (missing/broken sources). */
export const SKIP_SCRIPTS = new Set(["slayer_bro.txt"]);

/**
 * Every `.txt` gametype in the HREK megalo root (not nested folders like
 * `includes/` / `broken/`). Sorted for stable reports.
 */
export const listRootGametypeScripts = (): string[] =>
  fs
    .readdirSync(HREK_MEGALO, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.toLowerCase().endsWith(".txt") &&
        !SKIP_SCRIPTS.has(entry.name)
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

export const ensureArtifactDirs = (): {
  megacrow: string;
  megaloedit: string;
  reports: string;
} => {
  const megacrow = path.join(ARTIFACTS_ROOT, "megacrow");
  const megaloedit = path.join(ARTIFACTS_ROOT, "megaloedit");
  const reports = path.join(ARTIFACTS_ROOT, "reports");
  for (const dir of [megacrow, megaloedit, reports]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return { megacrow, megaloedit, reports };
};

export const toPlainJson = (value: unknown): unknown =>
  JSON.parse(
    JSON.stringify(value, (_key, current) => {
      if (typeof current === "bigint") {
        return current.toString();
      }
      return current;
    })
  );

export interface JsonDiff {
  megacrow: unknown;
  megaloedit: unknown;
  path: string;
}

export interface DiffJsonOptions {
  /** Return true to skip a path (and its subtree). Defaults to ignoring metadata. */
  ignore?: (path: string) => boolean;
  maxDiffs?: number;
}

/**
 * Paths whose subtree differs by design (compile timestamp, unique ids, author, …).
 * Matches megalo-proto-compile `IGNORE_METADATA`.
 */
export const IGNORE_METADATA = (path: string): boolean => {
  const normalized = path.startsWith("$.")
    ? path.slice(2)
    : path.replace(/^\$/, "");
  return (
    normalized === "m_base_variant.m_metadata" ||
    normalized.startsWith("m_base_variant.m_metadata.") ||
    normalized.startsWith("m_base_variant.m_metadata[")
  );
};

/** Top-level field bucket for a JSON path (proto-style summary). */
export const topFieldBucket = (path: string): string => {
  const normalized = path.startsWith("$.")
    ? path.slice(2)
    : path.startsWith("$")
      ? path.slice(1)
      : path;
  if (!normalized) {
    return "(root)";
  }
  const i = normalized.indexOf(".");
  const j = normalized.indexOf("[");
  const end = Math.min(
    i < 0 ? normalized.length : i,
    j < 0 ? normalized.length : j
  );
  return normalized.slice(0, end) || "(root)";
};

export const summarizeDiffBuckets = (
  diffs: JsonDiff[]
): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const d of diffs) {
    const field = topFieldBucket(d.path);
    counts.set(field, (counts.get(field) ?? 0) + 1);
  }
  return counts;
};

/** Deep equality walk; reports every leaf/object mismatch with a JSON path. */
export const diffJson = (
  megacrow: unknown,
  megaloedit: unknown,
  basePath = "$",
  options: DiffJsonOptions = {}
): JsonDiff[] => {
  const ignore = options.ignore ?? IGNORE_METADATA;
  const maxDiffs = options.maxDiffs ?? Number.POSITIVE_INFINITY;
  const diffs: JsonDiff[] = [];

  const walk = (a: unknown, b: unknown, p: string): void => {
    if (diffs.length >= maxDiffs || ignore(p)) {
      return;
    }

    if (Object.is(a, b)) {
      return;
    }

    const aIsObj = a !== null && typeof a === "object";
    const bIsObj = b !== null && typeof b === "object";

    if (!(aIsObj && bIsObj)) {
      diffs.push({ path: p, megacrow: a, megaloedit: b });
      return;
    }

    const aArr = Array.isArray(a);
    const bArr = Array.isArray(b);
    if (aArr !== bArr) {
      diffs.push({ path: p, megacrow: a, megaloedit: b });
      return;
    }

    if (aArr && bArr) {
      const max = Math.max(a.length, b.length);
      for (let i = 0; i < max; i++) {
        if (diffs.length >= maxDiffs) {
          return;
        }
        if (i >= a.length) {
          diffs.push({
            path: `${p}[${i}]`,
            megacrow: undefined,
            megaloedit: b[i],
          });
        } else if (i >= b.length) {
          diffs.push({
            path: `${p}[${i}]`,
            megacrow: a[i],
            megaloedit: undefined,
          });
        } else {
          walk(a[i], b[i], `${p}[${i}]`);
        }
      }
      return;
    }

    const aRec = a as Record<string, unknown>;
    const bRec = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(aRec), ...Object.keys(bRec)]);
    for (const key of [...keys].sort()) {
      if (diffs.length >= maxDiffs) {
        return;
      }
      const child = p === "$" ? `$.${key}` : `${p}.${key}`;
      if (ignore(child)) {
        continue;
      }
      if (!(key in aRec)) {
        diffs.push({
          path: child,
          megacrow: undefined,
          megaloedit: bRec[key],
        });
      } else if (key in bRec) {
        walk(aRec[key], bRec[key], child);
      } else {
        diffs.push({
          path: child,
          megacrow: aRec[key],
          megaloedit: undefined,
        });
      }
    }
  };

  walk(megacrow, megaloedit, basePath);
  return diffs;
};

export interface MegaloEditCompileResult {
  exitCode: number | null;
  ok: boolean;
  outputPath: string;
  stderr: string;
  stdout: string;
}

export const compileWithMegaloEdit = (
  sourceFileName: string,
  destinationDir: string
): MegaloEditCompileResult => {
  const sourcePath = path.join(HREK_MEGALO, sourceFileName);
  const baseName = path.basename(sourceFileName, path.extname(sourceFileName));
  const outputPath = path.join(destinationDir, `${baseName}.mglo`);
  // MegaloEdit exits 0 even when it fails to compile, so "ok" relies on it
  // writing the output. Remove a previous run's file so a stale artifact is
  // never mistaken for success.
  fs.rmSync(outputPath, { force: true });

  const result = spawnSync(
    MEGALOEDIT_EXE,
    ["--cli", "--compile", sourcePath, outputPath],
    {
      cwd: HREK_ROOT,
      encoding: "utf8",
      windowsHide: true,
      timeout: 120_000,
    }
  );

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const ok =
    result.status === 0 &&
    fs.existsSync(outputPath) &&
    fs.statSync(outputPath).size > 0;

  return {
    ok,
    outputPath,
    stdout,
    stderr,
    exitCode: result.status,
  };
};

export const createFsResolvers = (baseSearchDirs: string[]) => {
  const resolveInclude = (
    rel: string,
    ctx: { fromUri?: string }
  ): { text: string; uri: string } | null => {
    const fromDir = ctx.fromUri ? path.dirname(ctx.fromUri) : HREK_MEGALO;
    const absolute = path.resolve(fromDir, rel);
    try {
      const text = readTextFile(absolute);
      return { text, uri: absolute };
    } catch {
      return null;
    }
  };

  const resolveBaseFile = (
    rel: string,
    _ctx: { fromUri?: string }
  ): Uint8Array | null => {
    const candidates = [
      ...baseSearchDirs.map((dir) => path.resolve(dir, rel)),
      path.resolve(HREK_OUTPUT, rel),
      path.resolve(HREK_MEGALO, rel),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return new Uint8Array(fs.readFileSync(candidate));
      }
    }
    return null;
  };

  return { resolveInclude, resolveBaseFile };
};

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const ideRoot = path.resolve(import.meta.dirname, "../..");

/**
 * Runs the real CLI entry under plain Node (tsx), outside Vite. Catches
 * imports that only resolve through Vite aliases (e.g. Monaco themes)
 * leaking into the compiler's import chain.
 */
describe("CLI entry under Node", () => {
  let dir: string | null = null;
  afterEach(() => {
    if (dir) {
      rmSync(dir, { force: true, recursive: true });
      dir = null;
    }
  });

  it("compiles a source file to .mglo", () => {
    dir = mkdtempSync(path.join(os.tmpdir(), "megacrow-cli-"));
    const source = path.join(dir, "empty.txt");
    const output = path.join(dir, "empty.mglo");
    writeFileSync(source, "");
    const result = spawnSync(
      process.execPath,
      [
        path.join(ideRoot, "../../node_modules/tsx/dist/cli.mjs"),
        "--import",
        "./scripts/megalo-src-register.mjs",
        "src/cli/main.ts",
        "--compile",
        source,
        output,
      ],
      { cwd: ideRoot, encoding: "utf8", timeout: 120_000 }
    );
    expect(result.stderr).not.toContain("ERR_MODULE_NOT_FOUND");
    expect(result.status).toBe(0);
    expect(existsSync(output) && statSync(output).size).toBeGreaterThan(0);
  });
});

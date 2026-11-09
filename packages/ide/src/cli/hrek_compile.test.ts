import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEFAULT_MEGACROW_EXTENSIONS } from "@megacrow/megalo";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyCompilerSettings,
  getAppliedCompilerSettings,
} from "../compile/megaloCompilerSettings";
import { compileMegaloDirectory } from "./compileDirectory";
import { createNodeFilesystem } from "./nodeFilesystem";

const HREK_ROOT = "C:\\Program Files (x86)\\Steam\\steamapps\\common\\HREK";
const HREK_MEGALO_DIR = path.join(HREK_ROOT, "data\\multiplayer\\megalo");
const MEGALOEDIT_EXE = path.join(HREK_ROOT, "MegaloEdit.exe");

/**
 * Whether HREK's MegaloEdit compiles `sourcePath`. The megalo root also holds
 * non-gametype files (compile lists) and scripts MegaloEdit rejects; a MegaCrow
 * failure only counts when MegaloEdit succeeds. MegaloEdit exits 0 even on
 * failure, so success means it wrote a non-empty output file.
 */
const megaloEditCompiles = (
  sourcePath: string,
  scratchDir: string
): boolean => {
  if (!existsSync(MEGALOEDIT_EXE)) {
    return true;
  }
  const outputPath = path.join(
    scratchDir,
    `${path.basename(sourcePath, ".txt")}.mglo`
  );
  rmSync(outputPath, { force: true });
  spawnSync(MEGALOEDIT_EXE, ["--cli", "--compile", sourcePath, outputPath], {
    cwd: HREK_ROOT,
    windowsHide: true,
    timeout: 120_000,
  });
  return existsSync(outputPath) && statSync(outputPath).size > 0;
};

describe("HREK megalo directory compile", () => {
  const previousSettings = getAppliedCompilerSettings();

  afterEach(() => {
    applyCompilerSettings(previousSettings);
  });

  it("compiles every Reach stock script that MegaloEdit compiles", async () => {
    if (!existsSync(HREK_MEGALO_DIR)) {
      return;
    }

    // Stock scripts target MegaloEdit; MegaCrow-only checks (e.g. reserved
    // keywords used as names) are off in the MegaloEdit profile.
    applyCompilerSettings({
      ...previousSettings,
      megacrowExtensions: DEFAULT_MEGACROW_EXTENSIONS,
    });

    const outputDir = mkdtempSync(path.join(os.tmpdir(), "megacrow-hrek-"));
    const megaloEditDir = mkdtempSync(
      path.join(os.tmpdir(), "megacrow-hrek-megaloedit-")
    );
    try {
      const result = await compileMegaloDirectory({
        sourceDir: HREK_MEGALO_DIR,
        outputDir,
        format: "mglo",
        recursive: false,
        filesystem: createNodeFilesystem(),
      });

      const failures = result.failures.filter((failure) =>
        megaloEditCompiles(failure.sourcePath, megaloEditDir)
      );

      if (failures.length > 0) {
        const summary = failures
          .slice(0, 20)
          .map(
            (failure) =>
              `${path.relative(HREK_MEGALO_DIR, failure.sourcePath)}: ${failure.error}`
          )
          .join("\n");
        expect.fail(
          `${failures.length} compile failure(s) where MegaloEdit succeeds:\n${summary}${
            failures.length > 20 ? "\n..." : ""
          }`
        );
      }

      expect(result.compiled.length).toBeGreaterThan(0);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(megaloEditDir, { recursive: true, force: true });
    }
  });
});

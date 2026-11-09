import { APP_NAME } from "../app/constants";
import { compileMegaloDirectory } from "./compileDirectory";
import { compileMegaloFile } from "./compileSource";
import type { CliFilesystem } from "./filesystem";

export function cliUsage(): string {
  return [
    `${APP_NAME} CLI`,
    "",
    "Usage:",
    "  npm run cli -- --compile <source.txt> [destination.mglo|destination.bin]",
    "  npm run cli -- --compile-directory <source_dir> [destination_dir]",
    `  ${APP_NAME}.exe --compile <source.txt> [destination.mglo|destination.bin]`,
    `  ${APP_NAME}.exe --compile-directory <source_dir> [destination_dir]`,
    "",
    "Include and base resolution use the source file directory (or source_dir).",
    "Outputs are written beside the destination file or under destination_dir.",
  ].join("\n");
}

function fail(message: string): never {
  console.error(message);
  console.error("");
  console.error(cliUsage());
  throw new Error(message);
}

export async function runCli(
  argv: string[],
  filesystem: CliFilesystem
): Promise<number> {
  const compileIndex = argv.indexOf("--compile");
  const compileDirectoryIndex = argv.indexOf("--compile-directory");

  if (compileDirectoryIndex !== -1) {
    const sourceDir = argv[compileDirectoryIndex + 1];
    const outputDir = argv[compileDirectoryIndex + 2];
    if (!sourceDir) {
      fail("Missing source directory for --compile-directory");
    }

    const result = await compileMegaloDirectory({
      sourceDir,
      outputDir,
      filesystem,
    });

    console.log(
      `Compiled ${result.compiled.length} file(s), ${result.failures.length} failure(s).`
    );
    for (const entry of result.compiled) {
      console.log(`  OK ${entry.sourcePath} -> ${entry.outputPath}`);
    }
    for (const failure of result.failures) {
      console.error(`  FAIL ${failure.sourcePath}: ${failure.error}`);
    }

    return result.failures.length > 0 ? 1 : 0;
  }

  if (compileIndex !== -1) {
    const sourcePath = argv[compileIndex + 1];
    const outputPath = argv[compileIndex + 2];
    if (!sourcePath) {
      fail("Missing source file for --compile");
    }

    const result = await compileMegaloFile({
      sourcePath,
      outputPath,
      filesystem,
    });

    console.log(`Compiled ${result.sourcePath} -> ${result.outputPath}`);
    return 0;
  }

  fail("No CLI command specified");
}

// Import the compiler module directly: the `../compile` barrel also pulls in
// the IDE's LSP client, which the CLI does not need.
import { compileMgloFromMegaloSourceAsync } from "../compile/megaloCompile";
import { decodeTextFile } from "../files";
import type { FileProvider } from "../files/fileProvider";
import { isAbsoluteFilesystemPath } from "../files/fileProvider/paths";
import type { CliFilesystem } from "./filesystem";

export type CompileOutputFormat = "mglo" | "bin";

export interface CompileFileOptions {
  fileProvider?: FileProvider;
  filesystem: CliFilesystem;
  format?: CompileOutputFormat;
  outputPath?: string;
  sourcePath: string;
}

export interface CompileFileResult {
  bytes: Uint8Array;
  format: CompileOutputFormat;
  outputPath: string;
  sourcePath: string;
}

async function defaultOutputPath(
  sourcePath: string,
  format: CompileOutputFormat,
  fs: CliFilesystem
): Promise<string> {
  const resolved = await fs.resolve(sourcePath);
  const dir = await fs.dirname(resolved);
  const ext = await fs.extname(resolved);
  const base = await fs.basename(resolved, ext);
  const extension = format === "bin" ? ".bin" : ".mglo";
  return fs.resolve(dir, `${base}${extension}`);
}

function inferFormat(outputPath: string): CompileOutputFormat {
  const ext = outputPath.toLowerCase();
  if (ext.endsWith(".bin") || ext.endsWith(".blf")) {
    return "bin";
  }
  return "mglo";
}

export async function compileMegaloFile(
  options: CompileFileOptions
): Promise<CompileFileResult> {
  const fs = options.filesystem;
  const fileProvider = options.fileProvider ?? fs.fileProvider;
  const sourcePath = await fs.resolve(options.sourcePath);
  const sourceDir = await fs.dirname(sourcePath);
  const source = decodeTextFile(await fs.readBytes(sourcePath));
  const ext = await fs.extname(sourcePath);
  const scriptBasename = await fs.basename(sourcePath, ext);
  const outputPath = await fs.resolve(
    options.outputPath ??
      (await defaultOutputPath(sourcePath, options.format ?? "mglo", fs))
  );
  const format =
    options.format ?? (options.outputPath ? inferFormat(outputPath) : "mglo");
  const outputDir = await fs.dirname(outputPath);

  if (format === "bin") {
    throw new Error("gvar/bin export is not available in this CLI build");
  }

  const resolveFromDir = async (fromUri?: string): Promise<string> => {
    if (!fromUri) {
      return sourceDir;
    }
    return fs.dirname(fromUri);
  };

  const readProviderBytes = fileProvider.readBytes;
  if (!readProviderBytes) {
    throw new Error("File provider cannot read binary files for compile");
  }

  const bytes = await compileMgloFromMegaloSourceAsync(
    source,
    scriptBasename,
    undefined,
    {
      fromUri: sourcePath,
      resolveInclude: async (
        includePath: string,
        ctx: { kind: "include" | "localized_include"; fromUri?: string }
      ) => {
        const fromDir = await resolveFromDir(ctx.fromUri);
        const absolute = isAbsoluteFilesystemPath(includePath)
          ? includePath
          : fileProvider.resolvePath(includePath, fromDir);
        const includeBytes = await readProviderBytes(absolute);
        if (!includeBytes) {
          return null;
        }
        return { text: decodeTextFile(includeBytes), uri: absolute };
      },
      resolveBaseFile: async (basePath: string, ctx: { fromUri?: string }) => {
        const fromDir = await resolveFromDir(ctx.fromUri);
        const candidates = [
          fileProvider.resolvePath(basePath, fromDir),
          fileProvider.resolvePath(basePath, sourceDir),
          fileProvider.resolvePath(basePath, outputDir),
          fileProvider.resolvePath(
            `../../../maps/megalo/${basePath.replace(/^.*[\\/]/, "")}`,
            sourceDir
          ),
        ];
        for (const candidate of [...new Set(candidates)]) {
          const baseBytes = await readProviderBytes(candidate);
          if (baseBytes) {
            return baseBytes;
          }
        }
        return null;
      },
    }
  );

  await fs.mkdirRecursive(outputDir);
  await fs.writeBytes(outputPath, bytes);

  return { sourcePath, outputPath, format, bytes };
}

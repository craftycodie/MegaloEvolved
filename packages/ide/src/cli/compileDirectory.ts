import { decodeTextFile } from "../files";
import { readBaseDirective } from "./baseDirective";
import {
  type CompileFileResult,
  type CompileOutputFormat,
  compileMegaloFile,
} from "./compileSource";
import type { CliFilesystem } from "./filesystem";

export interface CompileDirectoryOptions {
  filesystem: CliFilesystem;
  format?: CompileOutputFormat;
  outputDir?: string;
  recursive?: boolean;
  sourceDir: string;
}

export interface CompileDirectoryResult {
  compiled: CompileFileResult[];
  failures: { sourcePath: string; error: string }[];
  skipped: string[];
}

interface DirectoryJob {
  baseMgloPath: string | null;
  outputPath: string;
  relativePath: string;
  sourcePath: string;
}

async function buildJobs(
  sourceDir: string,
  outputDir: string,
  format: CompileOutputFormat,
  recursive: boolean,
  fs: CliFilesystem
): Promise<DirectoryJob[]> {
  const absoluteSourceDir = await fs.resolve(sourceDir);
  const absoluteOutputDir = await fs.resolve(outputDir);
  const txtFiles = await fs.listTxtFiles(absoluteSourceDir, recursive);

  const jobs: DirectoryJob[] = [];
  for (const sourcePath of txtFiles) {
    const relativePath = await fs.relative(absoluteSourceDir, sourcePath);
    // Includes are resolved by megalo during compile (`compileMegaloFile`);
    // only the root file's `base` directive is needed to order the jobs.
    const source = decodeTextFile(await fs.readBytes(sourcePath));
    const baseMgloPath = readBaseDirective(source);
    const outputPath = await fs.resolve(
      absoluteOutputDir,
      relativePath.replace(/\.txt$/i, format === "bin" ? ".bin" : ".mglo")
    );
    jobs.push({
      sourcePath,
      relativePath,
      baseMgloPath,
      outputPath,
    });
  }
  return jobs;
}

function topoSortJobs(jobs: DirectoryJob[]): DirectoryJob[] {
  const producerByMglo = new Map<string, DirectoryJob>();
  for (const job of jobs) {
    const stem = job.sourcePath.replace(/^.*[\\/]/, "").replace(/\.txt$/i, "");
    producerByMglo.set(`${stem}.mglo`, job);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const sorted: DirectoryJob[] = [];

  const visit = (job: DirectoryJob) => {
    if (visited.has(job.sourcePath)) {
      return;
    }
    if (visiting.has(job.sourcePath)) {
      throw new Error(`Circular base dependency involving ${job.relativePath}`);
    }
    visiting.add(job.sourcePath);
    if (job.baseMgloPath) {
      const baseJob = producerByMglo.get(job.baseMgloPath);
      if (baseJob && baseJob.sourcePath !== job.sourcePath) {
        visit(baseJob);
      }
    }
    visiting.delete(job.sourcePath);
    visited.add(job.sourcePath);
    sorted.push(job);
  };

  for (const job of jobs) {
    visit(job);
  }
  return sorted;
}

export async function compileMegaloDirectory(
  options: CompileDirectoryOptions
): Promise<CompileDirectoryResult> {
  const fs = options.filesystem;
  const sourceDir = await fs.resolve(options.sourceDir);
  if (!(await fs.isDirectory(sourceDir))) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }
  const outputDir = await fs.resolve(options.outputDir ?? sourceDir);
  const format = options.format ?? "mglo";
  const recursive = options.recursive ?? true;

  const jobs = await buildJobs(sourceDir, outputDir, format, recursive, fs);
  const order = topoSortJobs(jobs);

  const compiled: CompileFileResult[] = [];
  const skipped: string[] = [];
  const failures: { sourcePath: string; error: string }[] = [];

  for (const job of order) {
    try {
      const result = await compileMegaloFile({
        sourcePath: job.sourcePath,
        outputPath: job.outputPath,
        format,
        filesystem: fs,
      });
      compiled.push(result);
    } catch (error) {
      failures.push({
        sourcePath: job.sourcePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const compiledSources = new Set(compiled.map((entry) => entry.sourcePath));
  for (const job of jobs) {
    if (!compiledSources.has(job.sourcePath)) {
      skipped.push(job.sourcePath);
    }
  }

  return { compiled, skipped, failures };
}

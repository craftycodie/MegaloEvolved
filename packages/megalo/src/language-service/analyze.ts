import type { CompilerSettings } from "src/compiler-settings";
import { MegaloCompilerContext } from "src/context";
import { Diagnostics } from "src/diagnostics";
import {
  Parser,
  type ResolveIncludeFn,
} from "src/frontend/abstract-syntax-tree";
import type { ObjectLists } from "src/frontend/object-lists";
import { Lexer } from "src/frontend/tokens";
import { computeLineStarts } from "src/language-service/position";
import type { AnalysisSnapshot } from "src/language-service/snapshot";
import { loadObjectListsForVersion } from "src/load-object-lists";
import {
  ALL_MEGACROW_EXTENSIONS,
  type MegacrowExtensions,
  resolveMegacrowExtensions,
} from "src/megacrow-extensions";
import type { SupportedMegaloVersion } from "src/version";

export interface AnalyzeDocumentOptions {
  compilerSettings?: Partial<CompilerSettings>;
  fromUri?: string;
  megacrowExtensions?: Partial<MegacrowExtensions>;
  objectLists?: ObjectLists;
  resolveInclude?: ResolveIncludeFn;
  version: SupportedMegaloVersion;
}

export type AnalyzeDocumentSyncOptions = Omit<
  AnalyzeDocumentOptions,
  "resolveInclude" | "fromUri"
>;

const buildSnapshot = (
  source: string,
  version: SupportedMegaloVersion,
  objectLists: ObjectLists | undefined,
  megacrowExtensions?: Partial<MegacrowExtensions>,
  compilerSettings?: Partial<CompilerSettings>
): AnalysisSnapshot => {
  const resolvedExtensions = resolveMegacrowExtensions(
    megacrowExtensions ?? ALL_MEGACROW_EXTENSIONS
  );
  const frontend = new MegaloCompilerContext(
    version,
    resolvedExtensions,
    compilerSettings
  );
  const diagnostics = new Diagnostics();
  const lists = objectLists ?? loadObjectListsForVersion(version);
  const tokens = new Lexer(frontend).lex(source, diagnostics);
  const ast = new Parser(frontend).parse(tokens, diagnostics, lists);

  return {
    source,
    tokens,
    ast,
    parseDiagnostics: [
      ...diagnostics.getErrors(),
      ...diagnostics.getWarnings(),
    ],
    lineStarts: computeLineStarts(source),
    megacrowExtensions: resolvedExtensions,
    version,
  };
};

/**
 * Sync lex + parse for features that cannot await (e.g. docs markdown-it).
 * Does not resolve includes — use `analyzeDocument` with `resolveInclude` for that.
 */
export const analyzeDocumentSync = (
  source: string,
  options: AnalyzeDocumentSyncOptions
): AnalysisSnapshot =>
  buildSnapshot(
    source,
    options.version,
    options.objectLists,
    options.megacrowExtensions,
    options.compilerSettings
  );

/**
 * Lex + parse once for editor features. Prefer this over re-parsing per query.
 * Uses `parseAsync` when `resolveInclude` is provided so symbols from includes bind.
 * Defaults to all MegaCrow extensions when `megacrowExtensions` is omitted.
 */
export const analyzeDocument = async (
  source: string,
  options: AnalyzeDocumentOptions
): Promise<AnalysisSnapshot> => {
  if (options.resolveInclude === undefined) {
    return buildSnapshot(
      source,
      options.version,
      options.objectLists,
      options.megacrowExtensions,
      options.compilerSettings
    );
  }

  const { version } = options;
  const resolvedExtensions = resolveMegacrowExtensions(
    options.megacrowExtensions ?? ALL_MEGACROW_EXTENSIONS
  );
  const frontend = new MegaloCompilerContext(
    version,
    resolvedExtensions,
    options.compilerSettings
  );
  const diagnostics = new Diagnostics();
  const objectLists = options.objectLists ?? loadObjectListsForVersion(version);
  const tokens = new Lexer(frontend).lex(source, diagnostics);
  const ast = await new Parser(frontend).parseAsync(tokens, diagnostics, {
    objectLists,
    fromUri: options.fromUri,
    resolveInclude: options.resolveInclude,
  });

  return {
    source,
    tokens,
    ast,
    parseDiagnostics: [
      ...diagnostics.getErrors(),
      ...diagnostics.getWarnings(),
    ],
    lineStarts: computeLineStarts(source),
    megacrowExtensions: resolvedExtensions,
    version,
  };
};

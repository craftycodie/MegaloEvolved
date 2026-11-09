/**
 * Absolute path to a Megalo source file on disk (desktop app).
 *
 * Include and base files are resolved by the LSP (`megacrow/resolveInclude`,
 * `megacrow/resolveBaseFile`); the IDE only tracks where the open file lives.
 */
export interface MegaloIncludeRoot {
  absoluteFilePath: string;
}

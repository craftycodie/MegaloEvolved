import {
  isObjectListDocument,
  isObjectListsPath,
} from "../gametype/objectListsPath";
import { pathToDocumentUri } from "../lsp/state";

/**
 * - `megalo`: Megalo source, compiled and served by the LSP.
 * - `objectList`: an `object_lists/<type>.txt` table, analyzed as a list.
 * - `text`: any other file under `object_lists/`, edited as plain text.
 */
export type DocumentKind = "megalo" | "objectList" | "text";

export function documentKindFor(
  path: string | null,
  displayName: string,
  objectListNames: readonly string[]
): DocumentKind {
  const openPath = path ?? displayName;
  if (isObjectListDocument(openPath, objectListNames)) {
    return "objectList";
  }
  return isObjectListsPath(openPath) ? "text" : "megalo";
}

/**
 * Identity of an open document: its LSP URI. Files without a disk path
 * (browser storage) get a placeholder URI under `file:///megalo/`.
 */
export function documentKeyFor(
  path: string | null,
  displayName: string
): string {
  return path
    ? pathToDocumentUri(path)
    : `file:///megalo/${encodeURIComponent(displayName)}`;
}

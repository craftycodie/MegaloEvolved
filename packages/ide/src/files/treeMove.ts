import { FsError } from "./fsErrors";

/**
 * Pure rules for moving a tree entry (`fromSegments`) into a folder
 * (`toParentSegments`). Segments are relative to the workspace root.
 *
 * Folder names compare case-insensitively when checking for ancestry: on
 * Windows and macOS `X/x` and `x` can be the same folder, and a false
 * "invalid" only refuses a move, while a false "move" can delete the source.
 */
export type TreeMovePlan =
  | { kind: "noop" }
  | { kind: "invalid"; reason: "root" | "into-self" | "onto-ancestor" }
  | { kind: "move"; toSegments: string[] };

const sameSegmentLoose = (a: string, b: string): boolean =>
  a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0;

function startsWithSegments(
  prefix: readonly string[],
  path: readonly string[]
): boolean {
  if (prefix.length > path.length) {
    return false;
  }
  return prefix.every((segment, index) =>
    sameSegmentLoose(segment, path[index] ?? "")
  );
}

function sameSegments(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && startsWithSegments(a, b);
}

export function planTreeMove(
  fromSegments: readonly string[],
  toParentSegments: readonly string[]
): TreeMovePlan {
  const name = fromSegments.at(-1);
  if (name === undefined) {
    return { kind: "invalid", reason: "root" };
  }
  const toSegments = [...toParentSegments, name];
  if (
    sameSegments(fromSegments, toSegments) ||
    sameSegments(fromSegments.slice(0, -1), toParentSegments)
  ) {
    return { kind: "noop" };
  }
  if (startsWithSegments(fromSegments, toSegments)) {
    return { kind: "invalid", reason: "into-self" };
  }
  // `toSegments` is a folder above the source, e.g. `x/x` dropped on the root
  // lands on `x`. Replacing that destination would delete the source itself.
  if (startsWithSegments(toSegments, fromSegments)) {
    return { kind: "invalid", reason: "onto-ancestor" };
  }
  return { kind: "move", toSegments };
}

export function treeMoveError(
  reason: "root" | "into-self" | "onto-ancestor"
): FsError {
  switch (reason) {
    case "root":
      return new FsError("move_root", "Cannot move the workspace root");
    case "into-self":
      return new FsError("move_into_self", "Cannot move a folder into itself");
    case "onto-ancestor":
      return new FsError(
        "move_onto_ancestor",
        "Cannot replace a folder that contains the item being moved"
      );
  }
}

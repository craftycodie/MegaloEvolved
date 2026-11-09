/** Reasons a workspace file operation is refused before touching the disk. */
export type FsErrorCode =
  | "delete_root"
  | "duplicate_root"
  | "invalid_file_name"
  | "invalid_folder_name"
  | "move_into_self"
  | "move_onto_ancestor"
  | "move_root"
  | "rename_root";

/**
 * A refused file operation. The UI shows a translated message chosen by
 * `code`; `message` is the English text for logs.
 */
export class FsError extends Error {
  readonly code: FsErrorCode;

  constructor(code: FsErrorCode, message: string) {
    super(message);
    this.name = "FsError";
    this.code = code;
  }
}

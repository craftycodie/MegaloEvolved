import { _event_warning, event } from "@blamnetwork/datamine";
import { FsError } from "../../files/fsErrors";
import { translateDiskError } from "../../localization";

/**
 * Text for a failed file-tree operation. Expected failures (`FsError`: name
 * taken, entry gone, ...) are only shown; anything else is also logged with
 * its raw message, which the translated text may hide.
 */
export function fileErrorMessage(error: unknown): string {
  if (!(error instanceof FsError)) {
    event(
      _event_warning,
      "ide:files: file operation failed: %s",
      String(error)
    );
  }
  return translateDiskError(error);
}

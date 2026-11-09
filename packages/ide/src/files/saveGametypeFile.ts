import {
  MEGALO_VERSIONS,
  type MegaloVersionId,
  packMgloBytesForVersion,
} from "@megacrow/megalo";

import { join } from "@tauri-apps/api/path";

import { save } from "@tauri-apps/plugin-dialog";

import { writeFile } from "@tauri-apps/plugin-fs";
import { DEFAULT_MEGALO_VERSION } from "../app/constants";
import { getCompileMegaloVersion } from "../compile/megaloCompile";
import { isTauriRuntime } from "../desktop/tauriRuntime";
import {
  autosaveQueueFileName,
  autosaveQueueFileSizeForMegaloVersionId,
  finalizeGametypeSaveBytes,
  type GametypeSaveFormat,
} from "../gametype/gametypeSaveFormat";
import type { Workspace } from "../workspace/workspace";

export function gametypeSaveFileName(
  fileName: string | null,

  format: GametypeSaveFormat
): string {
  if (format === "asq") {
    return autosaveQueueFileName();
  }

  const stem = fileName
    ? fileName.replace(/\.(txt|bin|blf|mglo|game)$/i, "")
    : "gametype";

  return format === "mglo" ? `${stem}.mglo` : `${stem}.bin`;
}

export interface GametypeSaveDialogText {
  filterAutosaveQueue: string;

  filterMegaloVariant: string;

  filterReachGametype: string;

  title: string;
}

function saveDialogFilters(
  format: GametypeSaveFormat,

  labels: GametypeSaveDialogText
) {
  if (format === "mglo") {
    return [{ name: labels.filterMegaloVariant, extensions: ["mglo"] }];
  }

  if (format === "asq") {
    return [{ name: labels.filterAutosaveQueue, extensions: ["game"] }];
  }

  return [{ name: labels.filterReachGametype, extensions: ["bin", "blf"] }];
}

export type SaveGametypeResult =
  | { saved: true; path: string | null }
  | { saved: false; cancelled: true };

export async function saveGametypeBytes(
  bytes: Uint8Array,

  format: GametypeSaveFormat,

  suggestedName: string,

  dialog?: GametypeSaveDialogText
): Promise<SaveGametypeResult> {
  const output = finalizeGametypeSaveBytes(bytes, format, {
    autosaveSlotSize: autosaveQueueFileSizeForMegaloVersionId(
      getCompileMegaloVersion()
    ),
  });

  if (isTauriRuntime()) {
    const path = await save({
      title: dialog?.title ?? "Save gametype",

      defaultPath: suggestedName,

      filters: saveDialogFilters(format, {
        title: dialog?.title ?? "Save gametype",

        filterMegaloVariant: dialog?.filterMegaloVariant ?? "Megalo variant",

        filterAutosaveQueue: dialog?.filterAutosaveQueue ?? "Autosave queue",

        filterReachGametype: dialog?.filterReachGametype ?? "Reach gametype",
      }),
    });

    if (!path) {
      return { saved: false, cancelled: true };
    }

    await writeFile(path, output);

    return { saved: true, path };
  }

  const blob = new Blob([Uint8Array.from(output)], {
    type: "application/octet-stream",
  });

  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");

  anchor.href = url;

  anchor.download = suggestedName;

  anchor.rel = "noopener";

  anchor.style.display = "none";

  document.body.appendChild(anchor);

  anchor.click();

  anchor.remove();

  // Delay revoke so the browser can start the download before the blob URL is invalidated.

  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);

  return { saved: true, path: null };
}

export async function writeBuildOutputsToWorkspace(
  workspace: Workspace,

  fileName: string | null,

  mgloBytes: Uint8Array,

  megaloVersionId: MegaloVersionId = DEFAULT_MEGALO_VERSION
): Promise<{ mgloPath: string; binPath: string }> {
  if (workspace.type !== "tauri") {
    throw new Error("Build requires the desktop app with an active workspace.");
  }

  if (!workspace.outputPath?.trim()) {
    throw new Error("This workspace has no output folder configured.");
  }

  const mgloName = gametypeSaveFileName(fileName, "mglo");

  const binName = gametypeSaveFileName(fileName, "gvar");

  const mgloPath = await join(workspace.outputPath, mgloName);

  const binPath = await join(workspace.outputPath, binName);

  const gvarBytes = packMgloBytesForVersion(
    mgloBytes,

    MEGALO_VERSIONS[megaloVersionId],

    "gvar"
  );

  await writeFile(mgloPath, mgloBytes);

  await writeFile(binPath, gvarBytes);

  return { mgloPath, binPath };
}

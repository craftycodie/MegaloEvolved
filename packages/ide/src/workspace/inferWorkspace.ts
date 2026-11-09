import { join } from "@tauri-apps/api/path";
import { exists, readTextFile } from "@tauri-apps/plugin-fs";
import type { IdeMessageKey } from "../localization";
import {
  guessHrekRootFromScripts,
  guessOutputPathFromScripts,
  parseProjectXmlDisplayName,
} from "./workspacePaths";

export interface InferredWorkspace {
  /** Display name from the Editing Kit's project.xml, if found. */
  name: string | null;
  /** The kit's maps/megalo folder next to the scripts folder, if it exists. */
  outputPath: string | null;
}

/**
 * Guess workspace details from a Halo Reach Editing Kit scripts folder
 * (desktop only). Missing or unreadable files just leave a field null.
 */
export async function inferWorkspaceFromScripts(
  scriptsPath: string
): Promise<InferredWorkspace> {
  let name: string | null = null;
  const kitRoot = guessHrekRootFromScripts(scriptsPath);
  if (kitRoot) {
    try {
      const projectXmlPath = await join(kitRoot, "project.xml");
      if (await exists(projectXmlPath)) {
        name = parseProjectXmlDisplayName(await readTextFile(projectXmlPath));
      }
    } catch {
      // No readable project.xml: no name.
    }
  }

  let outputPath: string | null = null;
  const guessedOutput = guessOutputPathFromScripts(scriptsPath);
  if (guessedOutput) {
    try {
      outputPath = (await exists(guessedOutput)) ? guessedOutput : null;
    } catch {
      // Cannot check: leave the output folder for the user to pick.
    }
  }
  return { name, outputPath };
}

/** Names for Halo: Reach builds in the build picker (others show the number). */
export const REACH_BUILD_LABEL_KEYS: ReadonlyMap<number, IdeMessageKey> =
  new Map([
    [9449, "workspace_modal_game_version_beta"],
    [9664, "workspace_modal_game_version_beta_tu1"],
    [9730, "workspace_modal_game_version_delta"],
  ]);

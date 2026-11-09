import type { MegaloVersionId } from "@megacrow/megalo";
import { isTauriRuntime } from "../desktop/tauriRuntime";
import {
  browserOpfsStoredWorkspace,
  isBrowserWorkspaceAvailable,
  type StoredWorkspace,
} from "./megacrowSettings";

export type WorkspaceType = "opfs" | "tauri";

export interface Workspace {
  /** Halo engine build number for encodings with multiple known builds. */
  gameBuildNumber: number | null;
  /** Custom command that replaces Launch Halo for non-MCC workspaces. */
  gameLaunchCommand: string | null;
  id: string;
  inputPath: string;
  megaloVersion: MegaloVersionId;
  name: string;
  /** Compiled `.mglo` output folder, or `null` when Build is disabled. */
  outputPath: string | null;
  type: WorkspaceType;
}

export function storedToWorkspace(
  stored: StoredWorkspace,
  type: WorkspaceType = "tauri"
): Workspace {
  return {
    id: stored.id,
    type,
    name: stored.name,
    megaloVersion: stored.megaloVersion,
    gameBuildNumber: stored.gameBuildNumber,
    gameLaunchCommand: stored.gameLaunchCommand,
    inputPath: stored.inputPath,
    outputPath: stored.outputPath,
  };
}

export function resolveActiveWorkspace(
  workspaces: StoredWorkspace[],
  activeWorkspaceId: string | null
): Workspace | null {
  if (isTauriRuntime()) {
    const match =
      (activeWorkspaceId
        ? workspaces.find((workspace) => workspace.id === activeWorkspaceId)
        : null) ?? workspaces[0];
    return match ? storedToWorkspace(match, "tauri") : null;
  }
  if (isBrowserWorkspaceAvailable()) {
    return storedToWorkspace(browserOpfsStoredWorkspace(), "opfs");
  }
  return null;
}

/** Fields the add / edit workspace form produces. */
export interface WorkspaceDraft {
  gameBuildNumber: number | null;
  gameLaunchCommand: string;
  inputPath: string;
  megaloVersion: MegaloVersionId;
  name: string;
  /** Empty string when the workspace has no build output folder. */
  outputPath: string;
}

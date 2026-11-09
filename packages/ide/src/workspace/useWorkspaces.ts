import type { MegaloVersionId } from "@megacrow/megalo";
import { isMccMegaloVersion, resolveGameBuildNumber } from "@megacrow/megalo";
import { useCallback, useEffect, useState } from "react";
import { isTauriRuntime } from "../desktop";
import { closeAllDocuments } from "../stores/documentStore";
import { bumpLocalDiskRevision } from "../stores/revisionStore";
import {
  setActiveWorkspaceOverride,
  settingsStore,
  updateSettings,
} from "../stores/settingsStore";
import {
  createWorkspaceId,
  isPathInWorkspaceInput,
  type StoredWorkspace,
  storedToWorkspace,
  type Workspace,
  type WorkspaceDraft,
} from "../workspace";

interface UseWorkspacesOptions {
  activeWorkspace: Workspace | null;
  bootstrapNeedsAddWorkspace: boolean | null;
}

const ignoreLoggedError = () => {
  // The settings store already logs failed saves.
};

export function useWorkspaces({
  activeWorkspace,
  bootstrapNeedsAddWorkspace,
}: UseWorkspacesOptions) {
  const [addWorkspaceOpen, setAddWorkspaceOpen] = useState(false);
  const [addWorkspaceRequired, setAddWorkspaceRequired] = useState(false);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (bootstrapNeedsAddWorkspace === null) {
      return;
    }
    setAddWorkspaceRequired(bootstrapNeedsAddWorkspace);
    setAddWorkspaceOpen(bootstrapNeedsAddWorkspace);
  }, [bootstrapNeedsAddWorkspace]);

  const handleAddWorkspace = useCallback(() => {
    setEditingWorkspaceId(null);
    setAddWorkspaceRequired(false);
    setAddWorkspaceOpen(true);
  }, []);

  const handleEditWorkspace = useCallback((workspace: StoredWorkspace) => {
    setEditingWorkspaceId(workspace.id);
    setAddWorkspaceRequired(false);
    setAddWorkspaceOpen(true);
  }, []);

  const closeWorkspaceModal = useCallback(() => {
    setAddWorkspaceOpen(false);
    setAddWorkspaceRequired(false);
    setEditingWorkspaceId(null);
  }, []);

  const handleSelectWorkspace = useCallback((id: string) => {
    if (settingsStore.getState().settings.activeWorkspaceId === id) {
      return;
    }
    closeAllDocuments();
    updateSettings((current) => ({
      ...current,
      activeWorkspaceId: id,
    })).catch(ignoreLoggedError);
    bumpLocalDiskRevision();
  }, []);

  /** Browser workspace only: its version lives in the session, not on disk. */
  const handleSelectMegaloVersion = useCallback(
    (version: MegaloVersionId) => {
      if (!activeWorkspace || activeWorkspace.megaloVersion === version) {
        return;
      }
      const nextWorkspace: Workspace = {
        ...activeWorkspace,
        megaloVersion: version,
        gameBuildNumber:
          resolveGameBuildNumber(version, activeWorkspace.gameBuildNumber) ??
          null,
        gameLaunchCommand: isMccMegaloVersion(version)
          ? null
          : activeWorkspace.gameLaunchCommand,
      };
      const stored = settingsStore
        .getState()
        .settings.workspaces.some((entry) => entry.id === activeWorkspace.id);
      if (!stored) {
        setActiveWorkspaceOverride(nextWorkspace);
        return;
      }
      updateSettings((current) => ({
        ...current,
        workspaces: current.workspaces.map((entry) =>
          entry.id === activeWorkspace.id
            ? {
                ...entry,
                megaloVersion: nextWorkspace.megaloVersion,
                gameBuildNumber: nextWorkspace.gameBuildNumber,
                gameLaunchCommand: nextWorkspace.gameLaunchCommand,
              }
            : entry
        ),
      })).catch(ignoreLoggedError);
    },
    [activeWorkspace]
  );

  const handleDeleteWorkspace = useCallback((id: string) => {
    const wasActive =
      settingsStore.getState().settings.activeWorkspaceId === id;
    if (wasActive) {
      closeAllDocuments();
    }
    let remainingCount = 0;
    updateSettings((current) => {
      const remaining = current.workspaces.filter(
        (workspace) => workspace.id !== id
      );
      remainingCount = remaining.length;
      return {
        ...current,
        workspaces: remaining,
        activeWorkspaceId:
          current.activeWorkspaceId === id
            ? (remaining[0]?.id ?? null)
            : current.activeWorkspaceId,
      };
    })
      .then(() => {
        bumpLocalDiskRevision();
        if (remainingCount === 0 && isTauriRuntime()) {
          setEditingWorkspaceId(null);
          setAddWorkspaceRequired(true);
          setAddWorkspaceOpen(true);
        }
      })
      .catch(ignoreLoggedError);
  }, []);

  const handleSaveWorkspace = useCallback(
    (draft: WorkspaceDraft) => {
      const editingId = editingWorkspaceId;
      const fields = {
        name: draft.name,
        megaloVersion: draft.megaloVersion,
        gameBuildNumber: draft.gameBuildNumber,
        gameLaunchCommand: draft.gameLaunchCommand.trim() || null,
        inputPath: draft.inputPath,
        outputPath: draft.outputPath.trim() || null,
      };
      closeWorkspaceModal();

      if (editingId) {
        if (settingsStore.getState().settings.activeWorkspaceId === editingId) {
          // Paths or version may have changed under the open file.
          closeAllDocuments();
        }
        updateSettings((current) => ({
          ...current,
          activeWorkspaceId: current.activeWorkspaceId ?? editingId,
          workspaces: current.workspaces.map((workspace) =>
            workspace.id === editingId
              ? {
                  ...workspace,
                  ...fields,
                  lastOpenFilePath:
                    workspace.lastOpenFilePath &&
                    isPathInWorkspaceInput(
                      workspace.lastOpenFilePath,
                      fields.inputPath
                    )
                      ? workspace.lastOpenFilePath
                      : null,
                }
              : workspace
          ),
        })).catch(ignoreLoggedError);
        bumpLocalDiskRevision();
        return;
      }

      const stored: StoredWorkspace = {
        ...fields,
        id: createWorkspaceId(),
        lastOpenFilePath: null,
      };
      closeAllDocuments();
      bumpLocalDiskRevision();
      updateSettings(
        (current) => ({
          ...current,
          workspaces: [...current.workspaces, stored],
          activeWorkspaceId: stored.id,
        }),
        { activeWorkspace: storedToWorkspace(stored, "tauri") }
      ).catch(ignoreLoggedError);
    },
    [closeWorkspaceModal, editingWorkspaceId]
  );

  return {
    addWorkspaceOpen,
    addWorkspaceRequired,
    closeWorkspaceModal,
    editingWorkspaceId,
    handleAddWorkspace,
    handleDeleteWorkspace,
    handleEditWorkspace,
    handleSaveWorkspace,
    handleSelectMegaloVersion,
    handleSelectWorkspace,
  };
}

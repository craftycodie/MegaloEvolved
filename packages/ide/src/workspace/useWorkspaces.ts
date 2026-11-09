import type { MegaloVersionId } from "@megacrow/megalo";
import { isMccMegaloVersion, resolveGameBuildNumber } from "@megacrow/megalo";
import { useCallback, useEffect, useState } from "react";
import type { WorkspaceDraft } from "../components/dialogs/AddWorkspaceModal";
import { isTauriRuntime } from "../desktop";
import { lspUpdateConfig, lspVersionConfiguration } from "../lsp";
import {
  createWorkspaceId,
  defaultMegacrowSettings,
  isPathInWorkspaceInput,
  type MegacrowSettings,
  type StoredWorkspace,
  storedToWorkspace,
  type Workspace,
} from "../workspace";

interface UseWorkspacesOptions {
  activeWorkspace: Workspace | null;
  applyWorkspace: (workspace: Workspace | null) => void;
  bootstrapNeedsAddWorkspace: boolean | null;
  clearWorkspace: () => void;
  commitSettings: (
    next: MegacrowSettings,
    workspaceOverride?: Workspace | null
  ) => Promise<void>;
  megacrowSettings: MegacrowSettings | null;
  setObjectListNames: (names: readonly string[]) => void;
  workspacesReady: boolean;
}

export function useWorkspaces({
  activeWorkspace,
  applyWorkspace,
  bootstrapNeedsAddWorkspace,
  clearWorkspace,
  commitSettings,
  megacrowSettings,
  setObjectListNames,
  workspacesReady: _workspacesReady,
}: UseWorkspacesOptions) {
  const [addWorkspaceOpen, setAddWorkspaceOpen] = useState(false);
  const [addWorkspaceRequired, setAddWorkspaceRequired] = useState(false);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(
    null
  );
  const [localDiskRevision, setLocalDiskRevision] = useState(0);
  const [opfsRevision, setOpfsRevision] = useState(0);

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

  const handleSelectWorkspace = useCallback(
    (id: string) => {
      if (!megacrowSettings) {
        return;
      }
      if (megacrowSettings.activeWorkspaceId === id) {
        return;
      }
      const next = {
        ...megacrowSettings,
        activeWorkspaceId: id,
      };
      clearWorkspace();
      void commitSettings(next);
      setLocalDiskRevision((value) => value + 1);
    },
    [clearWorkspace, commitSettings, megacrowSettings]
  );

  const handleSelectMegaloVersion = useCallback(
    async (version: MegaloVersionId) => {
      if (!activeWorkspace || activeWorkspace.megaloVersion === version) {
        return;
      }
      const nextBuildNumber =
        resolveGameBuildNumber(version, activeWorkspace.gameBuildNumber) ??
        null;
      const nextLaunchCommand = isMccMegaloVersion(version)
        ? null
        : activeWorkspace.gameLaunchCommand;
      const nextWorkspace = {
        ...activeWorkspace,
        megaloVersion: version,
        gameBuildNumber: nextBuildNumber,
        gameLaunchCommand: nextLaunchCommand,
      };
      applyWorkspace(nextWorkspace);
      if (megacrowSettings) {
        const next: MegacrowSettings = {
          ...megacrowSettings,
          workspaces: megacrowSettings.workspaces.map((workspace) =>
            workspace.id === activeWorkspace.id
              ? {
                  ...workspace,
                  megaloVersion: version,
                  gameBuildNumber: nextBuildNumber,
                  gameLaunchCommand: nextLaunchCommand,
                }
              : workspace
          ),
        };
        void commitSettings(next, nextWorkspace);
      }
      try {
        lspUpdateConfig({ megaloVersion: version });
        const config = await lspVersionConfiguration(version);
        setObjectListNames(config.objectListNames);
      } catch (error) {
        console.error("Failed to switch Megalo version:", error);
      }
    },
    [
      activeWorkspace,
      applyWorkspace,
      commitSettings,
      megacrowSettings,
      setObjectListNames,
    ]
  );

  const handleDeleteWorkspace = useCallback(
    (id: string) => {
      if (!megacrowSettings) {
        return;
      }
      const remaining = megacrowSettings.workspaces.filter(
        (workspace) => workspace.id !== id
      );
      const wasActive = megacrowSettings.activeWorkspaceId === id;
      const nextActiveId = wasActive
        ? (remaining[0]?.id ?? null)
        : megacrowSettings.activeWorkspaceId;
      const next: MegacrowSettings = {
        ...megacrowSettings,
        workspaces: remaining,
        activeWorkspaceId: nextActiveId,
      };
      if (wasActive) {
        clearWorkspace();
      }
      void commitSettings(next).then(() => {
        setLocalDiskRevision((value) => value + 1);
        if (remaining.length === 0 && isTauriRuntime()) {
          setEditingWorkspaceId(null);
          setAddWorkspaceRequired(true);
          setAddWorkspaceOpen(true);
        }
      });
    },
    [clearWorkspace, commitSettings, megacrowSettings]
  );

  const handleSaveWorkspace = useCallback(
    (draft: WorkspaceDraft) => {
      const base = megacrowSettings ?? defaultMegacrowSettings();
      const nextOutputPath = draft.outputPath.trim() || null;
      const nextLaunchCommand = draft.gameLaunchCommand.trim() || null;
      const nextBuildNumber = draft.gameBuildNumber;
      const editingId = editingWorkspaceId;

      setAddWorkspaceOpen(false);
      setAddWorkspaceRequired(false);
      setEditingWorkspaceId(null);

      if (editingId) {
        let updated: StoredWorkspace | null = null;
        const workspaces = base.workspaces.map((workspace) => {
          if (workspace.id !== editingId) {
            return workspace;
          }
          updated = {
            ...workspace,
            name: draft.name,
            megaloVersion: draft.megaloVersion,
            gameBuildNumber: nextBuildNumber,
            gameLaunchCommand: nextLaunchCommand,
            inputPath: draft.inputPath,
            outputPath: nextOutputPath,
            lastOpenFilePath:
              workspace.lastOpenFilePath &&
              isPathInWorkspaceInput(
                workspace.lastOpenFilePath,
                draft.inputPath
              )
                ? workspace.lastOpenFilePath
                : null,
          };
          return updated;
        });
        const next: MegacrowSettings = {
          ...base,
          workspaces,
          activeWorkspaceId: base.activeWorkspaceId ?? editingId,
        };
        const activeUpdated =
          next.activeWorkspaceId === editingId ? updated : null;
        if (activeUpdated) {
          clearWorkspace();
        }
        setLocalDiskRevision((value) => value + 1);
        void commitSettings(
          next,
          activeUpdated ? storedToWorkspace(activeUpdated, "tauri") : undefined
        ).catch(() => {
          // Error already logged in commitSettings.
        });
        return;
      }

      const stored: StoredWorkspace = {
        id: createWorkspaceId(),
        name: draft.name,
        megaloVersion: draft.megaloVersion,
        gameBuildNumber: nextBuildNumber,
        gameLaunchCommand: nextLaunchCommand,
        inputPath: draft.inputPath,
        outputPath: nextOutputPath,
        lastOpenFilePath: null,
      };
      const next: MegacrowSettings = {
        ...base,
        workspaces: [...base.workspaces, stored],
        activeWorkspaceId: stored.id,
      };
      clearWorkspace();
      setLocalDiskRevision((value) => value + 1);
      void commitSettings(next, storedToWorkspace(stored, "tauri")).catch(
        () => {
          // Error already logged in commitSettings.
        }
      );
    },
    [clearWorkspace, commitSettings, editingWorkspaceId, megacrowSettings]
  );

  const handleFileDeleted = useCallback((onActiveFileDeleted: () => void) => {
    setOpfsRevision((n) => n + 1);
    setLocalDiskRevision((n) => n + 1);
    onActiveFileDeleted();
  }, []);

  const bumpLocalDiskRevision = useCallback(() => {
    setLocalDiskRevision((n) => n + 1);
  }, []);

  return {
    addWorkspaceOpen,
    addWorkspaceRequired,
    bumpLocalDiskRevision,
    editingWorkspaceId,
    handleAddWorkspace,
    handleDeleteWorkspace,
    handleEditWorkspace,
    handleFileDeleted,
    handleSaveWorkspace,
    handleSelectMegaloVersion,
    handleSelectWorkspace,
    localDiskRevision,
    opfsRevision,
    setAddWorkspaceOpen,
    setAddWorkspaceRequired,
    setEditingWorkspaceId,
  };
}

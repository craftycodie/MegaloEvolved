import {
  getLabel,
  hasMultipleKnownGameBuilds,
  isMccMegaloVersion,
  isMegaloVersionId,
  knownGameBuildsFor,
  MEGALO_VERSIONS,
  type MegaloVersionId,
  resolveGameBuildNumber,
} from "@megacrow/megalo";
import { useMemo, useRef, useState } from "react";
import { DEFAULT_MEGALO_VERSION } from "../../app/constants";
import { pickTauriFolder } from "../../files";
import { type IdeMessageKey, useT } from "../../localization";
import { Dialog } from "../../ui/Dialog";
import { CloseIcon } from "../../ui/icons";
import type { StoredWorkspace, WorkspaceDraft } from "../../workspace";
import {
  inferWorkspaceFromScripts,
  REACH_BUILD_LABEL_KEYS,
} from "../../workspace/inferWorkspace";
import { BROWSER_MEGALO_VERSIONS } from "../MegaloVersionMenu";

/** Workspace versions with a real compile backend. */
export const WORKSPACE_MEGALO_VERSIONS: readonly MegaloVersionId[] =
  BROWSER_MEGALO_VERSIONS;

function gameBuildOptionLabel(
  t: (key: IdeMessageKey) => string,
  buildNumber: number
): string {
  const key = REACH_BUILD_LABEL_KEYS.get(buildNumber);
  return `${key ? t(key) : String(buildNumber)} (${buildNumber})`;
}

interface Props {
  /** When set, modal edits this workspace instead of creating a new one. */
  initialWorkspace?: StoredWorkspace | null;
  onCancel?: () => void;
  onSave: (workspace: WorkspaceDraft) => void;
  open: boolean;
  required?: boolean;
}

export function AddWorkspaceModal({
  open,
  required = false,
  initialWorkspace = null,
  onCancel,
  onSave,
}: Props) {
  const t = useT();
  const nameRef = useRef<HTMLInputElement>(null);
  // The form starts from `initialWorkspace` once. The parent remounts the
  // modal (via `key`) each time it opens or switches workspace, so typing is
  // never reset by a re-render.
  const initialVersion =
    initialWorkspace?.megaloVersion ?? DEFAULT_MEGALO_VERSION;
  const [name, setName] = useState(initialWorkspace?.name ?? "");
  const [megaloVersion, setMegaloVersion] =
    useState<MegaloVersionId>(initialVersion);
  const [inputPath, setInputPath] = useState(initialWorkspace?.inputPath ?? "");
  const [outputPath, setOutputPath] = useState(
    initialWorkspace?.outputPath ?? ""
  );
  const [gameLaunchCommand, setGameLaunchCommand] = useState(
    initialWorkspace?.gameLaunchCommand ?? ""
  );
  const [gameBuildNumber, setGameBuildNumber] = useState<number | null>(
    () =>
      resolveGameBuildNumber(
        initialVersion,
        initialWorkspace?.gameBuildNumber
      ) ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initialWorkspace;

  const canSave = useMemo(
    () => name.trim().length > 0 && inputPath.trim().length > 0,
    [name, inputPath]
  );

  const dismiss = () => {
    onCancel?.();
  };

  const pickScripts = async () => {
    const selected = await pickTauriFolder(t("folder_picker_title"));
    if (!selected) {
      return;
    }
    setInputPath(selected);

    const inferred = await inferWorkspaceFromScripts(selected);
    // Only fill the name when the user hasn't typed one yet.
    if (!name.trim() && inferred.name) {
      setName(inferred.name);
    }
    if (inferred.outputPath) {
      setOutputPath(inferred.outputPath);
    }
  };

  const pickOutput = async () => {
    const selected = await pickTauriFolder(t("folder_picker_title"));
    if (selected) {
      setOutputPath(selected);
    }
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    const trimmedInput = inputPath.trim();
    if (!trimmedName) {
      setError(t("workspace_modal_error_name"));
      nameRef.current?.focus();
      return;
    }
    if (!trimmedInput) {
      setError(t("workspace_modal_error_scripts"));
      return;
    }
    setError(null);
    onSave({
      name: trimmedName,
      megaloVersion,
      inputPath: trimmedInput,
      outputPath: outputPath.trim(),
      gameLaunchCommand: isMccMegaloVersion(megaloVersion)
        ? ""
        : gameLaunchCommand.trim(),
      gameBuildNumber:
        resolveGameBuildNumber(megaloVersion, gameBuildNumber) ?? null,
    });
  };

  return (
    <Dialog
      aria-labelledby="workspace-modal-title"
      className="workspace-modal"
      initialFocusRef={nameRef}
      onClose={dismiss}
      open={open}
    >
      <div className="workspace-modal-header">
        <h2 className="workspace-modal-title" id="workspace-modal-title">
          {isEdit
            ? t("workspace_modal_edit_title")
            : t("workspace_modal_add_title")}
        </h2>
        <button
          aria-label={t("common_close")}
          className="workspace-modal-close"
          onClick={dismiss}
          title={t("common_close")}
          type="button"
        >
          <CloseIcon />
        </button>
      </div>
      <p className="workspace-modal-hint">
        {required
          ? t("workspace_modal_hint_required")
          : t("workspace_modal_hint")}
      </p>

      <div className="workspace-modal-field-row">
        <label className="workspace-modal-field">
          <span>
            {t("workspace_modal_name")}{" "}
            <span className="workspace-modal-required">*</span>
          </span>
          <input
            maxLength={64}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canSave) {
                event.preventDefault();
                handleSave();
              }
            }}
            placeholder={t("workspace_modal_name_placeholder")}
            ref={nameRef}
            required
            type="text"
            value={name}
          />
        </label>

        <label className="workspace-modal-field">
          <span>{t("workspace_modal_megalo_version")}</span>
          <select
            onChange={(event) => {
              const value = event.target.value;
              if (isMegaloVersionId(value)) {
                setMegaloVersion(value);
                setGameBuildNumber(
                  resolveGameBuildNumber(value, gameBuildNumber) ?? null
                );
              }
            }}
            value={megaloVersion}
          >
            {WORKSPACE_MEGALO_VERSIONS.map((id) => (
              <option key={id} value={id}>
                {id} — {getLabel(MEGALO_VERSIONS[id])}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="workspace-modal-field">
        <span>
          {t("workspace_modal_scripts_folder")}{" "}
          <span className="workspace-modal-required">*</span>
        </span>
        <div className="workspace-modal-path-row">
          <input
            onChange={(event) => setInputPath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canSave) {
                event.preventDefault();
                handleSave();
              }
            }}
            placeholder={t("workspace_modal_scripts_placeholder")}
            required
            type="text"
            value={inputPath}
          />
          <button
            className="workspace-modal-browse"
            onClick={() => void pickScripts()}
            type="button"
          >
            {t("workspace_modal_browse")}
          </button>
        </div>
      </div>

      <div className="workspace-modal-field">
        <span>{t("workspace_modal_output_folder")}</span>
        <div className="workspace-modal-path-row">
          <input
            onChange={(event) => setOutputPath(event.target.value)}
            placeholder={t("workspace_modal_output_placeholder")}
            type="text"
            value={outputPath}
          />
          <button
            className="workspace-modal-browse"
            onClick={() => void pickOutput()}
            type="button"
          >
            {t("workspace_modal_browse")}
          </button>
        </div>
      </div>

      {isMccMegaloVersion(megaloVersion) ? null : (
        <section className="workspace-modal-advanced">
          <h3 className="workspace-modal-advanced-title">
            {t("workspace_modal_advanced")}
          </h3>
          <div className="workspace-modal-field">
            <span>{t("workspace_modal_launch_command")}</span>
            <input
              onChange={(event) => setGameLaunchCommand(event.target.value)}
              placeholder={t("workspace_modal_launch_command_placeholder")}
              spellCheck={false}
              type="text"
              value={gameLaunchCommand}
            />
            <p className="workspace-modal-field-hint">
              {t("workspace_modal_launch_command_hint")}
            </p>
          </div>
          {hasMultipleKnownGameBuilds(megaloVersion) ? (
            <label className="workspace-modal-field">
              <span>{t("workspace_modal_game_version")}</span>
              <select
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setGameBuildNumber(
                    resolveGameBuildNumber(megaloVersion, value) ?? null
                  );
                }}
                value={
                  resolveGameBuildNumber(megaloVersion, gameBuildNumber) ?? ""
                }
              >
                {knownGameBuildsFor(megaloVersion).map(
                  (buildNumber: number) => (
                    <option key={buildNumber} value={buildNumber}>
                      {gameBuildOptionLabel(t, buildNumber)}
                    </option>
                  )
                )}
              </select>
              <span className="workspace-modal-field-hint">
                {t("workspace_modal_game_version_hint")}
              </span>
            </label>
          ) : null}
        </section>
      )}

      {error ? <p className="workspace-modal-error">{error}</p> : null}

      <div className="workspace-modal-footer">
        <button
          className="workspace-modal-secondary"
          onClick={dismiss}
          type="button"
        >
          {t("common_cancel")}
        </button>
        <button
          className="workspace-modal-primary"
          disabled={!canSave}
          onClick={handleSave}
          type="button"
        >
          {isEdit
            ? t("workspace_modal_save_button")
            : t("workspace_modal_add_button")}
        </button>
      </div>
    </Dialog>
  );
}

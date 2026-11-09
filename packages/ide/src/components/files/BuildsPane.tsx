import type { MouseEvent } from "react";
import { useT } from "../../localization";
import { BuiltGametypeGlyph } from "./FilesGlyphs";
import { FolderErrorCard } from "./FolderErrorCard";
import {
  BUILDS_PANE_MAX_HEIGHT,
  BUILDS_PANE_MIN_HEIGHT,
  useBuildsPaneHeight,
} from "./useBuildsPaneHeight";

interface BuildOutput {
  name: string;
}

interface Props {
  buildOutputs: BuildOutput[];
  buildsError: string | null;
  /** Opens the workspace editor; shown on the folder-read error card. */
  editWorkspace?: () => void;
  onClearEditor?: () => void;
  onContextMenu: (event: MouseEvent, name: string) => void;
  /** The output folder cannot be read; replaces the build list. */
  outputError: string | null;
  outputPath: string;
}

export function BuildsPane({
  buildOutputs,
  buildsError,
  editWorkspace,
  onClearEditor,
  onContextMenu,
  outputError,
  outputPath,
}: Props) {
  const t = useT();
  const {
    height: buildsHeight,
    open: buildsOpen,
    onResizeStart: onBuildsResizeStart,
    toggleOpen: toggleBuildsOpen,
  } = useBuildsPaneHeight();

  return (
    <div className={`files-builds${buildsOpen ? " files-builds--open" : ""}`}>
      <button
        aria-expanded={buildsOpen}
        className="files-builds-header"
        onClick={toggleBuildsOpen}
        type="button"
      >
        <svg
          aria-hidden="true"
          className={`files-builds-chevron${buildsOpen ? " files-builds-chevron--open" : ""}`}
          height="12"
          viewBox="0 0 16 16"
          width="12"
        >
          <path
            d="M6 4l4 4-4 4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.4"
          />
        </svg>
        <span className="files-builds-title">{t("files_built_gametypes")}</span>
        {buildOutputs.length > 0 ? (
          <span className="files-section-count">{buildOutputs.length}</span>
        ) : null}
      </button>
      {buildsOpen ? (
        <>
          <div
            aria-label={t("files_resize_built_gametypes_pane")}
            aria-orientation="horizontal"
            aria-valuemax={BUILDS_PANE_MAX_HEIGHT}
            aria-valuemin={BUILDS_PANE_MIN_HEIGHT}
            aria-valuenow={buildsHeight}
            className="files-builds-resizer"
            onPointerDown={onBuildsResizeStart}
            role="separator"
          />
          <div className="files-builds-body" style={{ height: buildsHeight }}>
            {outputError ? (
              <FolderErrorCard
                error={outputError}
                onEditWorkspace={editWorkspace}
                path={outputPath}
                title={t("files_output_unreadable")}
              />
            ) : buildsError ? (
              <p className="files-hint files-hint--error">{buildsError}</p>
            ) : null}
            {outputError ? null : buildOutputs.length === 0 && !buildsError ? (
              <div className="files-empty files-empty--compact">
                <p>{t("files_no_built_gametypes_yet")}</p>
                <span>{t("files_use_build_hint")}</span>
              </div>
            ) : (
              <ul className="files-tree">
                {buildOutputs.map((entry) => (
                  <li className="files-tree-node" key={entry.name}>
                    <button
                      className="files-row-btn files-row-btn--built"
                      onClick={() => onClearEditor?.()}
                      onContextMenu={(event) =>
                        onContextMenu(event, entry.name)
                      }
                      title={entry.name}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className="files-chevron-spacer"
                      />
                      <BuiltGametypeGlyph />
                      <span className="files-row-label">{entry.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

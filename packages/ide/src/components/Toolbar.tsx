import { _event_error, event } from "@blamnetwork/datamine";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { type MouseEvent, useState } from "react";
import { APP_NAME } from "../app/constants";
import { GITHUB_LATEST_RELEASE_PAGE } from "../app/updateCheck";
import {
  ipcOpenDevtools,
  isTauriDebugBuild,
  openDocs,
  openExternalUrl,
} from "../desktop";
import { useMccLaunch } from "../desktop/useMccLaunch";
import type { GametypeSaveFormat } from "../gametype";
import { useT } from "../localization";
import {
  navigateBack,
  navigateForward,
  selectCanNavigateBack,
  selectCanNavigateForward,
  useDocument,
} from "../stores/documentStore";
import { useSettings } from "../stores/settingsStore";
import { AboutDialog } from "./dialogs/AboutDialog";
import { SaveAsMenu } from "./SaveAsMenu";
import { SettingsMenu } from "./SettingsMenu";
import { WindowControls } from "./WindowControls";

const showDevtoolsButton = isTauriDebugBuild();

interface Props {
  canBuild: boolean;
  /** False for object lists and other non-compilable text. */
  canExport?: boolean;
  fileName: string | null;
  onBuild: () => void;
  onCompile: (format: GametypeSaveFormat) => void;
  onShowMotd: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

export function Toolbar({
  onBuild,
  onCompile,
  canBuild,
  fileName,
  onShowMotd,
  canExport = true,
  sidebarOpen,
  onToggleSidebar,
}: Props) {
  const t = useT();
  const workspace = useSettings((state) => state.activeWorkspace);
  const canNavigateBack = useDocument(selectCanNavigateBack);
  const canNavigateForward = useDocument(selectCanNavigateForward);
  const [aboutOpen, setAboutOpen] = useState(false);
  const {
    frameless,
    handleLaunch,
    launchCommand,
    launchUnavailable,
    launching,
    mccInstalled,
    showCustomLaunch,
    showMccLaunch,
  } = useMccLaunch({ workspace });

  const handleTitlebarDoubleClick = (event: MouseEvent<HTMLElement>) => {
    if (!frameless) {
      return;
    }
    const target = event.target as HTMLElement;
    if (
      target.closest(
        "button, select, a, dialog, .window-controls, .toolbar-menu, .settings-menu, .save-as-menu"
      )
    ) {
      return;
    }
    void getCurrentWindow().toggleMaximize();
  };

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: double-click on the title bar maximizes, as in native windows; the window controls offer the same by keyboard. */}
      <header
        className={`toolbar${frameless ? " toolbar--frameless" : ""}`}
        data-tauri-drag-region={frameless ? true : undefined}
        onDoubleClick={handleTitlebarDoubleClick}
      >
        <div className="toolbar-leading">
          <button
            className="brand"
            onClick={() => setAboutOpen(true)}
            title={t("toolbar_about")}
            type="button"
          >
            <img
              alt=""
              className="brand-icon"
              src={`${import.meta.env.BASE_URL}megacrow-icon.png`}
            />
            <span className="brand-text">
              <span className="brand-title">{APP_NAME}</span>
              <span className="brand-subtitle">
                {t("toolbar_brand_subtitle")}
              </span>
            </span>
          </button>

          <div aria-hidden="true" className="toolbar-divider" />

          <button
            aria-label={
              sidebarOpen
                ? t("toolbar_hide_left_pane")
                : t("toolbar_show_left_pane")
            }
            aria-pressed={sidebarOpen}
            className="toolbar-menu"
            onClick={onToggleSidebar}
            title={
              sidebarOpen
                ? t("toolbar_hide_left_pane")
                : t("toolbar_show_left_pane")
            }
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16">
              <rect
                fill="none"
                height="11.5"
                rx="1.25"
                stroke="currentColor"
                strokeWidth="1.25"
                width="12.5"
                x="1.75"
                y="2.25"
              />
              <path d="M6 2.25v11.5" stroke="currentColor" strokeWidth="1.25" />
              <rect
                fill="currentColor"
                height="10"
                opacity={sidebarOpen ? 0.85 : 0.35}
                width="3"
                x="2.5"
                y="3"
              />
            </svg>
          </button>

          {/* biome-ignore lint/a11y/useSemanticElements: a labelled group of toolbar buttons, not a form fieldset. */}
          <div
            aria-label={t("toolbar_file_history")}
            className="toolbar-nav"
            role="group"
          >
            <button
              aria-label={t("toolbar_back")}
              className="toolbar-menu"
              disabled={!canNavigateBack}
              onClick={navigateBack}
              title={t("toolbar_back")}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 16 16">
                <path
                  d="M9.75 3.25 5 8l4.75 4.75"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.35"
                />
              </svg>
            </button>
            <button
              aria-label={t("toolbar_forward")}
              className="toolbar-menu"
              disabled={!canNavigateForward}
              onClick={navigateForward}
              title={t("toolbar_forward")}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 16 16">
                <path
                  d="M6.25 3.25 11 8l-4.75 4.75"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.35"
                />
              </svg>
            </button>
          </div>

          <nav
            aria-label={t("toolbar_editor_actions")}
            className="toolbar-actions"
          >
            {frameless ? (
              <span
                title={
                  showCustomLaunch
                    ? t("toolbar_launch_halo_custom_title", {
                        command: launchCommand,
                      })
                    : launchUnavailable
                      ? t("toolbar_launch_halo_needs_command")
                      : mccInstalled
                        ? t("toolbar_launch_halo_title")
                        : t("toolbar_launch_halo_missing")
                }
              >
                <button
                  className="toolbar-btn toolbar-btn--launch"
                  disabled={
                    launching ||
                    launchUnavailable ||
                    (showMccLaunch && !mccInstalled)
                  }
                  onClick={() => void handleLaunch()}
                  type="button"
                >
                  {launching
                    ? t("toolbar_launching")
                    : t("toolbar_launch_halo")}
                </button>
              </span>
            ) : null}

            {frameless && workspace?.outputPath?.trim() ? (
              <button
                className="toolbar-btn toolbar-btn--primary"
                disabled={!canBuild}
                onClick={onBuild}
                title={
                  canBuild
                    ? t("toolbar_build_title")
                    : t("toolbar_build_need_script")
                }
                type="button"
              >
                {t("toolbar_build")}
              </button>
            ) : null}
            <SaveAsMenu
              disabled={!(fileName && canExport)}
              onSave={onCompile}
            />
          </nav>
        </div>

        <div
          className="toolbar-center"
          title={
            workspace?.name && fileName
              ? `${workspace.name} | ${fileName}`
              : (workspace?.name ?? fileName ?? undefined)
          }
        >
          {workspace?.name ? (
            <span className="toolbar-center-workspace">{workspace.name}</span>
          ) : null}
          {workspace?.name && fileName ? (
            <span aria-hidden="true" className="toolbar-center-sep">
              |
            </span>
          ) : null}
          {fileName ? (
            <span className="toolbar-center-file">{fileName}</span>
          ) : null}
        </div>

        <div className="toolbar-trailing">
          {frameless ? null : (
            <button
              aria-label={t("toolbar_download_title")}
              className="toolbar-btn toolbar-btn--download"
              onClick={() => {
                void openExternalUrl(GITHUB_LATEST_RELEASE_PAGE);
              }}
              title={t("toolbar_download_title")}
              type="button"
            >
              {t("toolbar_download")}
            </button>
          )}
          {showDevtoolsButton ? (
            <button
              aria-label={t("toolbar_devtools_title")}
              className="toolbar-menu toolbar-menu--label"
              onClick={() => {
                void ipcOpenDevtools().catch((error) => {
                  event(
                    _event_error,
                    "ide:desktop: Failed to open DevTools: %s",
                    String(error)
                  );
                });
              }}
              title={t("toolbar_devtools_title")}
              type="button"
            >
              {t("toolbar_devtools")}
            </button>
          ) : null}
          <button
            aria-label={t("toolbar_docs_title")}
            className="toolbar-menu toolbar-menu--label"
            onClick={() => {
              void openDocs().catch((error) => {
                event(
                  _event_error,
                  "ide:desktop: Failed to open docs: %s",
                  String(error)
                );
              });
            }}
            title={t("toolbar_docs_title")}
            type="button"
          >
            {t("toolbar_docs")}
          </button>
          <SettingsMenu />
          <WindowControls />
        </div>
      </header>

      <AboutDialog
        onClose={() => setAboutOpen(false)}
        onVersionClick={onShowMotd}
        open={aboutOpen}
      />
    </>
  );
}

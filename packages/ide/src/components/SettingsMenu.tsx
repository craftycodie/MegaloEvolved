import { _event_warning, event } from "@blamnetwork/datamine";
import { useRef, useState } from "react";
import { APP_NAME } from "../app/constants";
import { DOCS_PATHS, isTauriRuntime, openDocs } from "../desktop";
import { IDE_LOCALE_NAMES, IDE_LOCALES, useT } from "../localization";
import { EDITOR_THEME_OPTIONS } from "../monaco/theme";
import { updateAppSettings, useSettings } from "../stores/settingsStore";
import { Dialog } from "../ui/Dialog";
import type { AppSettings, CompilerProfile } from "../workspace";
import { DocsHelpButton } from "./DocsHelpButton";

function onChange(patch: Partial<AppSettings>): void {
  updateAppSettings(patch).catch(() => {
    // Logged by the settings store.
  });
}

/** Settings button and dialog; reads and writes the settings store. */
export function SettingsMenu() {
  const settings = useSettings((state) => state.appSettings);
  const t = useT();
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="settings-menu">
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t("settings_aria")}
        className="toolbar-menu toolbar-menu--label"
        onClick={() => setOpen(true)}
        title={t("settings_title")}
        type="button"
      >
        {t("settings_title")}
      </button>

      <Dialog
        aria-labelledby="settings-modal-title"
        className="settings-modal"
        initialFocusRef={closeButtonRef}
        onClose={() => setOpen(false)}
        open={open}
      >
        <div className="settings-modal-title-row">
          <h2 className="settings-modal-title" id="settings-modal-title">
            {t("settings_title")}
          </h2>
          <DocsHelpButton
            label={t("docs_open_settings")}
            path={DOCS_PATHS.settings}
          />
        </div>
        <div className="settings-modal-body">
          <section
            aria-labelledby="settings-compiler-heading"
            className="settings-section"
          >
            <h3
              className="settings-section-title"
              id="settings-compiler-heading"
            >
              {t("settings_compiler_heading")}
            </h3>

            <label className="settings-field">
              <span className="settings-toggle-text">
                <span className="settings-toggle-label">
                  {t("settings_gametype_author")}
                </span>
                <span className="settings-toggle-hint">
                  {t("settings_gametype_author_hint")}
                </span>
              </span>
              <input
                className="settings-input"
                maxLength={16}
                onChange={(event) => onChange({ gamertag: event.target.value })}
                placeholder={t("settings_gamertag_placeholder")}
                spellCheck={false}
                type="text"
                value={settings.gamertag}
              />
            </label>

            <label className="settings-field">
              <span className="settings-toggle-text">
                <span className="settings-toggle-label">
                  {t("settings_compiler_profile")}
                </span>
                <span className="settings-toggle-hint">
                  {t("settings_compiler_profile_hint")}
                </span>
              </span>
              <select
                className="settings-select"
                onChange={(event) =>
                  onChange({
                    compilerProfile: event.target.value as CompilerProfile,
                  })
                }
                value={settings.compilerProfile}
              >
                <option value="megacrow">{APP_NAME}</option>
                <option value="megaloedit">MegaloEdit</option>
              </select>
            </label>

            {settings.compilerProfile === "megaloedit" ? (
              <div className="settings-warning-card" role="note">
                <p className="settings-warning-card-text">
                  {t("settings_megaloedit_warning_before")}
                  <button
                    aria-label={t("docs_open_megalo_headaches")}
                    className="settings-warning-card-link"
                    onClick={() => {
                      void openDocs(DOCS_PATHS.megaloHeadaches).catch(
                        (error: unknown) => {
                          event(
                            _event_warning,
                            "ide:desktop: Failed to open docs page %s: %s",
                            DOCS_PATHS.megaloHeadaches,
                            String(error)
                          );
                        }
                      );
                    }}
                    type="button"
                  >
                    {t("settings_megaloedit_warning_link")}
                  </button>
                  {t("settings_megaloedit_warning_after")}
                </p>
              </div>
            ) : null}

            <label className="settings-toggle">
              <input
                checked={settings.compilerStrictness}
                onChange={(event) =>
                  onChange({ compilerStrictness: event.target.checked })
                }
                type="checkbox"
              />
              <span className="settings-toggle-text">
                <span className="settings-toggle-label">
                  {t("settings_compiler_strictness")}
                </span>
                <span className="settings-toggle-hint">
                  {t("settings_compiler_strictness_hint")}
                </span>
              </span>
            </label>
          </section>

          <section
            aria-labelledby="settings-editor-heading"
            className="settings-section"
          >
            <h3 className="settings-section-title" id="settings-editor-heading">
              {t("settings_editor_heading")}
            </h3>

            <label className="settings-field">
              <span className="settings-toggle-text">
                <span className="settings-toggle-label">
                  {t("settings_language")}
                </span>
                <span className="settings-toggle-hint">
                  {t("settings_language_hint")}
                </span>
              </span>
              <select
                className="settings-select"
                onChange={(event) =>
                  onChange({
                    locale: event.target.value === "ja" ? "ja" : "en",
                  })
                }
                value={settings.locale}
              >
                {IDE_LOCALES.map((locale) => (
                  <option key={locale} value={locale}>
                    {IDE_LOCALE_NAMES[locale]}
                  </option>
                ))}
              </select>
            </label>

            <label className="settings-field">
              <span className="settings-toggle-text">
                <span className="settings-toggle-label">
                  {t("settings_editor_theme")}
                </span>
                <span className="settings-toggle-hint">
                  {t("settings_editor_theme_hint")}
                </span>
              </span>
              <select
                className="settings-select"
                onChange={(event) =>
                  onChange({ editorTheme: event.target.value })
                }
                value={settings.editorTheme}
              >
                {EDITOR_THEME_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {isTauriRuntime() ? (
              <label className="settings-toggle">
                <input
                  checked={settings.discordRichPresence}
                  onChange={(event) =>
                    onChange({ discordRichPresence: event.target.checked })
                  }
                  type="checkbox"
                />
                <span className="settings-toggle-text">
                  <span className="settings-toggle-label">
                    {t("settings_discord")}
                  </span>
                  <span className="settings-toggle-hint">
                    {t("settings_discord_hint")}
                  </span>
                </span>
              </label>
            ) : null}
          </section>
        </div>

        <div className="settings-modal-footer">
          <button
            className="settings-modal-close"
            onClick={() => setOpen(false)}
            ref={closeButtonRef}
            type="button"
          >
            {t("common_close")}
          </button>
        </div>
      </Dialog>
    </div>
  );
}

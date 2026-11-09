import { APP_NAME } from "../app/constants";
import {
  DEFAULT_EDITOR_THEME_ID,
  normalizeEditorThemeId,
} from "../monaco/theme";

export type UiLocale = "en" | "ja";

/** MegaloEvolved enables product extensions; MegaloEdit matches stock MegaloEdit. */
export type CompilerProfile = "megacrow" | "megaloedit";

export interface AppSettings {
  compilerProfile: CompilerProfile;
  compilerStrictness: boolean;
  discordRichPresence: boolean;
  editorTheme: string;
  /** When true, wrap long lines; when false, use horizontal scroll. */
  editorWordWrap: boolean;
  /** Creator written into the gametype (max 16 chars). */
  gamertag: string;
  /** Diagnostics / hover language (`en` or `ja`). */
  locale: UiLocale;
  skippedUpdateVersion: string | null;
}

const STORAGE_KEY = "megacrow_settings";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  discordRichPresence: true,
  gamertag: APP_NAME,
  compilerStrictness: false,
  compilerProfile: "megacrow",
  editorTheme: DEFAULT_EDITOR_THEME_ID,
  editorWordWrap: true,
  locale: "en",
  skippedUpdateVersion: null,
};

export function normalizeUiLocale(value: unknown): UiLocale {
  return value === "ja" ? "ja" : "en";
}

export function normalizeCompilerProfile(value: unknown): CompilerProfile {
  return value === "megaloedit" ? "megaloedit" : "megacrow";
}

/** Empty / missing author falls back to MegaloEvolved (max 16 chars on the wire). */
export function normalizeGametypeAuthor(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_APP_SETTINGS.gamertag;
  }
  const trimmed = value.trim().slice(0, 16);
  return trimmed.length > 0 ? trimmed : DEFAULT_APP_SETTINGS.gamertag;
}

/**
 * The one place app preferences are validated. Accepts anything (parsed
 * JSON, a settings file, a patched object) and fills bad or missing fields
 * with defaults.
 */
export function normalizeAppSettings(raw: unknown): AppSettings {
  const value = (typeof raw === "object" && raw !== null ? raw : {}) as Partial<
    Record<keyof AppSettings, unknown>
  >;
  const bool = (field: unknown, fallback: boolean) =>
    typeof field === "boolean" ? field : fallback;
  return {
    compilerProfile: normalizeCompilerProfile(value.compilerProfile),
    compilerStrictness: bool(
      value.compilerStrictness,
      DEFAULT_APP_SETTINGS.compilerStrictness
    ),
    discordRichPresence: bool(
      value.discordRichPresence,
      DEFAULT_APP_SETTINGS.discordRichPresence
    ),
    editorTheme: normalizeEditorThemeId(value.editorTheme),
    editorWordWrap: bool(
      value.editorWordWrap,
      DEFAULT_APP_SETTINGS.editorWordWrap
    ),
    gamertag: normalizeGametypeAuthor(value.gamertag),
    locale: normalizeUiLocale(value.locale),
    skippedUpdateVersion:
      typeof value.skippedUpdateVersion === "string"
        ? value.skippedUpdateVersion
        : null,
  };
}

export function readLocalAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizeAppSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

export function writeLocalAppSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage failures.
  }
}

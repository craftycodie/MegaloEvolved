import cloudsMidnight from "@monaco-themes/Clouds Midnight.json";
import cobalt2 from "@monaco-themes/Cobalt2.json";
import dracula from "@monaco-themes/Dracula.json";
import githubDark from "@monaco-themes/GitHub Dark.json";
import githubLight from "@monaco-themes/GitHub Light.json";
import monokai from "@monaco-themes/Monokai.json";
import nightOwl from "@monaco-themes/Night Owl.json";
import nord from "@monaco-themes/Nord.json";
import oceanicNext from "@monaco-themes/Oceanic Next.json";
import solarizedDark from "@monaco-themes/Solarized-dark.json";
import solarizedLight from "@monaco-themes/Solarized-light.json";
import tomorrowNight from "@monaco-themes/Tomorrow-Night.json";
import twilight from "@monaco-themes/Twilight.json";
import type * as MonacoApi from "monaco-editor";
import { APP_NAME } from "../app/constants";
import type { Monaco } from "../editor/monacoTypes";
import megacrowDark from "./themes/megacrow-dark.json";
import vsDark from "./themes/vs-dark.json";

interface ThemeRule {
  fontStyle?: string;
  foreground?: string;
  token: string;
}

type MonacoThemeData = MonacoApi.editor.IStandaloneThemeData;

const FALLBACK_FG = "D4D4D4";

/**
 * Megalo Monarch emits custom scopes themes do not know about.
 * Map those onto the editor foreground — do not override standard
 * semantic types (variable, enumMember, type, …).
 */
function megaloMonarchRules(base: MonacoThemeData): ThemeRule[] {
  const fg =
    base.colors?.["editor.foreground"]?.replace(/^#/, "") ?? FALLBACK_FG;

  return [
    { token: "identifier", foreground: fg },
    { token: "delimiter", foreground: fg },
    { token: "source", foreground: fg },
    // Escapes / %n placeholders — match VS-style regexp accent when theme omits it.
    { token: "string.escape", foreground: "D16969" },
  ];
}

export const DEFAULT_EDITOR_THEME_ID = "megacrow-dark";

/** Older saved settings ids → current ids. */
const THEME_ID_ALIASES: Record<string, string> = {
  "dark-plus": DEFAULT_EDITOR_THEME_ID,
};

export interface EditorThemeOption {
  data: MonacoThemeData;
  id: string;
  label: string;
}

export const EDITOR_THEME_OPTIONS: EditorThemeOption[] = [
  {
    id: "megacrow-dark",
    label: `${APP_NAME} Dark`,
    data: megacrowDark as MonacoThemeData,
  },
  { id: "vs-dark", label: "VS Dark", data: vsDark as MonacoThemeData },
  {
    id: "clouds-midnight",
    label: "Clouds Midnight",
    data: cloudsMidnight as MonacoThemeData,
  },
  { id: "cobalt2", label: "Cobalt2", data: cobalt2 as MonacoThemeData },
  { id: "dracula", label: "Dracula", data: dracula as MonacoThemeData },
  {
    id: "github-dark",
    label: "GitHub Dark",
    data: githubDark as MonacoThemeData,
  },
  {
    id: "github-light",
    label: "GitHub Light",
    data: githubLight as MonacoThemeData,
  },
  { id: "monokai", label: "Monokai", data: monokai as MonacoThemeData },
  { id: "night-owl", label: "Night Owl", data: nightOwl as MonacoThemeData },
  { id: "nord", label: "Nord", data: nord as MonacoThemeData },
  {
    id: "oceanic-next",
    label: "Oceanic Next",
    data: oceanicNext as MonacoThemeData,
  },
  {
    id: "solarized-dark",
    label: "Solarized Dark",
    data: solarizedDark as MonacoThemeData,
  },
  {
    id: "solarized-light",
    label: "Solarized Light",
    data: solarizedLight as MonacoThemeData,
  },
  {
    id: "tomorrow-night",
    label: "Tomorrow Night",
    data: tomorrowNight as MonacoThemeData,
  },
  { id: "twilight", label: "Twilight", data: twilight as MonacoThemeData },
];

const themeById = new Map(
  EDITOR_THEME_OPTIONS.map((option) => [option.id, option])
);

export function isEditorThemeId(value: string): boolean {
  return themeById.has(value);
}

export function normalizeEditorThemeId(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_EDITOR_THEME_ID;
  }
  const resolved = THEME_ID_ALIASES[value] ?? value;
  return isEditorThemeId(resolved) ? resolved : DEFAULT_EDITOR_THEME_ID;
}

/** Monaco runtime theme id (selected option is baked into this definition). */
export const MEGALO_THEME_ID = "megacrow-editor";

function baseThemeForId(themeId: string): MonacoThemeData {
  return (
    themeById.get(normalizeEditorThemeId(themeId))?.data ??
    themeById.get(DEFAULT_EDITOR_THEME_ID)!.data
  );
}

export function buildMegaloTheme(
  themeId: string = DEFAULT_EDITOR_THEME_ID
): MonacoThemeData {
  const base = baseThemeForId(themeId);
  return {
    ...base,
    inherit: true,
    base: base.base === "vs" ? "vs" : "vs-dark",
    rules: [...(base.rules ?? []), ...megaloMonarchRules(base)],
    colors: {
      ...(base.colors ?? {}),
    },
  };
}

export function defineMegaloTheme(
  monaco: Monaco,
  themeId: string = DEFAULT_EDITOR_THEME_ID
): void {
  monaco.editor.defineTheme(MEGALO_THEME_ID, buildMegaloTheme(themeId));
}

export function applyEditorTheme(
  monaco: Monaco,
  themeId: string = DEFAULT_EDITOR_THEME_ID
): void {
  defineMegaloTheme(monaco, themeId);
  monaco.editor.setTheme(MEGALO_THEME_ID);
}

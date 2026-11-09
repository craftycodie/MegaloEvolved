import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useMemo,
} from "react";
import rosetta from "rosetta";
import { FsError, type FsErrorCode } from "../files/fsErrors";
import en from "./locales/en.json";
import ja from "./locales/ja.json";

export type IdeLocale = "en" | "ja";

export const IDE_LOCALES: readonly IdeLocale[] = ["en", "ja"];

/** Each language's own name, shown untranslated in the language picker. */
export const IDE_LOCALE_NAMES: Record<IdeLocale, string> = {
  en: "English",
  ja: "日本語",
};

type LocaleCatalog = typeof en;

const i18n = rosetta<LocaleCatalog>({ en, ja });
i18n.locale("en");

export type IdeMessageKey = keyof LocaleCatalog;

export const getIdeLocale = (): IdeLocale => i18n.locale() as IdeLocale;

export const setIdeLocale = (locale: IdeLocale): void => {
  i18n.locale(locale);
};

export type TranslateParams = Record<string, string | number>;

export const translate = (
  key: IdeMessageKey,
  params?: TranslateParams
): string => i18n.t(key, params);

export type Translate = typeof translate;

/** Message keys that exist as a `_one` / `_other` pair. */
export type IdePluralKey = {
  [K in IdeMessageKey]: K extends `${infer Base}_one`
    ? `${Base}_other` extends IdeMessageKey
      ? Base
      : never
    : never;
}[IdeMessageKey];

const pluralRulesCache = new Map<string, Intl.PluralRules>();

function pluralSuffix(locale: string, count: number): "one" | "other" {
  let rules = pluralRulesCache.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRulesCache.set(locale, rules);
  }
  return rules.select(count) === "one" ? "one" : "other";
}

/** `base_one` or `base_other` for `count`; `count` is also passed as a param. */
export const translatePlural = (
  base: IdePluralKey,
  count: number,
  params?: TranslateParams,
  locale: IdeLocale = getIdeLocale()
): string =>
  i18n.t(
    `${base}_${pluralSuffix(locale, count)}`,
    { count, ...params },
    locale
  );

export const failedToCompileStatus = (errorCount: number): string =>
  translatePlural("status_failed_to_compile", Math.max(errorCount, 1));

const DISK_ERROR_KEYS = {
  delete_root: "disk_error_delete_root",
  duplicate_root: "disk_error_duplicate_root",
  invalid_file_name: "disk_error_invalid_file_name",
  invalid_folder_name: "disk_error_invalid_folder_name",
  move_into_self: "disk_error_move_into_self",
  move_onto_ancestor: "disk_error_move_onto_ancestor",
  move_root: "disk_error_move_root",
  rename_root: "disk_error_rename_root",
} as const satisfies Record<FsErrorCode, IdeMessageKey>;

const LAUNCH_ERROR_KEYS = {
  "Launching Halo MCC is only available in the desktop app":
    "launch_mcc_desktop_only",
  "Launching the game is only available in the desktop app":
    "launch_game_desktop_only",
} as const satisfies Record<string, IdeMessageKey>;

/** User-facing text for a failed file operation. */
export const translateDiskError = (error: unknown): string => {
  if (error instanceof FsError) {
    return translate(DISK_ERROR_KEYS[error.code]);
  }
  return error instanceof Error ? error.message : String(error);
};

export const translateLaunchError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  const key = LAUNCH_ERROR_KEYS[message as keyof typeof LAUNCH_ERROR_KEYS];
  return key ? translate(key) : message;
};

export interface IdeLocaleContextValue {
  locale: IdeLocale;
  /** Translate in this provider's locale; a new function per locale. */
  t: Translate;
  /** Plural form in this provider's locale. */
  tPlural: (
    base: IdePluralKey,
    count: number,
    params?: TranslateParams
  ) => string;
}

function contextValueFor(locale: IdeLocale): IdeLocaleContextValue {
  return {
    locale,
    t: (key, params) => i18n.t(key, params, locale),
    tPlural: (base, count, params) =>
      translatePlural(base, count, params, locale),
  };
}

const IdeLocaleContext = createContext<IdeLocaleContextValue | null>(null);

export function IdeLocaleProvider({
  locale,
  children,
}: {
  locale: IdeLocale;
  children: ReactNode;
}) {
  // Components translate through `t`, bound to `locale`. Code outside React
  // (and memoized helpers that call `translate`) reads the global locale, so
  // it is switched before children render, not in an effect one render late.
  // Setting it is idempotent, so doing it during render is safe.
  if (getIdeLocale() !== locale) {
    setIdeLocale(locale);
  }

  const value = useMemo(() => contextValueFor(locale), [locale]);
  return createElement(IdeLocaleContext.Provider, { value }, children);
}

export function useIdeLocale(): IdeLocaleContextValue {
  const ctx = useContext(IdeLocaleContext);
  return ctx ?? contextValueFor(getIdeLocale());
}

/** Prefer this in React components so they re-render when locale changes. */
export function useT(): Translate {
  return useIdeLocale().t;
}

/** Plural-aware translate for React components. */
export function useTPlural(): IdeLocaleContextValue["tPlural"] {
  return useIdeLocale().tPlural;
}

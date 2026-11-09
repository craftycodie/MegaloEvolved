import {
  ALL_MEGACROW_EXTENSIONS,
  DEFAULT_MEGACROW_EXTENSIONS,
  isMegaloVersionId,
  type MegacrowExtensions,
  type MegaloVersionId,
} from "@megacrow/megalo";
import type {
  AppSettings,
  CompilerProfile,
  UiLocale,
} from "../workspace/appSettings";

export interface MegaloCompileOptions {
  creatorGamertag?: string;
  includes?: {
    inputDir?: string;
    sourceDir?: string;
    outputDir?: string;
    readFile?: (path: string) => string | Promise<string>;
    exists?: (path: string) => boolean | Promise<boolean>;
  };
  strictStringLiterals?: boolean;
}

export function normalizeCreatorGamertag(tag: string): string {
  return tag.trim().slice(0, 16);
}

export interface MegaCrowCompilerSettings {
  creatorGamertag: string;
  locale: UiLocale;
  megacrowExtensions: MegacrowExtensions;
  strictStringLiterals: boolean;
}

const DEFAULT_COMPILE_VERSION_ID: MegaloVersionId = "107-mcc";

export function megacrowExtensionsForProfile(
  profile: CompilerProfile
): MegacrowExtensions {
  return profile === "megaloedit"
    ? DEFAULT_MEGACROW_EXTENSIONS
    : ALL_MEGACROW_EXTENSIONS;
}

export function compilerSettingsFromApp(
  settings: AppSettings
): MegaCrowCompilerSettings {
  return {
    creatorGamertag:
      normalizeCreatorGamertag(settings.gamertag) || "MegaloEvolved",
    locale: settings.locale,
    megacrowExtensions: megacrowExtensionsForProfile(settings.compilerProfile),
    strictStringLiterals: settings.compilerStrictness,
  };
}

const DEFAULT_COMPILER_SETTINGS: MegaCrowCompilerSettings =
  compilerSettingsFromApp({
    discordRichPresence: true,
    gamertag: "MegaloEvolved",
    compilerStrictness: false,
    compilerProfile: "megacrow",
    editorTheme: "megacrow-dark",
    editorWordWrap: true,
    locale: "en",
    skippedUpdateVersion: null,
  });

let appliedCompilerSettings: MegaCrowCompilerSettings = {
  ...DEFAULT_COMPILER_SETTINGS,
};

let compileMegaloVersionId: MegaloVersionId = DEFAULT_COMPILE_VERSION_ID;
let compileGameBuildNumber: number | undefined;

export function applyCompilerSettings(
  settings: MegaCrowCompilerSettings
): void {
  appliedCompilerSettings = settings;
}

export function setCompileMegaloVersion(versionId: MegaloVersionId): void {
  compileMegaloVersionId = isMegaloVersionId(versionId)
    ? versionId
    : DEFAULT_COMPILE_VERSION_ID;
}

export function getCompileMegaloVersion(): MegaloVersionId {
  return compileMegaloVersionId;
}

export function setCompileGameBuildNumber(
  buildNumber: number | null | undefined
): void {
  compileGameBuildNumber =
    typeof buildNumber === "number" && buildNumber > 0
      ? buildNumber
      : undefined;
}

export function getCompileGameBuildNumber(): number | undefined {
  return compileGameBuildNumber;
}

export function getCompileMegacrowExtensions(): MegacrowExtensions {
  return appliedCompilerSettings.megacrowExtensions;
}

export function getCompileStrictStringLiterals(): boolean {
  return appliedCompilerSettings.strictStringLiterals;
}

export function getCompileCreatorGamertag(): string {
  return appliedCompilerSettings.creatorGamertag;
}

export function getAppliedCompilerSettings(): MegaCrowCompilerSettings {
  return appliedCompilerSettings;
}

export function mergeMegaloCompileOptions(
  options: MegaloCompileOptions | undefined,
  compilerSettings: MegaCrowCompilerSettings = appliedCompilerSettings
): MegaloCompileOptions | undefined {
  if (!(compilerSettings || options)) {
    return;
  }
  return {
    ...options,
    creatorGamertag:
      normalizeCreatorGamertag(
        compilerSettings?.creatorGamertag ?? options?.creatorGamertag ?? ""
      ) || "MegaloEvolved",
    strictStringLiterals:
      compilerSettings?.strictStringLiterals ??
      options?.strictStringLiterals ??
      false,
  };
}

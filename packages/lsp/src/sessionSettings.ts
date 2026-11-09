import {
  ALL_MEGACROW_EXTENSIONS,
  type CompilerSettings,
  isMegaloVersionId,
  MEGALO_VERSIONS,
  type MegacrowExtensions,
  type SupportedMegaloVersion,
} from "@megacrow/megalo";

export class MegacrowSession {
  megacrowExtensions: MegacrowExtensions = ALL_MEGACROW_EXTENSIONS;
  compilerSettings: Partial<CompilerSettings> = {};
  /** `undefined` = no build (-1). */
  gameBuildNumber: number | undefined = undefined;
  megaloVersion: SupportedMegaloVersion = MEGALO_VERSIONS["107-mcc"];

  setMegacrowExtensions(extensions: MegacrowExtensions): void {
    this.megacrowExtensions = extensions;
  }

  setCompilerSettings(settings: Partial<CompilerSettings>): void {
    this.compilerSettings = settings;
  }

  setMegaloVersion(versionId: string): boolean {
    if (!isMegaloVersionId(versionId)) {
      return false;
    }
    this.megaloVersion = MEGALO_VERSIONS[versionId];
    return true;
  }
}

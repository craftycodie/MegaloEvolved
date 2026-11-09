import { translate } from "src/localization";

type MegaloFlavour = undefined | "mcc";

export interface MegaloVersion {
  flavour?: MegaloFlavour;
  version: number;
}

function version<const V extends number>(
  v: V
): { version: V; flavour: undefined };
function version<const V extends number, const F extends MegaloFlavour>(
  v: V,
  flavour: F
): { version: V; flavour: F };
function version(v: number, flavour?: MegaloFlavour): MegaloVersion {
  return { version: v, flavour };
}

export const MEGALO_VERSIONS = {
  // Halo: Reach
  "107-mcc": version(107, "mcc"), // December 3rd 2019 - MCC
  "107": version(107), // August 24th 2011 - 360 TU1
  "106": version(106), // July 24th 2010 - 360 Release
  "73": version(73), // May 2010 - 360 Beta
  //"69": version(69),                // March 9th 2010 - Digsite Leak - rover.mglo
  "49": version(49), // February 2010 - 360 Alpha
  //"41": version(41),                // January/February 2010 - Digsite Leak - ctf_pro.mglo
  //"32": version(32),                // December 2009 - Digsite Leak - ctf-2flag.mglo
};

export type MegaloVersionId =
  `${Exclude<keyof typeof MEGALO_VERSIONS, symbol>}`;

export type SupportedMegaloVersion =
  (typeof MEGALO_VERSIONS)[keyof typeof MEGALO_VERSIONS];

export function isMegaloVersionId(value: string): value is MegaloVersionId {
  return Object.hasOwn(MEGALO_VERSIONS, value);
}

export function isMccMegaloVersion(id: MegaloVersionId): boolean {
  return MEGALO_VERSIONS[id].flavour === "mcc";
}

/** Game title for a Megalo version (e.g. Halo: Reach). */
export function getGameName(_version: SupportedMegaloVersion): string {
  // All currently supported encodings are Halo: Reach builds.
  return translate("version_game_halo_reach");
}

/** Compact build tag (e.g. MCC, TU 1, Beta). */
export function getShortDescription({
  version,
  flavour,
}: SupportedMegaloVersion): string {
  switch (version) {
    case 107:
      switch (flavour) {
        case "mcc":
          return translate("version_short_107_mcc");
        default:
          return translate("version_short_107");
      }
    case 106:
      return translate("version_short_106");
    case 73:
      return translate("version_short_73");
    case 49:
      return translate("version_short_49");
    default: {
      const _exhaustive: never = version;
      throw new Error(`Unsupported version: ${_exhaustive}`);
    }
  }
}

/** Longer build name (e.g. The Master Chief Collection, Title Update 1). */
export function getFullDescription({
  version,
  flavour,
}: SupportedMegaloVersion): string {
  switch (version) {
    case 107:
      switch (flavour) {
        case "mcc":
          return translate("version_full_107_mcc");
        default:
          return translate("version_full_107");
      }
    case 106:
      return translate("version_full_106");
    case 73:
      return translate("version_full_73");
    case 49:
      return translate("version_full_49");
    default: {
      const _exhaustive: never = version;
      throw new Error(`Unsupported version: ${_exhaustive}`);
    }
  }
}

/**
 * Localized human-readable label: "{game} - {full description}".
 * Prefer {@link getGameName} / {@link getShortDescription} / {@link getFullDescription}
 * when composing UI.
 */
export function getLabel(version: SupportedMegaloVersion): string {
  return `${getGameName(version)} - ${getFullDescription(version)}`;
}

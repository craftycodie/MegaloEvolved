import type { MegaloVersionId } from "@megacrow/megalo";
import {
  getFullDescription,
  getGameName,
  getLabel,
  getShortDescription,
  MEGALO_VERSIONS,
} from "@megacrow/megalo";
import { DEFAULT_MEGALO_VERSION } from "../app/constants";

export function getVersionInfo(
  version: MegaloVersionId = DEFAULT_MEGALO_VERSION
) {
  const info = MEGALO_VERSIONS[version];
  return {
    id: version,
    /** Compact build tag from `@megacrow/megalo` (e.g. MCC, TU 1). */
    label: getShortDescription(info),
    /** Localized "{game} - {full description}". */
    fullLabel: getLabel(info),
    gameName: getGameName(info),
    shortDescription: getShortDescription(info),
    fullDescription: getFullDescription(info),
    encoding: info.version,
  };
}

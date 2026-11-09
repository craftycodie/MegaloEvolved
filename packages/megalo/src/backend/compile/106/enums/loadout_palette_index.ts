import {
  LoadoutPaletteType,
  type LoadoutPaletteType as LoadoutPaletteTypeName,
} from "src/frontend/intermediate-representation/game/megalogamengine/loadoutPaletteType";
import { mapMegaloEnum } from "src/frontend/intermediate-representation/megaloEnum";

/**
 * `m_loadout_palette_index` values (`none` = -1). BLF writes index + 1 on the
 * wire, so `none` encodes as 0.
 */
const LOADOUT_PALETTE_INDEX = {
  [LoadoutPaletteType.none]: -1,
  [LoadoutPaletteType.spartan_tier1]: 0,
  [LoadoutPaletteType.elite_tier1]: 1,
  [LoadoutPaletteType.spartan_tier2]: 2,
  [LoadoutPaletteType.elite_tier2]: 3,
  [LoadoutPaletteType.spartan_tier3]: 4,
  [LoadoutPaletteType.elite_tier3]: 5,
} as const satisfies Record<LoadoutPaletteTypeName, number>;

export const encodeLoadoutPaletteIndex = (
  value: LoadoutPaletteTypeName
): number => mapMegaloEnum(value, LOADOUT_PALETTE_INDEX);

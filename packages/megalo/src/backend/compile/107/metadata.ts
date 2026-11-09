import {
  type c_game_engine_custom_variant,
  e_file_type,
  e_game_engine_type,
  e_game_mode,
  e_gui_game_mode,
} from "@blamnetwork/blf/haloreach/v12065_11_08_24_1738_tu1actual";
import { encodeGameEngineCategory } from "src/backend/compile/107/enums/e_game_engine_category";
import { assignContentUniqueIds } from "src/backend/compile/contentUniqueIds";
import type { IR } from "src/frontend/intermediate-representation";

function applyHistory(
  target: {
    timestamp: Date;
    xuid: bigint;
    name: string;
    is_online: boolean;
  },
  source: {
    timestamp: Date;
    xuid: bigint;
    name: string;
    isOnline: boolean;
  }
): void {
  target.timestamp = source.timestamp;
  target.xuid = source.xuid;
  target.name = source.name;
  target.is_online = source.isOnline;
}

export const compileMetadata = (
  ir: IR,
  gameVariant: c_game_engine_custom_variant
): void => {
  const variant = ir.gameVariant;
  const metadata = gameVariant.m_base_variant.m_metadata;
  const irMetadata = variant.baseVariant.metadata;

  metadata.general.file_type = e_file_type.GameVariant;
  metadata.general.activity = e_gui_game_mode.multiplayer;
  metadata.general.game_mode = e_game_mode.multiplayer;
  metadata.general.game_engine_type = e_game_engine_type.megalogamengine;
  assignContentUniqueIds(metadata.general);

  const fileTypeData =
    metadata.file_type_data !== null && "icon_index" in metadata.file_type_data
      ? metadata.file_type_data
      : { icon_index: 0 };
  metadata.file_type_data = fileTypeData;

  if (variant.engineIcon !== undefined) {
    gameVariant.m_engine_icon = variant.engineIcon;
    fileTypeData.icon_index = variant.engineIcon;
  }

  if (variant.engineCategory !== undefined) {
    const engineCategory = encodeGameEngineCategory(variant.engineCategory);
    gameVariant.m_engine_category = engineCategory;
    metadata.display.megalo_category_index = engineCategory;
  }

  if (irMetadata.name !== undefined) {
    metadata.name = irMetadata.name;
  }
  if (irMetadata.description !== undefined) {
    metadata.description = irMetadata.description;
  }

  applyHistory(metadata.creation_history, irMetadata.creationHistory);
  applyHistory(metadata.modification_history, irMetadata.modificationHistory);
};

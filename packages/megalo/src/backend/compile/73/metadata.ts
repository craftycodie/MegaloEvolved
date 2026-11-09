import type { c_game_engine_custom_variant } from "@blamnetwork/blf/haloreach/v09730_10_04_09_1309_omaha_delta";
import {
  e_file_type,
  e_game_engine_type,
  e_game_mode,
  e_gui_game_mode,
} from "@blamnetwork/blf/haloreach/v12065_11_08_24_1738_tu1actual";
import { encodeGameEngineCategory } from "src/backend/compile/73/enums/e_game_engine_category";
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
    metadata.display.megalo_category_index = encodeGameEngineCategory(
      variant.engineCategory
    );
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

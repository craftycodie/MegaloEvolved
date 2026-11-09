import {
  type c_game_engine_custom_variant,
  c_object_filter,
  c_object_type_reference,
} from "@blamnetwork/blf/haloreach/v12065_11_08_24_1738_tu1actual";
import { encodeObjectTeamFilter } from "src/backend/compile/107/enums/e_object_team_filter";
import { BUILT_IN_LOCATION, type Diagnostics } from "src/diagnostics";
import { diagnosticMessages } from "src/diagnostics/messages";
import type { IR } from "src/frontend/intermediate-representation";
import type { ObjectFilter } from "src/frontend/intermediate-representation/game/megalogamengine/megalogamengine_map_objects";

const MAX_OBJECT_FILTERS = 16;
const MIN_USER_DATA = -0x8000;
const MAX_USER_DATA = 0x7fff;
const MAX_MIN = 0x7f;

const compileObjectFilter = (filter: ObjectFilter): c_object_filter => {
  const target = new c_object_filter();
  if (filter.label !== undefined) {
    // String index; BLF writes it 1-based on the wire (0 = no label).
    target.m_label_string_index = filter.label;
  }
  if (filter.objectType !== undefined) {
    target.m_valid_parameters.object_type = true;
    const objectType = new c_object_type_reference();
    objectType.m_object_type_index = filter.objectType;
    target.m_object_type = objectType;
  }
  if (filter.team !== undefined) {
    target.m_valid_parameters.team = true;
    target.m_team = encodeObjectTeamFilter(filter.team);
  }
  if (filter.userData !== undefined) {
    target.m_valid_parameters.user_data = true;
    target.m_user_data = filter.userData;
  }
  if (filter.min !== undefined) {
    target.m_min = filter.min;
  }
  return target;
};

export const compileMapObjects = (
  ir: IR,
  gameVariant: c_game_engine_custom_variant,
  diagnostics: Diagnostics
): void => {
  const { objectFilters, objectsUsed } = ir.gameVariant.gameEngine;

  if (objectFilters.length > MAX_OBJECT_FILTERS) {
    diagnostics.addError(
      diagnosticMessages.tooManyObjectFilters(),
      BUILT_IN_LOCATION
    );
  }

  for (const filter of objectFilters) {
    if (
      filter.userData !== undefined &&
      (filter.userData < MIN_USER_DATA || filter.userData > MAX_USER_DATA)
    ) {
      diagnostics.addError(
        diagnosticMessages.outOfRange(
          "object filter user_data",
          MIN_USER_DATA,
          MAX_USER_DATA
        ),
        BUILT_IN_LOCATION
      );
    }
    if (filter.min !== undefined && (filter.min < 0 || filter.min > MAX_MIN)) {
      diagnostics.addError(
        diagnosticMessages.outOfRange("object filter min", 0, MAX_MIN),
        BUILT_IN_LOCATION
      );
    }
  }

  gameVariant.m_game_engine.m_object_filters = objectFilters
    .slice(0, MAX_OBJECT_FILTERS)
    .map(compileObjectFilter);

  for (let index = 0; index < objectsUsed.length; index++) {
    if (objectsUsed[index] !== true) {
      continue;
    }
    gameVariant.m_game_engine.m_objects_used[index] = true;
  }
};

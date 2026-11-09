import {
  type c_game_engine_custom_variant,
  type c_game_engine_team_options_team,
  e_multiplayer_team_designator,
  k_game_variant_team_count,
} from "@blamnetwork/blf/haloreach_mcc/v_untracked_25_08_16_1352";
import { encodeDesignatorSwitchType } from "src/backend/compile/107-mcc/enums/e_game_engine_team_options_designator_switch_type";
import { encodeTeamOptionsModelOverrideType } from "src/backend/compile/107-mcc/enums/e_game_engine_team_options_model_override_type";
import { encodeMultiplayerTeamDesignator } from "src/backend/compile/107-mcc/enums/e_multiplayer_team_designator";
import { encodePlayerModelChoice } from "src/backend/compile/107-mcc/enums/e_player_model_choice";
import { BUILT_IN_LOCATION, type Diagnostics } from "src/diagnostics";
import { diagnosticMessages } from "src/diagnostics/messages";
import type { IR } from "src/frontend/intermediate-representation";
import {
  type Color,
  type GameEngineTeamOptionsTeam,
  TeamOptionsModelOverrideType,
} from "src/frontend/intermediate-representation/game/game_engine_default";
import { STRING_TABLE_LANGUAGES } from "src/frontend/language-configuration/omni/strings";

/** Pack an RGB {@link Color} into the 0xFFRRGGBB integer the compiled format uses. */
const encodeColor = (color: Color): number =>
  (0xff << 24) |
  ((color.r & 0xff) << 16) |
  ((color.g & 0xff) << 8) |
  (color.b & 0xff);

const emptyTeamNameStrings = (): (string | null)[][] =>
  STRING_TABLE_LANGUAGES.map(() => []);

const compileTeamNameTable = (
  name: NonNullable<GameEngineTeamOptionsTeam["name"]>
): (string | null)[][] => {
  // MegaloEdit repeats the English team name in every language slot
  const english =
    name.english ??
    STRING_TABLE_LANGUAGES.map((language) => name[language]).find(
      (value): value is string => typeof value === "string" && value.length > 0
    ) ??
    "";
  return STRING_TABLE_LANGUAGES.map(() => [english]);
};

const compileTeamOption = (
  target: c_game_engine_team_options_team,
  team: GameEngineTeamOptionsTeam,
  teamIndex: number
): void => {
  target.m_flags.team_enabled = true;
  if (team.designator === undefined) {
    // Missing designator defaults to the team slot index.
    target.m_team_initial_designator = teamIndex;
  } else {
    target.m_team_initial_designator = encodeMultiplayerTeamDesignator(
      team.designator
    );
  }
  if (team.model !== undefined) {
    target.m_model_override = encodePlayerModelChoice(team.model);
  }
  if (team.fireteamCount !== undefined) {
    target.m_fireteam_count = team.fireteamCount;
  }
  if (team.teamColor !== undefined) {
    target.m_flags.override_color_armour = true;
    target.m_team_color_override = encodeColor(team.teamColor);
  }
  if (team.name !== undefined) {
    // Team names live in the per-team string table, not the script strings.
    target.m_name.strings = compileTeamNameTable(team.name);
  }
};

export const compileTeams = (
  ir: IR,
  gameVariant: c_game_engine_custom_variant,
  diagnostics: Diagnostics
): void => {
  const teamOptions = gameVariant.m_base_variant.m_team_options;
  const irTeamOptions = ir.gameVariant.baseVariant.teamOptions;
  const irTeams = irTeamOptions.teams;
  const modelOverride =
    irTeams?.some((team) => team.model !== undefined) === true
      ? TeamOptionsModelOverrideType.set_by_team
      : irTeamOptions.model;
  if (modelOverride !== undefined) {
    teamOptions.m_model_override =
      encodeTeamOptionsModelOverrideType(modelOverride);
  }
  if (irTeamOptions.designatorSwitchType !== undefined) {
    teamOptions.m_designator_switch_type = encodeDesignatorSwitchType(
      irTeamOptions.designatorSwitchType
    );
  }
  if (irTeams === undefined || irTeams.length === 0) {
    return;
  }
  if (irTeams.length > k_game_variant_team_count) {
    diagnostics.addError(
      diagnosticMessages.tooManyTeamEntries(),
      BUILT_IN_LOCATION
    );
  }
  // First authored team entry clears the default enabled slots (ManagedMegalo).
  for (const target of teamOptions.m_teams) {
    target.m_flags.team_enabled = false;
    target.m_team_initial_designator = e_multiplayer_team_designator.none;
    target.m_name.strings = emptyTeamNameStrings();
  }
  irTeams.slice(0, k_game_variant_team_count).forEach((team, index) => {
    const target = teamOptions.m_teams[index];
    if (target !== undefined) {
      compileTeamOption(target, team, index);
    }
  });
};

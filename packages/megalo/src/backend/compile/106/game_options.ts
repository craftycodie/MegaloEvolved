import {
  type c_game_engine_custom_variant,
  k_game_variant_parameter_flags,
  type s_game_variant_parameter_flags,
  s_player_trait_option,
  s_user_defined_option,
  s_user_defined_option_value,
} from "@blamnetwork/blf/haloreach/v11860_10_07_24_0147_omaha_release";
import { encodeTeamScoringMethod } from "src/backend/compile/106/enums/e_team_scoring_method";
import { encodePlayerTraits } from "src/backend/compile/106/player_traits";
import { type Diagnostics, UNKNOWN_LOCATION } from "src/diagnostics";
import { diagnosticMessages } from "src/diagnostics/messages";
import type {
  IR,
  PlayerTraitOptionOverride,
  UserDefinedOptionOverride,
} from "src/frontend/intermediate-representation";
import type {
  VehicleSet,
  WeaponSet,
} from "src/frontend/intermediate-representation/game/game_engine_default";
import type { PlayerTraits } from "src/frontend/intermediate-representation/game/game_engine_player_traits";
import type {
  RangedUserDefinedOption,
  UserDefinedOption,
  UserDefinedOptionValue,
} from "src/frontend/intermediate-representation/game/megalogamengine/megalogamengine_user_defined_options";
import type { BuiltInGameOptionFlags } from "src/frontend/intermediate-representation/game/parameters";

const encodeWeaponSet = (value: WeaponSet): number => {
  switch (value) {
    case "none":
      return -1;
    case "default":
      return -2;
    case "random":
      return -3;
    default:
      return Number(value);
  }
};

const encodeVehicleSet = (value: VehicleSet): number => {
  switch (value) {
    case "none":
      return -1;
    case "default":
      return -2;
    case "random":
      return -3;
    default:
      return Number(value);
  }
};

type ParameterFlagKey = (typeof k_game_variant_parameter_flags)[number];

const snakeToCamel = (name: string): string =>
  name.replace(/_([a-z0-9])/g, (_match, char: string) => char.toUpperCase());

/** BLF snake_case flag → IR camelCase key (same naming convention as parameters.ts). */
const parameterFlagToIrKey = (
  snakeKey: ParameterFlagKey
): keyof BuiltInGameOptionFlags =>
  snakeToCamel(snakeKey) as keyof BuiltInGameOptionFlags;

/**
 * Copy the presence-based lock/hide flag overrides from the IR onto a BLF
 * bitfield. The IR keys are the camelCase equivalents of the BLF snake_case
 * flag names, and both lists share the same ordering.
 */
const applyParameterFlags = (
  target: s_game_variant_parameter_flags,
  flags: BuiltInGameOptionFlags
): void => {
  for (const snakeKey of k_game_variant_parameter_flags) {
    const value = flags[parameterFlagToIrKey(snakeKey)];
    if (value !== undefined) {
      target[snakeKey] = value;
    }
  }
};

const compilePlayerTraitOption = (
  name: number,
  description: number,
  traits: PlayerTraits
): s_player_trait_option => {
  const option = new s_player_trait_option();
  option.m_name_string_index = name;
  option.m_description_string_index = description;
  encodePlayerTraits(option.m_player_traits, traits);
  return option;
};

const isRangedUserDefinedOption = (
  option: UserDefinedOption
): option is RangedUserDefinedOption => "minValue" in option;

const encodeUserDefinedOptionValue = (
  value: UserDefinedOptionValue,
  isRange: boolean
): s_user_defined_option_value => {
  const encoded = new s_user_defined_option_value();
  encoded.m_value = value.value;
  if (!isRange) {
    encoded.m_name_string_index = value.name ?? 0;
    encoded.m_description_string_index = value.description ?? 0;
  }
  return encoded;
};

const encodeUserDefinedOption = (
  option: UserDefinedOption
): s_user_defined_option => {
  const encoded = new s_user_defined_option();
  encoded.m_name_string_index = option.name ?? 0;
  encoded.m_description_string_index = option.description ?? 0;

  if (isRangedUserDefinedOption(option)) {
    encoded.m_range_default_value = encodeUserDefinedOptionValue(
      option.defaultValue,
      true
    );
    encoded.m_range_min_value = encodeUserDefinedOptionValue(
      option.minValue,
      true
    );
    encoded.m_range_max_value = encodeUserDefinedOptionValue(
      option.maxValue,
      true
    );
    encoded.m_range_current_value = option.currentValue;
  } else {
    encoded.m_default_value_index = option.defaultValueIndex;
    encoded.m_values = option.values.map((value) =>
      encodeUserDefinedOptionValue(value, false)
    );
    encoded.m_current_value_index = option.currentValueIndex;
  }

  return encoded;
};

/** Append IR-defined user options onto the (possibly base-derived) gametype. */
const compileUserDefinedOptions = (
  ir: IR,
  gameVariant: c_game_engine_custom_variant
): void => {
  const options = ir.gameVariant.userDefinedOptions;
  if (options.length === 0) {
    return;
  }

  for (const option of options) {
    const index = gameVariant.m_user_defined_options.length;
    gameVariant.m_user_defined_options.push(encodeUserDefinedOption(option));
    if (option.locked) {
      gameVariant.m_user_defined_options_locked[index] = true;
    }
    if (option.hidden) {
      gameVariant.m_user_defined_options_hidden[index] = true;
    }
  }
};

const englishOptionName = (
  gametype: c_game_engine_custom_variant,
  option: s_user_defined_option
): string | undefined => {
  const english = gametype.m_script_strings.strings[0];
  return english?.[option.m_name_string_index] ?? undefined;
};

const resolveOverrideOptionIndex = (
  gametype: c_game_engine_custom_variant,
  override: UserDefinedOptionOverride,
  diagnostics: Diagnostics
): number | undefined => {
  const options = gametype.m_user_defined_options;
  if (override.target.kind === "index") {
    const index = override.target.value;
    if (index < 0 || index >= options.length) {
      diagnostics.addError(
        `Option index ${index} was out of range [0,${options.length})`,
        override.location
      );
      return;
    }
    return index;
  }

  const index = options.findIndex(
    (option) => englishOptionName(gametype, option) === override.target.value
  );
  if (index < 0) {
    diagnostics.addError(
      `Couldn't find an option with this name => ${override.target.value}`,
      override.location
    );
    return;
  }
  return index;
};

const applyUserDefinedOptionValue = (
  option: s_user_defined_option,
  value: number,
  optionLabel: string,
  location: UserDefinedOptionOverride["location"],
  diagnostics: Diagnostics
): void => {
  if (option.m_range_default_value !== undefined) {
    const min = option.m_range_min_value?.m_value ?? Number.NEGATIVE_INFINITY;
    const max = option.m_range_max_value?.m_value ?? Number.POSITIVE_INFINITY;
    if (value < min || value > max) {
      diagnostics.addError(
        `value ${value} out of range [${min},${max}] for option ${optionLabel}`,
        location
      );
      return;
    }
    option.m_range_current_value = value;
    return;
  }

  const values = option.m_values ?? [];
  const valueIndex = values.findIndex((entry) => entry.m_value === value);
  if (valueIndex < 0) {
    diagnostics.addError(
      `value ${value} is not a valid choice for option ${optionLabel}`,
      location
    );
    return;
  }
  option.m_current_value_index = valueIndex;
};

/**
 * Apply base-derived `option "Name" value` / `option <index> value` retunes.
 * Must run against the decoded base (and its script strings) before the IR
 * string table replaces `m_script_strings`.
 */
export const applyUserDefinedOptionOverrides = (
  ir: IR,
  gametype: c_game_engine_custom_variant,
  diagnostics: Diagnostics
): void => {
  const overrides = ir.baseOverrides.userDefinedOptions;
  if (overrides.length === 0) {
    return;
  }

  for (const override of overrides) {
    const index = resolveOverrideOptionIndex(gametype, override, diagnostics);
    if (index === undefined) {
      continue;
    }

    const option = gametype.m_user_defined_options[index]!;
    const label =
      override.target.kind === "name"
        ? override.target.value
        : (englishOptionName(gametype, option) ?? String(index));

    applyUserDefinedOptionValue(
      option,
      override.value,
      label,
      override.location,
      diagnostics
    );

    if (override.locked) {
      gametype.m_user_defined_options_locked[index] = true;
    }
    if (override.hidden) {
      gametype.m_user_defined_options_hidden[index] = true;
    }
  }
};

const englishPlayerTraitName = (
  gametype: c_game_engine_custom_variant,
  option: s_player_trait_option
): string | undefined => {
  const english = gametype.m_script_strings.strings[0];
  return english?.[option.m_name_string_index] ?? undefined;
};

const resolveOverridePlayerTraitIndex = (
  gametype: c_game_engine_custom_variant,
  override: PlayerTraitOptionOverride,
  diagnostics: Diagnostics
): number | undefined => {
  const traits = gametype.m_player_traits;
  if (override.target.kind === "index") {
    const index = override.target.value;
    if (index < 0 || index >= traits.length) {
      diagnostics.addError(
        "player trait index out of range",
        override.location
      );
      return;
    }
    return index;
  }

  const wanted = override.target.value.toLowerCase();
  const index = traits.findIndex((option) => {
    const name = englishPlayerTraitName(gametype, option);
    return name !== undefined && name.toLowerCase() === wanted;
  });
  if (index < 0) {
    diagnostics.addError(
      `string '${override.target.value}' is not the name of a player trait option`,
      override.location
    );
    return;
  }
  return index;
};

export const applyPlayerTraitOptionOverrides = (
  ir: IR,
  gametype: c_game_engine_custom_variant,
  diagnostics: Diagnostics
): void => {
  const overrides = ir.baseOverrides.playerTraits;
  if (overrides.length === 0) {
    return;
  }

  for (const override of overrides) {
    const index = resolveOverridePlayerTraitIndex(
      gametype,
      override,
      diagnostics
    );
    if (index === undefined) {
      continue;
    }
    const option = gametype.m_player_traits[index]!;
    encodePlayerTraits(option.m_player_traits, override.traits);
  }
};

/** Compile the base + custom variant game options from the IR into the gametype. */
export const compileGameOptions = (
  ir: IR,
  gameVariant: c_game_engine_custom_variant,
  diagnostics: Diagnostics
): void => {
  const { gameVariant: irVariant } = ir;
  const base = gameVariant.m_base_variant;
  const {
    baseVariant,
    baseVariantParametersLocked,
    baseVariantParametersHidden,
  } = irVariant;

  if (baseVariant.teamScoringMethod !== undefined) {
    base.m_team_scoring_method = encodeTeamScoringMethod(
      baseVariant.teamScoringMethod
    );
  }

  const misc = base.m_miscellaneous_options;
  const { miscellaneousOptions } = baseVariant;
  if (miscellaneousOptions.teamsEnabled !== undefined) {
    misc.m_flags.teams_enabled = miscellaneousOptions.teamsEnabled;
  }
  if (miscellaneousOptions.roundResetPlayers !== undefined) {
    misc.m_flags.round_reset_players = miscellaneousOptions.roundResetPlayers;
  }
  if (miscellaneousOptions.roundResetMap !== undefined) {
    misc.m_flags.round_reset_map = miscellaneousOptions.roundResetMap;
  }
  if (miscellaneousOptions.perfectionEnabled !== undefined) {
    misc.m_flags.perfection_enabled = miscellaneousOptions.perfectionEnabled;
  }
  if (miscellaneousOptions.roundTimeLimitMinutes !== undefined) {
    misc.m_round_time_limit_minutes =
      miscellaneousOptions.roundTimeLimitMinutes;
  }
  if (miscellaneousOptions.roundCount !== undefined) {
    const roundCount = miscellaneousOptions.roundCount;
    if (roundCount >= 0 && roundCount <= 31) {
      misc.m_round_limit = roundCount;
    } else {
      const location =
        ir.locations.get(miscellaneousOptions, "roundCount") ??
        UNKNOWN_LOCATION;
      diagnostics.addWarning(
        diagnosticMessages.valueOutOfRangeIgnored(
          "round_count",
          roundCount,
          0,
          31
        ),
        location
      );
    }
  }
  if (miscellaneousOptions.earlyVictoryWinCount !== undefined) {
    misc.m_early_victory_win_count = miscellaneousOptions.earlyVictoryWinCount;
  }
  if (miscellaneousOptions.suddenDeathTimeLimitSeconds !== undefined) {
    misc.m_sudden_death_time = miscellaneousOptions.suddenDeathTimeLimitSeconds;
  }
  if (miscellaneousOptions.gracePeriodTimeLimitSeconds !== undefined) {
    misc.m_grace_period = miscellaneousOptions.gracePeriodTimeLimitSeconds;
  }

  const respawn = base.m_respawn_options;
  const { respawnOptions } = baseVariant;
  if (respawnOptions.inheritRespawnTime !== undefined) {
    respawn.m_flags.inherit_respawn_time = respawnOptions.inheritRespawnTime;
  }
  if (respawnOptions.respawnWithTeammate !== undefined) {
    respawn.m_flags.respawn_with_teammate = respawnOptions.respawnWithTeammate;
  }
  if (respawnOptions.respawnAtLocation !== undefined) {
    respawn.m_flags.respawn_at_location = respawnOptions.respawnAtLocation;
  }
  if (respawnOptions.respawnOnKills !== undefined) {
    respawn.m_flags.respawn_on_kills = respawnOptions.respawnOnKills;
  }
  if (respawnOptions.livesPerRound !== undefined) {
    respawn.m_lives_per_round = respawnOptions.livesPerRound;
  }
  if (respawnOptions.teamLivesPerRound !== undefined) {
    respawn.m_team_lives_per_round = respawnOptions.teamLivesPerRound;
  }
  if (respawnOptions.respawnTimeSeconds !== undefined) {
    respawn.m_respawn_time_seconds = respawnOptions.respawnTimeSeconds;
  }
  if (respawnOptions.suicidePenaltySeconds !== undefined) {
    respawn.m_suicide_penalty_seconds = respawnOptions.suicidePenaltySeconds;
  }
  if (respawnOptions.betrayalPenaltySeconds !== undefined) {
    respawn.m_betrayal_penalty_seconds = respawnOptions.betrayalPenaltySeconds;
  }
  if (respawnOptions.respawnGrowthSeconds !== undefined) {
    respawn.m_respawn_growth_seconds = respawnOptions.respawnGrowthSeconds;
  }
  if (respawnOptions.loadoutCamTime !== undefined) {
    respawn.m_loadout_cam_time = respawnOptions.loadoutCamTime;
  }
  if (respawnOptions.respawnPlayerTraitsDurationSeconds !== undefined) {
    respawn.m_respawn_player_traits_duration_seconds =
      respawnOptions.respawnPlayerTraitsDurationSeconds;
  }
  const respawnTraits = respawnOptions.respawnPlayerTraits?.[0];
  if (respawnTraits !== undefined) {
    encodePlayerTraits(respawn.m_respawn_player_traits, respawnTraits);
  }

  const social = base.m_social_options.m_flags;
  const { socialOptions } = baseVariant;
  if (socialOptions.friendlyFireEnabled !== undefined) {
    social.friendly_fire_enabled = socialOptions.friendlyFireEnabled !== 0;
  }
  if (socialOptions.betrayalBootingEnabled !== undefined) {
    social.betrayal_booting_enabled =
      socialOptions.betrayalBootingEnabled !== 0;
  }
  if (socialOptions.enemyVoiceEnabled !== undefined) {
    social.enemy_voice_enabled = socialOptions.enemyVoiceEnabled !== 0;
  }
  if (socialOptions.openChannelVoiceEnabled !== undefined) {
    social.open_channel_voice_enabled =
      socialOptions.openChannelVoiceEnabled !== 0;
  }
  if (socialOptions.deadPlayerVoiceEnabled !== undefined) {
    social.dead_player_voice_enabled =
      socialOptions.deadPlayerVoiceEnabled !== 0;
  }

  const map = base.m_map_override_options;
  const { mapOverrideOptions } = baseVariant;
  if (mapOverrideOptions.grenadesOnMap !== undefined) {
    map.m_flags.grenades_on_map = mapOverrideOptions.grenadesOnMap !== 0;
  }
  if (mapOverrideOptions.shortcutsOnMap !== undefined) {
    map.m_flags.shortcuts_on_map = mapOverrideOptions.shortcutsOnMap;
  }
  if (mapOverrideOptions.equipmentOnMap !== undefined) {
    map.m_flags.equipment_on_map = mapOverrideOptions.equipmentOnMap;
  }
  if (mapOverrideOptions.powerupsOnMap !== undefined) {
    map.m_flags.powerups_on_map = mapOverrideOptions.powerupsOnMap;
  }
  if (mapOverrideOptions.turretsOnMap !== undefined) {
    map.m_flags.turrets_on_map = mapOverrideOptions.turretsOnMap;
  }
  if (mapOverrideOptions.indestructibleVehicles !== undefined) {
    map.m_flags.indestructible_vehicles =
      mapOverrideOptions.indestructibleVehicles !== 0;
  }
  if (mapOverrideOptions.weaponSetAbsoluteIndex !== undefined) {
    map.m_weapon_set_absolute_index = encodeWeaponSet(
      mapOverrideOptions.weaponSetAbsoluteIndex
    );
  }
  if (mapOverrideOptions.vehicleSetAbsoluteIndex !== undefined) {
    map.m_vehicle_set_absolute_index = encodeVehicleSet(
      mapOverrideOptions.vehicleSetAbsoluteIndex
    );
  }
  if (mapOverrideOptions.basePlayerTraits !== undefined) {
    encodePlayerTraits(
      map.m_base_player_traits,
      mapOverrideOptions.basePlayerTraits
    );
  }
  if (mapOverrideOptions.redPowerupTraits !== undefined) {
    encodePlayerTraits(
      map.m_red_powerup_traits,
      mapOverrideOptions.redPowerupTraits
    );
  }
  if (mapOverrideOptions.bluePowerupTraits !== undefined) {
    encodePlayerTraits(
      map.m_blue_powerup_traits,
      mapOverrideOptions.bluePowerupTraits
    );
  }
  if (mapOverrideOptions.yellowPowerupTraits !== undefined) {
    encodePlayerTraits(
      map.m_yellow_powerup_traits,
      mapOverrideOptions.yellowPowerupTraits
    );
  }
  if (mapOverrideOptions.redPowerupDurationSeconds !== undefined) {
    map.m_red_powerup_duration_seconds =
      mapOverrideOptions.redPowerupDurationSeconds;
  }
  if (mapOverrideOptions.bluePowerupDurationSeconds !== undefined) {
    map.m_blue_powerup_duration_seconds =
      mapOverrideOptions.bluePowerupDurationSeconds;
  }
  if (mapOverrideOptions.yellowPowerupDurationSeconds !== undefined) {
    map.m_yellow_powerup_duration_seconds =
      mapOverrideOptions.yellowPowerupDurationSeconds;
  }

  if (irVariant.scoreToWinRound !== undefined) {
    gameVariant.m_score_to_win_round = irVariant.scoreToWinRound;
  }
  if (irVariant.fireTeamsEnabled !== undefined) {
    gameVariant.m_fire_teams_enabled = irVariant.fireTeamsEnabled !== 0;
  }
  // MegaloEdit defaults this
  if (!ir.baseFileBytes || irVariant.symmetricGametype !== undefined) {
    gameVariant.m_symmetric_gametype = irVariant.symmetricGametype ?? true;
  }
  if (irVariant.playerTraits.length > 0) {
    if (ir.baseFileBytes) {
      // Apply base derived player trait overrides.
      const merged = [...gameVariant.m_player_traits];
      irVariant.playerTraits.forEach((option, i) => {
        const compiled = compilePlayerTraitOption(
          Number(option.name ?? 0),
          Number(option.description ?? 0),
          option.traits
        );
        if (i < merged.length) {
          merged[i]!.m_player_traits = compiled.m_player_traits;
        } else {
          merged.push(compiled);
        }
      });
      gameVariant.m_player_traits = merged;
    } else {
      gameVariant.m_player_traits = irVariant.playerTraits.map((option) =>
        compilePlayerTraitOption(
          Number(option.name ?? 0),
          Number(option.description ?? 0),
          option.traits
        )
      );
    }
  }
  compileUserDefinedOptions(ir, gameVariant);

  // Release (106) has no m_tu1_settings block — TU1 options are capability-gated.

  applyParameterFlags(
    gameVariant.m_base_variant_parameters_locked,
    baseVariantParametersLocked
  );
  applyParameterFlags(
    gameVariant.m_base_variant_parameters_hidden,
    baseVariantParametersHidden
  );
};

import type { IR } from "src/frontend/intermediate-representation";
import { BUILTIN_LOCK_FLAG } from "src/frontend/intermediate-representation/elements/game_options/override/helpers";
import type { PlayerTraits } from "src/frontend/intermediate-representation/game/game_engine_player_traits";

type Primitive = string | number | boolean | bigint;

/**
 * Same shape as {@link ToCapabilities}, but leaf values are Megalo source names
 * instead of support booleans.
 */
export type ToCapabilityNames<T> = [T] extends [readonly (infer E)[]]
  ? ToCapabilityNames<E>
  : [T] extends [Primitive]
    ? string
    : [T] extends [object]
      ?
          | {
              readonly [K in keyof Required<T>]: ToCapabilityNames<
                Required<T>[K]
              >;
            }
          | string
      : string;

type GameVariantFieldNames = ToCapabilityNames<
  Omit<IR["gameVariant"], "gameEngine">
>;

const PLAYER_TRAIT_FIELD_NAMES = {
  shieldVitality: {
    damageResistancePercentage: "damage_resistance",
    bodyMultiplierPercentage: "body_multiplier",
    bodyRechargeRatePercentage: "body_recharge",
    shieldMultiplierPercentage: "shield_multiplier",
    shieldRechargeRatePercentage: "shield_recharge",
    headshotImmunity: "headshot_immunity",
    vampirismPercentage: "vampirism",
    assasinationImmunity: "assassination_immunity",
    deathless: "deathless",
  },
  weapons: {
    damageModifierPercentageSetting: "damage_modifier",
    meleeDamageModifierPercentageSetting: "melee_damage_modifier",
    initialPrimaryWeaponAbsoluteIndex: "initial_primary_weapon",
    initialSecondaryWeaponAbsoluteIndex: "initial_secondary_weapon",
    initialGrenadeCount: "initial_grenades",
    rechargingGrenades: "recharging_grenades",
    infiniteAmmo: "infinite_ammo",
    weaponPickup: "weapon_pickup",
    equipmentUsage: "equipment_usage",
    dropEquipment: "drop_equipment",
    infiniteEquipment: "infinite_equipment",
    initialEquipmentAbsoluteIndex: "initial_equipment",
  },
  movement: {
    speedPercentage: "speed",
    gravityPercentage: "gravity",
    vehicleUsage: "vehicle_usage",
    jumpModifier: "jump_modifier",
    sprinting: "sprinting",
    doubleJump: "double_jump",
  },
  appearance: {
    activeCamo: "active_camo",
    waypoint: "waypoint",
    gamertag: "gamertag_visibility",
    forcedChangeColor: "color",
  },
  sensors: {
    motionTrackerMode: "tracker_mode",
    motionTrackerRange: "tracker_range",
  },
} as const satisfies ToCapabilityNames<PlayerTraits>;

/**
 * Megalo display names for IR capability fields — same nesting as version
 * `capabilities.ts` maps, with strings instead of booleans.
 */
export const CAPABILITY_FIELD_NAMES = {
  gameVariant: {
    baseVariant: {
      metadata: "metadata",
      builtIn: "built_in",
      teamScoringMethod: "team_scoring_mode",
      miscellaneousOptions: {
        teamsEnabled: "teams_enabled",
        roundResetPlayers: "round_reset_players",
        roundResetMap: "round_reset_map",
        perfectionEnabled: "perfection_enabled",
        roundTimeLimitMinutes: "round_time_limit",
        roundCount: "round_count",
        earlyVictoryWinCount: "early_victory_win_count",
        suddenDeathTimeLimitSeconds: "sudden_death_time_limit",
        gracePeriodTimeLimitSeconds: "grace_period_time_limit",
      },
      respawnOptions: {
        inheritRespawnTime: "inherit_respawn_time",
        respawnWithTeammate: "respawn_with_teammate",
        respawnAtLocation: "respawn_at_location",
        respawnOnKills: "respawn_on_kills",
        livesPerRound: "lives_per_round",
        teamLivesPerRound: "team_lives_per_round",
        respawnTimeSeconds: "respawn_time",
        suicidePenaltySeconds: "suicide_respawn_penalty",
        betrayalPenaltySeconds: "betrayal_respawn_penalty",
        respawnGrowthSeconds: "respawn_time_growth",
        loadoutCamTime: "loadout_selection_time",
        respawnPlayerTraitsDurationSeconds: "respawn_traits_duration",
        respawnPlayerTraits: PLAYER_TRAIT_FIELD_NAMES,
      },
      socialOptions: {
        friendlyFireEnabled: "friendly_fire_enabled",
        betrayalBootingEnabled: "betrayal_booting_enabled",
        enemyVoiceEnabled: "enemy_voice_enabled",
        openChannelVoiceEnabled: "open_channel_voice_enabled",
        deadPlayerVoiceEnabled: "dead_player_voice_enabled",
      },
      mapOverrideOptions: {
        grenadesOnMap: "grenades_on_map",
        shortcutsOnMap: "shortcuts_on_map",
        equipmentOnMap: "equipment_on_map",
        powerupsOnMap: "powerups_on_map",
        turretsOnMap: "turrets_on_map",
        indestructibleVehicles: "indestructible_vehicles",
        basePlayerTraits: PLAYER_TRAIT_FIELD_NAMES,
        weaponSetAbsoluteIndex: "weapon_set",
        vehicleSetAbsoluteIndex: "vehicle_set",
        redPowerupTraits: PLAYER_TRAIT_FIELD_NAMES,
        bluePowerupTraits: PLAYER_TRAIT_FIELD_NAMES,
        yellowPowerupTraits: PLAYER_TRAIT_FIELD_NAMES,
        redPowerupDurationSeconds: "red_powerup_duration",
        bluePowerupDurationSeconds: "blue_powerup_duration",
        yellowPowerupDurationSeconds: "yellow_powerup_duration",
      },
      teamOptions: {
        model: "model",
        designatorSwitchType: "designator_switch_type",
        teams: {
          name: "name",
          designator: "designator",
          model: "model",
          teamColor: "color",
          fireteamCount: "fireteam_count",
        },
      },
      loadoutTraits: {
        spartanLoadoutsEnabled: "spartan_loadouts_enabled",
        eliteLoadoutsEnabled: "elite_loadouts_enabled",
        loadoutPalettes: {
          loadouts: {
            name: "name",
            initialPrimaryWeaponAbsoluteIndex: "initial_primary_weapon",
            initialSecondaryWeaponAbsoluteIndex: "initial_secondary_weapon",
            initialEquipmentAbsoluteIndex: "initial_equipment",
            initialGrenadeCountSetting: "initial_grenades",
          },
        },
      },
    },
    playerTraits: {
      name: "name",
      description: "description",
      traits: PLAYER_TRAIT_FIELD_NAMES,
    },
    userDefinedOptions: "option",
    scriptStrings: "string_table",
    baseNameStringIndex: "name",
    localizedName: "name",
    localizedDescription: "description",
    localizedCategory: "category",
    engineIcon: "icon",
    engineCategory: "category",
    mapPermissions: "map_permissions",
    playerRatings: {
      ratingScale: "rating_scale",
      killWeight: "kill_weight",
      assistWeight: "assist_weight",
      betrayalWeight: "betrayal_weight",
      deathWeight: "death_weight",
      normalizeByMaxKills: "normalize_by_max_kills",
      base: "base_value",
      range: "range",
      lossScalar: "loss_scalar",
      customStat0: "custom_stat_0",
      customStat1: "custom_stat_1",
      customStat2: "custom_stat_2",
      customStat3: "custom_stat_3",
      expansion0: "expansion_0",
      expansion1: "expansion_1",
      showInScoreboard: "show_in_scoreboard",
    },
    scoreToWinRound: "score_to_win_round",
    fireTeamsEnabled: "fire_teams_enabled",
    symmetricGametype: "symmetric_gametype",
    // Aggregates — specific lock/hide option names come from BUILTIN_LOCK_FLAG.
    baseVariantParametersLocked: "lock",
    baseVariantParametersHidden: "hide",
    tu1Settings: {
      alwaysSpilloverDamage: "tu1_always_spillover_damage",
      armorLockStickiesRemain: "tu1_armor_lock_stickies_remain",
      attachedDamageBypassShields: "tu1_attached_damage_bypass_shields",
      activeCamoOverrideEnergyCurve: "tu1_active_camo_override_energy_curve",
      swordGunClangKills: "tu1_sword_gun_clang_kills",
      magnumIsAutomatic: "tu1_magnum_is_automatic",
      precisionBloom: "tu1_headshot_weapon_reticule_bloom_multiplier",
      armorLockDamageDrain: "tu1_armor_lock_damage_to_energy_transfer",
      armorLockDamageDrainLimit: "tu1_armor_lock_damage_to_energy_cap",
      activeCamoEnergyCurveMin: "tu1_active_camo_override_energy_curve_min",
      activeCamoEnergyCurveMax: "tu1_active_camo_override_energy_curve_max",
      magnumDamage: "tu1_magnum_damage_multiplier",
      magnumFireDelay: "tu1_magnum_fire_recovery_time_multiplier",
    },
  },
} as const satisfies {
  readonly gameVariant: GameVariantFieldNames;
};

/** BuiltInGameOptionFlags keys → Megalo option names (for lock/hide maps). */
const LOCK_FLAG_TO_MEGALO_NAME: ReadonlyMap<string, string> = new Map(
  [...BUILTIN_LOCK_FLAG.entries()].map(([megalo, flag]) => [flag, megalo])
);

const camelToSnake = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();

const stripIndex = (segment: string): string => segment.replace(/\[\d+\]$/, "");

const lookupInNameTree = (path: string): string | undefined => {
  const parts = path.split(".").map(stripIndex);
  let node: unknown = CAPABILITY_FIELD_NAMES;
  for (const part of parts) {
    if (typeof node === "string") {
      return node;
    }
    if (node === null || typeof node !== "object") {
      return;
    }
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
};

/** Resolve a Megalo-facing name for an IR capability path or lock/hide flag. */
export const capabilityFieldDisplayName = (
  path: string,
  /** Prefer this when expanding a true flag inside an unsupported map. */
  flagKey?: string
): string => {
  if (flagKey !== undefined) {
    const fromLock = LOCK_FLAG_TO_MEGALO_NAME.get(flagKey);
    if (fromLock !== undefined) {
      // Name the modifier too ("lock teams_enabled"): the option itself may be
      // supported while its lock / hide flag is not.
      const aggregate = lookupInNameTree(path);
      return aggregate === "lock" || aggregate === "hide"
        ? `${aggregate} ${fromLock}`
        : fromLock;
    }
    const fromTree = lookupInNameTree(`${path}.${flagKey}`);
    if (fromTree !== undefined) {
      return fromTree;
    }
    return camelToSnake(flagKey);
  }

  const fromTree = lookupInNameTree(path);
  if (fromTree !== undefined) {
    return fromTree;
  }
  const leaf = stripIndex(
    path.includes(".") ? (path.split(".").pop() ?? path) : path
  );
  return camelToSnake(leaf);
};

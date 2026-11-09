import type { LoadoutPaletteType } from "src/frontend/intermediate-representation/game/megalogamengine/loadoutPaletteType";
import type { HUDMeterInputType } from "src/frontend/intermediate-representation/game/megalogamengine/megalogamengine_hud_widgets";
import type {
  CustomTimerReference,
  CustomVariableReference,
  ObjectReference,
  ObjectTypeReference,
  PlayerReference,
  TeamReference,
} from "src/frontend/intermediate-representation/game/megalogamengine/megalogamengine_references";
import type { MegaloSound } from "src/frontend/intermediate-representation/game/megalogamengine/megalogamengine_sounds";
import type { DynamicString } from "src/frontend/intermediate-representation/game/megalogamengine/megalogamengine_text";
import type { VariantVariable } from "src/frontend/intermediate-representation/game/megalogamengine/megalogamengine_variant_variable";
import type { StringTableReference } from "src/frontend/intermediate-representation/game/string_table";
import {
  type MegaloEnumNames,
  megaloEnum,
} from "src/frontend/intermediate-representation/megaloEnum";

const ACTION_TYPE_MEMBERS = [
  "set_score",
  "create_object",
  "delete_object",
  "navpoint_set_visible",
  "navpoint_set_icon",
  "navpoint_set_priority",
  "navpoint_set_timer",
  "navpoint_set_visible_range",
  "set",
  "set_boundary",
  "apply_player_traits",
  "set_pickup_filter",
  "set_respawn_filter",
  "set_fireteam_respawn_filter",
  "set_progress_bar",
  "hud_post_message",
  "timer_set_rate",
  "print_variable",
  "get_player_holding_object",
  "for_each",
  "end_round",
  "boundary_set_visible",
  "object_destroy",
  "object_set_invincibility",
  "random",
  "break_into_debugger",
  "object_get_orientation",
  "object_get_velocity",
  "player_death_get_killing_player",
  "player_death_get_damage_type",
  "player_death_get_special_type",
  "debugging_enable_tracing",
  "object_attach",
  "object_detach",
  "player_get_place",
  "team_get_place",
  "player_get_killing_spree_count",
  "player_adjust_money",
  "player_enable_purchases",
  "player_get_vehicle",
  "player_set_vehicle",
  "player_set_unit",
  "timer_reset",
  "weapon_set_pickup_priority",
  "object_bounce",
  "hud_widget_set_text",
  "hud_widget_set_value",
  "hud_widget_set_meter",
  "hud_widget_set_icon",
  "hud_widget_set_visibility",
  "play_sound",
  "object_set_scale",
  "navpoint_set_text",
  "object_get_shield",
  "object_get_health",
  "player_set_objective",
  "player_set_objective_allegiance",
  "player_set_objective_allegiance_icon",
  "team_set_coop_spawning",
  "object_set_minimap_visibility",
  "object_set_minimap_priority",
  "object_set_minimap_icon",
  "team_set_primary_respawn_object",
  "player_set_primary_respawn_object",
  "player_get_fireteam_index",
  "player_set_fireteam_index",
  "object_adjust_shield",
  "object_adjust_health",
  "object_get_distance",
  "object_adjust_maximum_shield",
  "object_adjust_maximum_health",
  "player_set_requisition_palette",
  "player_set_fireteam_tier",
  "device_set_power",
  "device_get_power",
  "device_set_position",
  "device_get_position",
  "give_weapon",
  "adjust_grenades",
  "submit_incident",
  "submit_incident_with_custom_value",
  "set_loadout",
  "set_loadout_palette",
  "device_set_position_track",
  "device_animate_position",
  "device_set_position_immediate",
  "saved_film_insert_marker",
  "respawn_zone_enable",
  "player_get_weapon",
  "player_get_equipment",
  "object_set_never_garbage",
  "player_get_target_object",
  "create_tunnel",
  "debug_force_player_view_count",
  "player_pick_up_weapon",
  "player_set_coop_spawning",
  "object_set_orientation",
  "object_face_object",
  "biped_give_weapon",
  "biped_drop_weapon",
  "set_scenario_interpolator_state",
  "get_random_object",
  "game_grief_record_custom_penalty",
  "boundary_set_player_color",
  "begin",
  "hs_function_call",
  "get_button_time",
  "team_set_vehicle_spawning",
  "player_set_vehicle_spawning",
  "set_player_respawn_vehicle",
  "set_team_respawn_vehicle",
  "hide_object",
] as const;

export const actionType = megaloEnum(ACTION_TYPE_MEMBERS, (version) => {
  const supported = new Set<(typeof ACTION_TYPE_MEMBERS)[number]>([
    "set_score",
    "create_object",
    "delete_object",
    "navpoint_set_visible",
    "navpoint_set_icon",
    "navpoint_set_priority",
    "navpoint_set_timer",
    "navpoint_set_visible_range",
    "set",
    "set_boundary",
    "apply_player_traits",
    "set_pickup_filter",
    "set_respawn_filter",
    "set_fireteam_respawn_filter",
    "set_progress_bar",
    "hud_post_message",
    "timer_set_rate",
    "print_variable",
    "get_player_holding_object",
    "for_each",
    "end_round",
    "boundary_set_visible",
    "object_destroy",
    "object_set_invincibility",
    "random",
    "break_into_debugger",
    "object_get_orientation",
    "object_get_velocity",
    "player_death_get_killing_player",
    "player_death_get_damage_type",
    "player_death_get_special_type",
    "debugging_enable_tracing",
    "object_attach",
    "object_detach",
    "player_get_place",
    "team_get_place",
    "player_get_killing_spree_count",
    "player_adjust_money",
    "player_enable_purchases",
    "player_get_vehicle",
    "player_set_vehicle",
    "timer_reset",
    "weapon_set_pickup_priority",
    "object_bounce",
    "hud_widget_set_text",
    "hud_widget_set_value",
    "hud_widget_set_meter",
    "hud_widget_set_icon",
    "hud_widget_set_visibility",
    "play_sound",
    "object_set_scale",
    "navpoint_set_text",
    "object_get_shield",
    "player_set_objective",
    "team_set_coop_spawning",
    "team_set_primary_respawn_object",
    "player_set_primary_respawn_object",
    "player_get_fireteam_index",
    "player_set_fireteam_index",
    "object_adjust_shield",
    "object_adjust_health",
    "object_get_distance",
    "object_adjust_maximum_shield",
    "object_adjust_maximum_health",
    "player_set_requisition_palette",
    "device_set_power",
    "device_get_power",
    "device_set_position",
    "device_get_position",
    "adjust_grenades",
    "submit_incident",
    "submit_incident_with_custom_value",
    "set_loadout_palette",
    "device_set_position_track",
    "device_animate_position",
    "device_set_position_immediate",
    "saved_film_insert_marker",
    "respawn_zone_enable",
  ]);

  if (version.version < 73) {
    supported.add("object_set_minimap_visibility");
    supported.add("object_set_minimap_priority");
    supported.add("object_set_minimap_icon");
  }

  if (version.version < 106) {
    supported.add("player_set_fireteam_tier");
    supported.add("give_weapon");
    supported.add("set_loadout");
  }

  if (version.version >= 73) {
    supported.add("player_set_unit");
    supported.add("object_get_health");
    supported.add("player_get_weapon");
    supported.add("player_get_equipment");
    supported.add("object_set_never_garbage");
    supported.add("player_get_target_object");
    supported.add("create_tunnel");
    supported.add("debug_force_player_view_count");
    supported.add("player_pick_up_weapon");
    supported.add("player_set_coop_spawning");
  }

  if (version.version === 73) {
    supported.add("player_set_vehicle_spawning");
  }

  if (version.version >= 106) {
    supported.add("player_set_objective_allegiance");
    supported.add("player_set_objective_allegiance_icon");
    supported.add("object_set_orientation");
    supported.add("object_face_object");
    supported.add("biped_give_weapon");
    supported.add("biped_drop_weapon");
    supported.add("set_scenario_interpolator_state");
    supported.add("get_random_object");
    supported.add("game_grief_record_custom_penalty");
    supported.add("boundary_set_player_color");
  }

  if (version.version === 107 && version.flavour === "mcc") {
    supported.add("begin");
    supported.add("hs_function_call");
    supported.add("get_button_time");
    supported.add("team_set_vehicle_spawning");
    supported.add("player_set_vehicle_spawning");
    supported.add("set_player_respawn_vehicle");
    supported.add("set_team_respawn_vehicle");
    supported.add("hide_object");
  }

  return supported;
});
export const ActionType = actionType.enum;
export type ActionType = MegaloEnumNames<typeof actionType>;

interface ActionParameters<T extends ActionType, P> {
  parameters: P;
  type: T;
}

export const teamOrPlayerTarget = megaloEnum([
  "everyone",
  "player",
  "team",
] as const);
export const TeamOrPlayerTargetKind = teamOrPlayerTarget.enum;
export type TeamOrPlayerTargetKind = MegaloEnumNames<typeof teamOrPlayerTarget>;

export type TeamOrPlayerTarget =
  | { type: typeof TeamOrPlayerTargetKind.everyone }
  | { type: typeof TeamOrPlayerTargetKind.player; player: PlayerReference }
  | { type: typeof TeamOrPlayerTargetKind.team; team: TeamReference };

const MATH_OPERATION_MEMBERS = [
  "add",
  { name: "+=", aliasOf: "add" },
  "subtract",
  { name: "-=", aliasOf: "subtract" },
  "multiply",
  { name: "*=", aliasOf: "multiply" },
  "divide",
  { name: "/=", aliasOf: "divide" },
  "set_to",
  { name: "=", aliasOf: "set_to" },
  "modulo",
  { name: "%=", aliasOf: "modulo" },
  "and",
  { name: "&=", aliasOf: "and" },
  "or",
  { name: "|=", aliasOf: "or" },
  "xor",
  { name: "^=", aliasOf: "xor" },
  "not",
  { name: "~=", aliasOf: "not" },
  "lshift",
  { name: "<<", aliasOf: "lshift" },
  "rshift",
  { name: ">>", aliasOf: "rshift" },
  "abs", // no alias?
] as const;

export const mathOperation = megaloEnum(MATH_OPERATION_MEMBERS, (version) => {
  const supported = new Set<
    | "add"
    | "subtract"
    | "multiply"
    | "divide"
    | "set_to"
    | "modulo"
    | "and"
    | "or"
    | "xor"
    | "not"
    | "lshift"
    | "rshift"
    | "abs"
  >([
    "add",
    "subtract",
    "multiply",
    "divide",
    "set_to",
    "modulo",
    "and",
    "or",
    "xor",
    "not",
    "abs",
  ]);

  if (version.version === 107 && version.flavour === "mcc") {
    supported.add("lshift");
    supported.add("rshift");
  }

  return supported;
});
export const MathOperation = mathOperation.enum;
export type MathOperation = MegaloEnumNames<typeof mathOperation>;

export interface SetScoreParameters {
  operation: MathOperation;
  target: TeamOrPlayerTarget;
  variable: CustomVariableReference;
}

export interface ObjectOffset {
  x: number;
  y: number;
  z: number;
}

export interface CreateObjectParameters {
  absoluteOrientation?: boolean;
  labelIndex?: StringTableReference; // not 100% sure about this
  neverGarbageCollect?: boolean;
  object_reference_out?: ObjectReference;
  objectType: ObjectTypeReference;
  offset?: ObjectOffset;
  place_at_object: ObjectReference;
  suppressEffect?: boolean;
  variantNameIndex?: number; // object_lists/stringids.txt ?
}

export interface DeleteObjectParameters {
  object: ObjectReference;
}

export interface NavpointSetVisibleParameters {
  navpoint: ObjectReference;
  playerFilterModifier: PlayerFilterModifier;
}

export interface NavpointSetIconParameters {
  icon: number;
  navpoint: ObjectReference;
  /** Present when icon is `num` (11). */
  number?: CustomVariableReference;
}

export const navpointPriority = megaloEnum([
  "low",
  "normal",
  "high",
  "blink",
] as const);
export const NavpointPriority = navpointPriority.enum;
export type NavpointPriority = MegaloEnumNames<typeof navpointPriority>;

export interface NavpointSetPriorityParameters {
  navpoint: ObjectReference;
  priority: NavpointPriority;
}

export interface NavpointSetTimerParameters {
  navpoint: ObjectReference;
  timerIndex: number;
}

export interface NavpointSetVisibleRangeParameters {
  maxFeet: CustomVariableReference;
  minFeet: CustomVariableReference;
  navpoint: ObjectReference;
}

export interface SetParameters {
  left: VariantVariable;
  operation: MathOperation;
  right: VariantVariable;
}

export const boundaryShape = megaloEnum([
  "none",
  "sphere",
  "cylinder",
  "box",
] as const);
export const BoundaryShape = boundaryShape.enum;
export type BoundaryShape = MegaloEnumNames<typeof boundaryShape>;

interface NoneBoundaryParameters {
  shape: typeof BoundaryShape.none;
}

interface SphereBoundaryParameters {
  radius: CustomVariableReference;
  shape: typeof BoundaryShape.sphere;
}

interface BoxBoundaryParameters {
  depth: CustomVariableReference;
  /** MegaloEdit script order: … neg_height pos_height */
  negHeight: CustomVariableReference;
  posHeight: CustomVariableReference;
  shape: typeof BoundaryShape.box;
  width: CustomVariableReference;
}

interface CylinderBoundaryParameters {
  negHeight: CustomVariableReference;
  posHeight: CustomVariableReference;
  radius: CustomVariableReference;
  shape: typeof BoundaryShape.cylinder;
}

export type SetBoundaryParameters = {
  object: ObjectReference;
} & (
  | NoneBoundaryParameters
  | SphereBoundaryParameters
  | BoxBoundaryParameters
  | CylinderBoundaryParameters
);

export interface ApplyPlayerTraitsParameters {
  player: PlayerReference;
  traitIndex: number;
}

export interface FireteamFilter {
  fireteam1: boolean;
  fireteam2: boolean;
  fireteam3: boolean;
  fireteam4: boolean;
  fireteam5: boolean;
  fireteam6: boolean;
  fireteam7: boolean;
  fireteam8: boolean;
}

export interface SetFireteamRespawnFilterParameters {
  fireteamFilter: FireteamFilter;
  object: ObjectReference;
}

export const playerFilterType = megaloEnum([
  "no_one",
  "everyone",
  "allies",
  "enemies",
  "player",
  "all",
  { name: "normal", aliasOf: "all" },
] as const);
export const PlayerFilterType = playerFilterType.enum;
export type PlayerFilterType = MegaloEnumNames<typeof playerFilterType>;

export type PlayerFilterModifier =
  | {
      type: Exclude<PlayerFilterType, typeof PlayerFilterType.player>;
    }
  | {
      type: typeof PlayerFilterType.player;
      player: PlayerReference;
      visible: CustomVariableReference;
    };

export interface SetProgressBarParameters {
  object: ObjectReference;
  playerFilterModifier: PlayerFilterModifier;
  timerIndex: number;
}

export interface HudPostMessageParameters {
  soundIndex: MegaloSound;
  string: DynamicString;
  target: TeamOrPlayerTarget;
}

export interface TimerSetRateParameters {
  rate: number;
  timer: CustomTimerReference;
}

export interface ForEachParameters {
  triggerIndex: number;
}

export interface ObjectDestroyParameters {
  noStatistics?: boolean;
  object: ObjectReference;
}

export interface ObjectAttachParameters {
  absoluteOrientation?: boolean;
  child: ObjectReference;
  offset: ObjectOffset;
  parent: ObjectReference;
}

export interface PlayerAdjustMoneyParameters {
  amount: CustomVariableReference;
  operation: MathOperation;
  player: PlayerReference;
}

export interface PlayerPurchaseMode {
  aliveEquipment: boolean;
  aliveVehicles: boolean;
  aliveWeapons: boolean;
  deadEquipment: boolean;
  deadWeapons: boolean;
}

export const purchaseLifeState = megaloEnum(["alive", "dead", "both"] as const);
export const PurchaseLifeState = purchaseLifeState.enum;
export type PurchaseLifeState = MegaloEnumNames<typeof purchaseLifeState>;

export const purchaseCategory = megaloEnum([
  "weapons",
  "equipment",
  "vehicles",
  "all",
] as const);
export const PurchaseCategory = purchaseCategory.enum;
export type PurchaseCategory = MegaloEnumNames<typeof purchaseCategory>;

/** MegaloEdit fireteam filter presets (`none` | `all`); integers 0–3 are separate. */
export const fireteamFilterPreset = megaloEnum(["none", "all"] as const);
export const FireteamFilterPreset = fireteamFilterPreset.enum;
export type FireteamFilterPreset = MegaloEnumNames<typeof fireteamFilterPreset>;

/** Primary/secondary weapon slot (without biped `force`). */
export const weaponSlot = megaloEnum(["primary", "secondary"] as const);
export const WeaponSlot = weaponSlot.enum;
export type WeaponSlot = MegaloEnumNames<typeof weaponSlot>;

export interface PlayerEnablePurchasesParameters {
  enabled: CustomVariableReference;
  player: PlayerReference;
  selectedModes: PlayerPurchaseMode;
}

export const weaponPickupPriority = megaloEnum([
  "normal",
  "special",
  { name: "high", aliasOf: "special" },
  "auto",
  { name: "automatic", aliasOf: "auto" },
] as const);
export const WeaponPickupPriority = weaponPickupPriority.enum;
export type WeaponPickupPriority = MegaloEnumNames<typeof weaponPickupPriority>;

export interface WeaponSetPickupPriorityParameters {
  priority: WeaponPickupPriority;
  weapon: ObjectReference;
}

export interface HUDWidgetSetTextParameters {
  string: DynamicString;
  widgetIndex: number;
}

interface HUDMeterInputNumber {
  max: CustomVariableReference;
  meterType: typeof HUDMeterInputType.number;
  value: CustomVariableReference;
}

interface HUDMeterInputTimer {
  meterType: typeof HUDMeterInputType.timer;
  timer: CustomTimerReference;
}

interface HUDMeterInputNone {
  meterType: typeof HUDMeterInputType.none;
}

export type HUDMeterInput =
  | HUDMeterInputNumber
  | HUDMeterInputTimer
  | HUDMeterInputNone;

export interface HUDWidgetSetMeterParameters {
  meterInput: HUDMeterInput;
  widgetIndex: number;
}

export interface HUDWidgetSetIconParameters {
  iconIndex: number; // object_lists/hud_widget_icons.txt
  widgetIndex: number;
}

export interface HUDWidgetSetVisibilityParameters {
  player: PlayerReference;
  visible: boolean;
  widgetIndex: number;
}

export interface PlaySoundParameters {
  immediate: boolean;
  soundIndex: MegaloSound;
  target: TeamOrPlayerTarget;
}

export interface VitalityAdjustmentParameters {
  amount: CustomVariableReference;
  object: ObjectReference;
  operation: MathOperation;
}

export interface PlayerSetRequisitionPaletteParameters {
  player: PlayerReference;
  requisitionPaletteIndex: number;
}

export const grenadeType = megaloEnum(["frag", "plasma"] as const);
export const GrenadeType = grenadeType.enum;
export type GrenadeType = MegaloEnumNames<typeof grenadeType>;

export interface AdjustGrenadesParameters {
  amount: CustomVariableReference;
  grenadeType: GrenadeType;
  operation: MathOperation;
  player: PlayerReference;
}

export interface SubmitIncidentParameters {
  cause: TeamOrPlayerTarget;
  effect: TeamOrPlayerTarget;
  statIndex: number;
}

export interface SubmitIncidentWithCustomValueParameters {
  cause: TeamOrPlayerTarget;
  customValue: CustomVariableReference;
  effect: TeamOrPlayerTarget;
  statIndex: number;
}

export type SetLoadoutPaletteParameters = {
  target: TeamOrPlayerTarget;
} & (
  | {
      /** Shipping MegaloEdit LoadoutPaletteType — wire index assigned at compile. */
      loadoutPaletteType: LoadoutPaletteType;
    }
  | {
      /** Pre-release object_lists/loadout_palettes.txt index (or raw integer). */
      loadoutPaletteIndex: number;
    }
);

export interface SetLoadoutParameters {
  /** Index into object_lists/loadouts.txt (pre-release) or script loadout table. */
  loadoutIndex: number;
  target: TeamOrPlayerTarget;
}

export interface PlayerSetFireteamTierParameters {
  player: PlayerReference;
  tier: CustomVariableReference;
}

export interface GiveWeaponParameters {
  /** 1-bit wire flag; `force` encodes as 1, otherwise 0. */
  force: boolean;
  player: PlayerReference;
  weapon: ObjectTypeReference;
}

export interface ObjectSetMinimapVisibilityParameters {
  object: ObjectReference;
  visible: boolean;
}

export interface ObjectSetMinimapPriorityParameters {
  object: ObjectReference;
  priority: NavpointPriority;
}

export interface ObjectSetMinimapIconParameters {
  iconIndex: number;
  object: ObjectReference;
}

export interface PlayerGetWeaponParameters {
  player: PlayerReference;
  primary: boolean;
  weapon: ObjectReference;
}

export interface CreateTunnelParameters {
  from: ObjectReference;
  objectReferenceOut: ObjectReference;
  objectType: ObjectTypeReference;
  radious: CustomVariableReference;
  to: ObjectReference;
}

export interface PlayerSetCoopSpawningParameters {
  enabled: boolean;
  player: PlayerReference;
}

export interface ObjectSetOrientationParameters {
  absoluteOrientation?: boolean;
  object: ObjectReference;
  source: ObjectReference;
}

export interface ObjectFaceObjectParameters {
  object: ObjectReference;
  offset?: ObjectOffset;
  target: ObjectReference;
}

export const bipedGiveWeaponMode = megaloEnum([
  "primary",
  "secondary",
  "force",
] as const);
export const BipedGiveWeaponMode = bipedGiveWeaponMode.enum;
export type BipedGiveWeaponMode = MegaloEnumNames<typeof bipedGiveWeaponMode>;

export interface BipedGiveWeaponParameters {
  biped: ObjectReference;
  mode: BipedGiveWeaponMode;
  weapon: ObjectTypeReference;
}

export interface BipedDropWeaponParameters {
  biped: ObjectReference;
  deleteOnDrop: boolean;
  primary: boolean;
}

export interface GetRandomObjectParameters {
  filterIndex: number;
  ignoreObject: ObjectReference;
  objectOut: ObjectReference;
}

export interface BoundarySetPlayerColorParameters {
  object: ObjectReference;
  playerIndex: number;
}

export interface BeginParameters {
  actionCount: number;
  conditionCount: number;
  firstActionIndex: number;
  firstConditionIndex: number;
}

export interface HsFunctionCallParameters {
  functionNameIndex: number; // index in object_lists/strings.txt
}

export const scriptableGameButtons = megaloEnum([
  "jump",
  "grenade",
  "switch_weapon",
  "context_primary",
  "melee_attack",
  "equipment",
  "throw_grenade",
  "fire_primary",
  "crouch",
  "scope_zoom",
  "night_vision",
  "fire_secondary",
  "fire_tertiary",
  "vehicle_trick",
] as const);
export const ScriptableGameButtons = scriptableGameButtons.enum;
export type ScriptableGameButtons = MegaloEnumNames<
  typeof scriptableGameButtons
>;

export interface GetButtonTimeParameters {
  button: ScriptableGameButtons;
  player: PlayerReference;
  timeOut: CustomVariableReference;
}

export interface TeamSetVehicleSpawningParameters {
  enabled: boolean;
  team: TeamReference;
}

export interface PlayerSetVehicleSpawningParameters {
  enabled: boolean;
  player: PlayerReference;
}

export interface SetPlayerRespawnVehicleParameters {
  objectType: ObjectTypeReference;
  player: PlayerReference;
}

export interface SetTeamRespawnVehicleParameters {
  objectType: ObjectTypeReference;
  team: TeamReference;
}

export interface HideObjectParameters {
  object: ObjectReference;
  shouldHide: boolean;
}

export interface PrintVariableParameters {
  string: DynamicString;
}

export interface GetPlayerHoldingObjectParameters {
  object: ObjectReference;
  playerOut: PlayerReference;
}

export type EndRoundParameters = never;

export interface BoundarySetVisibleParameters {
  object: ObjectReference;
  playerFilterModifier: PlayerFilterModifier;
}

export interface ObjectSetInvincibilityParameters {
  invincible: CustomVariableReference;
  object: ObjectReference;
}

export interface RandomParameters {
  range: CustomVariableReference;
  valueOut: CustomVariableReference;
}

export interface ObjectGetOrientationParameters {
  object: ObjectReference;
  orientationOut: CustomVariableReference;
}

export interface ObjectGetVelocityParameters {
  object: ObjectReference;
  velocityOut: CustomVariableReference;
}

export interface PlayerDeathGetKillingPlayerParameters {
  deadPlayer: PlayerReference;
  killingPlayerOut: PlayerReference;
}

export interface PlayerDeathGetDamageTypeParameters {
  damageTypeOut: CustomVariableReference;
  deadPlayer: PlayerReference;
}

export interface PlayerDeathGetSpecialTypeParameters {
  deadPlayer: PlayerReference;
  specialTypeOut: CustomVariableReference;
}

export interface DebuggingEnableTracingParameters {
  tracingEnabled: boolean;
}

export interface ObjectDetachParameters {
  object: ObjectReference;
}

export interface PlayerGetPlaceParameters {
  placeOut: CustomVariableReference;
  player: PlayerReference;
}

export interface TeamGetPlaceParameters {
  placeOut: CustomVariableReference;
  team: TeamReference;
}

export interface PlayerGetKillingSpreeCountParameters {
  player: PlayerReference;
  spreeCountOut: CustomVariableReference;
}

export interface PlayerGetVehicleParameters {
  player: PlayerReference;
  vehicleOut: ObjectReference;
}

export interface PlayerSetVehicleParameters {
  player: PlayerReference;
  vehicle: ObjectReference;
}

export interface PlayerSetUnitParameters {
  player: PlayerReference;
  unit: ObjectReference;
}

export interface TimerResetParameters {
  timer: CustomTimerReference;
}

export interface ObjectBounceParameters {
  object: ObjectReference;
}

export interface HUDWidgetSetValueParameters {
  value: DynamicString;
  widgetIndex: number;
}

/** Alpha: immediate float; Beta+: custom number variable (incl. integer constants). */
export type ObjectSetScaleValue =
  | { kind: "float"; value: number }
  | { kind: "variable"; value: CustomVariableReference };

export interface ObjectSetScaleParameters {
  object: ObjectReference;
  scale: ObjectSetScaleValue;
}

export interface NavpointSetTextParameters {
  object: ObjectReference;
  string: DynamicString;
}

export interface ObjectGetShieldParameters {
  object: ObjectReference;
  variable: CustomVariableReference;
}

export interface ObjectGetHealthParameters {
  object: ObjectReference;
  variable: CustomVariableReference;
}

export interface PlayerSetObjectiveParameters {
  objective: DynamicString;
  player: PlayerReference;
}

export interface PlayerSetObjectiveAllegianceParameters {
  allegiance: DynamicString;
  player: PlayerReference;
}

export interface PlayerSetObjectiveAllegianceIconParameters {
  iconIndex: number; // object_lists/hud_widget_icons.txt
  player: PlayerReference;
}

export interface TeamSetCoopSpawningParameters {
  coopSpawningEnabled: boolean;
  team: TeamReference;
}

export interface TeamSetPrimaryRespawnObjectParameters {
  respawnObject: ObjectReference;
  team: TeamReference;
}

export interface PlayerSetPrimaryRespawnObjectParameters {
  player: PlayerReference;
  respawnObject: ObjectReference;
}

export interface PlayerGetFireteamIndexParameters {
  fireteamIndexOut: CustomVariableReference;
  player: PlayerReference;
}

export interface PlayerSetFireteamIndexParameters {
  fireteamIndex: CustomVariableReference;
  player: PlayerReference;
}

export interface ObjectAdjustShieldParameters {
  amount: CustomVariableReference;
  object: ObjectReference;
  operation: MathOperation;
}

export interface ObjectAdjustHealthParameters {
  amount: CustomVariableReference;
  object: ObjectReference;
  operation: MathOperation;
}

export interface ObjectAdjustMaximumShieldParameters {
  amount: CustomVariableReference;
  object: ObjectReference;
  operation: MathOperation;
}

export interface ObjectAdjustMaximumHealthParameters {
  amount: CustomVariableReference;
  object: ObjectReference;
  operation: MathOperation;
}

export interface ObjectGetDistanceParameters {
  distanceOut: CustomVariableReference;
  from: ObjectReference;
  to: ObjectReference;
}

export interface DeviceSetPowerParameters {
  object: ObjectReference;
  power: CustomVariableReference;
}

export interface DeviceGetPowerParameters {
  object: ObjectReference;
  powerOut: CustomVariableReference;
}

export interface DeviceSetPositionParameters {
  object: ObjectReference;
  position: CustomVariableReference;
}

export interface DeviceGetPositionParameters {
  object: ObjectReference;
  positionOut: CustomVariableReference;
}

export interface DeviceSetPositionTrackParameters {
  animationNameIndex: number; // object_lists/stringids.txt ?
  interpolationTime: CustomVariableReference;
  object: ObjectReference;
}

export interface DeviceAnimatePositionParameters {
  accelerationSeconds: CustomVariableReference;
  animationDurationSeconds: CustomVariableReference;
  animationTargetFraction: CustomVariableReference;
  decelerationSeconds: CustomVariableReference;
  object: ObjectReference;
}

export interface DeviceSetPositionImmediateParameters {
  object: ObjectReference;
  position: CustomVariableReference;
}

export interface SavedFilmInsertMarkerParameters {
  label: DynamicString;
  offsetSeconds: CustomVariableReference;
}

export interface RespawnZoneEnableParameters {
  enabled: CustomVariableReference;
  respawnZone: ObjectReference;
}

export interface PlayerGetEquipmentParameters {
  equipmentOut: ObjectReference;
  player: PlayerReference;
}

export interface ObjectSetNeverGarbageParameters {
  neverGarbage: CustomVariableReference;
  object: ObjectReference;
}

export interface PlayerGetTargetObjectParameters {
  objectOut: ObjectReference;
  player: PlayerReference;
}

export interface DebugForcePlayerViewCountParameters {
  viewCount: CustomVariableReference;
}

export interface PlayerPickUpWeaponParameters {
  player: PlayerReference;
  weapon: ObjectReference;
}

export interface SetScenarioInterpolatorStateParameters {
  active: CustomVariableReference;
  interpolatorIndex: CustomVariableReference;
}

export interface GameGriefRecordCustomPenaltyParameters {
  player: PlayerReference;
  variable: CustomVariableReference;
}

export interface SetPickupFilterParameters {
  object: ObjectReference;
  playerFilterModifier: PlayerFilterModifier;
}

export interface SetRespawnFilterParameters {
  object: ObjectReference;
  playerFilterModifier: PlayerFilterModifier;
}

export type BreakIntoDebuggerParameters = never;

export type Action =
  | ActionParameters<"set_score", SetScoreParameters>
  | ActionParameters<"create_object", CreateObjectParameters>
  | ActionParameters<"delete_object", DeleteObjectParameters>
  | ActionParameters<"navpoint_set_visible", NavpointSetVisibleParameters>
  | ActionParameters<"navpoint_set_icon", NavpointSetIconParameters>
  | ActionParameters<"navpoint_set_priority", NavpointSetPriorityParameters>
  | ActionParameters<"navpoint_set_timer", NavpointSetTimerParameters>
  | ActionParameters<
      "navpoint_set_visible_range",
      NavpointSetVisibleRangeParameters
    >
  | ActionParameters<"set", SetParameters>
  | ActionParameters<"set_boundary", SetBoundaryParameters>
  | ActionParameters<"apply_player_traits", ApplyPlayerTraitsParameters>
  | ActionParameters<"set_pickup_filter", SetPickupFilterParameters>
  | ActionParameters<"set_respawn_filter", SetRespawnFilterParameters>
  | ActionParameters<
      "set_fireteam_respawn_filter",
      SetFireteamRespawnFilterParameters
    >
  | ActionParameters<"set_progress_bar", SetProgressBarParameters>
  | ActionParameters<"hud_post_message", HudPostMessageParameters>
  | ActionParameters<"timer_set_rate", TimerSetRateParameters>
  | ActionParameters<"print_variable", PrintVariableParameters>
  | ActionParameters<
      "get_player_holding_object",
      GetPlayerHoldingObjectParameters
    >
  | ActionParameters<"for_each", ForEachParameters>
  | ActionParameters<"end_round", EndRoundParameters>
  | ActionParameters<"boundary_set_visible", BoundarySetVisibleParameters>
  | ActionParameters<"object_destroy", ObjectDestroyParameters>
  | ActionParameters<
      "object_set_invincibility",
      ObjectSetInvincibilityParameters
    >
  | ActionParameters<"random", RandomParameters>
  | ActionParameters<"break_into_debugger", BreakIntoDebuggerParameters>
  | ActionParameters<"object_get_orientation", ObjectGetOrientationParameters>
  | ActionParameters<"object_get_velocity", ObjectGetVelocityParameters>
  | ActionParameters<
      "player_death_get_killing_player",
      PlayerDeathGetKillingPlayerParameters
    >
  | ActionParameters<
      "player_death_get_damage_type",
      PlayerDeathGetDamageTypeParameters
    >
  | ActionParameters<
      "player_death_get_special_type",
      PlayerDeathGetSpecialTypeParameters
    >
  | ActionParameters<
      "debugging_enable_tracing",
      DebuggingEnableTracingParameters
    >
  | ActionParameters<"object_attach", ObjectAttachParameters>
  | ActionParameters<"object_detach", ObjectDetachParameters>
  | ActionParameters<"player_get_place", PlayerGetPlaceParameters>
  | ActionParameters<"team_get_place", TeamGetPlaceParameters>
  | ActionParameters<
      "player_get_killing_spree_count",
      PlayerGetKillingSpreeCountParameters
    >
  | ActionParameters<"player_adjust_money", PlayerAdjustMoneyParameters>
  | ActionParameters<"player_enable_purchases", PlayerEnablePurchasesParameters>
  | ActionParameters<"player_get_vehicle", PlayerGetVehicleParameters>
  | ActionParameters<"player_set_vehicle", PlayerSetVehicleParameters>
  | ActionParameters<"player_set_unit", PlayerSetUnitParameters>
  | ActionParameters<"timer_reset", TimerResetParameters>
  | ActionParameters<
      "weapon_set_pickup_priority",
      WeaponSetPickupPriorityParameters
    >
  | ActionParameters<"object_bounce", ObjectBounceParameters>
  | ActionParameters<"hud_widget_set_text", HUDWidgetSetTextParameters>
  | ActionParameters<"hud_widget_set_value", HUDWidgetSetValueParameters>
  | ActionParameters<"hud_widget_set_meter", HUDWidgetSetMeterParameters>
  | ActionParameters<"hud_widget_set_icon", HUDWidgetSetIconParameters>
  | ActionParameters<
      "hud_widget_set_visibility",
      HUDWidgetSetVisibilityParameters
    >
  | ActionParameters<"play_sound", PlaySoundParameters>
  | ActionParameters<"object_set_scale", ObjectSetScaleParameters>
  | ActionParameters<"navpoint_set_text", NavpointSetTextParameters>
  | ActionParameters<"object_get_shield", ObjectGetShieldParameters>
  | ActionParameters<"object_get_health", ObjectGetHealthParameters>
  | ActionParameters<"player_set_objective", PlayerSetObjectiveParameters>
  | ActionParameters<
      "player_set_objective_allegiance",
      PlayerSetObjectiveAllegianceParameters
    >
  | ActionParameters<
      "player_set_objective_allegiance_icon",
      PlayerSetObjectiveAllegianceIconParameters
    >
  | ActionParameters<"team_set_coop_spawning", TeamSetCoopSpawningParameters>
  | ActionParameters<
      "object_set_minimap_visibility",
      ObjectSetMinimapVisibilityParameters
    >
  | ActionParameters<
      "object_set_minimap_priority",
      ObjectSetMinimapPriorityParameters
    >
  | ActionParameters<"object_set_minimap_icon", ObjectSetMinimapIconParameters>
  | ActionParameters<
      "team_set_primary_respawn_object",
      TeamSetPrimaryRespawnObjectParameters
    >
  | ActionParameters<
      "player_set_primary_respawn_object",
      PlayerSetPrimaryRespawnObjectParameters
    >
  | ActionParameters<
      "player_get_fireteam_index",
      PlayerGetFireteamIndexParameters
    >
  | ActionParameters<
      "player_set_fireteam_index",
      PlayerSetFireteamIndexParameters
    >
  | ActionParameters<"object_adjust_shield", ObjectAdjustShieldParameters>
  | ActionParameters<"object_adjust_health", ObjectAdjustHealthParameters>
  | ActionParameters<"object_get_distance", ObjectGetDistanceParameters>
  | ActionParameters<
      "object_adjust_maximum_shield",
      ObjectAdjustMaximumShieldParameters
    >
  | ActionParameters<
      "object_adjust_maximum_health",
      ObjectAdjustMaximumHealthParameters
    >
  | ActionParameters<
      "player_set_requisition_palette",
      PlayerSetRequisitionPaletteParameters
    >
  | ActionParameters<
      "player_set_fireteam_tier",
      PlayerSetFireteamTierParameters
    >
  | ActionParameters<"device_set_power", DeviceSetPowerParameters>
  | ActionParameters<"device_get_power", DeviceGetPowerParameters>
  | ActionParameters<"device_set_position", DeviceSetPositionParameters>
  | ActionParameters<"device_get_position", DeviceGetPositionParameters>
  | ActionParameters<"give_weapon", GiveWeaponParameters>
  | ActionParameters<"adjust_grenades", AdjustGrenadesParameters>
  | ActionParameters<"submit_incident", SubmitIncidentParameters>
  | ActionParameters<
      "submit_incident_with_custom_value",
      SubmitIncidentWithCustomValueParameters
    >
  | ActionParameters<"set_loadout", SetLoadoutParameters>
  | ActionParameters<"set_loadout_palette", SetLoadoutPaletteParameters>
  | ActionParameters<
      "device_set_position_track",
      DeviceSetPositionTrackParameters
    >
  | ActionParameters<"device_animate_position", DeviceAnimatePositionParameters>
  | ActionParameters<
      "device_set_position_immediate",
      DeviceSetPositionImmediateParameters
    >
  | ActionParameters<
      "saved_film_insert_marker",
      SavedFilmInsertMarkerParameters
    >
  | ActionParameters<"respawn_zone_enable", RespawnZoneEnableParameters>
  | ActionParameters<"player_get_weapon", PlayerGetWeaponParameters>
  | ActionParameters<"player_get_equipment", PlayerGetEquipmentParameters>
  | ActionParameters<
      "object_set_never_garbage",
      ObjectSetNeverGarbageParameters
    >
  | ActionParameters<
      "player_get_target_object",
      PlayerGetTargetObjectParameters
    >
  | ActionParameters<"create_tunnel", CreateTunnelParameters>
  | ActionParameters<
      "debug_force_player_view_count",
      DebugForcePlayerViewCountParameters
    >
  | ActionParameters<"player_pick_up_weapon", PlayerPickUpWeaponParameters>
  | ActionParameters<
      "player_set_coop_spawning",
      PlayerSetCoopSpawningParameters
    >
  | ActionParameters<"object_set_orientation", ObjectSetOrientationParameters>
  | ActionParameters<"object_face_object", ObjectFaceObjectParameters>
  | ActionParameters<"biped_give_weapon", BipedGiveWeaponParameters>
  | ActionParameters<"biped_drop_weapon", BipedDropWeaponParameters>
  | ActionParameters<
      "set_scenario_interpolator_state",
      SetScenarioInterpolatorStateParameters
    >
  | ActionParameters<"get_random_object", GetRandomObjectParameters>
  | ActionParameters<
      "game_grief_record_custom_penalty",
      GameGriefRecordCustomPenaltyParameters
    >
  | ActionParameters<
      "boundary_set_player_color",
      BoundarySetPlayerColorParameters
    >
  | ActionParameters<"begin", BeginParameters>
  | ActionParameters<"hs_function_call", HsFunctionCallParameters>
  | ActionParameters<"get_button_time", GetButtonTimeParameters>
  | ActionParameters<
      "team_set_vehicle_spawning",
      TeamSetVehicleSpawningParameters
    >
  | ActionParameters<
      "player_set_vehicle_spawning",
      PlayerSetVehicleSpawningParameters
    >
  | ActionParameters<
      "set_player_respawn_vehicle",
      SetPlayerRespawnVehicleParameters
    >
  | ActionParameters<
      "set_team_respawn_vehicle",
      SetTeamRespawnVehicleParameters
    >
  | ActionParameters<"hide_object", HideObjectParameters>;

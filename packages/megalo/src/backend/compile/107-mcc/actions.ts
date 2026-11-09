import {
  c_action,
  type c_game_engine_custom_variant,
  e_action_type,
  type e_chud_navpoint_icon_type,
  e_fireteam_filter_flags,
  s_action_adjust_grenades_parameters,
  s_action_apply_player_traits_parameters,
  s_action_begin_parameters,
  s_action_biped_drop_weapon_parameters,
  s_action_biped_give_weapon_parameters,
  s_action_boundary_set_player_color_parameters,
  s_action_boundary_set_visible_parameters,
  s_action_break_into_debugger_parameters,
  s_action_create_object_parameters,
  s_action_create_tunnel_parameters,
  s_action_debug_force_player_view_count_parameters,
  s_action_debugging_enable_tracing_parameters,
  s_action_delete_object_parameters,
  s_action_device_animate_position_parameters,
  s_action_device_get_position_parameters,
  s_action_device_get_power_parameters,
  s_action_device_set_position_immediate_parameters,
  s_action_device_set_position_parameters,
  s_action_device_set_position_track_parameters,
  s_action_device_set_power_parameters,
  s_action_end_round_parameters,
  s_action_for_each_parameters,
  s_action_game_grief_record_custom_penalty_parameters,
  s_action_get_button_time_parameters,
  s_action_get_player_holding_object_parameters,
  s_action_get_random_object_parameters,
  s_action_hide_object_parameters,
  s_action_hs_function_call_parameters,
  s_action_hud_post_message_parameters,
  s_action_hud_widget_set_icon_parameters,
  s_action_hud_widget_set_meter_parameters,
  s_action_hud_widget_set_text_parameters,
  s_action_hud_widget_set_value_parameters,
  s_action_hud_widget_set_visibility_parameters,
  s_action_navpoint_set_icon_parameters,
  s_action_navpoint_set_priority_parameters,
  s_action_navpoint_set_text_parameters,
  s_action_navpoint_set_timer_parameters,
  s_action_navpoint_set_visible_parameters,
  s_action_navpoint_set_visible_range_parameters,
  s_action_object_adjust_health_parameters,
  s_action_object_adjust_maximum_health_parameters,
  s_action_object_adjust_maximum_shield_parameters,
  s_action_object_adjust_shield_parameters,
  s_action_object_attach_parameters,
  s_action_object_bounce_parameters,
  s_action_object_destroy_parameters,
  s_action_object_detach_parameters,
  s_action_object_face_object_parameters,
  s_action_object_get_distance_parameters,
  s_action_object_get_health_parameters,
  s_action_object_get_orientation_parameters,
  s_action_object_get_shield_parameters,
  s_action_object_get_velocity_parameters,
  s_action_object_set_invincibility_parameters,
  s_action_object_set_never_garbage_parameters,
  s_action_object_set_orientation_parameters,
  s_action_object_set_scale_parameters,
  s_action_play_sound_parameters,
  s_action_player_adjust_money_parameters,
  s_action_player_death_get_damage_type_parameters,
  s_action_player_death_get_killing_player_parameters,
  s_action_player_death_get_special_type_parameters,
  s_action_player_enable_purchases_parameters,
  s_action_player_get_equipment_parameters,
  s_action_player_get_fireteam_index_parameters,
  s_action_player_get_killing_spree_count_parameters,
  s_action_player_get_place_parameters,
  s_action_player_get_target_object_parameters,
  s_action_player_get_vehicle_parameters,
  s_action_player_get_weapon_parameters,
  s_action_player_pick_up_weapon_parameters,
  s_action_player_set_coop_spawning_parameters,
  s_action_player_set_fireteam_index_parameters,
  s_action_player_set_objective_allegiance_icon_parameters,
  s_action_player_set_objective_allegiance_parameters,
  s_action_player_set_objective_parameters,
  s_action_player_set_primary_respawn_object_parameters,
  s_action_player_set_requisition_palette_parameters,
  s_action_player_set_unit_parameters,
  s_action_player_set_vehicle_parameters,
  s_action_player_set_vehicle_spawning_parameters,
  s_action_print_variable_parameters,
  s_action_random_parameters,
  s_action_respawn_zone_enable_parameters,
  s_action_saved_film_insert_marker_parameters,
  s_action_set_boundary_parameters,
  s_action_set_fireteam_respawn_filter_parameters,
  s_action_set_loadout_palette_parameters,
  s_action_set_parameters,
  s_action_set_pickup_filter_parameters,
  s_action_set_player_respawn_vehicle_parameters,
  s_action_set_progress_bar_parameters,
  s_action_set_respawn_filter_parameters,
  s_action_set_scenario_interpolator_state_parameters,
  s_action_set_score_parameters,
  s_action_set_team_respawn_vehicle_parameters,
  s_action_submit_incident_parameters,
  s_action_submit_incident_with_custom_value_parameters,
  s_action_team_get_place_parameters,
  s_action_team_set_coop_spawning_parameters,
  s_action_team_set_primary_respawn_object_parameters,
  s_action_team_set_vehicle_spawning_parameters,
  s_action_timer_reset_parameters,
  s_action_timer_set_rate_parameters,
  s_action_weapon_set_pickup_priority_parameters,
} from "@blamnetwork/blf/haloreach_mcc/v_untracked_25_08_16_1352";
import { encodeActionType } from "src/backend/compile/107-mcc/enums/e_action_type";
import { encodeBipedGiveWeaponMode } from "src/backend/compile/107-mcc/enums/e_biped_give_weapon_mode";
import { encodeGameEngineTimerRate } from "src/backend/compile/107-mcc/enums/e_game_engine_timer_rate";
import { encodeGrenadeType } from "src/backend/compile/107-mcc/enums/e_grenade_type";
import { encodeMathOperation } from "src/backend/compile/107-mcc/enums/e_math_operation";
import { encodeMegaloSound } from "src/backend/compile/107-mcc/enums/e_megalo_sound";
import { encodeNavpointPriority } from "src/backend/compile/107-mcc/enums/e_navpoint_priority";
import { encodeScriptableGameButtons } from "src/backend/compile/107-mcc/enums/e_scriptable_game_buttons";
import { encodeWeaponPickupPriority } from "src/backend/compile/107-mcc/enums/e_weapon_pickup_priority";
import { encodeLoadoutPaletteIndex } from "src/backend/compile/107-mcc/enums/loadout_palette_index";
import {
  encodeBoundaryShape,
  encodeCreateObjectFlags,
  encodeCustomTimerReference,
  encodeCustomVariableReference,
  encodeDynamicString,
  encodeHudMeterInput,
  encodeObjectOffset,
  encodeObjectReference,
  encodeObjectTypeReference,
  encodePlayerFilterModifier,
  encodePlayerPurchaseModeFlags,
  encodePlayerReference,
  encodeTeamOrPlayerTarget,
  encodeTeamReference,
  encodeVariantVariable,
} from "src/backend/compile/107-mcc/references";
import {
  BUILT_IN_LOCATION,
  type Diagnostics,
  UNKNOWN_LOCATION,
} from "src/diagnostics";
import { CompilerError } from "src/diagnostics/error";
import type {
  FieldLocations,
  IR,
} from "src/frontend/intermediate-representation";
import {
  type Action,
  ActionType,
  BoundaryShape,
  type FireteamFilter,
  type SetBoundaryParameters,
} from "src/frontend/intermediate-representation/game/megalogamengine/megalogamengine_actions";
import type { Trigger } from "src/frontend/intermediate-representation/game/megalogamengine/megalogamengine_trigger";
import { encodeNoObjectReference } from "src/frontend/intermediate-representation/parameters";

const encodeFireteamFilter = (
  value: FireteamFilter
): e_fireteam_filter_flags => {
  const flags = new e_fireteam_filter_flags();
  flags.fireteam1 = value.fireteam1;
  flags.fireteam2 = value.fireteam2;
  flags.fireteam3 = value.fireteam3;
  flags.fireteam4 = value.fireteam4;
  flags.fireteam5 = value.fireteam5;
  flags.fireteam6 = value.fireteam6;
  flags.fireteam7 = value.fireteam7;
  flags.fireteam8 = value.fireteam8;
  return flags;
};
const assignSetBoundaryParameters = (
  params: s_action_set_boundary_parameters,
  boundary: SetBoundaryParameters
): void => {
  params.m_object = encodeObjectReference(boundary.object);
  params.m_shape = encodeBoundaryShape(boundary.shape) as typeof params.m_shape;
  switch (boundary.shape) {
    case BoundaryShape.none:
      break;
    case BoundaryShape.sphere:
      params.m_variable_1 = encodeCustomVariableReference(boundary.radius);
      break;
    case BoundaryShape.box:
      // MegaloEdit encode order: width, depth, pos_height, neg_height
      params.m_variable_1 = encodeCustomVariableReference(boundary.width);
      params.m_variable_2 = encodeCustomVariableReference(boundary.depth);
      params.m_variable_3 = encodeCustomVariableReference(boundary.posHeight);
      params.m_variable_4 = encodeCustomVariableReference(boundary.negHeight);
      break;
    case BoundaryShape.cylinder:
      // MegaloEdit encode order: radius, pos_height, neg_height. The heights
      // use the same slots as a box's (variables 3 and 4).
      params.m_variable_1 = encodeCustomVariableReference(boundary.radius);
      params.m_variable_3 = encodeCustomVariableReference(boundary.posHeight);
      params.m_variable_4 = encodeCustomVariableReference(boundary.negHeight);
      break;
    default: {
      const _exhaustive: never = boundary;
      void _exhaustive;
    }
  }
};
const compileAction = (
  _action: Action,
  _diagnostics: Diagnostics,
  locations: FieldLocations
): c_action => {
  const action = _action;
  const target = new c_action();
  target.m_type = encodeActionType(action.type);
  switch (action.type) {
    case ActionType.set_score: {
      const params = new s_action_set_score_parameters();
      params.m_target = encodeTeamOrPlayerTarget(action.parameters.target);
      params.m_operation = encodeMathOperation(action.parameters.operation);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.variable
      );
      target.m_set_score_parameters = params;
      break;
    }
    case ActionType.create_object: {
      const params = new s_action_create_object_parameters();
      params.m_object_type = encodeObjectTypeReference(
        action.parameters.objectType
      );
      params.m_object_reference_1 = encodeObjectReference(
        action.parameters.object_reference_out ?? encodeNoObjectReference()
      );
      params.m_object_reference_2 = encodeObjectReference(
        action.parameters.place_at_object
      );
      params.m_filter_index = action.parameters.labelIndex ?? -1;
      params.m_flags = encodeCreateObjectFlags(action.parameters);
      params.m_offset = encodeObjectOffset(
        action.parameters.offset ?? { x: 0, y: 0, z: 0 }
      );
      params.m_variant_name_index = action.parameters.variantNameIndex ?? 0;
      target.m_create_object_parameters = params;
      break;
    }
    case ActionType.delete_object: {
      const params = new s_action_delete_object_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      target.m_delete_object_parameters = params;
      break;
    }
    case ActionType.navpoint_set_visible: {
      const params = new s_action_navpoint_set_visible_parameters();
      params.m_object = encodeObjectReference(action.parameters.navpoint);
      params.m_player_filter_modifier = encodePlayerFilterModifier(
        action.parameters.playerFilterModifier
      );
      target.m_navpoint_set_visible_parameters = params;
      break;
    }
    case ActionType.navpoint_set_icon: {
      const params = new s_action_navpoint_set_icon_parameters();
      params.m_object = encodeObjectReference(action.parameters.navpoint);
      params.m_navpoint_icon = Number(
        action.parameters.icon
      ) as unknown as e_chud_navpoint_icon_type;
      if (action.parameters.number !== undefined) {
        params.m_navpoint_number = encodeCustomVariableReference(
          action.parameters.number
        );
      }
      target.m_navpoint_set_icon_parameters = params;
      break;
    }
    case ActionType.navpoint_set_priority: {
      const params = new s_action_navpoint_set_priority_parameters();
      params.m_object = encodeObjectReference(action.parameters.navpoint);
      params.m_priority = encodeNavpointPriority(action.parameters.priority);
      target.m_navpoint_set_priority_parameters = params;
      break;
    }
    case ActionType.navpoint_set_timer: {
      const params = new s_action_navpoint_set_timer_parameters();
      params.m_object = encodeObjectReference(action.parameters.navpoint);
      params.m_timer_index = action.parameters.timerIndex;
      target.m_navpoint_set_timer_parameters = params;
      break;
    }
    case ActionType.navpoint_set_visible_range: {
      const params = new s_action_navpoint_set_visible_range_parameters();
      params.m_object = encodeObjectReference(action.parameters.navpoint);
      params.m_variable_1 = encodeCustomVariableReference(
        action.parameters.minFeet
      );
      params.m_variable_2 = encodeCustomVariableReference(
        action.parameters.maxFeet
      );
      target.m_navpoint_set_visible_range_parameters = params;
      break;
    }
    case ActionType.set: {
      const params = new s_action_set_parameters();
      params.m_variable_1 = encodeVariantVariable(action.parameters.left);
      params.m_variable_2 = encodeVariantVariable(action.parameters.right);
      params.m_operation = encodeMathOperation(action.parameters.operation);
      target.m_set_parameters = params;
      break;
    }
    case ActionType.set_boundary: {
      const params = new s_action_set_boundary_parameters();
      assignSetBoundaryParameters(params, action.parameters);
      target.m_set_boundary_parameters = params;
      break;
    }
    case ActionType.apply_player_traits: {
      const params = new s_action_apply_player_traits_parameters();
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_trait_index = action.parameters.traitIndex;
      target.m_apply_player_traits_parameters = params;
      break;
    }
    case ActionType.set_pickup_filter: {
      const params = new s_action_set_pickup_filter_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_player_filter_modifier = encodePlayerFilterModifier(
        action.parameters.playerFilterModifier
      );
      target.m_set_pickup_filter_parameters = params;
      break;
    }
    case ActionType.set_respawn_filter: {
      const params = new s_action_set_respawn_filter_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_player_filter_modifier = encodePlayerFilterModifier(
        action.parameters.playerFilterModifier
      );
      target.m_set_respawn_filter_parameters = params;
      break;
    }
    case ActionType.set_fireteam_respawn_filter: {
      const params = new s_action_set_fireteam_respawn_filter_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_fireteam_filter = encodeFireteamFilter(
        action.parameters.fireteamFilter
      );
      target.m_set_fireteam_respawn_filter_parameters = params;
      break;
    }
    case ActionType.set_progress_bar: {
      const params = new s_action_set_progress_bar_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_player_filter_modifier = encodePlayerFilterModifier(
        action.parameters.playerFilterModifier
      );
      params.m_timer_index = action.parameters.timerIndex;
      target.m_set_progress_bar_parameters = params;
      break;
    }
    case ActionType.hud_post_message: {
      const params = new s_action_hud_post_message_parameters();
      params.m_target = encodeTeamOrPlayerTarget(action.parameters.target);
      params.m_sound_index = encodeMegaloSound(action.parameters.soundIndex);
      params.m_string = encodeDynamicString(action.parameters.string);
      target.m_hud_post_message_parameters = params;
      break;
    }
    case ActionType.timer_set_rate: {
      const params = new s_action_timer_set_rate_parameters();
      params.m_timer = encodeCustomTimerReference(action.parameters.timer);
      params.m_rate = encodeGameEngineTimerRate(
        action.parameters.rate,
        _diagnostics,
        locations.get(action.parameters, "rate")
      );
      target.m_timer_set_rate_parameters = params;
      break;
    }
    case ActionType.print_variable: {
      const params = new s_action_print_variable_parameters();
      params.m_string = encodeDynamicString(action.parameters.string);
      target.m_print_variable_parameters = params;
      break;
    }
    case ActionType.get_player_holding_object: {
      const params = new s_action_get_player_holding_object_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_player = encodePlayerReference(action.parameters.playerOut);
      target.m_get_player_holding_object_parameters = params;
      break;
    }
    case ActionType.for_each: {
      const params = new s_action_for_each_parameters();
      params.m_trigger_index = action.parameters.triggerIndex;
      target.m_for_each_parameters = params;
      break;
    }
    case ActionType.end_round: {
      target.m_end_round_parameters = new s_action_end_round_parameters();
      break;
    }
    case ActionType.boundary_set_visible: {
      const params = new s_action_boundary_set_visible_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_player_filter_modifier = encodePlayerFilterModifier(
        action.parameters.playerFilterModifier
      );
      target.m_boundary_set_visible_parameters = params;
      break;
    }
    case ActionType.object_destroy: {
      const params = new s_action_object_destroy_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_no_statistics = action.parameters.noStatistics ?? false;
      target.m_object_destroy_parameters = params;
      break;
    }
    case ActionType.object_set_invincibility: {
      const params = new s_action_object_set_invincibility_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.invincible
      );
      target.m_object_set_invincibility_parameters = params;
      break;
    }
    case ActionType.random: {
      const params = new s_action_random_parameters();
      params.m_variable_1 = encodeCustomVariableReference(
        action.parameters.range
      );
      params.m_variable_2 = encodeCustomVariableReference(
        action.parameters.valueOut
      );
      target.m_random_parameters = params;
      break;
    }
    case ActionType.break_into_debugger: {
      target.m_break_into_debugger_parameters =
        new s_action_break_into_debugger_parameters();
      break;
    }
    case ActionType.object_get_orientation: {
      const params = new s_action_object_get_orientation_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.orientationOut
      );
      target.m_object_get_orientation_parameters = params;
      break;
    }
    case ActionType.object_get_velocity: {
      const params = new s_action_object_get_velocity_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.velocityOut
      );
      target.m_object_get_velocity_parameters = params;
      break;
    }
    case ActionType.player_death_get_killing_player: {
      const params = new s_action_player_death_get_killing_player_parameters();
      params.m_player_1 = encodePlayerReference(action.parameters.deadPlayer);
      params.m_player_2 = encodePlayerReference(
        action.parameters.killingPlayerOut
      );
      target.m_player_death_get_killing_player_parameters = params;
      break;
    }
    case ActionType.player_death_get_damage_type: {
      const params = new s_action_player_death_get_damage_type_parameters();
      params.m_player = encodePlayerReference(action.parameters.deadPlayer);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.damageTypeOut
      );
      target.m_player_death_get_damage_type_parameters = params;
      break;
    }
    case ActionType.player_death_get_special_type: {
      const params = new s_action_player_death_get_special_type_parameters();
      params.m_player = encodePlayerReference(action.parameters.deadPlayer);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.specialTypeOut
      );
      target.m_player_death_get_special_type_parameters = params;
      break;
    }
    case ActionType.debugging_enable_tracing: {
      const params = new s_action_debugging_enable_tracing_parameters();
      params.m_tracing_enabled = action.parameters.tracingEnabled;
      target.m_debugging_enable_tracing_parameters = params;
      break;
    }
    case ActionType.object_attach: {
      const params = new s_action_object_attach_parameters();
      params.m_object_1 = encodeObjectReference(action.parameters.child);
      params.m_object_2 = encodeObjectReference(action.parameters.parent);
      params.m_offset = encodeObjectOffset(action.parameters.offset);
      params.m_absolute_orientation =
        action.parameters.absoluteOrientation ?? false;
      target.m_object_attach_parameters = params;
      break;
    }
    case ActionType.object_detach: {
      const params = new s_action_object_detach_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      target.m_object_detach_parameters = params;
      break;
    }
    case ActionType.player_get_place: {
      const params = new s_action_player_get_place_parameters();
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.placeOut
      );
      target.m_player_get_place_parameters = params;
      break;
    }
    case ActionType.team_get_place: {
      const params = new s_action_team_get_place_parameters();
      params.m_team = encodeTeamReference(action.parameters.team);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.placeOut
      );
      target.m_team_get_place_parameters = params;
      break;
    }
    case ActionType.player_get_killing_spree_count: {
      const params = new s_action_player_get_killing_spree_count_parameters();
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.spreeCountOut
      );
      target.m_player_get_killing_spree_count_parameters = params;
      break;
    }
    case ActionType.player_adjust_money: {
      const params = new s_action_player_adjust_money_parameters();
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_math_operation = encodeMathOperation(
        action.parameters.operation
      );
      params.m_variable = encodeCustomVariableReference(
        action.parameters.amount
      );
      target.m_player_adjust_money_parameters = params;
      break;
    }
    case ActionType.player_enable_purchases: {
      const params = new s_action_player_enable_purchases_parameters();
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.enabled
      );
      params.m_mode = encodePlayerPurchaseModeFlags(
        action.parameters.selectedModes
      );
      target.m_player_enable_purchases_parameters = params;
      break;
    }
    case ActionType.player_get_vehicle: {
      const params = new s_action_player_get_vehicle_parameters();
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_object = encodeObjectReference(action.parameters.vehicleOut);
      target.m_player_get_vehicle_parameters = params;
      break;
    }
    case ActionType.player_set_vehicle: {
      const params = new s_action_player_set_vehicle_parameters();
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_object = encodeObjectReference(action.parameters.vehicle);
      target.m_player_set_vehicle_parameters = params;
      break;
    }
    case ActionType.player_set_unit: {
      const params = new s_action_player_set_unit_parameters();
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_object = encodeObjectReference(action.parameters.unit);
      target.m_player_set_unit_parameters = params;
      break;
    }
    case ActionType.timer_reset: {
      const params = new s_action_timer_reset_parameters();
      params.m_timer = encodeCustomTimerReference(action.parameters.timer);
      target.m_timer_reset_parameters = params;
      break;
    }
    case ActionType.weapon_set_pickup_priority: {
      const params = new s_action_weapon_set_pickup_priority_parameters();
      params.m_object = encodeObjectReference(action.parameters.weapon);
      params.m_weapon_pickup_priority = encodeWeaponPickupPriority(
        action.parameters.priority
      );
      target.m_weapon_set_pickup_priority_parameters = params;
      break;
    }
    case ActionType.object_bounce: {
      const params = new s_action_object_bounce_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      target.m_object_bounce_parameters = params;
      break;
    }
    case ActionType.hud_widget_set_text: {
      const params = new s_action_hud_widget_set_text_parameters();
      params.m_widget_index = action.parameters.widgetIndex;
      params.m_string = encodeDynamicString(action.parameters.string);
      target.m_hud_widget_set_text_parameters = params;
      break;
    }
    case ActionType.hud_widget_set_value: {
      const params = new s_action_hud_widget_set_value_parameters();
      params.m_widget_index = action.parameters.widgetIndex;
      params.m_string = encodeDynamicString(action.parameters.value);
      target.m_hud_widget_set_value_parameters = params;
      break;
    }
    case ActionType.hud_widget_set_meter: {
      const params = new s_action_hud_widget_set_meter_parameters();
      params.m_widget_index = action.parameters.widgetIndex;
      params.m_meter_input = encodeHudMeterInput(action.parameters.meterInput);
      target.m_hud_widget_set_meter_parameters = params;
      break;
    }
    case ActionType.hud_widget_set_icon: {
      const params = new s_action_hud_widget_set_icon_parameters();
      params.m_widget_index = action.parameters.widgetIndex;
      params.m_icon_index = action.parameters.iconIndex;
      target.m_hud_widget_set_icon_parameters = params;
      break;
    }
    case ActionType.hud_widget_set_visibility: {
      const params = new s_action_hud_widget_set_visibility_parameters();
      params.m_widget_index = action.parameters.widgetIndex;
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_visible = action.parameters.visible;
      target.m_hud_widget_set_visibility_parameters = params;
      break;
    }
    case ActionType.play_sound: {
      const params = new s_action_play_sound_parameters();
      params.m_sound_index = encodeMegaloSound(action.parameters.soundIndex);
      params.m_immediate = action.parameters.immediate;
      params.m_target = encodeTeamOrPlayerTarget(action.parameters.target);
      target.m_play_sound_parameters = params;
      break;
    }
    case ActionType.object_set_scale: {
      const params = new s_action_object_set_scale_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      if (action.parameters.scale.kind === "variable") {
        params.m_variable = encodeCustomVariableReference(
          action.parameters.scale.value
        );
      }
      target.m_object_set_scale_parameters = params;
      break;
    }
    case ActionType.navpoint_set_text: {
      const params = new s_action_navpoint_set_text_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_string = encodeDynamicString(action.parameters.string);
      target.m_navpoint_set_text_parameters = params;
      break;
    }
    case ActionType.object_get_shield: {
      const params = new s_action_object_get_shield_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.variable
      );
      target.m_object_get_shield_parameters = params;
      break;
    }
    case ActionType.object_get_health: {
      const params = new s_action_object_get_health_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.variable
      );
      target.m_object_get_health_parameters = params;
      break;
    }
    case ActionType.player_set_objective: {
      const params = new s_action_player_set_objective_parameters();
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_string = encodeDynamicString(action.parameters.objective);
      target.m_player_set_objective_parameters = params;
      break;
    }
    case ActionType.player_set_objective_allegiance: {
      const params = new s_action_player_set_objective_allegiance_parameters();
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_string = encodeDynamicString(action.parameters.allegiance);
      target.m_player_set_objective_allegiance_parameters = params;
      break;
    }
    case ActionType.player_set_objective_allegiance_icon: {
      const params =
        new s_action_player_set_objective_allegiance_icon_parameters();
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_icon_index = action.parameters.iconIndex;
      target.m_player_set_objective_allegiance_icon_parameters = params;
      break;
    }
    case ActionType.team_set_coop_spawning: {
      const params = new s_action_team_set_coop_spawning_parameters();
      params.m_team = encodeTeamReference(action.parameters.team);
      params.m_enabled = action.parameters.coopSpawningEnabled;
      target.m_team_set_coop_spawning_parameters = params;
      break;
    }
    case ActionType.team_set_primary_respawn_object: {
      const params = new s_action_team_set_primary_respawn_object_parameters();
      params.m_team = encodeTeamReference(action.parameters.team);
      params.m_object = encodeObjectReference(action.parameters.respawnObject);
      target.m_team_set_primary_respawn_object_parameters = params;
      break;
    }
    case ActionType.player_set_primary_respawn_object: {
      const params =
        new s_action_player_set_primary_respawn_object_parameters();
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_object = encodeObjectReference(action.parameters.respawnObject);
      target.m_player_set_primary_respawn_object_parameters = params;
      break;
    }
    case ActionType.player_get_fireteam_index: {
      const params = new s_action_player_get_fireteam_index_parameters();
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.fireteamIndexOut
      );
      target.m_player_get_fireteam_index_parameters = params;
      break;
    }
    case ActionType.player_set_fireteam_index: {
      const params = new s_action_player_set_fireteam_index_parameters();
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.fireteamIndex
      );
      target.m_player_set_fireteam_index_parameters = params;
      break;
    }
    case ActionType.object_adjust_shield: {
      const params = new s_action_object_adjust_shield_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_operation = encodeMathOperation(action.parameters.operation);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.amount
      );
      target.m_object_adjust_shield_parameters = params;
      break;
    }
    case ActionType.object_adjust_health: {
      const params = new s_action_object_adjust_health_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_operation = encodeMathOperation(action.parameters.operation);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.amount
      );
      target.m_object_adjust_health_parameters = params;
      break;
    }
    case ActionType.object_get_distance: {
      const params = new s_action_object_get_distance_parameters();
      params.m_object_1 = encodeObjectReference(action.parameters.from);
      params.m_object_2 = encodeObjectReference(action.parameters.to);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.distanceOut
      );
      target.m_object_get_distance_parameters = params;
      break;
    }
    case ActionType.object_adjust_maximum_shield: {
      const params = new s_action_object_adjust_maximum_shield_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_operation = encodeMathOperation(action.parameters.operation);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.amount
      );
      target.m_object_adjust_maximum_shield_parameters = params;
      break;
    }
    case ActionType.object_adjust_maximum_health: {
      const params = new s_action_object_adjust_maximum_health_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_operation = encodeMathOperation(action.parameters.operation);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.amount
      );
      target.m_object_adjust_maximum_health_parameters = params;
      break;
    }
    case ActionType.player_set_requisition_palette: {
      const params = new s_action_player_set_requisition_palette_parameters();
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_new_palette = action.parameters.requisitionPaletteIndex;
      target.m_player_set_requisition_palette_parameters = params;
      break;
    }
    case ActionType.device_set_power: {
      const params = new s_action_device_set_power_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.power
      );
      target.m_device_set_power_parameters = params;
      break;
    }
    case ActionType.device_get_power: {
      const params = new s_action_device_get_power_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.powerOut
      );
      target.m_device_get_power_parameters = params;
      break;
    }
    case ActionType.device_set_position: {
      const params = new s_action_device_set_position_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.position
      );
      target.m_device_set_position_parameters = params;
      break;
    }
    case ActionType.device_get_position: {
      const params = new s_action_device_get_position_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.positionOut
      );
      target.m_device_get_position_parameters = params;
      break;
    }
    case ActionType.adjust_grenades: {
      const params = new s_action_adjust_grenades_parameters();
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_grenade_type = encodeGrenadeType(action.parameters.grenadeType);
      params.m_math_operation = encodeMathOperation(
        action.parameters.operation
      );
      params.m_variable = encodeCustomVariableReference(
        action.parameters.amount
      );
      target.m_adjust_grenades_parameters = params;
      break;
    }
    case ActionType.submit_incident: {
      const params = new s_action_submit_incident_parameters();
      params.m_incident_id = action.parameters.statIndex;
      params.m_target_1 = encodeTeamOrPlayerTarget(action.parameters.cause);
      params.m_target_2 = encodeTeamOrPlayerTarget(action.parameters.effect);
      target.m_submit_incident_parameters = params;
      break;
    }
    case ActionType.submit_incident_with_custom_value: {
      const params =
        new s_action_submit_incident_with_custom_value_parameters();
      params.m_incident_id = action.parameters.statIndex;
      params.m_target_1 = encodeTeamOrPlayerTarget(action.parameters.cause);
      params.m_target_2 = encodeTeamOrPlayerTarget(action.parameters.effect);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.customValue
      );
      target.m_submit_incident_with_custom_value_parameters = params;
      break;
    }
    case ActionType.set_loadout_palette: {
      const params = new s_action_set_loadout_palette_parameters();
      params.m_target = encodeTeamOrPlayerTarget(action.parameters.target);
      // Shipping IR always carries loadoutPaletteType; syntax is a LowerError.
      if (!("loadoutPaletteType" in action.parameters)) {
        throw new CompilerError(
          "set_loadout_palette missing loadoutPaletteType",
          locations.get(action.parameters, "loadoutPaletteIndex") ??
            UNKNOWN_LOCATION
        );
      }
      params.m_loadout_palette_index = encodeLoadoutPaletteIndex(
        action.parameters.loadoutPaletteType
      );
      target.m_set_loadout_palette_parameters = params;
      break;
    }
    case ActionType.device_set_position_track: {
      const params = new s_action_device_set_position_track_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_animation_name_index = action.parameters.animationNameIndex;
      params.m_variable = encodeCustomVariableReference(
        action.parameters.interpolationTime
      );
      target.m_device_set_position_track_parameters = params;
      break;
    }
    case ActionType.device_animate_position: {
      const params = new s_action_device_animate_position_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_variable_1 = encodeCustomVariableReference(
        action.parameters.animationTargetFraction
      );
      params.m_variable_2 = encodeCustomVariableReference(
        action.parameters.animationDurationSeconds
      );
      params.m_variable_3 = encodeCustomVariableReference(
        action.parameters.accelerationSeconds
      );
      params.m_variable_4 = encodeCustomVariableReference(
        action.parameters.decelerationSeconds
      );
      target.m_device_animate_position_parameters = params;
      break;
    }
    case ActionType.device_set_position_immediate: {
      const params = new s_action_device_set_position_immediate_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.position
      );
      target.m_device_set_position_immediate_parameters = params;
      break;
    }
    case ActionType.saved_film_insert_marker: {
      const params = new s_action_saved_film_insert_marker_parameters();
      params.m_variable = encodeCustomVariableReference(
        action.parameters.offsetSeconds
      );
      params.m_string = encodeDynamicString(action.parameters.label);
      target.m_saved_film_insert_marker_parameters = params;
      break;
    }
    case ActionType.respawn_zone_enable: {
      const params = new s_action_respawn_zone_enable_parameters();
      params.m_object = encodeObjectReference(action.parameters.respawnZone);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.enabled
      );
      target.m_respawn_zone_enable_parameters = params;
      break;
    }
    case ActionType.player_get_weapon: {
      const params = new s_action_player_get_weapon_parameters();
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_primary = action.parameters.primary;
      params.m_object = encodeObjectReference(action.parameters.weapon);
      target.m_player_get_weapon_parameters = params;
      break;
    }
    case ActionType.player_get_equipment: {
      const params = new s_action_player_get_equipment_parameters();
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_object = encodeObjectReference(action.parameters.equipmentOut);
      target.m_player_get_equipment_parameters = params;
      break;
    }
    case ActionType.object_set_never_garbage: {
      const params = new s_action_object_set_never_garbage_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.neverGarbage
      );
      target.m_object_set_never_garbage_parameters = params;
      break;
    }
    case ActionType.player_get_target_object: {
      const params = new s_action_player_get_target_object_parameters();
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_object = encodeObjectReference(action.parameters.objectOut);
      target.m_player_get_target_object_parameters = params;
      break;
    }
    case ActionType.create_tunnel: {
      const params = new s_action_create_tunnel_parameters();
      params.m_object_1 = encodeObjectReference(
        action.parameters.from
      ) as unknown as typeof params.m_object_1;
      params.m_object_2 = encodeObjectReference(
        action.parameters.to
      ) as unknown as typeof params.m_object_2;
      params.m_object_type = encodeObjectTypeReference(
        action.parameters.objectType
      ) as unknown as typeof params.m_object_type;
      params.m_variable = encodeCustomVariableReference(
        action.parameters.radious
      );
      params.m_object_3 = encodeObjectReference(
        action.parameters.objectReferenceOut
      ) as unknown as typeof params.m_object_3;
      target.m_create_tunnel_parameters = params;
      break;
    }
    case ActionType.debug_force_player_view_count: {
      const params = new s_action_debug_force_player_view_count_parameters();
      params.m_variable = encodeCustomVariableReference(
        action.parameters.viewCount
      );
      target.m_debug_force_player_view_count_parameters = params;
      break;
    }
    case ActionType.player_pick_up_weapon: {
      const params = new s_action_player_pick_up_weapon_parameters();
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_object = encodeObjectReference(action.parameters.weapon);
      target.m_player_pick_up_weapon_parameters = params;
      break;
    }
    case ActionType.player_set_coop_spawning: {
      const params = new s_action_player_set_coop_spawning_parameters();
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_enabled = action.parameters.enabled;
      target.m_player_set_coop_spawning_parameters = params;
      break;
    }
    case ActionType.object_set_orientation: {
      const params = new s_action_object_set_orientation_parameters();
      params.m_object_1 = encodeObjectReference(action.parameters.object);
      params.m_object_2 = encodeObjectReference(action.parameters.source);
      params.m_absolute_orientation =
        action.parameters.absoluteOrientation ?? false;
      target.m_object_set_orientation_parameters = params;
      break;
    }
    case ActionType.object_face_object: {
      const params = new s_action_object_face_object_parameters();
      params.m_object_1 = encodeObjectReference(action.parameters.object);
      params.m_object_2 = encodeObjectReference(action.parameters.target);
      params.m_offset = encodeObjectOffset(
        action.parameters.offset ?? { x: 0, y: 0, z: 0 }
      );
      target.m_object_face_object_parameters = params;
      break;
    }
    case ActionType.biped_give_weapon: {
      const params = new s_action_biped_give_weapon_parameters();
      params.m_object = encodeObjectReference(action.parameters.biped);
      params.m_object_type = encodeObjectTypeReference(
        action.parameters.weapon
      );
      params.m_mode = encodeBipedGiveWeaponMode(action.parameters.mode);
      target.m_biped_give_weapon_parameters = params;
      break;
    }
    case ActionType.biped_drop_weapon: {
      const params = new s_action_biped_drop_weapon_parameters();
      params.m_object = encodeObjectReference(action.parameters.biped);
      params.m_primary = action.parameters.primary;
      params.m_delete_on_drop = action.parameters.deleteOnDrop;
      target.m_biped_drop_weapon_parameters = params;
      break;
    }
    case ActionType.set_scenario_interpolator_state: {
      const params = new s_action_set_scenario_interpolator_state_parameters();
      params.m_variable_1 = encodeCustomVariableReference(
        action.parameters.interpolatorIndex
      );
      params.m_variable_2 = encodeCustomVariableReference(
        action.parameters.active
      );
      target.m_set_scenario_interpolator_state_parameters = params;
      break;
    }
    case ActionType.get_random_object: {
      const params = new s_action_get_random_object_parameters();
      params.m_object_1 = encodeObjectReference(action.parameters.ignoreObject);
      params.m_object_2 = encodeObjectReference(action.parameters.objectOut);
      params.m_filter_index = action.parameters.filterIndex;
      target.m_get_random_object_parameters = params;
      break;
    }
    case ActionType.game_grief_record_custom_penalty: {
      const params = new s_action_game_grief_record_custom_penalty_parameters();
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.variable
      );
      target.m_game_grief_record_custom_penalty_parameters = params;
      break;
    }
    case ActionType.boundary_set_player_color: {
      const params = new s_action_boundary_set_player_color_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_player_index = action.parameters.playerIndex;
      target.m_boundary_set_player_color_parameters = params;
      break;
    }
    case ActionType.begin: {
      const params = new s_action_begin_parameters();
      params.m_first_condition_index = action.parameters.firstConditionIndex;
      params.m_condition_count = action.parameters.conditionCount;
      params.m_first_action_index = action.parameters.firstActionIndex;
      params.m_action_count = action.parameters.actionCount;
      target.m_begin_parameters = params;
      break;
    }
    case ActionType.hs_function_call: {
      const params = new s_action_hs_function_call_parameters();
      // BLF writes index + 1 on the wire.
      params.m_function_name_index = action.parameters.functionNameIndex;
      target.m_hs_function_call_parameters = params;
      break;
    }
    case ActionType.get_button_time: {
      const params = new s_action_get_button_time_parameters();
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_buttons = encodeScriptableGameButtons(action.parameters.button);
      params.m_variable = encodeCustomVariableReference(
        action.parameters.timeOut
      );
      target.m_get_button_time_parameters = params;
      break;
    }
    case ActionType.team_set_vehicle_spawning: {
      const params = new s_action_team_set_vehicle_spawning_parameters();
      params.m_team = encodeTeamReference(action.parameters.team);
      params.m_enabled = action.parameters.enabled;
      target.m_team_set_vehicle_spawning_parameters = params;
      break;
    }
    case ActionType.player_set_vehicle_spawning: {
      const params = new s_action_player_set_vehicle_spawning_parameters();
      params.m_player = encodePlayerReference(action.parameters.player);
      params.m_enabled = action.parameters.enabled;
      target.m_player_set_vehicle_spawning_parameters = params;
      break;
    }
    case ActionType.set_player_respawn_vehicle: {
      const params = new s_action_set_player_respawn_vehicle_parameters();
      params.m_object_type = encodeObjectTypeReference(
        action.parameters.objectType
      );
      params.m_player = encodePlayerReference(action.parameters.player);
      target.m_set_player_respawn_vehicle_parameters = params;
      break;
    }
    case ActionType.set_team_respawn_vehicle: {
      const params = new s_action_set_team_respawn_vehicle_parameters();
      params.m_object_type = encodeObjectTypeReference(
        action.parameters.objectType
      );
      params.m_team = encodeTeamReference(action.parameters.team);
      target.m_set_team_respawn_vehicle_parameters = params;
      break;
    }
    case ActionType.hide_object: {
      const params = new s_action_hide_object_parameters();
      params.m_object = encodeObjectReference(action.parameters.object);
      params.m_should_hide = action.parameters.shouldHide;
      target.m_hide_object_parameters = params;
      break;
    }
    default: {
      throw new Error(
        `Action ${(action as { type: string }).type} is not supported on this version`
      );
    }
  }
  return target;
};

const validatePregameActionRange = (
  actions: readonly c_action[],
  triggers: readonly Trigger[],
  firstAction: number,
  actionCount: number,
  diagnostics: Diagnostics
): void => {
  for (let i = firstAction; i < firstAction + actionCount; i++) {
    const action = actions[i];
    if (action === undefined) {
      continue;
    }
    if (!action.executable_pregame()) {
      diagnostics.addError(
        "This action can't be used inside a pregame trigger",
        BUILT_IN_LOCATION
      );
    }
    if (
      action.m_type === e_action_type.begin &&
      action.m_begin_parameters !== undefined
    ) {
      validatePregameActionRange(
        actions,
        triggers,
        action.m_begin_parameters.m_first_action_index,
        action.m_begin_parameters.m_action_count,
        diagnostics
      );
    }
    if (
      action.m_type === e_action_type.for_each &&
      action.m_for_each_parameters !== undefined
    ) {
      const nested = triggers[action.m_for_each_parameters.m_trigger_index];
      if (nested !== undefined) {
        validatePregameActionRange(
          actions,
          triggers,
          nested.firstAction,
          nested.actionCount,
          diagnostics
        );
      }
    }
  }
};

// Check that pregame trigger actions are valid
// also runs thru nested triggers (begin, foreach)
const validatePregameActions = (
  ir: IR,
  actions: readonly c_action[],
  diagnostics: Diagnostics
): void => {
  const { pregameTriggerIndex, triggers } = ir.gameVariant.gameEngine;
  if (pregameTriggerIndex < 0 || pregameTriggerIndex >= triggers.length) {
    return;
  }
  const trigger = triggers[pregameTriggerIndex]!;
  validatePregameActionRange(
    actions,
    triggers,
    trigger.firstAction,
    trigger.actionCount,
    diagnostics
  );
};

export const compileActions = (
  ir: IR,
  gameVariant: c_game_engine_custom_variant,
  diagnostics: Diagnostics
): void => {
  const actions = ir.gameVariant.gameEngine.actions.map((action) =>
    compileAction(action, diagnostics, ir.locations)
  );
  gameVariant.m_game_engine.m_actions = actions;
  validatePregameActions(ir, actions, diagnostics);
};

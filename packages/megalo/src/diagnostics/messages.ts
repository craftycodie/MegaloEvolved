import type { SourceLocation } from "src/diagnostics/index";
import { SourceLocationType } from "src/diagnostics/index";
import { TokenKind } from "src/frontend/tokens";
import { formatAlternatives, translate } from "src/localization";

const expectedOneOf = (alternatives: readonly string[], got: string): string =>
  translate("expected_one_of", {
    expected: formatAlternatives(alternatives),
    got,
  });

const formatLocationRef = (location: SourceLocation): string | undefined => {
  if (location.type === SourceLocationType.SOURCE_CODE) {
    return `${location.start.line}:${location.start.column}`;
  }
  if (location.type === SourceLocationType.INCLUDE) {
    const { start } = location.declaration;
    return `${start.line}:${start.column}`;
  }
  return;
};

export const diagnosticMessages = {
  unusedValue(name: string, overriddenAt: SourceLocation): string {
    const location = formatLocationRef(overriddenAt);
    if (location === undefined) {
      return translate("unused_value", { name });
    }
    return translate("unused_value_overridden_at", { name, location });
  },

  invalidParameterCount(expected: number, got: number): string {
    return translate("invalid_parameter_count", {
      expected: String(expected),
      got: String(got),
    });
  },

  expectedOneOf(alternatives: readonly string[], got: string): string {
    return expectedOneOf(alternatives, got);
  },

  expectedElement(value: string): string {
    return translate("unrecognized_element", { value });
  },

  expectedTokenKind(
    expected: TokenKind,
    kind: TokenKind,
    value: string
  ): string {
    // MegaloEdit.exe: Expected token of type <expected>, got one of type <type>: '<token>'
    const expectedName = TokenKind[expected] ?? String(expected);
    const kindName = TokenKind[kind] ?? String(kind);
    return translate("expected_token_kind", {
      expected: expectedName,
      kind: kindName,
      token: value,
    });
  },

  expectedEndBeforeEof(): string {
    // MegaloEdit.exe: Reached end of file reading string table
    return translate("expected_end_before_eof");
  },

  stringAlreadyDefined(language: string, identifier: string): string {
    // MegaloEdit.exe: String table for language <language> already has a string for token <identifier> defined
    return translate("string_already_defined", { language, identifier });
  },

  expectedNumberOrEnd(got: string): string {
    // MegaloEdit.exe: Expected 'number' or 'end' but got '<got>'
    return expectedOneOf(["'number'", "'end'"], got);
  },

  expectedConstantValue(got: string): string {
    // MegaloEdit.exe: Expected 'true', 'false', or numeric constant name; got '<got>'
    return expectedOneOf(
      ["'true'", "'false'", translate("numeric_constant_name")],
      got
    );
  },

  expectedVariableNetworkOrEnd(got: string): string {
    // MegaloEdit.exe: Expected 'local', 'networked', 'networked_high' or 'end' but got '<got>'
    return expectedOneOf(
      ["'local'", "'networked'", "'networked_high'", "'end'"],
      got
    );
  },

  expectedVariableType(got: string): string {
    // MegaloEdit.exe: Expected 'timer', 'number', 'team', 'player', or 'object', but got '<got>'
    return expectedOneOf(
      ["'timer'", "'number'", "'team'", "'player'", "'object'"],
      got
    );
  },

  expectedGameOptionElement(got: string): string {
    return expectedOneOf(
      [
        "'override'",
        "'option'",
        "'ranged_option'",
        "'player_traits'",
        "'lock'",
        "'hide'",
        "'end'",
      ],
      got
    );
  },

  invalidStringIdentifier(identifier: string): string {
    // MegaloEdit.exe: Invalid string identifier '<token>'
    return translate("invalid_string_identifier", { identifier });
  },

  invalidExplicitTeam(token: string): string {
    // MegaloEdit.exe: Invalid explicit team: {0}
    return translate("invalid_explicit_team", { token });
  },

  expectedVariableReference(got: string): string {
    return expectedOneOf([translate("variable_reference")], got);
  },

  objectTypeUsedAsObjectReference(name: string): string {
    return translate("object_type_used_as_object_reference", { name });
  },

  expectedParameterType(expected: string, got: string): string {
    if (got.length === 0) {
      return translate("expected_parameter_type_missing", { expected });
    }
    return translate("expected_parameter_type", { expected, got });
  },

  unknownPlayerTrait(got: string): string {
    // MegaloEdit.exe: Expected player trait modifier, got '<token>'
    return translate("unknown_player_trait", { got });
  },

  unknownLoadoutProperty(got: string): string {
    return translate("unknown_loadout_property", { got });
  },

  unknownTeamsBlockProperty(got: string): string {
    return translate("unknown_teams_block_property", { got });
  },

  unknownTeamProperty(got: string): string {
    return translate("unknown_team_property", { got });
  },

  unknownEngineDataProperty(got: string): string {
    return translate("unknown_engine_data_property", { got });
  },

  unknownGameOptionOverride(got: string): string {
    return translate("unknown_game_option_override", { got });
  },

  unknownCondition(got: string): string {
    return `Unknown condition '${got}'.`;
  },

  unknownAction(got: string): string {
    return `Unknown action '${got}'.`;
  },

  actionNotAllowedInPregame(): string {
    return translate("action_not_allowed_in_pregame");
  },

  objectReferenceMustBeWritable(): string {
    return translate("object_reference_must_be_writable");
  },

  playerReferenceMustBeWriteable(): string {
    return translate("player_reference_must_be_writeable");
  },

  teamReferenceMustBeWriteable(): string {
    return translate("team_reference_must_be_writeable");
  },

  numericReferenceMustBeWriteable(): string {
    return translate("numeric_reference_must_be_writeable");
  },

  unresolvedIdentifier(name: string): string {
    return translate("unresolved_identifier", { name });
  },

  unresolvedScopedIdentifier(base: string, member: string): string {
    return translate("unresolved_scoped_identifier", { base, member });
  },

  unknownTriggerStatement(got: string): string {
    return translate("unrecognized_element", { value: got });
  },

  expectedTemporaryStorage(got: string): string {
    return expectedOneOf(["'number'", "'object'", "'team'", "'player'"], got);
  },

  expectedTemporaryInitial(): string {
    return "Expected temporary variable initial value.";
  },

  tooManyVariables(scope: string, type: string, limit: number): string {
    return translate("too_many_variables", {
      scope,
      type,
      limit: String(limit),
    });
  },

  tooManyHudWidgets(): string {
    return translate("too_many_hud_widgets");
  },

  variantEncodedTooLarge(encoded: number, max: number): string {
    return translate("variant_encoded_too_large", {
      encoded: String(encoded),
      max: String(max),
    });
  },

  scriptStringBytesTooLarge(used: number, max: number): string {
    return translate("script_string_bytes_too_large", {
      used: String(used),
      max: String(max),
    });
  },

  failedToWriteGametypeFile(detail?: string): string {
    const base = translate("failed_to_write_gametype_file");
    if (detail === undefined || detail.length === 0) {
      return base;
    }
    return `${base} ${detail}`;
  },

  tooManyTeamEntries(): string {
    return translate("too_many_team_entries");
  },

  tooManyMapPermissionExceptions(): string {
    return translate("too_many_map_permission_exceptions");
  },

  outOfRange(name: string, min: string | number, max: string | number): string {
    return translate("out_of_range", {
      name,
      min: String(min),
      max: String(max),
    });
  },

  tooManyObjectFilters(): string {
    return translate("too_many_object_filters");
  },

  tooManyGameStatistics(): string {
    return translate("too_many_game_statistics");
  },

  tooManyLoadoutPalettes(limit: number): string {
    return translate("too_many_loadout_palettes", { limit: String(limit) });
  },

  tooManyLoadouts(limit: number): string {
    return translate("too_many_loadouts", { limit: String(limit) });
  },

  tooManyPlayerTraits(limit: number): string {
    return translate("too_many_player_traits", { limit: String(limit) });
  },

  objectTypeIndexOutOfRange(index: number, max: number): string {
    return translate("object_type_index_out_of_range", {
      index: String(index),
      max: String(max),
    });
  },

  objectListExceedsObjectsLimit(count: number, max: number): string {
    return translate("object_list_exceeds_objects_limit", {
      count: String(count),
      max: String(max),
    });
  },

  objectListDuplicateEntry(
    name: string,
    previousLine: number,
    duplicateLine: number
  ): string {
    return translate("object_list_duplicate_entry", {
      name,
      previousLine: String(previousLine),
      duplicateLine: String(duplicateLine),
    });
  },

  fireteamCountOutOfRange(value: number, max: number): string {
    return translate("fireteam_count_out_of_range", {
      value: String(value),
      max: String(max),
    });
  },

  valueOutOfRangeIgnored(
    name: string,
    value: number,
    min: number,
    max: number
  ): string {
    return translate("value_out_of_range_ignored", {
      name,
      value: String(value),
      min: String(min),
      max: String(max),
    });
  },

  expectedLoadoutPaletteItemOrEnd(got: string): string {
    return translate("expected_parameter_type", {
      expected: "item or end",
      got,
    });
  },

  invalidObjectType(): string {
    // MegaloEdit.exe: This is not a valid object type.
    return "This is not a valid object type.";
  },

  duplicateDeclarationNameIgnored(kind: string, name: string): string {
    return translate("duplicate_declaration_name_ignored", { kind, name });
  },

  reservedKeywordVariableName(kind: string, name: string): string {
    return translate("reserved_keyword_variable_name", { kind, name });
  },

  variableShadowingDisabled(kind: string, name: string): string {
    return translate("variable_shadowing_disabled", { kind, name });
  },

  onlyOneBaseDirectiveAllowed(): string {
    return translate("only_one_base_directive_allowed");
  },

  elementNotAllowedInBaseDerived(element: string): string {
    return translate("element_not_allowed_in_base_derived", { element });
  },

  gameOptionNotAllowedInBaseDerived(entry: string): string {
    return translate("game_option_not_allowed_in_base_derived", { entry });
  },

  gameOptionOverrideRequiresBase(entry: string): string {
    return translate("game_option_override_requires_base", { entry });
  },

  lockingHidingPlayerTraitsNotSupported(): string {
    return translate("locking_hiding_player_traits_not_supported");
  },

  megacrowExtensionRequired(extension: string, sourceName: string): string {
    return translate("megacrow_extension_required", { extension, sourceName });
  },

  doubleJumpUnofficialRequiresTagChanges(): string {
    return translate("double_jump_unofficial_requires_tag_changes");
  },

  sprintingDoesNotSeemToFunction(): string {
    return translate("sprinting_does_not_seem_to_function");
  },

  timerRateSnapped(got: string, used: string): string {
    return translate("timer_rate_snapped", { got, used });
  },

  teamColorOverridesDoNotApplyInMccMenus(): string {
    return translate("team_color_overrides_do_not_apply_in_mcc_menus");
  },

  legacyHudWidgetTextKeyword(): string {
    return translate("legacy_hud_widget_text_keyword");
  },

  unsupportedDynamicStringReplacement(got: string): string {
    return translate("unsupported_dynamic_string_replacement", { got });
  },

  objectSetScaleFloatNotSupported(versionLabel: string): string {
    return translate("object_set_scale_float_not_supported", { versionLabel });
  },

  objectSetScaleVariableNotSupported(versionLabel: string): string {
    return translate("object_set_scale_variable_not_supported", {
      versionLabel,
    });
  },

  unsupportedAction(name: string, versionLabel: string): string {
    return translate("unsupported_action", { name, versionLabel });
  },

  unsupportedMathOperation(name: string, versionLabel: string): string {
    return translate("unsupported_math_operation", { name, versionLabel });
  },

  unsupportedEnumMember(
    enumName: string,
    name: string,
    versionLabel: string
  ): string {
    return translate("unsupported_enum_member", {
      enumName,
      name,
      versionLabel,
    });
  },

  stringLiteralNotAllowedWhenStrict(): string {
    return translate("string_literal_not_allowed_when_strict");
  },

  couldNotResolveInclude(path: string): string {
    return translate("could_not_resolve_include", { path });
  },

  couldNotResolveLocalizedInclude(path: string): string {
    return translate("could_not_resolve_localized_include", { path });
  },

  transientVariableInPersistentString(): string {
    // MegaloEdit.exe: Can't use transient variables when reading a persistent string
    return translate("transient_variable_in_persistent_string");
  },
};

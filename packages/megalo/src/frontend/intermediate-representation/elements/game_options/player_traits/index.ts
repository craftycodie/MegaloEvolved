import type { SourceCodeLocation } from "src/diagnostics";
import { diagnosticMessages } from "src/diagnostics/messages";
import type {
  PlayerTraitOptionNode,
  PlayerTraitsElementNode,
  PlayerTraitsOverrideNode,
} from "src/frontend/abstract-syntax-tree/elements/game_options/player_traits";
import { dxAssertionScope } from "src/frontend/intermediate-representation/diagnostics";
import { assertNotErrorNode } from "src/frontend/intermediate-representation/diagnostics/assertNotErrorNode";
import { lowerAppearanceOption } from "src/frontend/intermediate-representation/elements/game_options/player_traits/appearance";
import { parameterLocation } from "src/frontend/intermediate-representation/elements/game_options/player_traits/helpers";
import { lowerMovementOption } from "src/frontend/intermediate-representation/elements/game_options/player_traits/movement";
import { lowerSensorsOption } from "src/frontend/intermediate-representation/elements/game_options/player_traits/sensors";
import { lowerShieldVitalityOption } from "src/frontend/intermediate-representation/elements/game_options/player_traits/shieldVitality";
import { lowerWeaponsOption } from "src/frontend/intermediate-representation/elements/game_options/player_traits/weapons";
import { emptyPlayerTraits } from "src/frontend/intermediate-representation/elements/game_options/shared";
import { LowerError } from "src/frontend/intermediate-representation/error";
import type { PlayerTraits } from "src/frontend/intermediate-representation/game/game_engine_player_traits";
import type { PlayerTraitOption } from "src/frontend/intermediate-representation/game/game_engine_traits";
import {
  asParameterLoweringContext,
  type ElementLowerContext,
  type ParameterLoweringContext,
} from "src/frontend/intermediate-representation/parameters";
import { resolveScriptStringTableReference } from "src/frontend/intermediate-representation/parameters/resolveScriptStringTableReference";

export const lowerPlayerTraitOptions = (
  options: PlayerTraitOptionNode[],
  ctx: ParameterLoweringContext,
  fallbackLocation: SourceCodeLocation
): PlayerTraits => {
  const traits = emptyPlayerTraits();

  for (const option of options) {
    const { identifier, parameters } = option;
    const location = parameterLocation(parameters, fallbackLocation);
    const args = {
      parameters,
      first: parameters[0],
      ctx,
      location,
    };

    const handled =
      lowerShieldVitalityOption(identifier, traits, args) ||
      lowerWeaponsOption(identifier, traits, args) ||
      lowerMovementOption(identifier, traits, args) ||
      lowerAppearanceOption(identifier, traits, args) ||
      lowerSensorsOption(identifier, traits, args);

    if (!handled) {
      throw new LowerError(
        diagnosticMessages.unknownPlayerTrait(identifier),
        location
      );
    }
  }

  return traits;
};

export const lowerPlayerTraits = (
  entry: PlayerTraitsElementNode,
  ctx: ElementLowerContext
) => {
  dxAssertionScope(ctx.diagnostics, () => {
    assertNotErrorNode(entry.name);
    const limit = ctx.frontend.versionConfiguration.limits.playerTraitSets;
    if (ctx.ir.gameVariant.playerTraits.length >= limit) {
      throw new LowerError(
        diagnosticMessages.tooManyPlayerTraits(limit),
        entry.name.location
      );
    }
    const traits = lowerPlayerTraitOptions(
      entry.options,
      asParameterLoweringContext(ctx),
      entry.location
    );
    const option: PlayerTraitOption = {
      name: resolveScriptStringTableReference(entry.displayName, ctx.ir, ctx),
      description: resolveScriptStringTableReference(
        entry.description,
        ctx.ir,
        ctx
      ),
      traits,
    };
    ctx.ir.locations.record(option, "name", entry.displayName.location);
    ctx.ir.locations.record(option, "description", entry.description.location);
    ctx.ir.locations.record(option, "traits", entry.location);
    ctx.ir.gameVariant.playerTraits.push(option);
  });
};

export const lowerPlayerTraitsOptionOverride = (
  entry: PlayerTraitsOverrideNode,
  ctx: ElementLowerContext
) => {
  dxAssertionScope(ctx.diagnostics, () => {
    if (entry.modifiers.lock || entry.modifiers.hide) {
      throw new LowerError(
        diagnosticMessages.lockingHidingPlayerTraitsNotSupported(),
        entry.location
      );
    }
    const traits = lowerPlayerTraitOptions(
      entry.options,
      asParameterLoweringContext(ctx),
      entry.location
    );
    const override = {
      target:
        entry.target.kind === "name"
          ? { kind: "name" as const, value: entry.target.value }
          : { kind: "index" as const, value: entry.target.value },
      traits,
      location: entry.location,
    };
    ctx.ir.baseOverrides.playerTraits.push(override);
    ctx.ir.locations.record(override, "traits", entry.location);
  });
};

import { diagnosticMessages } from "src/diagnostics/messages";
import { SyntaxKind } from "src/frontend/abstract-syntax-tree";
import type { LoadoutElementNode } from "src/frontend/abstract-syntax-tree/elements/loadout";
import type { ASTParameterNode } from "src/frontend/abstract-syntax-tree/parameters";
import {
  type Located,
  located,
} from "src/frontend/intermediate-representation";
import { dxAssertionScope } from "src/frontend/intermediate-representation/diagnostics";
import { assertNotErrorNode } from "src/frontend/intermediate-representation/diagnostics/assertNotErrorNode";
import { assertSyntaxKind } from "src/frontend/intermediate-representation/diagnostics/assertSyntaxKind";
import { LowerError } from "src/frontend/intermediate-representation/error";
import type { LoadoutTraits } from "src/frontend/intermediate-representation/game/game_engine_default";
import type { ElementLowerContext } from "src/frontend/intermediate-representation/parameters";
import { lowerGrenadeCount } from "src/frontend/intermediate-representation/parameters/grenadeCount";
import { setField } from "src/frontend/intermediate-representation/setField";
import { ObjectListType } from "src/frontend/object-lists";
import { SymbolKind } from "src/frontend/symbol-table";

const OBJECT_LIST_SENTINELS: Record<string, number> = {
  none: -1,
  default: -2,
  random: -3,
};

const lowerObjectListKeyword = (
  node: ASTParameterNode,
  objectType: ObjectListType,
  ctx: ElementLowerContext,
  allowSentinels = false
): Located<number> => {
  assertSyntaxKind(node, SyntaxKind.KEYWORD);
  if (allowSentinels && OBJECT_LIST_SENTINELS[node.value] !== undefined) {
    return located(OBJECT_LIST_SENTINELS[node.value]!, node.location);
  }
  const symbol = ctx.symbolTable
    .toArray()
    .find(
      (entry) =>
        entry.kind === SymbolKind.ObjectListItem &&
        entry.objectType === objectType &&
        entry.name === node.value
    );
  if (symbol?.kind !== SymbolKind.ObjectListItem) {
    throw new LowerError(
      diagnosticMessages.expectedParameterType(objectType, node.value),
      node.location
    );
  }
  return located(symbol.index, node.location);
};

export const loadoutLowerer = (
  element: LoadoutElementNode,
  ctx: ElementLowerContext
) => {
  const { name } = element;
  const traits: LoadoutTraits = {};
  for (const item of element.items) {
    dxAssertionScope(ctx.diagnostics, () => {
      const parameter = item.parameters[0];
      if (parameter === undefined) {
        throw new LowerError(
          diagnosticMessages.expectedParameterType(item.identifier, ""),
          element.location
        );
      }
      switch (item.identifier) {
        case "name": {
          const value = lowerObjectListKeyword(
            parameter,
            ObjectListType.Loadouts,
            ctx
          );
          setField(
            ctx.ir.locations,
            ctx.diagnostics,
            traits,
            "name",
            value.value,
            value.location,
            "name"
          );
          break;
        }
        case "primary_weapon": {
          const value = lowerObjectListKeyword(
            parameter,
            ObjectListType.Weapons,
            ctx,
            true
          );
          setField(
            ctx.ir.locations,
            ctx.diagnostics,
            traits,
            "initialPrimaryWeaponAbsoluteIndex",
            value.value,
            value.location,
            "primary_weapon"
          );
          break;
        }
        case "backpack_weapon": {
          const value = lowerObjectListKeyword(
            parameter,
            ObjectListType.Weapons,
            ctx,
            true
          );
          setField(
            ctx.ir.locations,
            ctx.diagnostics,
            traits,
            "initialSecondaryWeaponAbsoluteIndex",
            value.value,
            value.location,
            "backpack_weapon"
          );
          break;
        }
        case "equipment": {
          const value = lowerObjectListKeyword(
            parameter,
            ObjectListType.Equipment,
            ctx,
            true
          );
          setField(
            ctx.ir.locations,
            ctx.diagnostics,
            traits,
            "initialEquipmentAbsoluteIndex",
            value.value,
            value.location,
            "equipment"
          );
          break;
        }
        case "grenades": {
          assertSyntaxKind(parameter, SyntaxKind.GRENADE_COUNT);
          const value = lowerGrenadeCount(parameter);
          setField(
            ctx.ir.locations,
            ctx.diagnostics,
            traits,
            "initialGrenadeCountSetting",
            value.value,
            value.location,
            "grenades"
          );
          break;
        }
      }
    });
  }

  dxAssertionScope(ctx.diagnostics, () => {
    assertNotErrorNode(name);
    // Megalo Headache #1
    if (!ctx.loadoutsByName.has(name.value)) {
      // Like MegaloEdit, every declared loadout counts, used or not.
      const limit = ctx.frontend.versionConfiguration.limits.loadouts;
      const { loadouts } = ctx.ir.gameVariant.gameEngine;
      if (loadouts.length >= limit) {
        throw new LowerError(
          diagnosticMessages.tooManyLoadouts(limit),
          name.location
        );
      }
      ctx.loadoutsByName.set(name.value, traits);
      loadouts.push(traits);
    }
  });
};

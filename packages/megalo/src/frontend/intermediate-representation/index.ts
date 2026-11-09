import { _event_warning, event } from "@blamnetwork/datamine";
import type { MegaloCompilerContext } from "src/context";
import type { Diagnostics, SourceLocation } from "src/diagnostics";
import type { AST } from "src/frontend/abstract-syntax-tree";
import { ElementKind } from "src/frontend/abstract-syntax-tree/elements";
import { dxAssertionScope } from "src/frontend/intermediate-representation/diagnostics";
import { assertAllowedInBaseDerived } from "src/frontend/intermediate-representation/diagnostics/assertAllowedInBaseDerived";
import {
  baseLowerer,
  ELEMENT_LOWERERS,
} from "src/frontend/intermediate-representation/elements";
import type { GameEngineCustomVariant } from "src/frontend/intermediate-representation/game/game_variant";
import type {
  PlayerTraitOptionOverride,
  UserDefinedOptionOverride,
} from "src/frontend/intermediate-representation/game/megalogamengine/megalogamengine_user_defined_options";
import type { VariableMetadata } from "src/frontend/intermediate-representation/game/megalogamengine/megalogamengine_variable_metadata";
import { StringTable } from "src/frontend/intermediate-representation/game/string_table";
import {
  createFieldLocations,
  type FieldLocations,
} from "src/frontend/intermediate-representation/locations";
import type { ElementLowerContext } from "src/frontend/intermediate-representation/parameters";
import { applyDefaultLoadoutCameraTime } from "src/frontend/intermediate-representation/postprocessing/applyDefaultLoadoutCameraTime";
import { applyMetadata } from "src/frontend/intermediate-representation/postprocessing/applyMetadata";
import { applyVariableMetadata } from "src/frontend/intermediate-representation/postprocessing/applyVariableMetadata";
import { assertMccTeamColorOverrides } from "src/frontend/intermediate-representation/postprocessing/assertMccTeamColorOverrides";
import { buildVariableSlotMap } from "src/frontend/intermediate-representation/preprocessing/symbols";
import type { ObjectLists } from "src/frontend/object-lists";

export interface Located<T> {
  location: SourceLocation;
  value: T;
}

export interface IR {
  // Raw bytes of the base .mglo file.
  baseFileBytes?: Uint8Array;
  // We use this more as a presence indicator for whether a file is base-derived,
  // Its possible we cant find the file, in which case baseFileBytes isnt set,
  // but the file is still base derived and we wanna know about that.
  baseFilePath?: string;
  // Anything applied on top of a base file that doesnt fit within the typical
  // GameEngineCustomVariant struct.
  baseOverrides: BaseOverrides;
  gameVariant: GameEngineCustomVariant;
  /** Source locations for IR leaves (diagnostics / unused-override warnings). */
  locations: FieldLocations;
}

export interface BaseOverrides {
  playerTraits: PlayerTraitOptionOverride[];
  userDefinedOptions: UserDefinedOptionOverride[];
}

export type { PlayerTraitOptionOverride, UserDefinedOptionOverride };

export interface LowerContext {
  objectLists?: ObjectLists;
}

export const located = <T>(value: T, location: SourceLocation): Located<T> => ({
  value,
  location,
});

const emptyVariableMetadata = (): VariableMetadata => ({
  numericVariables: [],
  timerVariables: [],
  teamVariables: [],
  playerVariables: [],
  objectVariables: [],
});

export class Lowerer {
  public constructor(private readonly frontend: MegaloCompilerContext) {}

  public lower(
    ast: AST,
    diagnostics: Diagnostics,
    context: LowerContext = {}
  ): IR {
    const ir = this.buildDefaultIR();
    if (this.frontend.megacrowExtensions.notBuiltIn) {
      ir.gameVariant.baseVariant.builtIn = false;
    }
    const lowerContext: ElementLowerContext = {
      frontend: this.frontend,
      symbolTable: ast.symbolTable,
      variableSlots: buildVariableSlotMap(
        this.frontend,
        ast.symbolTable,
        diagnostics
      ),
      ir,
      diagnostics,
      loadoutsByName: new Map(),
      loadoutPalettesByName: new Map(),
      variableDeclarations: new Map(),
      inPregameTrigger: false,
    };

    // Base element always goes first.
    for (const element of ast.elements) {
      if (element.elementKind !== ElementKind.BASE) {
        continue;
      }
      baseLowerer(element, lowerContext);
    }

    for (const element of ast.elements) {
      if (element.elementKind === ElementKind.BASE) {
        continue;
      }
      dxAssertionScope(diagnostics, () => {
        assertAllowedInBaseDerived(element, lowerContext);
        const elementLowerer = ELEMENT_LOWERERS.get(element.elementKind);
        if (elementLowerer) {
          elementLowerer(element, lowerContext);
        } else {
          event(
            _event_warning,
            "megalo: lowerer for %s NYI",
            element.elementKind
          );
        }
      });
    }

    this.postprocess(ir, lowerContext, context);

    return ir;
  }

  private postprocess(
    ir: IR,
    ctx: ElementLowerContext,
    _lowerCtx: LowerContext
  ) {
    applyDefaultLoadoutCameraTime(ir);
    applyMetadata(ir, ctx);
    applyVariableMetadata(ir, ctx);
    assertMccTeamColorOverrides(ir, ctx);
  }

  private buildDefaultIR(): IR {
    const scriptStrings = new StringTable();

    const locations = createFieldLocations();
    const gameVariant: GameEngineCustomVariant = {
      baseVariant: {
        metadata: {
          general: {
            gameEngineType: 0,
            gameMode: 0,
          },
          creationHistory: {
            timestamp: new Date(),
            xuid: BigInt(0),
            name: "MegaloEvolved",
            isOnline: false,
          },
          modificationHistory: {
            timestamp: new Date(),
            xuid: BigInt(0),
            name: "MegaloEvolved",
            isOnline: false,
          },
        },
        builtIn: true,
        miscellaneousOptions: {},
        respawnOptions: {},
        socialOptions: {},
        mapOverrideOptions: {},
        teamOptions: {},
        loadoutTraits: {},
      },
      playerTraits: [],
      userDefinedOptions: [],
      scriptStrings,
      baseNameStringIndex: 0,
      localizedName: undefined,
      localizedDescription: undefined,
      localizedCategory: undefined,
      engineIcon: undefined,
      engineCategory: undefined,
      mapPermissions: undefined,
      playerRatings: undefined,
      scoreToWinRound: undefined,
      fireTeamsEnabled: undefined,
      symmetricGametype: undefined,
      baseVariantParametersLocked: {},
      baseVariantParametersHidden: {},
      gameEngine: {
        conditions: [],
        actions: [],
        triggers: [],
        statistics: [],
        variableMetadata: {
          global: emptyVariableMetadata(),
          player: emptyVariableMetadata(),
          object: emptyVariableMetadata(),
          team: emptyVariableMetadata(),
          temporary: emptyVariableMetadata(),
        },
        hudWidgets: [],
        initializationTriggerIndex: -1,
        localInitializationTriggerIndex: -1,
        hostMigrationTriggerIndex: -1,
        doubleMigrationTriggerIndex: -1,
        objectDeathEventTriggerIndex: -1,
        localTriggerIndex: -1,
        pregameTriggerIndex: -1,
        requisitionPalettes: [],
        loadouts: [],
        loadoutPalettes: [],
        objectsUsed: [],
        objectFilters: [],
      },
      tu1Settings: {},
    };

    return {
      baseFilePath: undefined,
      baseOverrides: {
        userDefinedOptions: [],
        playerTraits: [],
      },
      gameVariant,
      locations,
    };
  }
}

export type { FieldLocations } from "src/frontend/intermediate-representation/locations";
export { createFieldLocations } from "src/frontend/intermediate-representation/locations";
export { setField } from "src/frontend/intermediate-representation/setField";

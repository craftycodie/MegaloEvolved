import { c_game_engine_custom_variant } from "@blamnetwork/blf/haloreach/v08516_10_02_19_1607_omaha_alpha";
import { c_string_table } from "@blamnetwork/blf/haloreach/v12065_11_08_24_1738_tu1actual";

import { compileActions } from "src/backend/compile/49/actions";
import { CAPABILITES_49 } from "src/backend/compile/49/capabilities";
import { compileConditions } from "src/backend/compile/49/conditions";
import {
  applyPlayerTraitOptionOverrides,
  applyUserDefinedOptionOverrides,
  compileGameOptions,
} from "src/backend/compile/49/game_options";
import { compileGameStats } from "src/backend/compile/49/game_stats";
import { compileHudWidgets } from "src/backend/compile/49/hud_widgets";
import { compileLoadoutPalettes } from "src/backend/compile/49/loadout_palette";
import { compileMapObjects } from "src/backend/compile/49/map_object";
import { compileMetadata } from "src/backend/compile/49/metadata";
import { packCompiledVariant } from "src/backend/compile/49/pack";
import { compileRequisitions } from "src/backend/compile/49/requisitions";
import { compileTeams } from "src/backend/compile/49/teams";
import { compileTriggers } from "src/backend/compile/49/triggers";
import { compileVariableMetadata } from "src/backend/compile/49/variableMetadata";
import {
  applyWriteMegaloFileBuildNumber,
  type CompiledMegaloMetadata,
  Compiler,
  EngineIcon,
  type WriteMegaloFileOptions,
  type WriteMegaloFileResult,
} from "src/backend/compile/compiler";
import {
  assertCompatibleIR,
  type CompilerCapabilities,
} from "src/backend/compile/diagnostics/assertCompatibleIR";
import { collectCompiledEngineStats } from "src/backend/compile/engineStats";
import { decodeMglo } from "src/decode-mglo";
import { type Diagnostics, UNKNOWN_LOCATION } from "src/diagnostics";
import type { IR } from "src/frontend/intermediate-representation";
import type { StringTable } from "src/frontend/intermediate-representation/game/string_table";
import {
  STRING_TABLE_LANGUAGES,
  type StringTableLanguage,
} from "src/frontend/language-configuration/omni/strings";
import { MEGALO_VERSIONS, type SupportedMegaloVersion } from "src/version";

/** omaha_alpha script string table bitstream layout. */
const SCRIPT_STRINGS = {
  maxStringCount: 112,
  maxStringLength: 0x4c_00,
  offsetBitLength: 14,
  bufferSizeBitLength: 14,
  countBitLength: 7,
} as const;

const LOCALIZED_NAME = {
  maxStringCount: 1,
  maxStringLength: 0x1_80,
  offsetBitLength: 5,
  bufferSizeBitLength: 6,
  countBitLength: 1,
} as const;

const LOCALIZED_DESCRIPTION = {
  maxStringCount: 1,
  maxStringLength: 0xc_00,
  offsetBitLength: 8,
  bufferSizeBitLength: 9,
  countBitLength: 1,
} as const;

export class Compiler49 extends Compiler {
  private compileStringTable(
    irStrings: StringTable,
    maxStringCount: number,
    maxStringLength: number,
    offsetBitLength: number,
    bufferSizeBitLength: number,
    countBitLength: number
  ): c_string_table {
    const table = new c_string_table(
      maxStringCount,
      maxStringLength,
      offsetBitLength,
      bufferSizeBitLength,
      countBitLength
    );

    const entries = irStrings.toArray();
    table.strings = STRING_TABLE_LANGUAGES.map((language) =>
      entries.map((entry) => entry[language] ?? null)
    );

    return table;
  }

  private makeDefaultGametype(): c_game_engine_custom_variant {
    const gametype = new c_game_engine_custom_variant();
    gametype.initialize();
    gametype.m_encoding_version = 49;
    gametype.m_build_number = -1;
    gametype.m_engine_icon = -1;
    return gametype;
  }

  private decodeBaseGametype(
    ir: IR,
    diagnostics: Diagnostics
  ): c_game_engine_custom_variant {
    if (!ir.baseFileBytes) {
      return this.makeDefaultGametype();
    }

    const location = ir.locations.get(ir, "baseFilePath") ?? UNKNOWN_LOCATION;
    const version = this.getMegaloVersion();

    try {
      const decoded = decodeMglo(ir.baseFileBytes);
      if (decoded.version.encodingVersion !== version.version) {
        diagnostics.addError(
          `Base file encoding version ${decoded.version.encodingVersion} does not match compile target ${version.version}`,
          location
        );
        return this.makeDefaultGametype();
      }
      return decoded.gametype as c_game_engine_custom_variant;
    } catch (error) {
      diagnostics.addError(
        error instanceof Error
          ? error.message
          : `Failed to decode base file${
              ir.baseFilePath ? ` "${ir.baseFilePath}"` : ""
            }`,
        location
      );
      return this.makeDefaultGametype();
    }
  }

  private compile(
    ir: IR,
    diagnostics: Diagnostics
  ): c_game_engine_custom_variant {
    assertCompatibleIR(ir, this, diagnostics);

    const gametype = this.decodeBaseGametype(ir, diagnostics);
    const isBaseDerived = ir.baseFileBytes !== undefined;

    // Handle base overrides
    if (isBaseDerived) {
      applyUserDefinedOptionOverrides(ir, gametype, diagnostics);
      applyPlayerTraitOptionOverrides(ir, gametype, diagnostics);
    }

    const variant = ir.gameVariant;

    if (!isBaseDerived) {
      gametype.m_script_strings = this.compileStringTable(
        variant.scriptStrings,
        SCRIPT_STRINGS.maxStringCount,
        SCRIPT_STRINGS.maxStringLength,
        SCRIPT_STRINGS.offsetBitLength,
        SCRIPT_STRINGS.bufferSizeBitLength,
        SCRIPT_STRINGS.countBitLength
      );
    }

    if (variant.localizedName !== undefined) {
      gametype.m_localized_name = this.compileStringTable(
        variant.localizedName,
        LOCALIZED_NAME.maxStringCount,
        LOCALIZED_NAME.maxStringLength,
        LOCALIZED_NAME.offsetBitLength,
        LOCALIZED_NAME.bufferSizeBitLength,
        LOCALIZED_NAME.countBitLength
      );
    }
    if (variant.localizedDescription !== undefined) {
      gametype.m_localized_description = this.compileStringTable(
        variant.localizedDescription,
        LOCALIZED_DESCRIPTION.maxStringCount,
        LOCALIZED_DESCRIPTION.maxStringLength,
        LOCALIZED_DESCRIPTION.offsetBitLength,
        LOCALIZED_DESCRIPTION.bufferSizeBitLength,
        LOCALIZED_DESCRIPTION.countBitLength
      );
    }

    compileMetadata(ir, gametype);

    if (!isBaseDerived) {
      gametype.m_base_name_string_index = variant.baseNameStringIndex;
    }
    if (variant.baseVariant.builtIn) {
      gametype.m_base_variant.m_built_in = true;
    }

    compileGameOptions(ir, gametype, diagnostics);
    compileTeams(ir, gametype, diagnostics);
    compileLoadoutPalettes(ir, gametype);
    compileRequisitions(ir, gametype, diagnostics);

    if (!isBaseDerived) {
      compileMapObjects(ir, gametype, diagnostics);
      compileGameStats(ir, gametype, diagnostics);
      compileHudWidgets(ir, gametype, diagnostics);
      compileVariableMetadata(ir, gametype);
      compileConditions(ir, gametype, diagnostics);
      compileActions(ir, gametype, diagnostics);
      compileTriggers(ir, gametype, diagnostics);
    }

    gametype.m_encoding_version = 49;

    return gametype;
  }

  private readonly mapEngineIcon = (icon: number): EngineIcon | undefined => {
    switch (icon) {
      case 0:
        return EngineIcon.CaptureTheFlag;
      case 1:
        return EngineIcon.Slayer;
      case 2:
        return EngineIcon.Oddball;
      case 3:
        return EngineIcon.KingOfTheHill;
      case 4:
        return EngineIcon.Juggernaut;
      case 5:
        return EngineIcon.Territories;
      case 6:
        return EngineIcon.Assault;
      case 7:
        return EngineIcon.Infection;
      case 8:
        return EngineIcon.VIP;
      case 9:
        return EngineIcon.Invasion;
      case 10:
        return EngineIcon.InvasionSlayer;
      case 11:
        return EngineIcon.Stockpile;
      case 12:
        return EngineIcon.ActionSack;
      case 13:
        return EngineIcon.Race;
      case 14:
        return EngineIcon.RocketRace;
      case 15:
        return EngineIcon.Grifball;
      case 16:
        return EngineIcon.Soccer;
      case 17:
        return EngineIcon.Headhunter;
      case 18:
        return EngineIcon.Crosshair;
      case 19:
        return EngineIcon.Wheel;
      case 20:
        return EngineIcon.Swirl;
      case 21:
        return EngineIcon.Bunker;
      case 22:
        return EngineIcon.Healthpack;
      case 23:
        return EngineIcon.Towershield;
      case 24:
        return EngineIcon.Return;
      case 25:
        return EngineIcon.PreGameWarmUp;
      case 26:
        return EngineIcon.Cartographer;
      case 27:
        return EngineIcon.Eightball;
      case 28:
        return EngineIcon.Spartan;
      case 29:
        return EngineIcon.Elite;
      case 30:
        return EngineIcon.Attack;
      default:
        return;
    }
  };

  private mapLocalizedString(
    table: c_string_table,
    stringIndex: number
  ): Record<StringTableLanguage, string> | undefined {
    if (stringIndex < 0) {
      return;
    }

    const entry = {} as Record<StringTableLanguage, string>;
    let hasAny = false;
    for (
      let languageIndex = 0;
      languageIndex < STRING_TABLE_LANGUAGES.length;
      languageIndex++
    ) {
      const language = STRING_TABLE_LANGUAGES[languageIndex]!;
      const value = table.strings[languageIndex]?.[stringIndex] ?? "";
      entry[language] = value;
      if (value) {
        hasAny = true;
      }
    }
    return hasAny ? entry : undefined;
  }

  private getGametypeMetadata(
    gametype: c_game_engine_custom_variant
  ): CompiledMegaloMetadata {
    const localizedName = this.mapLocalizedString(gametype.m_localized_name, 0);
    const name =
      localizedName ??
      this.mapLocalizedString(
        gametype.m_script_strings,
        gametype.m_base_name_string_index - 1
      );

    return {
      name,
      description: this.mapLocalizedString(gametype.m_localized_description, 0),
      engineIcon: this.mapEngineIcon(gametype.m_engine_icon),
    };
  }

  public dryRun(
    ir: IR,
    diagnostics: Diagnostics
  ): ReturnType<Compiler["dryRun"]> {
    const gametype = this.compile(ir, diagnostics);
    return {
      metadata: this.getGametypeMetadata(gametype),
      engineStats: collectCompiledEngineStats(gametype, ir, 0),
    };
  }

  public writeMegaloFile(
    ir: IR,
    diagnostics: Diagnostics,
    options?: WriteMegaloFileOptions
  ): WriteMegaloFileResult {
    const gametype = this.compile(ir, diagnostics);
    if (diagnostics.hasErrors()) {
      // Keep the real compile diagnostics; do not throw a secondary write error.
      return {
        data: new Uint8Array(),
        variantByteLength: 0,
        metadata: this.getGametypeMetadata(gametype),
        engineStats: collectCompiledEngineStats(gametype, ir, 0),
      };
    }
    applyWriteMegaloFileBuildNumber(gametype, options);
    const packed = packCompiledVariant(gametype, options?.fileType ?? "mglo");
    return {
      data: packed.data,
      variantByteLength: packed.variantByteLength,
      metadata: this.getGametypeMetadata(gametype),
      engineStats: collectCompiledEngineStats(
        gametype,
        ir,
        packed.variantByteLength
      ),
    };
  }

  public getCapabilities(): CompilerCapabilities {
    return CAPABILITES_49;
  }

  public getMegaloVersion(): SupportedMegaloVersion {
    return MEGALO_VERSIONS["49"];
  }
}

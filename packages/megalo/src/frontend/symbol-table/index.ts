import type { MegaloCompilerContext } from "src/context";
import {
  BUILT_IN_POSITION,
  type Diagnostics,
  OPEN_ENDED_POSITION,
  type SourceCodeLocation,
  type SourceLocation,
  SourceLocationType,
  type SourcePosition,
} from "src/diagnostics";
import { diagnosticMessages } from "src/diagnostics/messages";
import {
  type StringTableEntry,
  stringTableEntry,
} from "src/frontend/intermediate-representation/game/string_table";
import { isReservedVariableName } from "src/frontend/language-configuration/omni/keywords";
import type { StringTableLanguage } from "src/frontend/language-configuration/omni/strings";
import { VARIABLE_TYPE_NAMES } from "src/frontend/language-configuration/omni/variables";
import type { ObjectListType } from "src/frontend/object-lists";

export enum SymbolKind {
  Constant = 0,
  Variable = 1,
  String = 2,
  GameOption = 3,
  HudWidget = 4,
  Loadout = 5,
  LoadoutPalette = 6,
  RequisitionPalette = 7,
  ObjectListItem = 8,
  ObjectFilter = 9,
  PlayerTraits = 10,
  GameStat = 11,
}

// Modelled based on Bungie.Megalo.VariableType
export enum VariableType {
  Timer = 0,
  Number = 1,
  Team = 2,
  Player = 3,
  Object = 4,
}

export enum VariableScope {
  Global = 0,
  Team = 1,
  Player = 2,
  Object = 3,
  Temporary = 4,
}

export type SymbolId = number;

export interface SymbolTableEntryBase {
  id: SymbolId;
  name: string;

  /**
   * Lexical scope range.
   * `start` is the declaration position (built-ins use {@link BUILT_IN_POSITION}).
   * `end` is the exclusive end of visibility; open-ended symbols (globals, built-ins)
   * keep `end` as {@link OPEN_ENDED_POSITION} until EOF / {@link SymbolTable.setScopeEnd}.
   */
  range: SourceCodeLocation;

  references: SourceCodeLocation[];
}

const openEndedRange = (start: SourcePosition): SourceCodeLocation => ({
  type: SourceLocationType.SOURCE_CODE,
  start,
  end: OPEN_ENDED_POSITION,
});

const declarationRange = (declaration: SourceLocation): SourceCodeLocation => {
  switch (declaration.type) {
    case SourceLocationType.BUILT_IN:
      return openEndedRange(BUILT_IN_POSITION);
    case SourceLocationType.OBJECT_LIST:
      return openEndedRange(declaration.source);
    case SourceLocationType.INCLUDE:
      // Prefer the span inside the included file (absolute offsets are rebased
      // on the unfurled program); the include directive is on `declaration`.
      return openEndedRange(declaration.source.start);
    case SourceLocationType.SOURCE_CODE:
      return openEndedRange(declaration.start);
    case SourceLocationType.UNKNOWN:
      return openEndedRange(OPEN_ENDED_POSITION);
    default: {
      const _exhaustive: never = declaration;
      return _exhaustive;
    }
  }
};

export type SymbolTableVariableEntry = SymbolTableEntryBase & {
  kind: SymbolKind.Variable;
  type: VariableType;
  declaration: SourceLocation;
  scope: VariableScope;
};

/** True when the variable was injected by the compiler (not user-declared). */
export const isBuiltInVariable = (symbol: SymbolTableVariableEntry): boolean =>
  symbol.declaration.type === SourceLocationType.BUILT_IN;

export type SymbolTableGameOptionEntry = SymbolTableEntryBase & {
  kind: SymbolKind.GameOption;
  type: VariableType.Number;
  declaration: SourceLocation;
  // Undefined for built-in game options
  index?: number;
};

export type SymbolTableConstantEntry = SymbolTableEntryBase & {
  kind: SymbolKind.Constant;
  type: VariableType.Number;
  declaration: SourceLocation;
  value: number;
};

export type SymbolTableStringEntry = SymbolTableEntryBase & {
  kind: SymbolKind.String;
  languageDeclarations: Partial<Record<StringTableLanguage, SourceLocation>>;
  languageContents: StringTableEntry;
};

export type SymbolTableHudWidgetEntry = SymbolTableEntryBase & {
  kind: SymbolKind.HudWidget;
  declaration: SourceLocation;
};

export type SymbolTableLoadoutEntry = SymbolTableEntryBase & {
  kind: SymbolKind.Loadout;
  declaration: SourceLocation;
};

export type SymbolTableLoadoutPaletteEntry = SymbolTableEntryBase & {
  kind: SymbolKind.LoadoutPalette;
  declaration: SourceLocation;
};

export type SymbolTableRequisitionPaletteEntry = SymbolTableEntryBase & {
  kind: SymbolKind.RequisitionPalette;
  declaration: SourceLocation;
};

export type SymbolTableObjectListItemEntry = SymbolTableEntryBase & {
  kind: SymbolKind.ObjectListItem;
  objectType: ObjectListType;
  index: number;
  declaration: SourceLocation;
};

export type SymbolTableObjectFilterEntry = SymbolTableEntryBase & {
  kind: SymbolKind.ObjectFilter;
  index: number;
  declaration: SourceLocation;
};

export type SymbolTablePlayerTraitsEntry = SymbolTableEntryBase & {
  kind: SymbolKind.PlayerTraits;
  index: number;
  declaration: SourceLocation;
};

export type SymbolTableGameStatEntry = SymbolTableEntryBase & {
  kind: SymbolKind.GameStat;
  index: number;
  declaration: SourceLocation;
};

export type SymbolTableEntry =
  | SymbolTableVariableEntry
  | SymbolTableConstantEntry
  | SymbolTableStringEntry
  | SymbolTableGameOptionEntry
  | SymbolTableHudWidgetEntry
  | SymbolTableLoadoutEntry
  | SymbolTableLoadoutPaletteEntry
  | SymbolTableRequisitionPaletteEntry
  | SymbolTableObjectListItemEntry
  | SymbolTableObjectFilterEntry
  | SymbolTablePlayerTraitsEntry
  | SymbolTableGameStatEntry;

const reservedNameKind = (entry: SymbolTableEntry): string => {
  switch (entry.kind) {
    case SymbolKind.Constant:
      return "constant";
    case SymbolKind.Variable:
      return VARIABLE_TYPE_NAMES[entry.type];
    case SymbolKind.String:
      return "string";
    case SymbolKind.GameOption:
      return "option";
    case SymbolKind.HudWidget:
      return "hud_widget";
    case SymbolKind.Loadout:
      return "loadout";
    case SymbolKind.LoadoutPalette:
      return "loadout_palette";
    case SymbolKind.RequisitionPalette:
      return "requisition_palette";
    case SymbolKind.ObjectListItem:
      return "object";
    case SymbolKind.ObjectFilter:
      return "map_object";
    case SymbolKind.PlayerTraits:
      return "player_traits";
    case SymbolKind.GameStat:
      return "game_stats";
    default: {
      const _exhaustive: never = entry;
      return _exhaustive;
    }
  }
};

const userDeclaration = (
  entry: SymbolTableEntry
): SourceLocation | undefined => {
  if (entry.kind === SymbolKind.String) {
    return Object.values(entry.languageDeclarations).find(
      (declaration) => declaration !== undefined
    );
  }
  return entry.declaration;
};

export class SymbolTable {
  private readonly table: SymbolTableEntry[] = [];

  public constructor(table: SymbolTableEntry[]) {
    this.table = table;
  }

  public getSymbol(symbolId: SymbolId): SymbolTableEntry | undefined {
    return this.table.find((symbol) => symbol.id === symbolId);
  }

  public toArray(): readonly SymbolTableEntry[] {
    return this.table;
  }

  public findVariableByName(
    name: string
  ): SymbolTableVariableEntry | undefined {
    const matches = this.table.filter(
      (symbol): symbol is SymbolTableVariableEntry =>
        symbol.kind === SymbolKind.Variable && symbol.name === name
    );
    if (matches.length === 0) {
      return;
    }
    if (matches.length === 1) {
      return matches[0];
    }

    // MegaloEdit Headache #1
    const last = matches.at(-1)!;
    const sameList = matches.filter(
      (symbol) => symbol.scope === last.scope && symbol.type === last.type
    );
    if (sameList.length > 1) {
      const resolvesLastDeclared =
        last.scope === VariableScope.Temporary ||
        (last.scope === VariableScope.Global &&
          last.type !== VariableType.Timer);
      return resolvesLastDeclared ? sameList.at(-1) : sameList[0];
    }

    return matches[0];
  }

  public lookupUserDefinedOptionIndex(name: string): number | undefined {
    for (const symbol of this.table) {
      if (
        symbol.kind === SymbolKind.GameOption &&
        symbol.index !== undefined &&
        symbol.name === name
      ) {
        return symbol.index;
      }
    }
    return;
  }

  public lookupGameStatIndex(name: string): number | undefined {
    for (const symbol of this.table) {
      if (symbol.kind === SymbolKind.GameStat && symbol.name === name) {
        return symbol.index;
      }
    }
    return;
  }

  public variablesOf(
    scope: VariableScope,
    type: VariableType
  ): readonly SymbolTableVariableEntry[] {
    return this.table.filter(
      (symbol): symbol is SymbolTableVariableEntry =>
        symbol.kind === SymbolKind.Variable &&
        !isBuiltInVariable(symbol) &&
        symbol.scope === scope &&
        symbol.type === type
    );
  }
}

/** Position in a {@link SymbolBinder}, for rolling back speculative parses. */
export interface SymbolBinderCheckpoint {
  readonly references: number;
  readonly symbols: number;
}

/**
 * SymbolBinder is responsible for binding symbols to their declarations and adding references to them.
 * It handles diagnostics for things related to symbol declarations, like duplicate declarations or scope issues.
 */
// Analysis lifecycle - we build a new one each analysis pass.
export class SymbolBinder {
  private readonly table: SymbolTableEntry[] = [];
  /** Symbol id per `addReference` call, in order, so speculation can undo them. */
  private readonly referenceLog: SymbolId[] = [];
  private readonly diagnostics: Diagnostics;
  private readonly frontend: MegaloCompilerContext;

  public constructor(
    frontend: MegaloCompilerContext,
    diagnostics: Diagnostics
  ) {
    this.frontend = frontend;
    this.diagnostics = diagnostics;
  }

  private push(entry: SymbolTableEntry): SymbolId {
    this.errorIfReservedIdentifier(entry);
    this.table.push(entry);
    return entry.id;
  }

  private errorIfReservedIdentifier(entry: SymbolTableEntry): void {
    if (!this.frontend.megacrowExtensions.reservedKeywords) {
      return;
    }
    const declaration = userDeclaration(entry);
    if (
      declaration === undefined ||
      declaration.type === SourceLocationType.BUILT_IN ||
      declaration.type === SourceLocationType.OBJECT_LIST
    ) {
      return;
    }
    if (!isReservedVariableName(entry.name)) {
      return;
    }
    this.diagnostics.addError(
      diagnosticMessages.reservedKeywordVariableName(
        reservedNameKind(entry),
        entry.name
      ),
      declaration
    );
  }

  public addString(
    entry: Pick<SymbolTableStringEntry, "name"> & {
      language: StringTableLanguage;
      content: string;
      declaration: SourceLocation;
    }
  ): SymbolId | undefined {
    const existingString = this.table.find(
      (symbol): symbol is SymbolTableStringEntry =>
        symbol.kind === SymbolKind.String && symbol.name === entry.name
    );

    // if the string has already been declared for this language, error
    if (existingString?.languageDeclarations[entry.language] !== undefined) {
      if (entry.declaration.type === SourceLocationType.SOURCE_CODE) {
        this.diagnostics.addError(
          diagnosticMessages.stringAlreadyDefined(entry.language, entry.name),
          entry.declaration
        );
      }
      return;
    }

    // if the string has already been declared but not for this language, add the new language declaration
    if (existingString) {
      existingString.languageDeclarations[entry.language] = entry.declaration;
      existingString.languageContents[entry.language] = entry.content;
      return existingString.id;
    }

    // if the string is entirely new, declare it
    const id = this.table.length;
    return this.push({
      id,
      range: declarationRange(entry.declaration),
      references: [],
      name: entry.name,
      kind: SymbolKind.String,
      languageDeclarations: { [entry.language]: entry.declaration },
      languageContents: stringTableEntry(entry.language, entry.content),
    });
  }

  public addVariable(
    entry: Pick<
      SymbolTableVariableEntry,
      "name" | "type" | "declaration" | "scope"
    >
  ): SymbolId {
    const id = this.table.length;
    return this.push({
      id,
      range: declarationRange(entry.declaration),
      references: [],
      name: entry.name,
      kind: SymbolKind.Variable,
      type: entry.type,
      declaration: entry.declaration,
      scope: entry.scope,
    });
  }

  public addGameOption(
    entry: Pick<
      SymbolTableGameOptionEntry,
      "name" | "type" | "declaration" | "index"
    >
  ): SymbolId {
    const id = this.table.length;
    return this.push({
      id,
      range: declarationRange(entry.declaration),
      references: [],
      name: entry.name,
      kind: SymbolKind.GameOption,
      type: entry.type,
      declaration: entry.declaration,
      index: entry.index,
    });
  }

  public addConstant(
    entry: Pick<SymbolTableConstantEntry, "name" | "declaration" | "value">
  ): SymbolId {
    const id = this.table.length;
    return this.push({
      id,
      range: declarationRange(entry.declaration),
      references: [],
      name: entry.name,
      kind: SymbolKind.Constant,
      type: VariableType.Number,
      declaration: entry.declaration,
      value: entry.value,
    });
  }

  public addHudWidget(
    entry: Pick<SymbolTableHudWidgetEntry, "name" | "declaration">
  ): SymbolId {
    const id = this.table.length;
    return this.push({
      id,
      range: declarationRange(entry.declaration),
      references: [],
      name: entry.name,
      kind: SymbolKind.HudWidget,
      declaration: entry.declaration,
    });
  }

  public addLoadout(
    entry: Pick<SymbolTableLoadoutEntry, "name" | "declaration">
  ): SymbolId {
    const id = this.table.length;
    return this.push({
      id,
      range: declarationRange(entry.declaration),
      references: [],
      name: entry.name,
      kind: SymbolKind.Loadout,
      declaration: entry.declaration,
    });
  }

  public addLoadoutPalette(
    entry: Pick<SymbolTableLoadoutPaletteEntry, "name" | "declaration">
  ): SymbolId {
    const id = this.table.length;
    return this.push({
      id,
      range: declarationRange(entry.declaration),
      references: [],
      name: entry.name,
      kind: SymbolKind.LoadoutPalette,
      declaration: entry.declaration,
    });
  }

  public addRequisitionPalette(
    entry: Pick<SymbolTableRequisitionPaletteEntry, "name" | "declaration">
  ): SymbolId {
    const id = this.table.length;
    return this.push({
      id,
      range: declarationRange(entry.declaration),
      references: [],
      name: entry.name,
      kind: SymbolKind.RequisitionPalette,
      declaration: entry.declaration,
    });
  }

  public addObjectListItem(
    entry: Pick<
      SymbolTableObjectListItemEntry,
      "name" | "objectType" | "index" | "declaration"
    >
  ): SymbolId {
    const id = this.table.length;
    return this.push({
      id,
      range: declarationRange(entry.declaration),
      references: [],
      name: entry.name,
      kind: SymbolKind.ObjectListItem,
      objectType: entry.objectType,
      index: entry.index,
      declaration: entry.declaration,
    });
  }

  public addObjectFilter(
    entry: Pick<SymbolTableObjectFilterEntry, "name" | "index" | "declaration">
  ): SymbolId {
    const id = this.table.length;
    return this.push({
      id,
      range: declarationRange(entry.declaration),
      references: [],
      name: entry.name,
      kind: SymbolKind.ObjectFilter,
      index: entry.index,
      declaration: entry.declaration,
    });
  }

  public addPlayerTraits(
    entry: Pick<SymbolTablePlayerTraitsEntry, "name" | "index" | "declaration">
  ): SymbolId {
    const id = this.table.length;
    return this.push({
      id,
      range: declarationRange(entry.declaration),
      references: [],
      name: entry.name,
      kind: SymbolKind.PlayerTraits,
      index: entry.index,
      declaration: entry.declaration,
    });
  }

  public addGameStat(
    entry: Pick<SymbolTableGameStatEntry, "name" | "index" | "declaration">
  ): SymbolId {
    const id = this.table.length;
    return this.push({
      id,
      range: declarationRange(entry.declaration),
      references: [],
      name: entry.name,
      kind: SymbolKind.GameStat,
      index: entry.index,
      declaration: entry.declaration,
    });
  }

  public addReference(symbolId: SymbolId, reference: SourceCodeLocation): void {
    this.table[symbolId].references.push(reference);
    this.referenceLog.push(symbolId);
  }

  public checkpoint(): SymbolBinderCheckpoint {
    return {
      symbols: this.table.length,
      references: this.referenceLog.length,
    };
  }

  /**
   * Drop symbols and references added since `checkpoint` (a failed
   * speculative parse). Scope maps in `ParserSymbolContext` are not rolled
   * back, so speculative parses must not declare symbols.
   */
  public rollback(checkpoint: SymbolBinderCheckpoint): void {
    while (this.referenceLog.length > checkpoint.references) {
      const symbolId = this.referenceLog.pop()!;
      this.table[symbolId]?.references.pop();
    }
    this.table.length = checkpoint.symbols;
  }

  public setScopeStart(symbolId: SymbolId, position: SourcePosition): void {
    const entry = this.table[symbolId];
    if (entry !== undefined) {
      entry.range = {
        ...entry.range,
        start: position,
      };
    }
  }

  public setScopeEnd(symbolId: SymbolId, position: SourcePosition): void {
    const entry = this.table[symbolId];
    if (entry !== undefined) {
      entry.range = {
        ...entry.range,
        end: position,
      };
    }
  }

  public getSymbolEntry(symbolId: SymbolId): SymbolTableEntry | undefined {
    return this.table[symbolId];
  }

  public getSymbolTable(): SymbolTable {
    return new SymbolTable(this.table);
  }
}

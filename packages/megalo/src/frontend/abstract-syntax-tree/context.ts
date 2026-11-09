import type { MegaloCompilerContext } from "src/context";
import {
  type Diagnostics,
  type SourceCodeLocation,
  SourceLocationType,
} from "src/diagnostics";
import { diagnosticMessages } from "src/diagnostics/messages";
import { EngineDataParserRepository } from "src/frontend/abstract-syntax-tree/elements/engine_data";
import { PlayerTraitParserRepository } from "src/frontend/abstract-syntax-tree/elements/game_options/player_traits";
import { LoadoutParserRepository } from "src/frontend/abstract-syntax-tree/elements/loadout";
import { LoadoutPaletteParserRepository } from "src/frontend/abstract-syntax-tree/elements/loadout_palette";
import { TeamsParserRepository } from "src/frontend/abstract-syntax-tree/elements/teams";
import { ActionParserRepository } from "src/frontend/abstract-syntax-tree/elements/trigger/action";
import { ConditionParserRepository } from "src/frontend/abstract-syntax-tree/elements/trigger/condition";
import { ParserSymbolContext } from "src/frontend/abstract-syntax-tree/symbol-context";
import type { ObjectLists } from "src/frontend/object-lists";
import type {
  SymbolBinder,
  SymbolBinderCheckpoint,
} from "src/frontend/symbol-table";
import { type Token, TokenKind, type Tokens } from "src/frontend/tokens";

/** Parser state saved before a speculative parse. */
export interface ParserCheckpoint {
  readonly symbols: SymbolBinderCheckpoint;
  readonly tokenIndex: number;
}

// Used by the parse function to track it's progress & refer to variables in scope.
export class ParserContext {
  private readonly tokens: Tokens;
  private tokenIndex = 0;
  private readonly symbolBinder: SymbolBinder;

  public readonly frontend: MegaloCompilerContext;
  public readonly diagnostics: Diagnostics;
  public readonly symbolParser: ParserSymbolContext;

  public readonly playerTraitParserRepository: PlayerTraitParserRepository;
  public readonly loadoutParserRepository: LoadoutParserRepository;
  public readonly loadoutPaletteParserRepository: LoadoutPaletteParserRepository;
  public readonly teamsParserRepository: TeamsParserRepository;
  public readonly engineDataParserRepository: EngineDataParserRepository;
  public readonly actionParserRepository: ActionParserRepository;
  public readonly conditionParserRepository: ConditionParserRepository;

  public constructor(
    tokens: Tokens,
    frontend: MegaloCompilerContext,
    diagnostics: Diagnostics,
    symbolTable: SymbolBinder,
    objectLists: ObjectLists = {},
    /** When set, reuse scopes so include expansion shares the parent symbol table. */
    sharedSymbolParser?: ParserSymbolContext
  ) {
    this.frontend = frontend;
    this.diagnostics = diagnostics;
    this.tokens = tokens;
    this.symbolBinder = symbolTable;
    this.symbolParser =
      sharedSymbolParser ??
      new ParserSymbolContext(frontend, diagnostics, symbolTable, objectLists);
    this.playerTraitParserRepository = new PlayerTraitParserRepository(
      frontend
    );
    this.loadoutParserRepository = new LoadoutParserRepository(frontend);
    this.loadoutPaletteParserRepository = new LoadoutPaletteParserRepository(
      frontend
    );
    this.teamsParserRepository = new TeamsParserRepository(frontend);
    this.engineDataParserRepository = new EngineDataParserRepository(frontend);
    this.actionParserRepository = new ActionParserRepository(frontend);
    this.conditionParserRepository = new ConditionParserRepository(frontend);
  }

  public getToken(): Token {
    return this.tokens[this.tokenIndex++];
  }

  public peekToken(offset = 0): Token | undefined {
    return this.tokens[this.tokenIndex + offset];
  }

  public hasMore(): boolean {
    return this.tokenIndex < this.tokens.length;
  }

  /** Current token index (for progress checks, not for backtracking). */
  public mark(): number {
    return this.tokenIndex;
  }

  /**
   * Move to a token index. Binder state is kept, so use
   * {@link checkpoint}/{@link rollback} to undo a speculative parse.
   */
  public reset(mark: number): void {
    this.tokenIndex = mark;
  }

  /** Save parser state before a speculative parse. */
  public checkpoint(): ParserCheckpoint {
    return {
      tokenIndex: this.tokenIndex,
      symbols: this.symbolBinder.checkpoint(),
    };
  }

  /**
   * Undo a failed speculative parse: rewind the token stream and drop symbols
   * and references it added to the binder.
   */
  public rollback(checkpoint: ParserCheckpoint): void {
    this.tokenIndex = checkpoint.tokenIndex;
    this.symbolBinder.rollback(checkpoint.symbols);
  }

  /**
   * Use with caution.
   * In Megalo, "end" is a valid variable name.
   * In some elements like string_table, variables are never used, so this is OK.
   */
  public parseUntilEnd(parseItem: () => void): void {
    while (this.hasMore()) {
      const token = this.peekToken()!;
      if (token.kind === TokenKind.Identifier && token.value === "end") {
        this.getToken();
        return;
      }

      const indexBefore = this.tokenIndex;
      parseItem();
      if (this.tokenIndex === indexBefore && this.hasMore()) {
        this.getToken();
      }
    }

    const lastToken = this.tokens.at(-1);
    const location: SourceCodeLocation = lastToken?.location ?? {
      type: SourceLocationType.SOURCE_CODE,
      start: {
        localOffset: 0,
        absoluteOffset: 0,
        line: 1,
        column: 1,
      },
      end: {
        localOffset: 0,
        absoluteOffset: 0,
        line: 1,
        column: 1,
      },
    };
    this.diagnostics.addError(
      diagnosticMessages.expectedEndBeforeEof(),
      location
    );
  }
}

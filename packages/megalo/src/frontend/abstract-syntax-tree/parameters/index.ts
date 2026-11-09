import {
  spanSourceCodeLocations as locationSpan,
  type SourceCodeLocation,
} from "src/diagnostics";
import { diagnosticMessages } from "src/diagnostics/messages";
import type { ParserContext } from "src/frontend/abstract-syntax-tree/context";
import {
  type ASTErrorNode,
  type ASTFloatingPointNode,
  type ASTIntegerNode,
  type ASTMemberReferenceNode,
  type ASTNode,
  type ASTReferenceNode,
  SyntaxKind,
} from "src/frontend/abstract-syntax-tree/kinds";
import {
  type ASTDynamicStringNode,
  parseDynamicString,
  tryParseDynamicString,
} from "src/frontend/abstract-syntax-tree/parameters/types/dynamic-string";
import type { ASTGrenadeCountNode } from "src/frontend/abstract-syntax-tree/parameters/types/grenade-count";
import type { MegaloEnumDef } from "src/frontend/intermediate-representation/megaloEnum";
import { TRIGGER_BODY_KEYWORDS } from "src/frontend/language-configuration/omni/keywords";
import type { ObjectListType } from "src/frontend/object-lists";
import {
  type SymbolId,
  SymbolKind,
  type SymbolTableEntry,
  VariableType,
} from "src/frontend/symbol-table";
import { type Token, TokenKind } from "src/frontend/tokens";

export type { ASTDynamicStringNode } from "src/frontend/abstract-syntax-tree/parameters/types/dynamic-string";
export { scanDynamicStringPlaceholders } from "src/frontend/abstract-syntax-tree/parameters/types/dynamic-string";
export type { ASTGrenadeCountNode } from "src/frontend/abstract-syntax-tree/parameters/types/grenade-count";
export { grenadeCountParser } from "src/frontend/abstract-syntax-tree/parameters/types/grenade-count";

export enum ParameterType {
  Keyword = 0,
  Integer = 1,
  String = 2,
  QuotedString = 3,
  DynamicString = 4,
  Timer = 5,
  Team = 6,
  Player = 7,
  Object = 8,
  HudWidget = 9,
  Loadout = 10,
  LoadoutPalette = 11,
  RequisitionPalette = 12,
  MathOperation = 13,
  ObjectFilter = 14,
  PlayerTraits = 15,
  Float = 16,
}

export interface KeywordParameter {
  readonly kind: "keyword";
  readonly value: string;
}

export const KeywordParameter = (value: string): KeywordParameter => ({
  kind: "keyword",
  value,
});

/**
 * Build an AST keyword-parameter union from a {@link megaloEnum}'s accepted
 * names (canonical members plus aliases).
 */
export const megaloEnumKeywords = <Name extends string>(
  def: Pick<MegaloEnumDef<Name>, "acceptedNames">,
  options?: {
    /** Drop these accepted names (canonical or alias spelling). */
    exclude?: readonly string[];
  }
): KeywordParameter[] => {
  const excluded = new Set(options?.exclude ?? []);
  return def.acceptedNames
    .filter((name) => !excluded.has(name))
    .map((name) => KeywordParameter(name));
};

export interface ObjectListParameterSpec {
  readonly kind: "objectList";
  readonly objectType: ObjectListType;
}

export const ObjectListParameter = (
  objectType: ObjectListType
): ObjectListParameterSpec => ({
  kind: "objectList",
  objectType,
});

export type ParameterSpec =
  | ParameterType
  | KeywordParameter
  | ObjectListParameterSpec;

export interface OptionalParameterSpec {
  readonly kind: "optional";
  readonly name: string;
  readonly specs?: readonly ParameterSpec[];
}

export const OptionalParameter = (
  name: string,
  ...specs: ParameterSpec[]
): OptionalParameterSpec => ({
  kind: "optional",
  name,
  specs: specs.length > 0 ? specs : undefined,
});

export type ParameterSlot =
  | ParameterSpec
  | readonly ParameterSpec[]
  | OptionalParameterSpec;

export type ParameterSignature = readonly ParameterSlot[];

export type ASTKeywordParameterNode = ASTNode<SyntaxKind.KEYWORD> & {
  value: string;
};

export type ASTQuotedStringNode = ASTNode<SyntaxKind.QUOTED_STRING> & {
  value: string;
};

export type ASTParameterNode =
  | ASTKeywordParameterNode
  | ASTIntegerNode
  | ASTFloatingPointNode
  | ASTReferenceNode
  | ASTMemberReferenceNode
  | ASTDynamicStringNode
  | ASTGrenadeCountNode
  | ASTQuotedStringNode
  | ASTErrorNode;

export type ParameterParser = (
  ctx: ParserContext,
  anchor: SourceCodeLocation
) => ASTParameterNode[];

const isKeywordParameter = (spec: ParameterSpec): spec is KeywordParameter =>
  typeof spec === "object" && "kind" in spec && spec.kind === "keyword";

const isObjectListParameter = (
  spec: ParameterSpec
): spec is ObjectListParameterSpec =>
  typeof spec === "object" && "kind" in spec && spec.kind === "objectList";

const isOptionalParameter = (
  slot: ParameterSlot
): slot is OptionalParameterSpec =>
  typeof slot === "object" &&
  !Array.isArray(slot) &&
  "kind" in slot &&
  slot.kind === "optional";

const isParameterUnion = (
  slot: ParameterSlot
): slot is readonly ParameterSpec[] => Array.isArray(slot);

const makeReferenceNode = (
  ctx: ParserContext,
  identifier: string,
  location: SourceCodeLocation,
  symbolId: SymbolId
): ASTReferenceNode => {
  ctx.symbolParser.recordReference(symbolId, location);

  return {
    kind: SyntaxKind.REFERENCE,
    identifier,
    symbolId,
    location,
  };
};

export const matchesParameterType = (
  entry: SymbolTableEntry,
  type: ParameterType
): boolean => {
  switch (type) {
    case ParameterType.Integer:
    case ParameterType.Float:
      return (
        entry.kind === SymbolKind.Constant ||
        entry.kind === SymbolKind.GameOption ||
        (entry.kind === SymbolKind.Variable &&
          entry.type === VariableType.Number)
      );
    case ParameterType.Timer:
      return (
        entry.kind === SymbolKind.Variable && entry.type === VariableType.Timer
      );
    case ParameterType.Team:
      return (
        entry.kind === SymbolKind.Variable && entry.type === VariableType.Team
      );
    case ParameterType.Player:
      return (
        entry.kind === SymbolKind.Variable && entry.type === VariableType.Player
      );
    case ParameterType.Object:
      return (
        entry.kind === SymbolKind.Variable &&
        (entry.type === VariableType.Object ||
          entry.type === VariableType.Player)
      );
    case ParameterType.HudWidget:
      return entry.kind === SymbolKind.HudWidget;
    case ParameterType.Loadout:
      return entry.kind === SymbolKind.Loadout;
    case ParameterType.LoadoutPalette:
      return entry.kind === SymbolKind.LoadoutPalette;
    case ParameterType.RequisitionPalette:
      return entry.kind === SymbolKind.RequisitionPalette;
    case ParameterType.ObjectFilter:
      return entry.kind === SymbolKind.ObjectFilter;
    case ParameterType.PlayerTraits:
      return entry.kind === SymbolKind.PlayerTraits;
    case ParameterType.String:
    case ParameterType.DynamicString:
      return entry.kind === SymbolKind.String;
    default:
      return false;
  }
};

const isVariableParameterType = (type: ParameterType): boolean =>
  type === ParameterType.Integer ||
  type === ParameterType.Float ||
  type === ParameterType.Timer ||
  type === ParameterType.Team ||
  type === ParameterType.Player ||
  type === ParameterType.Object;

/** Parse a single `.member` after a root identifier that has already been consumed. */
export const parseMemberReference = (
  ctx: ParserContext,
  rootToken: { value: string; location: SourceCodeLocation }
): ASTMemberReferenceNode => {
  const rootSymbolId = ctx.symbolParser.lookupSymbol(rootToken.value);
  if (rootSymbolId !== undefined) {
    ctx.symbolParser.recordReference(rootSymbolId, rootToken.location);
  }

  ctx.getToken(); // MemberVariableSeparator
  const memberToken = ctx.getToken();
  if (memberToken.kind !== TokenKind.Identifier) {
    ctx.diagnostics.addError(
      diagnosticMessages.expectedTokenKind(
        TokenKind.Identifier,
        memberToken.kind,
        memberToken.value
      ),
      memberToken.location
    );
    return {
      kind: SyntaxKind.MEMBER_REFERENCE,
      root: rootToken.value,
      rootSymbolId,
      member: { value: "", location: memberToken.location },
      location: locationSpan(rootToken.location, memberToken.location),
    };
  }

  const memberSymbolId = ctx.symbolParser.lookupSymbol(memberToken.value);
  if (memberSymbolId !== undefined) {
    ctx.symbolParser.recordReference(memberSymbolId, memberToken.location);
  }

  return {
    kind: SyntaxKind.MEMBER_REFERENCE,
    root: rootToken.value,
    rootSymbolId,
    member: {
      value: memberToken.value,
      location: memberToken.location,
    },
    location: locationSpan(rootToken.location, memberToken.location),
  };
};

const lookupReferenceSymbolId = (
  ctx: ParserContext,
  name: string
): SymbolId | undefined =>
  ctx.symbolParser.lookupSymbol(name) ??
  ctx.symbolParser.lookupString(name) ??
  ctx.symbolParser.lookupHudWidget(name) ??
  ctx.symbolParser.lookupLoadout(name) ??
  ctx.symbolParser.lookupLoadoutPalette(name) ??
  ctx.symbolParser.lookupRequisitionPalette(name) ??
  ctx.symbolParser.lookupObjectFilter(name) ??
  ctx.symbolParser.lookupPlayerTraits(name);

/**
 * Tokens that start (or end) a trigger body statement — not action/condition
 * operands. Derived from {@link TRIGGER_BODY_KEYWORDS}; `for_each` is included
 * because nested for_each headers are statement-shaped even when written without
 * repeating `action` in recovery paths. `not` is omitted (condition modifier).
 */
const TRIGGER_STATEMENT_BOUNDARY = new Set<string>([
  ...TRIGGER_BODY_KEYWORDS.filter((keyword) => keyword !== "not"),
  "for_each",
]);

/** Next-token boundaries that belong to the trigger statement parser, not operands. */
export const isTriggerStatementBoundary = (
  token: Token | undefined
): boolean => {
  if (token === undefined) {
    return true;
  }
  return (
    token.kind === TokenKind.Identifier &&
    TRIGGER_STATEMENT_BOUNDARY.has(token.value)
  );
};

const consumeLenientParameter = (
  ctx: ParserContext,
  anchor: SourceCodeLocation
): ASTParameterNode => {
  const token = ctx.peekToken();

  if (token === undefined || isTriggerStatementBoundary(token)) {
    return {
      kind: SyntaxKind.INVALID,
      location: anchor,
    };
  }

  if (
    token.kind === TokenKind.Identifier &&
    ctx.peekToken(1)?.kind === TokenKind.MemberVariableSeparator
  ) {
    const rootToken = ctx.getToken();
    return parseMemberReference(ctx, rootToken);
  }

  const consumed = ctx.getToken();

  if (consumed.kind === TokenKind.Integer) {
    return {
      kind: SyntaxKind.INTEGER,
      value: Number.parseInt(consumed.value, 10),
      location: consumed.location,
    };
  }

  if (consumed.kind === TokenKind.FloatingPoint) {
    return {
      kind: SyntaxKind.FLOATING_POINT,
      value: Number.parseFloat(consumed.value),
      location: consumed.location,
    };
  }

  if (
    consumed.kind === TokenKind.Operator ||
    consumed.kind === TokenKind.Identifier
  ) {
    const symbolId =
      consumed.kind === TokenKind.Identifier
        ? lookupReferenceSymbolId(ctx, consumed.value)
        : undefined;

    if (symbolId !== undefined) {
      return makeReferenceNode(
        ctx,
        consumed.value,
        consumed.location,
        symbolId
      );
    }

    return {
      kind: SyntaxKind.KEYWORD,
      value: consumed.value,
      location: consumed.location,
    };
  }

  return {
    kind: SyntaxKind.INVALID,
    location: consumed.location ?? anchor,
  };
};

const parseVariableParameter = (
  ctx: ParserContext,
  type: ParameterType
): ASTParameterNode | undefined => {
  const token = ctx.peekToken();

  if (type === ParameterType.Integer && token?.kind === TokenKind.Integer) {
    const integerToken = ctx.getToken();
    return {
      kind: SyntaxKind.INTEGER,
      value: Number.parseInt(integerToken.value, 10),
      location: integerToken.location,
    };
  }

  if (type === ParameterType.Float) {
    if (token?.kind === TokenKind.FloatingPoint) {
      const floatToken = ctx.getToken();
      return {
        kind: SyntaxKind.FLOATING_POINT,
        value: Number.parseFloat(floatToken.value),
        location: floatToken.location,
      };
    }
    if (token?.kind === TokenKind.Integer) {
      const integerToken = ctx.getToken();
      return {
        kind: SyntaxKind.INTEGER,
        value: Number.parseInt(integerToken.value, 10),
        location: integerToken.location,
      };
    }
  }

  if (token?.kind !== TokenKind.Identifier) {
    return;
  }

  if (ctx.peekToken(1)?.kind === TokenKind.MemberVariableSeparator) {
    // check if we have a member with the right type.
    const memberPeek = ctx.peekToken(2);
    if (memberPeek?.kind === TokenKind.Identifier) {
      const memberSymbolId = ctx.symbolParser.lookupSymbol(memberPeek.value);
      if (memberSymbolId !== undefined) {
        const memberEntry = ctx.symbolParser.getSymbolEntry(memberSymbolId);
        if (
          memberEntry !== undefined &&
          !matchesParameterType(memberEntry, type)
        ) {
          // Typed signature miss (e.g. number member vs Timer) — try next overload.
          return;
        }
      }
    }
    const rootToken = ctx.getToken();
    return parseMemberReference(ctx, rootToken);
  }

  const symbolId = ctx.symbolParser.lookupSymbol(token.value);
  if (symbolId === undefined) {
    return;
  }

  const entry = ctx.symbolParser.getSymbolEntry(symbolId);
  if (entry === undefined || !matchesParameterType(entry, type)) {
    return;
  }

  const referenceToken = ctx.getToken();
  return makeReferenceNode(
    ctx,
    referenceToken.value,
    referenceToken.location,
    symbolId
  );
};

const parseNamedSymbolParameter = (
  ctx: ParserContext,
  lookup: (name: string) => SymbolId | undefined
): ASTParameterNode | undefined => {
  const token = ctx.peekToken();
  if (token?.kind !== TokenKind.Identifier) {
    return;
  }

  const symbolId = lookup(token.value);
  if (symbolId === undefined) {
    return;
  }

  const referenceToken = ctx.getToken();
  return makeReferenceNode(
    ctx,
    referenceToken.value,
    referenceToken.location,
    symbolId
  );
};

const parseObjectListParameter = (
  ctx: ParserContext,
  objectType: ObjectListType
): ASTParameterNode | undefined => {
  const token = ctx.peekToken();
  if (
    token?.kind !== TokenKind.Identifier &&
    token?.kind !== TokenKind.QuotedString
  ) {
    return;
  }

  const symbolId = ctx.symbolParser.lookupObjectListItem(
    objectType,
    token.value
  );
  if (symbolId === undefined) {
    return;
  }

  const referenceToken = ctx.getToken();
  return makeReferenceNode(
    ctx,
    referenceToken.value,
    referenceToken.location,
    symbolId
  );
};

const parseParameter = (
  ctx: ParserContext,
  spec: ParameterSpec
): ASTParameterNode | undefined => {
  const token = ctx.peekToken();

  if (isKeywordParameter(spec)) {
    if (token?.kind !== TokenKind.Identifier || token.value !== spec.value) {
      return;
    }

    const keywordToken = ctx.getToken();
    return {
      kind: SyntaxKind.KEYWORD,
      value: keywordToken.value,
      location: keywordToken.location,
    };
  }

  if (isObjectListParameter(spec)) {
    return parseObjectListParameter(ctx, spec.objectType);
  }

  if (isVariableParameterType(spec)) {
    return parseVariableParameter(ctx, spec);
  }

  switch (spec) {
    case ParameterType.Keyword: {
      if (token?.kind !== TokenKind.Identifier) {
        return;
      }

      const keywordToken = ctx.getToken();
      return {
        kind: SyntaxKind.KEYWORD,
        value: keywordToken.value,
        location: keywordToken.location,
      };
    }

    case ParameterType.MathOperation: {
      if (
        token?.kind !== TokenKind.Operator &&
        token?.kind !== TokenKind.Identifier
      ) {
        return;
      }

      const mathToken = ctx.getToken();
      return {
        kind: SyntaxKind.KEYWORD,
        value: mathToken.value,
        location: mathToken.location,
      };
    }

    case ParameterType.QuotedString: {
      if (token?.kind !== TokenKind.QuotedString) {
        return;
      }

      const stringToken = ctx.getToken();
      return {
        kind: SyntaxKind.QUOTED_STRING,
        value: stringToken.value,
        location: stringToken.location,
      };
    }

    case ParameterType.HudWidget:
      return parseNamedSymbolParameter(ctx, (name) =>
        ctx.symbolParser.lookupHudWidget(name)
      );

    case ParameterType.Loadout:
      return parseNamedSymbolParameter(ctx, (name) =>
        ctx.symbolParser.lookupLoadout(name)
      );

    case ParameterType.LoadoutPalette:
      return parseNamedSymbolParameter(ctx, (name) =>
        ctx.symbolParser.lookupLoadoutPalette(name)
      );

    case ParameterType.RequisitionPalette:
      return parseNamedSymbolParameter(ctx, (name) =>
        ctx.symbolParser.lookupRequisitionPalette(name)
      );

    case ParameterType.ObjectFilter:
      return parseNamedSymbolParameter(ctx, (name) =>
        ctx.symbolParser.lookupObjectFilter(name)
      );

    case ParameterType.PlayerTraits:
      return parseNamedSymbolParameter(ctx, (name) =>
        ctx.symbolParser.lookupPlayerTraits(name)
      );

    case ParameterType.String:
      return parseNamedSymbolParameter(ctx, (name) =>
        ctx.symbolParser.lookupString(name)
      );

    default:
      return;
  }
};

/**
 * Try each spec without consuming the token stream on failure.
 * Returns undefined if none match.
 */
export const tryParseParameterValue = (
  ctx: ParserContext,
  ...specs: ParameterSpec[]
): ASTParameterNode | undefined => {
  for (const spec of specs) {
    const mark = ctx.mark();
    const parameter = parseParameter(ctx, spec);
    if (parameter !== undefined) {
      return parameter;
    }
    ctx.reset(mark);
  }

  return;
};

/** Parse a single parameter slot against the given specs (tries each until one matches). */
export const parseParameterValue = (
  ctx: ParserContext,
  anchor: SourceCodeLocation,
  ...specs: ParameterSpec[]
): ASTParameterNode =>
  tryParseParameterValue(ctx, ...specs) ?? consumeLenientParameter(ctx, anchor);

const dynamicStringParserDeps = () => ({
  parseReplacement: (ctx: ParserContext, type: ParameterType) =>
    parseParameter(ctx, type),
  parseReplacementLenient: (
    ctx: ParserContext,
    anchor: SourceCodeLocation,
    type: ParameterType
  ) => parseParameter(ctx, type) ?? consumeLenientParameter(ctx, anchor),
});

const tryParseSlot = (
  ctx: ParserContext,
  slot: ParameterSlot
): ASTParameterNode[] | undefined => {
  if (slot === ParameterType.DynamicString) {
    const node = tryParseDynamicString(ctx, dynamicStringParserDeps());
    return node === undefined ? undefined : [node];
  }

  if (isOptionalParameter(slot)) {
    const token = ctx.peekToken();
    if (token?.kind !== TokenKind.Identifier || token.value !== slot.name) {
      return [];
    }

    const nameToken = ctx.getToken();
    const nodes: ASTParameterNode[] = [
      {
        kind: SyntaxKind.KEYWORD,
        value: nameToken.value,
        location: nameToken.location,
      },
    ];

    if (slot.specs !== undefined) {
      for (const spec of slot.specs) {
        const parameter = parseParameter(ctx, spec);
        if (parameter === undefined) {
          return;
        }

        nodes.push(parameter);
      }
    }

    return nodes;
  }

  if (isParameterUnion(slot)) {
    for (const spec of slot) {
      const mark = ctx.mark();
      const parameter = parseParameter(ctx, spec);
      if (parameter !== undefined) {
        return [parameter];
      }

      ctx.reset(mark);
    }

    return;
  }

  const parameter = parseParameter(ctx, slot);
  return parameter === undefined ? undefined : [parameter];
};

const parseSlot = (
  ctx: ParserContext,
  slot: ParameterSlot,
  anchor: SourceCodeLocation
): ASTParameterNode[] => {
  if (slot === ParameterType.DynamicString) {
    if (isTriggerStatementBoundary(ctx.peekToken())) {
      return [];
    }
    return [
      parseDynamicString(
        ctx,
        anchor,
        dynamicStringParserDeps(),
        consumeLenientParameter
      ),
    ];
  }

  if (isOptionalParameter(slot)) {
    const token = ctx.peekToken();
    if (token?.kind !== TokenKind.Identifier || token.value !== slot.name) {
      return [];
    }

    const nameToken = ctx.getToken();
    const nodes: ASTParameterNode[] = [
      {
        kind: SyntaxKind.KEYWORD,
        value: nameToken.value,
        location: nameToken.location,
      },
    ];

    if (slot.specs !== undefined) {
      for (const spec of slot.specs) {
        const parameter =
          parseParameter(ctx, spec) ?? consumeLenientParameter(ctx, anchor);
        nodes.push(parameter);
      }
    }

    return nodes;
  }

  if (isParameterUnion(slot)) {
    for (const spec of slot) {
      const mark = ctx.mark();
      const parameter = parseParameter(ctx, spec);
      if (parameter !== undefined) {
        return [parameter];
      }

      ctx.reset(mark);
    }

    if (isTriggerStatementBoundary(ctx.peekToken())) {
      return [];
    }
    return [consumeLenientParameter(ctx, anchor)];
  }

  const parameter = parseParameter(ctx, slot);
  if (parameter !== undefined) {
    return [parameter];
  }
  if (isTriggerStatementBoundary(ctx.peekToken())) {
    return [];
  }
  return [consumeLenientParameter(ctx, anchor)];
};

/**
 * Skip one operand's tokens (a token, or an `a.b.c` member chain) without
 * building nodes or recording symbol references. Used only while scoring
 * signatures. Returns false at a statement boundary.
 */
const skipOperandTokens = (ctx: ParserContext): boolean => {
  if (isTriggerStatementBoundary(ctx.peekToken())) {
    return false;
  }
  ctx.getToken();
  while (
    ctx.peekToken()?.kind === TokenKind.MemberVariableSeparator &&
    ctx.peekToken(1) !== undefined
  ) {
    ctx.getToken();
    ctx.getToken();
  }
  return true;
};

const tryParseSignature = (
  ctx: ParserContext,
  signature: ParameterSignature
): ASTParameterNode[] | undefined => {
  const parameters: ASTParameterNode[] = [];

  for (const slot of signature) {
    const parsed = tryParseSlot(ctx, slot);
    if (parsed === undefined) {
      return;
    }

    parameters.push(...parsed);
  }

  return parameters;
};

const parseSignature = (
  ctx: ParserContext,
  signature: ParameterSignature,
  anchor: SourceCodeLocation
): ASTParameterNode[] => {
  const parameters: ASTParameterNode[] = [];

  for (const slot of signature) {
    parameters.push(...parseSlot(ctx, slot, anchor));
  }

  return parameters;
};

export const parameterParserBuilder = (
  ...signatures: ParameterSignature[]
): ParameterParser => {
  if (signatures.length === 0) {
    return () => [];
  }

  return (
    ctx: ParserContext,
    anchor: SourceCodeLocation
  ): ASTParameterNode[] => {
    const parseAnchor = anchor;

    for (const signature of signatures) {
      const mark = ctx.mark();
      const parameters = tryParseSignature(ctx, signature);
      if (parameters !== undefined) {
        return parameters;
      }

      ctx.reset(mark);
    }

    // Prefer the signature whose slots match best. A slot that fails (e.g. an
    // unresolved name) is skipped and scoring continues, so a later
    // discriminating keyword still decides between forms like set_score /
    // play_sound's everyone|player|team targets.
    let bestSignature = signatures[0]!;
    let bestScore = -1;

    for (const signature of signatures) {
      const mark = ctx.mark();
      let score = 0;

      for (const slot of signature) {
        const parsed = tryParseSlot(ctx, slot);
        if (parsed !== undefined) {
          score += 1;
          continue;
        }
        if (!skipOperandTokens(ctx)) {
          break;
        }
      }

      ctx.reset(mark);

      if (score > bestScore) {
        bestScore = score;
        bestSignature = signature;
      }
    }

    return parseSignature(ctx, bestSignature, parseAnchor);
  };
};

import {
  type ASTElementNode,
  ElementKind,
} from "src/frontend/abstract-syntax-tree/elements";
import type {
  BeginStatementNode,
  ForEachStatementNode,
  TriggerElementNode,
  TriggerStatementNode,
} from "src/frontend/abstract-syntax-tree/elements/trigger";
import type { ActionStatementNode } from "src/frontend/abstract-syntax-tree/elements/trigger/action";
import type { ConditionStatementNode } from "src/frontend/abstract-syntax-tree/elements/trigger/condition";
import { SyntaxKind } from "src/frontend/abstract-syntax-tree/kinds";
import type { SymbolTableEntry } from "src/frontend/symbol-table";
import { type Token, TokenKind } from "src/frontend/tokens";
import { lookupHoverContribution } from "src/language-service/hover/registry";
import type { HoverTarget } from "src/language-service/hover/types";
import {
  isRootDocumentLocation,
  locationContainsOffset,
  positionToOffset,
} from "src/language-service/position";
import type { AnalysisSnapshot } from "src/language-service/snapshot";

const KEYWORD_IDS = new Set([
  "action",
  "condition",
  "temporary",
  "begin",
  "end",
  "trigger",
  "not",
]);

/** Token containing `offset`, if any (root-document tokens only). */
const tokenAtOffset = (
  snapshot: AnalysisSnapshot,
  offset: number
): Token | undefined => {
  for (const token of snapshot.tokens) {
    if (!isRootDocumentLocation(token.location)) {
      continue;
    }
    if (locationContainsOffset(token.location, offset)) {
      return token;
    }
  }
  return;
};

const rootTarget = (
  range: HoverTarget["range"],
  target: HoverTarget
): HoverTarget | null => (isRootDocumentLocation(range) ? target : null);

const findStatementHover = (
  statements: readonly TriggerStatementNode[],
  offset: number
): HoverTarget | null => {
  for (const statement of statements) {
    switch (statement.kind) {
      case SyntaxKind.ACTION: {
        const action = statement as ActionStatementNode;
        if (locationContainsOffset(action.name.location, offset)) {
          return rootTarget(action.name.location, {
            kind: "action",
            id: action.name.value,
            range: action.name.location,
          });
        }
        break;
      }
      case SyntaxKind.CONDITION: {
        const condition = statement as ConditionStatementNode;
        if (locationContainsOffset(condition.name.location, offset)) {
          return rootTarget(condition.name.location, {
            kind: "condition",
            id: condition.name.value,
            range: condition.name.location,
          });
        }
        break;
      }
      case SyntaxKind.BEGIN: {
        const begin = statement as BeginStatementNode;
        if (locationContainsOffset(begin.keywordLocation, offset)) {
          return rootTarget(begin.keywordLocation, {
            kind: "keyword",
            id: "begin",
            range: begin.keywordLocation,
          });
        }
        const nested = findStatementHover(begin.statements, offset);
        if (nested !== null) {
          return nested;
        }
        break;
      }
      case SyntaxKind.FOR_EACH: {
        const forEach = statement as ForEachStatementNode;
        if (locationContainsOffset(forEach.name.location, offset)) {
          return rootTarget(forEach.name.location, {
            kind: "action",
            id: forEach.name.value,
            range: forEach.name.location,
          });
        }
        const nested = findStatementHover(forEach.statements, offset);
        if (nested !== null) {
          return nested;
        }
        break;
      }
      default:
        break;
    }
  }
  return null;
};

export const elementKeywordId = (
  element: ASTElementNode
): string | undefined => {
  switch (element.elementKind) {
    case ElementKind.BASE:
      return "base";
    case ElementKind.INCLUDE:
      return "include";
    case ElementKind.LOCALIZED_INCLUDE:
      return "localized_include";
    case ElementKind.STRING_TABLE:
      return "string_table";
    case ElementKind.CONSTANTS:
      return "constants";
    case ElementKind.VARIABLES:
      return "variables";
    case ElementKind.GAME_OPTIONS:
      return "game_options";
    case ElementKind.HUD_WIDGETS:
      return "hud_widgets";
    case ElementKind.LOADOUT:
      return "loadout";
    case ElementKind.LOADOUT_PALETTE:
      return "loadout_palette";
    case ElementKind.TEAMS:
      return "teams";
    case ElementKind.ENGINE_DATA:
      return "engine_data";
    case ElementKind.PLAYER_RATING:
      return "player_rating";
    case ElementKind.MAP_PERMISSIONS:
      return "map_permissions";
    case ElementKind.GAME_STATS:
      return "game_stats";
    case ElementKind.MAP_OBJECT:
      return "map_object";
    case ElementKind.REQUISITION_PALETTE:
      return "requisition_palette";
    case ElementKind.TRIGGER:
      return "trigger";
    default: {
      const _exhaustive: never = element;
      void _exhaustive;
      return;
    }
  }
};

const resolveElementParam = (
  element: ASTElementNode,
  elementId: string,
  offset: number,
  token: Token | undefined
): HoverTarget | null => {
  if (!locationContainsOffset(element.location, offset)) {
    return null;
  }
  if (locationContainsOffset(element.keywordLocation, offset)) {
    return null;
  }
  if (token === undefined || token.kind !== TokenKind.Identifier) {
    return null;
  }
  if (
    !locationContainsOffset(element.location, token.location.start.localOffset)
  ) {
    return null;
  }
  const paramId = `${elementId}.${token.value}`;
  if (lookupHoverContribution("param", paramId) === undefined) {
    return null;
  }
  return rootTarget(token.location, {
    kind: "param",
    id: paramId,
    range: token.location,
  });
};

/**
 * Resolve what the cursor is over for hover via ordered first-match.
 * Safe only under `reservedKeywords`: a token cannot be both a keyword and a
 * user symbol, so element → keyword → symbol is mutually exclusive per token.
 * Element keywords are checked before bare KEYWORD_IDS so `trigger` stays an
 * element hover.
 */
export const resolveHoverTarget = (
  snapshot: AnalysisSnapshot,
  position: { line: number; character: number }
): HoverTarget | null => {
  const offset = positionToOffset(
    snapshot.lineStarts,
    snapshot.source.length,
    position.line,
    position.character
  );
  const token = tokenAtOffset(snapshot, offset);

  for (const element of snapshot.ast.elements) {
    if (element.elementKind === ElementKind.TRIGGER) {
      const trigger = element as TriggerElementNode;
      if (locationContainsOffset(trigger.keywordLocation, offset)) {
        const target = rootTarget(trigger.keywordLocation, {
          kind: "element",
          id: "trigger",
          range: trigger.keywordLocation,
        });
        if (target !== null) {
          return target;
        }
      }
      const statementTarget = findStatementHover(trigger.statements, offset);
      if (statementTarget !== null) {
        return statementTarget;
      }
      continue;
    }

    const id = elementKeywordId(element);
    if (id === undefined) {
      continue;
    }
    if (locationContainsOffset(element.keywordLocation, offset)) {
      const target = rootTarget(element.keywordLocation, {
        kind: "element",
        id,
        range: element.keywordLocation,
      });
      if (target !== null) {
        return target;
      }
    }
    const param = resolveElementParam(element, id, offset, token);
    if (param !== null) {
      return param;
    }
  }

  if (
    token !== undefined &&
    token.kind === TokenKind.Identifier &&
    KEYWORD_IDS.has(token.value)
  ) {
    return {
      kind: "keyword",
      id: token.value,
      range: token.location,
    };
  }

  for (const entry of snapshot.ast.symbolTable.toArray() as SymbolTableEntry[]) {
    for (const reference of entry.references) {
      if (
        isRootDocumentLocation(reference) &&
        locationContainsOffset(reference, offset)
      ) {
        return {
          kind: "symbol",
          entry,
          range: reference,
        };
      }
    }
  }

  return null;
};

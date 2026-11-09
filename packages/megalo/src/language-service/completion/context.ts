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
import type { TemporaryStatementNode } from "src/frontend/abstract-syntax-tree/elements/trigger/temporary";
import { SyntaxKind } from "src/frontend/abstract-syntax-tree/kinds";
import type { ASTParameterNode } from "src/frontend/abstract-syntax-tree/parameters";
import { type Token, TokenKind } from "src/frontend/tokens";
import { findCompletionPrefix } from "src/language-service/completion/replace-range";
import type {
  CompletionContext,
  CompletionPrefix,
} from "src/language-service/completion/types";
import {
  isRootDocumentLocation,
  positionToOffset,
} from "src/language-service/position";
import type { AnalysisSnapshot } from "src/language-service/snapshot";

const spanLength = (start: number, end: number): number =>
  Math.max(0, end - start);

const paramContainsOffset = (
  node: {
    location: {
      start: { localOffset: number };
      end: { localOffset: number };
    };
  },
  offset: number
): boolean =>
  offset >= node.location.start.localOffset &&
  offset <= node.location.end.localOffset;

/**
 * Slot index for positional params.
 * Cursor inside or at the end of a param → that index; in a gap before a param →
 * that index; after the last param → `parameters.length` (next missing slot).
 */
export const slotIndexForParameters = (
  parameters: readonly ASTParameterNode[],
  offset: number
): number => {
  if (parameters.length === 0) {
    return 0;
  }
  for (let i = 0; i < parameters.length; i++) {
    const param = parameters[i]!;
    if (offset < param.location.start.localOffset) {
      return i;
    }
    if (offset <= param.location.end.localOffset) {
      return i;
    }
  }
  return parameters.length;
};

const lineOfOffset = (snapshot: AnalysisSnapshot, offset: number): number => {
  const { lineStarts } = snapshot;
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid]! <= offset) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
};

/**
 * Last root-document token on the cursor's line that ends at or before `offset`.
 * Under `reservedKeywords`, identifier values are exact keywords — no text regex.
 */
const lastTokenOnLineBefore = (
  snapshot: AnalysisSnapshot,
  offset: number
): Token | undefined => {
  const line = lineOfOffset(snapshot, offset);
  const lineStart = snapshot.lineStarts[line]!;
  let last: Token | undefined;
  for (const token of snapshot.tokens) {
    if (!isRootDocumentLocation(token.location)) {
      continue;
    }
    if (token.location.start.localOffset < lineStart) {
      continue;
    }
    if (token.location.start.localOffset >= offset) {
      break;
    }
    if (token.location.end.localOffset <= offset) {
      last = token;
    }
  }
  return last;
};

/** Immediate predecessor of `token` on the same line, if any. */
const previousTokenOnLine = (
  snapshot: AnalysisSnapshot,
  token: Token
): Token | undefined => {
  const lineStart =
    snapshot.lineStarts[token.location.start.line - 1] ??
    token.location.start.localOffset;
  let previous: Token | undefined;
  for (const candidate of snapshot.tokens) {
    if (!isRootDocumentLocation(candidate.location)) {
      continue;
    }
    if (candidate.location.start.localOffset < lineStart) {
      continue;
    }
    if (
      candidate.location.start.localOffset >= token.location.start.localOffset
    ) {
      break;
    }
    previous = candidate;
  }
  return previous;
};

/** Placeholder used when completing `temporary ` before the statement parses. */
const syntheticTemporary = (
  location: TemporaryStatementNode["location"]
): TemporaryStatementNode => ({
  kind: SyntaxKind.TEMPORARY,
  storage: { value: "number", location },
  name: { value: "", location },
  initial: { kind: SyntaxKind.INVALID, location },
  location,
});

/**
 * `trigger` or `trigger <partialName>` with nothing else on the line yet.
 * Token-exact under reserved keywords.
 */
const isTriggerHeaderLine = (
  snapshot: AnalysisSnapshot,
  offset: number
): boolean => {
  const line = lineOfOffset(snapshot, offset);
  const lineStart = snapshot.lineStarts[line]!;
  const onLine: Token[] = [];
  for (const token of snapshot.tokens) {
    if (!isRootDocumentLocation(token.location)) {
      continue;
    }
    if (token.location.start.localOffset < lineStart) {
      continue;
    }
    if (token.location.start.localOffset >= offset) {
      break;
    }
    onLine.push(token);
  }
  if (onLine.length === 0 || onLine.length > 2) {
    return false;
  }
  const first = onLine[0]!;
  return first.kind === TokenKind.Identifier && first.value === "trigger";
};

const isCompletingTriggerName = (
  snapshot: AnalysisSnapshot,
  offset: number,
  trigger: TriggerElementNode
): boolean => {
  const kwEnd = trigger.keywordLocation.end.localOffset;
  if (offset <= kwEnd) {
    return false;
  }
  const line = lineOfOffset(snapshot, offset);
  const kwLine = trigger.keywordLocation.start.line - 1;
  if (line !== kwLine) {
    return false;
  }
  const nameEnd = trigger.name.location.end.localOffset;
  const firstBody = trigger.statements[0];
  if (
    firstBody !== undefined &&
    offset >= firstBody.location.start.localOffset &&
    firstBody.location.start.localOffset > nameEnd
  ) {
    return false;
  }
  return true;
};

/** Completing `for_each <kind>` target on the for_each header line. */
const isCompletingForEachTarget = (
  snapshot: AnalysisSnapshot,
  offset: number,
  statement: ForEachStatementNode
): boolean => {
  const line = lineOfOffset(snapshot, offset);
  const headerLine = statement.location.start.line - 1;
  if (line !== headerLine) {
    return false;
  }
  const targetEnd = statement.target.location.end.localOffset;
  const firstBody = statement.statements[0];
  if (
    firstBody !== undefined &&
    offset >= firstBody.location.start.localOffset &&
    firstBody.location.start.localOffset > targetEnd
  ) {
    return false;
  }
  // Need to be past `action for_each` — at/after the target span or the gap before it.
  return (
    offset >= statement.target.location.start.localOffset ||
    offset > statement.location.start.localOffset
  );
};

interface Hit {
  kind:
    | "action"
    | "condition"
    | "trigger"
    | "begin"
    | "for_each"
    | "temporary"
    | "element";
  node:
    | ActionStatementNode
    | ConditionStatementNode
    | TriggerElementNode
    | BeginStatementNode
    | ForEachStatementNode
    | TemporaryStatementNode
    | ASTElementNode;
  span: number;
}

/** Top-level / nested blocks that close with an `end` keyword. */
const ELEMENT_KINDS_WITH_END = new Set<ElementKind>([
  ElementKind.STRING_TABLE,
  ElementKind.CONSTANTS,
  ElementKind.VARIABLES,
  ElementKind.GAME_OPTIONS,
  ElementKind.HUD_WIDGETS,
  ElementKind.LOADOUT,
  ElementKind.LOADOUT_PALETTE,
  ElementKind.TEAMS,
  ElementKind.ENGINE_DATA,
  ElementKind.PLAYER_RATING,
  ElementKind.MAP_PERMISSIONS,
  ElementKind.GAME_STATS,
  ElementKind.MAP_OBJECT,
  ElementKind.REQUISITION_PALETTE,
]);

const isBlockHitKind = (kind: Hit["kind"]): boolean =>
  kind === "trigger" ||
  kind === "begin" ||
  kind === "for_each" ||
  kind === "element";

/**
 * Whether the node's source span ends with a block `end`.
 * Sound under `reservedKeywords`: a trailing `end` cannot be a variable.
 */
const closedWithEndKeyword = (
  snapshot: AnalysisSnapshot,
  node: Hit["node"]
): boolean =>
  /\bend\s*$/i.test(
    snapshot.source.slice(
      node.location.start.localOffset,
      node.location.end.localOffset
    )
  );

const isOnlyWhitespace = (text: string): boolean => /^\s*$/.test(text);

/** Exclusive start of the next root element after `afterOffset`, or EOF. */
const nextRootElementStart = (
  snapshot: AnalysisSnapshot,
  afterOffset: number
): number => {
  let next = snapshot.source.length;
  for (const element of snapshot.ast.elements) {
    const start = element.location.start.localOffset;
    if (start > afterOffset && start < next) {
      next = start;
    }
  }
  return next;
};

const consider = (
  hits: Hit[],
  kind: Hit["kind"],
  node: Hit["node"],
  offset: number,
  snapshot: AnalysisSnapshot
): void => {
  if (!isRootDocumentLocation(node.location)) {
    return;
  }
  const start = node.location.start.localOffset;
  const end = node.location.end.localOffset;
  if (offset >= start && offset <= end) {
    hits.push({ kind, node, span: spanLength(start, end) });
    return;
  }
  // Same line after the node — still completing that statement's next token.
  if (offset > end) {
    const cursorLine = lineOfOffset(snapshot, offset);
    if (cursorLine === node.location.end.line - 1) {
      const lineEnd =
        snapshot.lineStarts[cursorLine + 1] ?? snapshot.source.length;
      if (offset <= lineEnd) {
        hits.push({ kind, node, span: spanLength(start, end) });
        return;
      }
    }

    // Unclosed `end` blocks stop at the last statement/header, so trailing blank
    // lines fall outside the AST span — still treat them as inside the block.
    if (
      isBlockHitKind(kind) &&
      !closedWithEndKeyword(snapshot, node) &&
      (kind !== "element" ||
        ELEMENT_KINDS_WITH_END.has((node as ASTElementNode).elementKind)) &&
      offset < nextRootElementStart(snapshot, start) &&
      isOnlyWhitespace(snapshot.source.slice(end, offset))
    ) {
      hits.push({ kind, node, span: spanLength(start, end) });
    }
  }
};

const walkStatements = (
  statements: readonly TriggerStatementNode[],
  offset: number,
  hits: Hit[],
  snapshot: AnalysisSnapshot
): void => {
  for (const statement of statements) {
    switch (statement.kind) {
      case SyntaxKind.ACTION:
        consider(hits, "action", statement, offset, snapshot);
        break;
      case SyntaxKind.CONDITION:
        consider(hits, "condition", statement, offset, snapshot);
        break;
      case SyntaxKind.BEGIN:
        consider(hits, "begin", statement, offset, snapshot);
        walkStatements(statement.statements, offset, hits, snapshot);
        break;
      case SyntaxKind.FOR_EACH:
        consider(hits, "for_each", statement, offset, snapshot);
        walkStatements(statement.statements, offset, hits, snapshot);
        break;
      case SyntaxKind.TEMPORARY:
        consider(hits, "temporary", statement, offset, snapshot);
        break;
      default:
        break;
    }
  }
};

const temporarySlotIndex = (
  statement: TemporaryStatementNode,
  offset: number
): number => {
  // Incomplete parse: storage/name still sit on the `temporary` keyword span.
  const storageIsPlaceholder =
    statement.name.value.length === 0 &&
    statement.storage.location.start.localOffset ===
      statement.location.start.localOffset &&
    statement.storage.location.end.localOffset ===
      statement.location.end.localOffset;
  if (storageIsPlaceholder) {
    return 0;
  }

  if (offset < statement.storage.location.start.localOffset) {
    return 0;
  }
  if (offset <= statement.storage.location.end.localOffset) {
    return 0;
  }
  if (offset < statement.name.location.start.localOffset) {
    return 1;
  }
  if (offset <= statement.name.location.end.localOffset) {
    return 1;
  }
  return 2;
};

const resolveInsideAction = (
  snapshot: AnalysisSnapshot,
  offset: number,
  prefix: CompletionPrefix,
  statement: ActionStatementNode
): CompletionContext => {
  const afterName = statement.name.location.end.localOffset;
  const nameEmpty = statement.name.value.length === 0;

  // Past the action name → operand slots (even when params are still missing).
  if (!nameEmpty && offset > afterName) {
    return {
      kind: "action-operands",
      offset,
      prefix,
      snapshot,
      statement,
      slotIndex: slotIndexForParameters(statement.parameters, offset),
    };
  }

  const inOrAtName =
    nameEmpty ||
    paramContainsOffset(statement.name, offset) ||
    offset <= afterName;

  if (inOrAtName && statement.parameters.length === 0) {
    return { kind: "action-name", offset, prefix, snapshot };
  }
  if (inOrAtName && offset <= afterName) {
    return { kind: "action-name", offset, prefix, snapshot };
  }

  return {
    kind: "action-operands",
    offset,
    prefix,
    snapshot,
    statement,
    slotIndex: slotIndexForParameters(statement.parameters, offset),
  };
};

const resolveInsideCondition = (
  snapshot: AnalysisSnapshot,
  offset: number,
  prefix: CompletionPrefix,
  statement: ConditionStatementNode
): CompletionContext => {
  const afterName = statement.name.location.end.localOffset;
  const nameEmpty = statement.name.value.length === 0;

  if (!nameEmpty && offset > afterName) {
    return {
      kind: "condition-operands",
      offset,
      prefix,
      snapshot,
      statement,
      slotIndex: slotIndexForParameters(
        statement.operands as unknown as ASTParameterNode[],
        offset
      ),
    };
  }

  const inOrAtName =
    nameEmpty ||
    paramContainsOffset(statement.name, offset) ||
    offset <= afterName;

  if (inOrAtName && statement.operands.length === 0) {
    return { kind: "condition-name", offset, prefix, snapshot };
  }
  if (inOrAtName && offset <= afterName) {
    return { kind: "condition-name", offset, prefix, snapshot };
  }

  return {
    kind: "condition-operands",
    offset,
    prefix,
    snapshot,
    statement,
    slotIndex: slotIndexForParameters(
      statement.operands as unknown as ASTParameterNode[],
      offset
    ),
  };
};

const resolveTriggerBodyKeywords = (
  snapshot: AnalysisSnapshot,
  offset: number,
  prefix: CompletionPrefix,
  anchorLocation: TemporaryStatementNode["location"]
): CompletionContext | undefined => {
  const last = lastTokenOnLineBefore(snapshot, offset);
  if (last === undefined || last.kind !== TokenKind.Identifier) {
    return;
  }

  if (last.value === "action") {
    return { kind: "action-name", offset, prefix, snapshot };
  }
  if (last.value === "not") {
    const previous = previousTokenOnLine(snapshot, last);
    if (
      previous?.kind === TokenKind.Identifier &&
      previous.value === "condition"
    ) {
      return { kind: "condition-name", offset, prefix, snapshot };
    }
  }
  if (last.value === "condition") {
    return { kind: "condition-name", offset, prefix, snapshot };
  }
  if (last.value === "temporary") {
    return {
      kind: "temporary",
      offset,
      prefix,
      snapshot,
      statement: syntheticTemporary(anchorLocation),
      slotIndex: 0,
    };
  }
  return;
};

export const resolveCompletionContext = (
  snapshot: AnalysisSnapshot,
  position: { line: number; character: number }
): CompletionContext => {
  const offset = positionToOffset(
    snapshot.lineStarts,
    snapshot.source.length,
    position.line,
    position.character
  );
  const prefix = findCompletionPrefix(snapshot, offset);

  const hits: Hit[] = [];
  for (const element of snapshot.ast.elements) {
    if (element.elementKind === ElementKind.TRIGGER) {
      const trigger = element as TriggerElementNode;
      consider(hits, "trigger", trigger, offset, snapshot);
      walkStatements(trigger.statements, offset, hits, snapshot);
      continue;
    }
    consider(hits, "element", element, offset, snapshot);
  }

  // Prefer the tightest non-trigger hit when both match.
  hits.sort((a, b) => {
    if (a.kind === "trigger" && b.kind !== "trigger") {
      return 1;
    }
    if (b.kind === "trigger" && a.kind !== "trigger") {
      return -1;
    }
    return a.span - b.span;
  });
  const best = hits[0];

  if (best?.kind === "action") {
    return resolveInsideAction(
      snapshot,
      offset,
      prefix,
      best.node as ActionStatementNode
    );
  }
  if (best?.kind === "condition") {
    return resolveInsideCondition(
      snapshot,
      offset,
      prefix,
      best.node as ConditionStatementNode
    );
  }
  if (best?.kind === "temporary") {
    const statement = best.node as TemporaryStatementNode;
    return {
      kind: "temporary",
      offset,
      prefix,
      snapshot,
      statement,
      slotIndex: temporarySlotIndex(statement, offset),
    };
  }
  if (best?.kind === "for_each") {
    const statement = best.node as ForEachStatementNode;
    if (isCompletingForEachTarget(snapshot, offset, statement)) {
      return { kind: "trigger-name", offset, prefix, snapshot };
    }
    const body = resolveTriggerBodyKeywords(
      snapshot,
      offset,
      prefix,
      statement.location
    );
    if (body !== undefined) {
      return body;
    }
    return { kind: "trigger-body", offset, prefix, snapshot };
  }
  if (best?.kind === "trigger" || best?.kind === "begin") {
    const anchor =
      best.kind === "trigger"
        ? (best.node as TriggerElementNode).location
        : (best.node as BeginStatementNode).location;
    const body = resolveTriggerBodyKeywords(snapshot, offset, prefix, anchor);
    if (body !== undefined) {
      return body;
    }
    if (
      best.kind === "trigger" &&
      isCompletingTriggerName(snapshot, offset, best.node as TriggerElementNode)
    ) {
      return { kind: "trigger-name", offset, prefix, snapshot };
    }
    return { kind: "trigger-body", offset, prefix, snapshot };
  }
  if (best?.kind === "element") {
    return {
      kind: "element",
      offset,
      prefix,
      snapshot,
      element: best.node as ASTElementNode,
    };
  }

  if (isTriggerHeaderLine(snapshot, offset)) {
    return { kind: "trigger-name", offset, prefix, snapshot };
  }

  return { kind: "top-level", offset, prefix, snapshot };
};

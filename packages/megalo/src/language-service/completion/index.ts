import { completeActionOperands } from "src/language-service/completion/actions";
import { completeConditionOperands } from "src/language-service/completion/conditions";
import { resolveCompletionContext } from "src/language-service/completion/context";
import { completeElement } from "src/language-service/completion/elements";
import { suggestActionNames } from "src/language-service/completion/suggest/action-names";
import { suggestConditionNames } from "src/language-service/completion/suggest/condition-names";
import { completeTemporary } from "src/language-service/completion/suggest/temporary";
import { suggestTopLevel } from "src/language-service/completion/suggest/top-level";
import { suggestTriggerBody } from "src/language-service/completion/suggest/trigger-body";
import { suggestTriggerName } from "src/language-service/completion/suggest/trigger-name";
import type { CompletionItem } from "src/language-service/completion/types";
import type { AnalysisSnapshot } from "src/language-service/snapshot";

/**
 * Context-aware Megalo completions at a 0-based LSP position.
 * Disabled when `reservedKeywords` is off (MegaloEdit profile).
 */
export const completionsAtPosition = (
  snapshot: AnalysisSnapshot,
  position: { line: number; character: number }
): CompletionItem[] => {
  if (!snapshot.megacrowExtensions.reservedKeywords) {
    return [];
  }
  const ctx = resolveCompletionContext(snapshot, position);
  switch (ctx.kind) {
    case "top-level":
      return suggestTopLevel(ctx);
    case "trigger-name":
      return suggestTriggerName(ctx);
    case "trigger-body":
      return suggestTriggerBody(ctx);
    case "action-name":
      return suggestActionNames(ctx);
    case "condition-name":
      return suggestConditionNames(ctx);
    case "action-operands":
      return completeActionOperands(ctx);
    case "condition-operands":
      return completeConditionOperands(ctx);
    case "element":
      return completeElement(ctx);
    case "temporary":
      return completeTemporary(ctx);
    default:
      return [];
  }
};

export {
  completeQuotedPath,
  getQuotedPathCompletionQuery,
  type PathDirectiveKind,
  type PathDirectoryEntry,
  type QuotedPathCompletionQuery,
  splitPathPrefix,
} from "src/language-service/completion/path";
export type {
  ActionCompleter,
  ActionCompletionContext,
  CompletionContext,
  CompletionItem,
  CompletionKind,
  CompletionPrefix,
  CompletionRange,
  ConditionCompleter,
  ConditionCompletionContext,
  ElementCompleter,
  ElementCompletionContext,
  TemporaryCompletionContext,
} from "src/language-service/completion/types";

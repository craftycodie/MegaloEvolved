import { actionHovers } from "src/language-service/hover/actions/catalog";
import { conditionHovers } from "src/language-service/hover/conditions/catalog";
import { objectIsTypeHover } from "src/language-service/hover/conditions/object_is_type";
import { elementHovers } from "src/language-service/hover/elements/catalog";
import { gameOptionsHover } from "src/language-service/hover/elements/game_options";
import { elementParamHovers } from "src/language-service/hover/elements/params";
import { triggerHover } from "src/language-service/hover/elements/trigger";
import { variablesHover } from "src/language-service/hover/elements/variables";
import { keywordHovers } from "src/language-service/hover/keywords";
import {
  lookupHoverContribution,
  registerHovers,
} from "src/language-service/hover/registry";
import {
  renderContributionMarkdown,
  renderSymbolMarkdown,
} from "src/language-service/hover/render";
import { resolveHoverTarget } from "src/language-service/hover/resolve";
import type { HoverResult } from "src/language-service/hover/types";
import type { AnalysisSnapshot } from "src/language-service/snapshot";

// Catalogs first; curated element/condition overrides win on duplicate ids.
registerHovers([
  ...actionHovers,
  ...conditionHovers,
  ...elementHovers,
  ...elementParamHovers,
  ...keywordHovers,
  objectIsTypeHover,
  gameOptionsHover,
  variablesHover,
  triggerHover,
]);

const sourceLocationToRange = (location: {
  start: { line: number; column: number };
  end: { line: number; column: number };
}): HoverResult["range"] => ({
  start: {
    line: Math.max(0, location.start.line - 1),
    character: Math.max(0, location.start.column - 1),
  },
  end: {
    line: Math.max(0, location.end.line - 1),
    character: Math.max(0, location.end.column - 1),
  },
});

/**
 * Context-aware Megalo hover at a 0-based LSP position.
 * Disabled when `reservedKeywords` is off (MegaloEdit profile).
 */
export const hoverAtPosition = (
  snapshot: AnalysisSnapshot,
  position: { line: number; character: number }
): HoverResult | null => {
  if (!snapshot.megacrowExtensions.reservedKeywords) {
    return null;
  }

  const target = resolveHoverTarget(snapshot, position);
  if (target === null) {
    return null;
  }

  if (target.kind === "symbol") {
    return {
      range: sourceLocationToRange(target.range),
      contents: {
        kind: "markdown",
        value: renderSymbolMarkdown(target.entry),
      },
    };
  }

  const contribution = lookupHoverContribution(target.kind, target.id);
  if (contribution === undefined) {
    return null;
  }

  return {
    range: sourceLocationToRange(target.range),
    contents: {
      kind: "markdown",
      value: renderContributionMarkdown(contribution),
    },
  };
};

export {
  defineActionHover,
  defineConditionHover,
  defineElementHover,
  defineKeywordHover,
  defineParamHover,
  hoverDocumentationForId,
  lookupHoverContribution,
  registerHover,
  registerHovers,
} from "src/language-service/hover/registry";
export {
  elementKeywordId,
  resolveHoverTarget,
} from "src/language-service/hover/resolve";
export type {
  HoverContribution,
  HoverContributionKind,
  HoverResult,
  HoverTarget,
} from "src/language-service/hover/types";

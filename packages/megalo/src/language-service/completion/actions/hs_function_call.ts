import {
  ObjectListType,
  suggestObjectList,
} from "src/language-service/completion/helpers";
import type {
  ActionCompletionContext,
  CompletionItem,
} from "src/language-service/completion/types";

/** `hs_function_call <strings list item>` */
export const completeHsFunctionCall = (
  ctx: ActionCompletionContext
): CompletionItem[] =>
  ctx.slotIndex === 0 ? suggestObjectList(ctx, ObjectListType.Strings) : [];

import type { ActionStatementNode } from "src/frontend/abstract-syntax-tree/elements/trigger/action";
import { highlightStructural } from "src/language-service/highlighting/helpers";
import type { SemanticToken } from "src/language-service/highlighting/types";

export const highlightHsFunctionCall = (
  out: SemanticToken[],
  statement: ActionStatementNode
): void => {
  highlightStructural(out, statement.parameters[0]);
};

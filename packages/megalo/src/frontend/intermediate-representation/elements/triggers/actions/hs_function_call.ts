import type { SourceCodeLocation } from "src/diagnostics";
import { diagnosticMessages } from "src/diagnostics/messages";
import { SyntaxKind } from "src/frontend/abstract-syntax-tree";
import type { ASTParameterNode } from "src/frontend/abstract-syntax-tree/parameters";
import { requireParamCount } from "src/frontend/intermediate-representation/elements/triggers/helpers";
import { LowerError } from "src/frontend/intermediate-representation/error";
import {
  type Action,
  ActionType,
} from "src/frontend/intermediate-representation/game/megalogamengine/megalogamengine_actions";
import type { ElementLowerContext } from "src/frontend/intermediate-representation/parameters/context";
import { ObjectListType } from "src/frontend/object-lists";
import { SymbolKind } from "src/frontend/symbol-table";

/** Index of the HaloScript function's name in the `strings` object list. */
const resolveFunctionNameIndex = (
  node: ASTParameterNode,
  ctx: ElementLowerContext,
  location: SourceCodeLocation
): number => {
  if (node.kind === SyntaxKind.REFERENCE) {
    const symbol = ctx.symbolTable.getSymbol(node.symbolId);
    if (
      symbol?.kind === SymbolKind.ObjectListItem &&
      symbol.objectType === ObjectListType.Strings
    ) {
      return symbol.index;
    }
  }

  const name =
    node.kind === SyntaxKind.KEYWORD
      ? node.value
      : node.kind === SyntaxKind.REFERENCE
        ? (ctx.symbolTable.getSymbol(node.symbolId)?.name ?? node.identifier)
        : undefined;

  throw new LowerError(
    diagnosticMessages.expectedParameterType("hs function name", name ?? ""),
    node.location ?? location
  );
};

export const lowerHsFunctionCall = (
  parameters: ASTParameterNode[],

  ctx: ElementLowerContext,

  location: SourceCodeLocation
): Action => {
  requireParamCount(parameters, 1, location);

  return {
    type: ActionType.hs_function_call,

    parameters: {
      functionNameIndex: resolveFunctionNameIndex(
        parameters[0]!,
        ctx,
        location
      ),
    },
  };
};

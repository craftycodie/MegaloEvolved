import { diagnosticMessages } from "src/diagnostics/messages";
import { SyntaxKind } from "src/frontend/abstract-syntax-tree";
import type { LoadoutPaletteElementNode } from "src/frontend/abstract-syntax-tree/elements/loadout_palette";
import { dxAssertionScope } from "src/frontend/intermediate-representation/diagnostics";
import { assertNotErrorNode } from "src/frontend/intermediate-representation/diagnostics/assertNotErrorNode";
import { LowerError } from "src/frontend/intermediate-representation/error";
import type { LoadoutPaletteTraits } from "src/frontend/intermediate-representation/game/game_engine_default";
import type { ElementLowerContext } from "src/frontend/intermediate-representation/parameters";

export const loadoutPaletteLowerer = (
  element: LoadoutPaletteElementNode,
  ctx: ElementLowerContext
) => {
  dxAssertionScope(ctx.diagnostics, () => {
    assertNotErrorNode(element.name);
    const paletteName = element.name.value;
    const palette: LoadoutPaletteTraits = { loadouts: [] };
    for (const item of element.items) {
      const param = item.parameters[0];
      const name =
        param?.kind === SyntaxKind.REFERENCE
          ? param.identifier
          : param?.kind === SyntaxKind.KEYWORD
            ? param.value
            : undefined;
      const loadout =
        name === undefined ? undefined : ctx.loadoutsByName.get(name);
      if (loadout === undefined) {
        throw new LowerError(
          diagnosticMessages.expectedParameterType("loadout", name ?? ""),
          param?.location ?? item.location
        );
      }
      palette.loadouts?.push(loadout);
    }

    // Megalo Headache #1
    if (!ctx.loadoutPalettesByName.has(paletteName)) {
      // MegaloEdit counts every declared palette, used or not, and refuses
      // to compile past the limit ("Too many megalo-defined loadout
      // palettes"); report it on the first palette over the limit.
      const limit = ctx.frontend.versionConfiguration.limits.loadoutPalettes;
      const { loadoutPalettes } = ctx.ir.gameVariant.gameEngine;
      if (loadoutPalettes.length >= limit) {
        throw new LowerError(
          diagnosticMessages.tooManyLoadoutPalettes(limit),
          element.name.location
        );
      }
      ctx.loadoutPalettesByName.set(paletteName, palette);
      loadoutPalettes.push(palette);
    }
  });
};

import { describe, expect, it } from "vitest";
import { MEGACROW_BUILD_STRING } from "../../../src/build-info";
import { MegaloCompilerContext } from "../../../src/context";
import { Diagnostics } from "../../../src/diagnostics";
import { Parser } from "../../../src/frontend/abstract-syntax-tree";
import { ParserSymbolContext } from "../../../src/frontend/abstract-syntax-tree/symbol-context";
import { Lowerer } from "../../../src/frontend/intermediate-representation";
import { ActionType } from "../../../src/frontend/intermediate-representation/game/megalogamengine/megalogamengine_actions";
import { SymbolBinder } from "../../../src/frontend/symbol-table";
import { Lexer } from "../../../src/frontend/tokens";
import type { MegacrowExtensions } from "../../../src/megacrow-extensions";
import { MEGALO_VERSIONS } from "../../../src/version";

const parseScript = (
  source: string,
  megacrowExtensions?: Partial<MegacrowExtensions>
) => {
  const diagnostics = new Diagnostics();
  const frontend = new MegaloCompilerContext(
    MEGALO_VERSIONS["107-mcc"],
    megacrowExtensions
  );
  const tokens = new Lexer(frontend).lex(source, diagnostics);
  const ast = new Parser(frontend).parse(tokens, diagnostics);
  return { ast, diagnostics, frontend };
};

const lowerScript = (
  source: string,
  megacrowExtensions?: Partial<MegacrowExtensions>
) => {
  const { ast, diagnostics, frontend } = parseScript(
    source,
    megacrowExtensions
  );
  const ir = new Lowerer(frontend).lower(ast, diagnostics);
  return { ir, diagnostics };
};

const TARGET_TEAM_SCRIPT = `variables global
	local team g_team none
end
trigger local
	action set g_team set_to target_team
end
`;

const COOP_SPAWNING_SCRIPT = `variables global
	networked object marker none
end
trigger initialization
	action navpoint_set_icon marker coop spawning
end
`;

describe("megacrowExtensions.targetTeam", () => {
  it("errors at lower when target_team is used without the extension", () => {
    const { diagnostics } = lowerScript(TARGET_TEAM_SCRIPT);
    expect(diagnostics.hasErrors()).toBe(true);
    const messages = diagnostics.getErrors().map((e) => e.message);
    expect(messages.some((m) => m.includes("targetTeam"))).toBe(true);
    expect(messages.some((m) => m.includes("target_team"))).toBe(true);
  });

  it("lowers target_team when the extension is enabled", () => {
    const { diagnostics } = lowerScript(TARGET_TEAM_SCRIPT, {
      targetTeam: true,
    });
    expect(diagnostics.getErrors().map((e) => e.message)).toEqual([]);
  });

  it("allows local_team without the extension", () => {
    const source = `variables global
	local team g_team none
end
trigger local
	action set g_team set_to local_team
end
`;
    const { diagnostics } = lowerScript(source);
    expect(diagnostics.getErrors().map((e) => e.message)).toEqual([]);
  });
});

describe("megacrowExtensions.coopSpawning", () => {
  it("does not join coop spawning without the extension", () => {
    const { diagnostics } = lowerScript(COOP_SPAWNING_SCRIPT);
    expect(diagnostics.hasErrors()).toBe(true);
  });

  it("parses and lowers coop spawning when the extension is enabled", () => {
    const { ir, diagnostics } = lowerScript(COOP_SPAWNING_SCRIPT, {
      coopSpawningWaypointIcon: true,
    });
    expect(diagnostics.getErrors().map((e) => e.message)).toEqual([]);
    const action = ir.gameVariant.gameEngine.actions.find(
      (entry) => entry.type === ActionType.navpoint_set_icon
    );
    expect(action?.parameters).toMatchObject({ icon: 27 });
  });
});

const DOUBLE_JUMP_SCRIPT = `string_table english
	traits_name "DJ Traits"
	traits_description "Double jump traits"
end
game_options
	player_traits dj_traits traits_name traits_description
		double_jump enabled
	end
end
`;

describe("megacrowExtensions.doubleJump", () => {
  it("errors at lower when double_jump is used without the extension", () => {
    const { diagnostics } = lowerScript(DOUBLE_JUMP_SCRIPT);
    expect(diagnostics.hasErrors()).toBe(true);
    const messages = diagnostics.getErrors().map((e) => e.message);
    expect(messages.some((m) => m.includes("doubleJump"))).toBe(true);
    expect(messages.some((m) => m.includes("double_jump"))).toBe(true);
  });

  it("lowers double_jump when the extension is enabled", () => {
    const { ir, diagnostics } = lowerScript(DOUBLE_JUMP_SCRIPT, {
      doubleJump: true,
    });
    expect(diagnostics.getErrors().map((e) => e.message)).toEqual([]);
    expect(diagnostics.getWarnings().map((e) => e.message)).toContain(
      "double_jump is not official Megalo syntax and requires tag changes to work"
    );
    const traits = ir.gameVariant.playerTraits[0];
    expect(traits?.traits.movement.doubleJump).toBe("enabled");
  });
});

describe("megacrowExtensions.megacrowVersionString", () => {
  it("does not seed megacrow_version without the extension", () => {
    const diagnostics = new Diagnostics();
    const frontend = new MegaloCompilerContext(MEGALO_VERSIONS["107-mcc"]);
    const binder = new SymbolBinder(frontend, diagnostics);
    const parser = new ParserSymbolContext(frontend, diagnostics, binder);
    expect(parser.lookupString("megacrow_version")).toBeUndefined();
  });

  it("seeds megacrow_version with the build string when enabled", () => {
    const diagnostics = new Diagnostics();
    const frontend = new MegaloCompilerContext(MEGALO_VERSIONS["107-mcc"], {
      megacrowVersionString: true,
    });
    const binder = new SymbolBinder(frontend, diagnostics);
    const parser = new ParserSymbolContext(frontend, diagnostics, binder);
    expect(parser.lookupString("megacrow_version")).toBeDefined();
    expect(parser.lookupStringContent("megacrow_version")).toBe(
      MEGACROW_BUILD_STRING
    );
  });
});

describe("megacrowExtensions.reservedKeywords", () => {
  it.each([
    {
      kind: "number",
      source: `variables global
	local number action 0
end
`,
    },
    {
      kind: "constant",
      source: `constants
	number action 1
end
`,
    },
    {
      kind: "string",
      source: `string_table english
	action "hello"
end
`,
    },
    {
      kind: "loadout",
      source: `loadout action
	name scout_label
end
`,
    },
    {
      kind: "loadout_palette",
      source: `loadout scout
	name scout_label
end
loadout_palette action
	item scout
end
`,
    },
    {
      kind: "hud_widget",
      source: `hud_widgets
	action low_left
end
`,
    },
    {
      kind: "map_object",
      source: `map_object action
	label "slayer"
end
`,
    },
    {
      kind: "game_stats",
      source: `string_table english
	stat_label "Caps"
end
game_stats
	action number stat_label none 1
end
`,
    },
    {
      kind: "requisition_palette",
      source: `requisition_palette action
	baseline elite
end
`,
    },
    {
      kind: "option",
      source: `string_table english
	option_name_kill_points "Kill Points"
	option_description_kill_points "Kill Points Description"
	points_0 "0"
end
game_options
	option action
		option_name_kill_points
		option_description_kill_points
		1
		0 points_0 ""
	end
end
`,
    },
    {
      kind: "player_traits",
      source: `string_table english
	traits_name "VIP Traits"
	traits_description "VIP player traits"
end
game_options
	player_traits action traits_name traits_description
		weapon_pickup 0
	end
end
`,
    },
  ] as const)("errors when a language keyword is used as a $kind name", ({
    kind,
    source,
  }) => {
    const { diagnostics } = parseScript(source, { reservedKeywords: true });
    const reserved = diagnostics
      .getErrors()
      .filter(
        (error) =>
          error.message.includes("action") &&
          error.message.includes(kind) &&
          error.message.includes("MegaloEvolved")
      );
    expect(reserved).toHaveLength(1);
    expect(diagnostics.getWarnings()).toHaveLength(0);
  });

  it("errors once when a reserved string name is declared in extra languages", () => {
    const { diagnostics } = parseScript(
      `string_table english
	action "hello"
end
string_table spanish
	action "hola"
end
`,
      { reservedKeywords: true }
    );
    expect(diagnostics.getErrors()).toHaveLength(1);
    expect(diagnostics.getErrors()[0]?.message).toContain("string");
    expect(diagnostics.getWarnings()).toHaveLength(0);
  });

  it("does not error for ordinary variable names", () => {
    const { diagnostics } = parseScript(
      `variables global
	local number counter 0
end
`,
      { reservedKeywords: true }
    );
    expect(diagnostics.hasErrors()).toBe(false);
    expect(diagnostics.getWarnings()).toHaveLength(0);
  });

  it("does not error when the extension is disabled", () => {
    const { diagnostics } = parseScript(`variables global
	local number end 0
end
`);
    expect(diagnostics.hasErrors()).toBe(false);
    expect(diagnostics.getWarnings()).toHaveLength(0);
  });
});

describe("megacrowExtensions.preventShadowing", () => {
  it("errors when a duplicate global timer name is declared", () => {
    const { diagnostics } = parseScript(
      `variables global
	networked timer shared_timer 5
	networked timer shared_timer 99
end
`,
      { preventShadowing: true }
    );
    expect(diagnostics.hasErrors()).toBe(true);
    expect(diagnostics.getErrors()[0]?.message).toContain("shared_timer");
    expect(diagnostics.getErrors()[0]?.message).toContain("timer");
    expect(diagnostics.getErrors()[0]?.message).toContain("already have");
    expect(diagnostics.getErrors()[0]?.message).toContain("MegaloEvolved");
    expect(diagnostics.getWarnings()).toHaveLength(0);
  });

  it("errors when a duplicate global number would last-wins shadow", () => {
    const { diagnostics } = parseScript(
      `variables global
	local number counter 0
	local number counter 7
end
`,
      { preventShadowing: true }
    );
    expect(diagnostics.hasErrors()).toBe(true);
    expect(diagnostics.getErrors()[0]?.message).toContain("counter");
    expect(diagnostics.getErrors()[0]?.message).toContain("number");
    expect(diagnostics.getErrors()[0]?.message).toContain("already have");
  });

  it("allows the same identifier in different variable scopes", () => {
    const { diagnostics } = parseScript(
      `variables team
	networked number foo 0
end
variables global
	networked number foo 0
end
variables player
	networked number foo 0
end
`,
      { preventShadowing: true }
    );
    expect(diagnostics.hasErrors()).toBe(false);
    expect(diagnostics.getWarnings()).toHaveLength(0);
  });

  it("errors when a user variable reuses a built-in identifier", () => {
    const { diagnostics } = parseScript(
      `variables global
	local number local_player 0
end
`,
      { preventShadowing: true }
    );
    expect(diagnostics.hasErrors()).toBe(true);
    expect(diagnostics.getErrors()[0]?.message).toContain("local_player");
  });

  it("does not error on last-wins shadowing when the extension is disabled", () => {
    const { diagnostics } = parseScript(`variables global
	local number counter 0
	local number counter 7
end
`);
    expect(diagnostics.hasErrors()).toBe(false);
    expect(diagnostics.getWarnings()).toHaveLength(0);
  });

  it("still warns on duplicate FindIndex names when the extension is disabled", () => {
    const { diagnostics } = parseScript(`variables global
	networked timer shared_timer 5
	networked timer shared_timer 99
end
`);
    expect(diagnostics.hasErrors()).toBe(false);
    expect(diagnostics.getWarnings()).toHaveLength(1);
    expect(diagnostics.getWarnings()[0]?.message).toContain("shared_timer");
    expect(diagnostics.getWarnings()[0]?.message).toContain("ignored");
  });

  it("still warns on duplicate loadout_palette names when the extension is disabled", () => {
    const { diagnostics } = parseScript(`loadout scout
	name scout_label
end
loadout_palette slayer_loadouts
	item scout
end
loadout_palette slayer_loadouts
	item scout
end
`);
    expect(diagnostics.hasErrors()).toBe(false);
    expect(diagnostics.getWarnings()).toHaveLength(1);
    expect(diagnostics.getWarnings()[0]?.message).toContain("slayer_loadouts");
    expect(diagnostics.getWarnings()[0]?.message).toContain("ignored");
  });

  it("errors when a duplicate temporary name is declared in the same trigger", () => {
    const { diagnostics } = parseScript(
      `trigger local
	temporary number scratch 0
	temporary number scratch 1
end
`,
      { preventShadowing: true }
    );
    expect(diagnostics.hasErrors()).toBe(true);
    expect(diagnostics.getErrors()[0]?.message).toContain("scratch");
    expect(diagnostics.getErrors()[0]?.message).toContain("already have");
  });

  it("allows the same temporary name in different triggers", () => {
    const { diagnostics } = parseScript(
      `trigger local
	temporary number scratch 0
end
trigger local
	temporary number scratch 1
end
`,
      { preventShadowing: true }
    );
    expect(diagnostics.hasErrors()).toBe(false);
    expect(diagnostics.getWarnings()).toHaveLength(0);
  });

  it("errors when a duplicate loadout_palette name is declared", () => {
    const { diagnostics } = parseScript(
      `loadout scout
	name scout_label
end
loadout_palette slayer_loadouts
	item scout
end
loadout_palette slayer_loadouts
	item scout
end
`,
      { preventShadowing: true }
    );
    expect(diagnostics.hasErrors()).toBe(true);
    expect(diagnostics.getErrors()[0]?.message).toContain("slayer_loadouts");
    expect(diagnostics.getErrors()[0]?.message).toContain("loadout_palette");
    expect(diagnostics.getErrors()[0]?.message).toContain("already have");
    expect(diagnostics.getWarnings()).toHaveLength(0);
  });
});

describe("player_set_objective_allegiance_icon", () => {
  it("lowers a constant engine icon index", () => {
    const { ir, diagnostics } = lowerScript(`constants
	number k_engine_icon_elite 7
end
trigger local
	action player_set_objective_allegiance_icon current_player k_engine_icon_elite
end
`);
    expect(diagnostics.getErrors().map((e) => e.message)).toEqual([]);
    const action = ir.gameVariant.gameEngine.actions.find(
      (entry) => entry.type === ActionType.player_set_objective_allegiance_icon
    );
    expect(action?.parameters).toMatchObject({ iconIndex: 7 });
  });

  it("rejects icon indexes outside 0..127 (except -1)", () => {
    const { diagnostics } = lowerScript(`trigger local
	action player_set_objective_allegiance_icon current_player 128
end
`);
    expect(diagnostics.hasErrors()).toBe(true);
    expect(
      diagnostics
        .getErrors()
        .some((e) => e.message.includes("icon index out of range"))
    ).toBe(true);
  });
});

# Introduction

## Foreword

Megalo was designed in March 2008 by Bungie's Jon Cable as a data-driven system for implementing Halo multiplayer game rules. End-user Megalo tooling was an objective from the start, but it was something Bungie never shipped during Reach's original development.

Since then, Halo Studios has released Bungie's **MegaloEdit.exe** with the Halo Reach Editing Kit (HREK), enabling players to build their own scripts. Little documentation has accompanied that tooling.

This documentation is the result of an extensive study of Halo: Reach Megalo. It deliberately follows Bungie's own [Ubiquitous Language](https://martinfowler.com/bliki/UbiquitousLanguage.html) — naming things as Bungie would have named them, using the same vocabulary found in shipped scripts and the MegaloEdit tooling.

I would like to give my thanks to those modders who worked tirelessly to understand Megalo and make cool gametypes with it in the last 16 years including [kornman](https://github.com/KornnerStudios), [DavidJCobb](https://github.com/DavidJCobb/ReachVariantEditor), [Pfoiffee](https://github.com/Pfoiffee), [Soptive](https://github.com/Sopitive) and countless others I have not had the pleasure of meeting. - Codie

## What is Megalo?

**Megalo** is the scripting language Bungie built for Halo: Reach multiplayer rules. Authors edit human-readable `.txt` scripts with a Megalo-aware editor; Bungie shipped **MegaloEdit.exe** with Reach. We recommend **MegaloEvolved** as a free and open-source alternative.

Megalo is not a general-purpose language. It has no functions, loops, or arbitrary expressions — only the condition and action vocabulary the engine exposes, organized into **triggers** that fire on game events.

A Megalo program is a sequence of **elements** that describe a gametype or custom map variant:

| Concept | Role |
|---------|------|
| **Elements** | Block and leaf keywords at the script root — metadata, teams, variables, triggers, HUD widgets, string tables, and more. See [The element model](/language/syntax#the-element-model); individual pages are listed under **Elements** in the sidebar. |
| **Triggers** | Event handlers. Each trigger runs when its **conditions** are satisfied, then executes its **actions**. See [trigger](/language/elements/trigger). |
| **Conditions** | Predicates such as `if`, `player_died`, `timer_expired`, or `object_in_area`. See [condition](/language/elements/trigger/condition). |
| **Actions** | Imperative statements — `set`, `create_object`, `hud_post_message`, `for_each`, and dozens of others. See [action](/language/elements/trigger/action). |
| **Variables** | Typed slots (`number`, `timer`, `object`, `team`, `player`) scoped to global, team, player, or object storage. See [Variable model](/language/variable-model). |
| **References** | Symbolic operands that identify players, teams, objects, timers, and custom variables at runtime. See [References](/language/references). |

## Source files

Megalo editors store scripts as plain text. A typical gametype script begins with metadata and ends with triggers:

```megalo
include "strings/slayer_strings.txt"

engine_data
	name slayer_title
	description slayer_description
	icon k_engine_icon_slayer
	category slayer
end

variables global
	local number my_counter 0
end

trigger initialization
	action set my_counter set_to 0
end
```

Scripts can `include` other files; the editor merges includes before compile. Some scripts also declare a `base` to inherit from a compiled parent variant — see [Base files](/language/base-files).

The exact set of valid conditions and actions depends on the Reach build. See [Megalo Versions](/versions/) for per-build tables.

## Reading guide

Work through these pages in order, or jump to a topic:

1. [Syntax & file format](/language/syntax) — comments, tokens, naming, includes, [element model](/language/syntax#the-element-model)
2. [Base files](/language/base-files) — inheriting from a compiled parent variant
3. [Variable model](/language/variable-model) — types, scopes, constants, built-ins
4. [trigger](/language/elements/trigger) — kinds, action scope, execution, `for_each`
5. [condition](/language/elements/trigger/condition) — comparisons, events, `and` / `or`, negation
6. [action](/language/elements/trigger/action) — opcodes, `set`, [math operations](/language/enums/math-operations), action families
7. [References](/language/references) — player, team, object, timer operands; see also [dynamic strings](/language/enums/dynamic-strings)
8. [Example scripts](/language/examples) — annotated walkthroughs of minimal scripts
9. [Object lists](/language/object-lists) — engine lookup tables for symbolic names
10. [Compiler settings](/language/compiler-settings) — compile-time strictness and temporary overflow

For using the TypeScript library, see the [usage guide](/guide/quick-start).

## See also

- [Megalo Versions & action tables](/versions/)
- [Megalo versions (MCC vs TU1)](/guide/megalo-versions)

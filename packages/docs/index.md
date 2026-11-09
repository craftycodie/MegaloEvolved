# What is MegaloEvolved?

**MegaloEvolved** (npm package `@blamnetwork/megalo`) is a TypeScript library for working with Halo **Megalo** scripts — the text-based scripting language used in Halo: Reach gametypes and custom map variants.

## What this package provides

- **Parser** — turn Megalo source (`.txt`) into an AST ([Parsing source](/guide/parsing)).
- **Compiler** — build game variant or custom variant data from a program ([Compiling](/guide/compiling)).
- **Decompiler** — recover Megalo source from compiled variant data ([Decompiling](/guide/decompiling)).
- **BLF integration** — extract, patch, and round-trip gametypes inside BLF files via [@blamnetwork/blf](https://blam-network.github.io/blf/) ([Gametypes & BLF](/guide/gametypes)).
- **Megalo versions** — Reach MCC and Xbox 360 TU1 ([Megalo versions](/guide/megalo-versions)).
- **Language reference** — Bungie Megalo scripting concepts and per-build action tables ([Megalo language](/language/)).

Megalo struct layouts and BLF chunk I/O come from `@blamnetwork/blf` and [@craftycodie/cstruct](https://www.npmjs.com/package/@craftycodie/cstruct), which npm installs automatically as dependencies.

## Get started

See [Install & quick start](/guide/quick-start).

Release history: [Changelog](/changelog).

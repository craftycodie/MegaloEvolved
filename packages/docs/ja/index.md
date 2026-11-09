# MegaloEvolved とは？

**MegaloEvolved**（npm パッケージ `@blamnetwork/megalo`）は、Halo の **Megalo** スクリプトを扱う TypeScript ライブラリです。Megalo は、Halo: Reach のゲームタイプやカスタムマップバリアントで使われるテキストベースのスクリプティング言語です。

## このパッケージが提供するもの

- **パーサー** — Megalo ソース（`.txt`）を AST に変換します（[ソースのパース](/ja/guide/parsing)）。
- **コンパイラ** — プログラムからゲームバリアントまたはカスタムバリアントデータを構築します（[コンパイル](/ja/guide/compiling)）。
- **デコンパイラ** — コンパイル済みバリアントデータから Megalo ソースを復元します（[デコンパイル](/ja/guide/decompiling)）。
- **BLF 連携** — [@blamnetwork/blf](https://blam-network.github.io/blf/) 経由で BLF ファイル内のゲームタイプの抽出、パッチ、ラウンドトリップを行います（[ゲームタイプと BLF](/ja/guide/gametypes)）。
- **Megalo バージョン** — Reach MCC および Xbox 360 TU1 に対応（[Megalo バージョン](/ja/guide/megalo-versions)）。
- **言語リファレンス** — Bungie Megalo スクリプティングの概念とビルド別アクション表（[Megalo 言語](/ja/language/)）。

Megalo の構造体レイアウトと BLF チャンク I/O は `@blamnetwork/blf` および [@craftycodie/cstruct](https://www.npmjs.com/package/@craftycodie/cstruct) から提供され、npm 依存関係として自動インストールされます。

## はじめに

[インストールとクイックスタート](/ja/guide/quick-start) を参照してください。

リリース履歴: [Changelog](/ja/changelog)。

# はじめに

## まえがき

Megalo は 2008 年 3 月、Bungie の Jon Cable によって、Halo マルチプレイヤーのゲームルールをデータ駆動で実装する仕組みとして設計されました。エンドユーザー向けの Megalo ツールは当初から目標でしたが、Reach の当初開発期間中に Bungie が出荷することはありませんでした。

その後、Halo Studios が Halo Reach Editing Kit (HREK) とともに Bungie の **MegaloEdit.exe** を公開し、プレイヤーが独自のスクリプトを書けるようになりました。そのツールに付随するドキュメントはほとんどありません。

本ドキュメントは、Halo: Reach の Megalo を徹底的に調査した結果です。意図的に Bungie 自身の [Ubiquitous Language](https://martinfowler.com/bliki/UbiquitousLanguage.html) に従い — Bungie が名付けたであろう名前で、出荷スクリプトや MegaloEdit ツールに現れる同じ語彙を使っています。

過去 16 年間、Megalo を理解し、それで面白いゲームタイプを作り続けてきたモッダーの方々に感謝します。[kornman](https://github.com/KornnerStudios)、[DavidJCobb](https://github.com/DavidJCobb/ReachVariantEditor)、[Pfoiffee](https://github.com/Pfoiffee)、[Soptive](https://github.com/Sopitive)、そしてお会いしたことのない数え切れない方々へ。 — Codie

## Megalo とは？

**Megalo** は、Bungie が Halo: Reach のマルチプレイヤールール用に作ったスクリプト言語です。作者は Megalo 対応エディタで人間が読める `.txt` スクリプトを編集します。Bungie は Reach とともに **MegaloEdit.exe** を出荷しました。無料のオープンソース代替として **MegaloEvolved** を推奨します。

Megalo は汎用言語ではありません。関数も、ループも、任意の式もありません — エンジンが公開する条件とアクションの語彙だけがあり、ゲームイベントで発火する **トリガー** にまとめられます。

Megalo プログラムは、ゲームタイプまたはカスタムマップバリアントを記述する **要素** の列です。

| 概念 | 役割 |
|---------|------|
| **要素 (Elements)** | スクリプトルートのブロック／リーフキーワード — メタデータ、チーム、変数、トリガー、HUD ウィジェット、文字列テーブルなど。詳しくは [要素モデル](/ja/language/syntax#the-element-model)。個別ページはサイドバーの **Elements** にあります。 |
| **トリガー (Triggers)** | イベントハンドラ。各トリガーは **条件** が満たされたときに実行され、その後 **アクション** を実行します。[trigger](/ja/language/elements/trigger) を参照。 |
| **条件 (Conditions)** | `if`、`player_died`、`timer_expired`、`object_in_area` などの述語。[condition](/ja/language/elements/trigger/condition) を参照。 |
| **アクション (Actions)** | 命令文 — `set`、`create_object`、`hud_post_message`、`for_each`、ほか多数。[action](/ja/language/elements/trigger/action) を参照。 |
| **変数 (Variables)** | `number`、`timer`、`object`、`team`、`player` 型のスロット。global / team / player / object にスコープ。[変数モデル](/ja/language/variable-model) を参照。 |
| **参照 (References)** | 実行時にプレイヤー、チーム、オブジェクト、タイマー、カスタム変数を指す記号オペランド。[参照](/ja/language/references) を参照。 |

## ソースファイル

Megalo エディタはスクリプトをプレーンテキストで保存します。典型的なゲームタイプスクリプトはメタデータで始まり、トリガーで終わります。

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

スクリプトは他のファイルを `include` できます。エディタはコンパイル前に include をマージします。一部のスクリプトはコンパイル済み親バリアントから継承する `base` も宣言します — [ベースファイル](/ja/language/base-files) を参照。

有効な条件とアクションの集合は Reach のビルドに依存します。ビルドごとの表は [Megalo バージョン](/ja/versions/) を参照。

## 読み進め方

次の順で読むか、興味のあるトピックへジャンプしてください。

1. [構文とファイル形式](/ja/language/syntax) — コメント、トークン、命名、include、[要素モデル](/ja/language/syntax#the-element-model)
2. [ベースファイル](/ja/language/base-files) — コンパイル済み親バリアントからの継承
3. [変数モデル](/ja/language/variable-model) — 型、スコープ、定数、組み込み
4. [trigger](/ja/language/elements/trigger) — 種類、アクションスコープ、実行、`for_each`
5. [condition](/ja/language/elements/trigger/condition) — 比較、イベント、`and` / `or`、否定
6. [action](/ja/language/elements/trigger/action) — オペコード、`set`、[数学演算](/ja/language/enums/math-operations)、アクション系統
7. [参照](/ja/language/references) — player / team / object / timer オペランド。[動的文字列](/ja/language/enums/dynamic-strings) も参照
8. [サンプルスクリプト](/ja/language/examples) — 最小スクリプトの注釈付きウォークスルー
9. [オブジェクトリスト](/ja/language/object-lists) — 記号名のエンジン照合テーブル
10. [コンパイラ設定](/ja/language/compiler-settings) — コンパイル時の厳格さと一時変数オーバーフロー

TypeScript ライブラリの使い方は [利用ガイド](/ja/guide/quick-start) を参照。

## 関連項目

- [Megalo バージョンとアクション表](/ja/versions/)
- [Megalo バージョン (MCC と TU1)](/ja/guide/megalo-versions)

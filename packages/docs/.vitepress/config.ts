import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type MarkdownIt from "markdown-it";
import { defineConfig } from "vitepress";
import type { DefaultTheme } from "vitepress/theme";
import { MEGACROW_BUILD_STRING } from "../../megalo/src/build-info";
import haloscriptGrammar from "./grammars/haloscript.tmLanguage.json";
import languageActions from "./language-actions.json";
import languageVersions from "./language-versions.json";
import {
  createSearchRenderHook,
  localSearchOptions,
} from "./search-enrichment";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const highlightBundleUrl = pathToFileURL(
  path.join(configDir, "megalo-highlight.bundle.mjs")
).href;

function normalizeDocsBase(value: string | undefined): string {
  const raw = (value ?? "/megalo/").trim() || "/megalo/";
  if (raw.startsWith(".")) {
    return raw.endsWith("/") ? raw : `${raw}/`;
  }
  const withLeading = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}

const docsBase = normalizeDocsBase(process.env.DOCS_BASE);
const REACH_GAME_ICON = `${docsBase}images/icons/game-reach.png`;

function withLocalePrefix(prefix: string, docPath: string): string {
  if (!docPath.startsWith("/") || docPath.startsWith("//")) {
    return docPath;
  }
  if (!prefix) {
    return docPath;
  }
  if (docPath === "/") {
    return `${prefix}/`;
  }
  return `${prefix}${docPath}`;
}

function versionSidebarLabel(label: string) {
  return `<span class="version-sidebar-label"><img class="version-reach-icon" src="${REACH_GAME_ICON}" alt="" aria-hidden="true" /><span>${label}</span></span>`;
}

function normalizeFenceLang(lang: string | undefined): string {
  return (
    lang
      ?.replace(/\[.*\]/, "")
      .replace(/=(\d*)/, "")
      .replace(/:(no-)?line-numbers(=\d*)?$/, "")
      .replace(/-vue(?=:|$)/, "")
      .trim()
      .toLowerCase() ?? "txt"
  );
}

type DocsLocale = "en" | "ja";

const ui = {
  en: {
    nav: {
      guide: "Guide",
      megacrow: "MegaloEvolved",
      language: "Language",
      changelog: "Changelog",
    },
    sidebar: {
      introduction: "Introduction",
      whatIsMegalo: "What is megalo?",
      installQuickStart: "Install & quick start",
      megacrow: "MegaloEvolved",
      overview: "Overview",
      workspaces: "Workspaces",
      export: "Export",
      settings: "Settings",
      megaloLanguage: "Megalo language",
      syntax: "Syntax & file format",
      baseFiles: "Base files",
      elements: "Elements",
      actions: "Actions",
      optionsEnums: "Options & Enums",
      variableModel: "Variable model",
      megaloHeadaches: "Megalo Headaches",
      references: "References",
      exampleScripts: "Example scripts",
      objectLists: "Object lists",
      compilerSettings: "Compiler settings",
      versions: "Megalo Versions",
      usage: "Usage",
      parsing: "Parsing source",
      compiling: "Compiling",
      decompiling: "Decompiling",
      gametypes: "Gametypes & BLF",
      megaloVersions: "Megalo versions",
      contributing: "Contributing",
      development: "Development",
      reference: "Reference",
      changelog: "Changelog",
      mathOperations: "Math operations",
      teamOrPlayerTarget: "Team or player target",
      dynamicStrings: "Dynamic strings",
      gameOptions: "Game options",
      teamScoringMethod: "Team Scoring Method",
      weaponSet: "Weapon Set",
      vehicleSet: "Vehicle Set",
      playerTraits: "Player traits",
      grenadeCount: "Grenade Count",
      vehicleUsageSetting: "Vehicle Usage Setting",
      sprinting: "Sprinting",
      equipmentUsageSetting: "Equipment Usage Setting",
      activeCamoSetting: "Active Camo Setting",
      waypointSetting: "Waypoint Setting",
      forcedChangeColorSetting: "Forced Change Color Setting",
      motionTrackerSetting: "Motion Tracker Setting",
      builtInVariables: "Built-in variables",
      engineCategories: "Engine categories",
      sounds: "Sounds",
    },
  },
  ja: {
    nav: {
      guide: "ガイド",
      megacrow: "MegaloEvolved",
      language: "言語",
      changelog: "変更履歴",
    },
    sidebar: {
      introduction: "はじめに",
      whatIsMegalo: "megalo とは？",
      installQuickStart: "インストールとクイックスタート",
      megacrow: "MegaloEvolved",
      overview: "概要",
      workspaces: "ワークスペース",
      export: "エクスポート",
      settings: "設定",
      megaloLanguage: "Megalo 言語",
      syntax: "構文とファイル形式",
      baseFiles: "ベースファイル",
      elements: "要素",
      actions: "アクション",
      optionsEnums: "オプションと列挙型",
      variableModel: "変数モデル",
      megaloHeadaches: "Megalo の注意点",
      references: "参考文献",
      exampleScripts: "サンプルスクリプト",
      objectLists: "オブジェクトリスト",
      compilerSettings: "コンパイラ設定",
      versions: "バージョン",
      usage: "使い方",
      parsing: "ソースのパース",
      compiling: "コンパイル",
      decompiling: "デコンパイル",
      gametypes: "ゲームタイプと BLF",
      megaloVersions: "Megalo バージョン",
      contributing: "コントリビュート",
      development: "開発",
      reference: "リファレンス",
      changelog: "変更履歴",
      mathOperations: "数学演算",
      teamOrPlayerTarget: "チームまたはプレイヤー対象",
      dynamicStrings: "動的文字列",
      gameOptions: "ゲームオプション",
      teamScoringMethod: "チームスコア方式",
      weaponSet: "武器セット",
      vehicleSet: "車両セット",
      playerTraits: "プレイヤートレイト",
      grenadeCount: "グレネード数",
      vehicleUsageSetting: "車両使用設定",
      sprinting: "スプリント",
      equipmentUsageSetting: "装備使用設定",
      activeCamoSetting: "アクティブカモ設定",
      waypointSetting: "ウェイポイント設定",
      forcedChangeColorSetting: "強制カラー変更設定",
      motionTrackerSetting: "モーションセンサー設定",
      builtInVariables: "組み込み変数",
      engineCategories: "エンジンカテゴリ",
      sounds: "サウンド",
    },
  },
} as const;

function elementsSidebar(prefix: string): DefaultTheme.SidebarItem[] {
  return [
    {
      text: "string_table",
      link: withLocalePrefix(prefix, "/language/elements/string-table"),
    },
    {
      text: "game_options",
      link: withLocalePrefix(prefix, "/language/elements/game-options"),
      items: [
        {
          text: "player_traits",
          link: withLocalePrefix(
            prefix,
            "/language/elements/game-options/player-traits"
          ),
        },
      ],
    },
    {
      text: "constants",
      link: withLocalePrefix(prefix, "/language/elements/constants"),
    },
    {
      text: "loadout",
      link: withLocalePrefix(prefix, "/language/elements/loadout"),
    },
    {
      text: "loadout_palette",
      link: withLocalePrefix(prefix, "/language/elements/loadout-palette"),
    },
    {
      text: "include",
      link: withLocalePrefix(prefix, "/language/elements/include"),
    },
    {
      text: "localized_include",
      link: withLocalePrefix(prefix, "/language/elements/localized-include"),
    },
    {
      text: "base",
      link: withLocalePrefix(prefix, "/language/elements/base"),
    },
    {
      text: "teams",
      link: withLocalePrefix(prefix, "/language/elements/teams"),
    },
    {
      text: "engine_data",
      link: withLocalePrefix(prefix, "/language/elements/engine-data"),
    },
    {
      text: "player_rating",
      link: withLocalePrefix(prefix, "/language/elements/player-rating"),
    },
    {
      text: "map_permissions",
      link: withLocalePrefix(prefix, "/language/elements/map-permissions"),
    },
    {
      text: "variables",
      link: withLocalePrefix(prefix, "/language/elements/variables"),
    },
    {
      text: "trigger",
      link: withLocalePrefix(prefix, "/language/elements/trigger"),
      items: [
        {
          text: "condition",
          link: withLocalePrefix(prefix, "/language/elements/trigger/condition"),
        },
        {
          text: "action",
          link: withLocalePrefix(prefix, "/language/elements/trigger/action"),
        },
        {
          text: "begin",
          link: withLocalePrefix(prefix, "/language/elements/begin"),
        },
      ],
    },
    {
      text: "requisition_palette",
      link: withLocalePrefix(prefix, "/language/elements/requisition-palette"),
    },
    {
      text: "hud_widgets",
      link: withLocalePrefix(prefix, "/language/elements/hud-widgets"),
    },
    {
      text: "map_object",
      link: withLocalePrefix(prefix, "/language/elements/map-object"),
    },
    {
      text: "game_stats",
      link: withLocalePrefix(prefix, "/language/elements/game-stats"),
    },
  ];
}

function actionsSidebar(prefix: string): DefaultTheme.SidebarItem[] {
  return languageActions.actions.map((action) => ({
    text: action.name,
    link: withLocalePrefix(prefix, action.docLink),
  }));
}

function enumsSidebar(
  prefix: string,
  t: (typeof ui)[DocsLocale]["sidebar"]
): DefaultTheme.SidebarItem[] {
  return [
    {
      text: t.mathOperations,
      link: withLocalePrefix(prefix, "/language/enums/math-operations"),
    },
    {
      text: t.teamOrPlayerTarget,
      link: withLocalePrefix(prefix, "/language/enums/team-or-player-target"),
    },
    {
      text: t.dynamicStrings,
      link: withLocalePrefix(prefix, "/language/enums/dynamic-strings"),
    },
    {
      text: t.gameOptions,
      link: withLocalePrefix(prefix, "/language/enums/game-options"),
      items: [
        {
          text: t.teamScoringMethod,
          link: withLocalePrefix(
            prefix,
            "/language/enums/game-options/team-scoring-method"
          ),
        },
        {
          text: t.weaponSet,
          link: withLocalePrefix(prefix, "/language/enums/game-options/weapon-set"),
        },
        {
          text: t.vehicleSet,
          link: withLocalePrefix(
            prefix,
            "/language/enums/game-options/vehicle-set"
          ),
        },
      ],
    },
    {
      text: t.playerTraits,
      link: withLocalePrefix(prefix, "/language/enums/player-traits"),
      items: [
        {
          text: t.grenadeCount,
          link: withLocalePrefix(
            prefix,
            "/language/enums/player-traits/grenade-count"
          ),
        },
        {
          text: t.vehicleUsageSetting,
          link: withLocalePrefix(
            prefix,
            "/language/enums/player-traits/vehicle-usage-setting"
          ),
        },
        {
          text: t.sprinting,
          link: withLocalePrefix(
            prefix,
            "/language/enums/player-traits/sprinting"
          ),
        },
        {
          text: t.equipmentUsageSetting,
          link: withLocalePrefix(
            prefix,
            "/language/enums/player-traits/equipment-usage-setting"
          ),
        },
        {
          text: t.activeCamoSetting,
          link: withLocalePrefix(
            prefix,
            "/language/enums/player-traits/active-camo-setting"
          ),
        },
        {
          text: t.waypointSetting,
          link: withLocalePrefix(
            prefix,
            "/language/enums/player-traits/waypoint-setting"
          ),
        },
        {
          text: t.forcedChangeColorSetting,
          link: withLocalePrefix(
            prefix,
            "/language/enums/player-traits/forced-change-color-setting"
          ),
        },
        {
          text: t.motionTrackerSetting,
          link: withLocalePrefix(
            prefix,
            "/language/enums/player-traits/motion-tracker-setting"
          ),
        },
      ],
    },
    {
      text: t.builtInVariables,
      link: withLocalePrefix(prefix, "/language/enums/built-in-variables"),
    },
    {
      text: t.engineCategories,
      link: withLocalePrefix(prefix, "/language/enums/engine-categories"),
    },
    {
      text: t.sounds,
      link: withLocalePrefix(prefix, "/language/enums/sounds"),
    },
  ];
}

function megaloLanguageSidebar(
  prefix: string,
  t: (typeof ui)[DocsLocale]["sidebar"]
): DefaultTheme.SidebarItem[] {
  return [
    { text: t.introduction, link: withLocalePrefix(prefix, "/language/") },
    { text: t.syntax, link: withLocalePrefix(prefix, "/language/syntax") },
    {
      text: t.baseFiles,
      link: withLocalePrefix(prefix, "/language/base-files"),
    },
    {
      text: t.elements,
      collapsed: false,
      items: elementsSidebar(prefix),
    },
    {
      text: t.actions,
      collapsed: true,
      items: actionsSidebar(prefix),
    },
    {
      text: t.optionsEnums,
      collapsed: true,
      items: enumsSidebar(prefix, t),
    },
    {
      text: t.variableModel,
      link: withLocalePrefix(prefix, "/language/variable-model"),
    },
    {
      text: t.megaloHeadaches,
      link: withLocalePrefix(prefix, "/language/megalo-headaches"),
    },
    {
      text: t.references,
      link: withLocalePrefix(prefix, "/language/references"),
    },
    {
      text: t.exampleScripts,
      link: withLocalePrefix(prefix, "/language/examples"),
    },
    {
      text: t.objectLists,
      link: withLocalePrefix(prefix, "/language/object-lists"),
    },
    {
      text: t.compilerSettings,
      link: withLocalePrefix(prefix, "/language/compiler-settings"),
    },
  ];
}

function supportedVersionsSidebar(
  prefix: string,
  t: (typeof ui)[DocsLocale]["sidebar"]
): DefaultTheme.SidebarItem[] {
  const items: DefaultTheme.SidebarItem[] = [
    { text: t.overview, link: withLocalePrefix(prefix, "/versions/") },
  ];

  for (const version of languageVersions.versions) {
    items.push({
      text: versionSidebarLabel(version.label),
      link: withLocalePrefix(prefix, version.docLink),
    });
  }

  return items;
}

function buildNav(
  prefix: string,
  locale: DocsLocale
): DefaultTheme.NavItem[] {
  const t = ui[locale].nav;
  return [
    { text: "Blam Network", link: "https://blam.network" },
    { text: t.guide, link: withLocalePrefix(prefix, "/guide/quick-start") },
    {
      text: t.megacrow,
      link: withLocalePrefix(prefix, "/megacrow/"),
      activeMatch: withLocalePrefix(prefix, "/megacrow/"),
    },
    {
      text: t.language,
      link: withLocalePrefix(prefix, "/language/"),
      activeMatch: withLocalePrefix(prefix, "/language/"),
    },
    { text: t.changelog, link: withLocalePrefix(prefix, "/changelog") },
    {
      text: "npm",
      link: "https://www.npmjs.com/package/@blamnetwork/megalo",
    },
    {
      text: "GitHub",
      link: "https://github.com/Blam-Network/megalo",
    },
  ];
}

function buildSidebar(
  prefix: string,
  locale: DocsLocale
): DefaultTheme.SidebarItem[] {
  const t = ui[locale].sidebar;
  return [
    {
      text: t.introduction,
      items: [
        { text: t.whatIsMegalo, link: withLocalePrefix(prefix, "/") },
        {
          text: t.installQuickStart,
          link: withLocalePrefix(prefix, "/guide/quick-start"),
        },
      ],
    },
    {
      text: t.megacrow,
      items: [
        { text: t.overview, link: withLocalePrefix(prefix, "/megacrow/") },
        {
          text: t.workspaces,
          link: withLocalePrefix(prefix, "/megacrow/workspaces"),
        },
        { text: t.export, link: withLocalePrefix(prefix, "/megacrow/export") },
        {
          text: t.settings,
          link: withLocalePrefix(prefix, "/megacrow/settings"),
        },
      ],
    },
    {
      text: t.megaloLanguage,
      items: megaloLanguageSidebar(prefix, t),
    },
    {
      text: t.versions,
      items: supportedVersionsSidebar(prefix, t),
    },
    {
      text: t.usage,
      items: [
        {
          text: t.parsing,
          link: withLocalePrefix(prefix, "/guide/parsing"),
        },
        {
          text: t.compiling,
          link: withLocalePrefix(prefix, "/guide/compiling"),
        },
        {
          text: t.decompiling,
          link: withLocalePrefix(prefix, "/guide/decompiling"),
        },
        {
          text: t.gametypes,
          link: withLocalePrefix(prefix, "/guide/gametypes"),
        },
        {
          text: t.megaloVersions,
          link: withLocalePrefix(prefix, "/guide/megalo-versions"),
        },
      ],
    },
    {
      text: t.contributing,
      items: [
        {
          text: t.development,
          link: withLocalePrefix(prefix, "/guide/development"),
        },
      ],
    },
    {
      text: t.reference,
      items: [
        { text: t.changelog, link: withLocalePrefix(prefix, "/changelog") },
      ],
    },
  ];
}

const japaneseThemeUi: DefaultTheme.Config = {
  docFooter: {
    prev: "前のページ",
    next: "次のページ",
  },
  outline: {
    label: "このページの内容",
  },
  returnToTopLabel: "トップに戻る",
  darkModeSwitchLabel: "外観",
  lightModeSwitchTitle: "ライトモードに切り替え",
  darkModeSwitchTitle: "ダークモードに切り替え",
  sidebarMenuLabel: "メニュー",
  lastUpdatedText: "最終更新",
  langMenuLabel: "言語を切り替える",
};

export default defineConfig(async () => {
  const { megaloCodeToHtml } = await import(
    /* @vite-ignore */ highlightBundleUrl
  );

  return {
    title: "MegaloEvolved Docs",
    description: "Documentation for the Megalo language and the MegaloEvolved IDE.",
    base: docsBase,
    cleanUrls: true,
    appearance: "force-dark",
    head: [
      ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
      [
        "link",
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
      ],
      [
        "link",
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Overpass:wght@400;500;600;700&display=swap",
        },
      ],
    ],
    markdown: {
      theme: {
        light: "github-light",
        dark: "github-dark",
      },
      // HaloScript grammar from Unordinal/Haloscript-Syntax (MIT, see grammars/).
      languages: [{ ...haloscriptGrammar, name: "haloscript" }],
      config(md: MarkdownIt) {
        const shikiHighlight = md.options.highlight;
        if (!shikiHighlight) {
          return;
        }

        md.options.highlight = (code, lang, attrs) => {
          if (normalizeFenceLang(lang) === "megalo") {
            return megaloCodeToHtml(code);
          }
          return shikiHighlight(code, lang, attrs);
        };
      },
    },
    locales: {
      root: {
        label: "English",
        lang: "en",
        themeConfig: {
          nav: buildNav("", "en"),
          sidebar: buildSidebar("", "en"),
        },
      },
      ja: {
        label: "日本語",
        lang: "ja",
        link: "/ja/",
        description:
          "Megalo 言語と MegaloEvolved IDE のドキュメントです。",
        themeConfig: {
          ...japaneseThemeUi,
          nav: buildNav("/ja", "ja"),
          sidebar: buildSidebar("/ja", "ja"),
        },
      },
    },
    themeConfig: {
      search: {
        provider: "local",
        options: {
          ...localSearchOptions,
          _render: createSearchRenderHook(),
        },
      },
      siteTitle:
        `<span class="megalo-site-title"><span class="megalo-site-title-row"><span class="megalo-scope">@blamnetwork/</span><span class="megalo-name">megalo</span></span><span class="megalo-site-build">${MEGACROW_BUILD_STRING}</span></span>`,
      socialLinks: [
        {
          icon: "npm",
          link: "https://www.npmjs.com/package/@blamnetwork/megalo",
          ariaLabel: "npm",
        },
        {
          icon: "github",
          link: "https://github.com/Blam-Network/megalo",
        },
        {
          icon: "discord",
          link: "https://discord.gg/77ZAgXv8a6",
          ariaLabel: "Discord",
        },
      ],
      footer: {
        message: `MegaloEvolved ${MEGACROW_BUILD_STRING}`,
        copyright:
          'Copyright © <a href="https://discord.gg/77ZAgXv8a6" target="_blank" rel="noopener noreferrer">Blam Network</a>',
      },
    },
  };
});

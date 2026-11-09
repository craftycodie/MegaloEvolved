import path from "node:path";
import {
  commands,
  type ExtensionContext,
  StatusBarAlignment,
  type StatusBarItem,
  type TextDocument,
  window,
  workspace,
} from "vscode";
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import {
  type ListDirectoryParams,
  MEGACROW_CONFIGURATION_SECTION,
  MEGACROW_LIST_DIRECTORY_METHOD,
  MEGACROW_RESOLVE_BASE_FILE_METHOD,
  MEGACROW_RESOLVE_INCLUDE_METHOD,
  type MegacrowConfig,
  type MegacrowInitializationOptions,
  type ResolveBaseFileParams,
  type ResolveIncludeParams,
} from "./protocol";
import {
  handleListDirectory,
  handleResolveBaseFile,
  handleResolveInclude,
} from "./resolveHandlers";
import {
  DEFAULT_MEGALO_VERSION,
  isMegaloVersionId,
  labelForMegaloVersion,
  MEGALO_VERSION_OPTIONS,
  type MegaloVersionId,
} from "./versions";

/** Mirrors `@megacrow/megalo` ALL_MEGACROW_EXTENSIONS / DEFAULT_MEGACROW_EXTENSIONS. */
const ALL_MEGACROW_EXTENSIONS = {
  targetTeam: true,
  coopSpawningWaypointIcon: true,
  doubleJump: true,
  notBuiltIn: true,
  compileMissingBaseFromSource: true,
  megacrowVersionString: true,
  preventShadowing: false,
  reservedKeywords: true,
  supportLegacySyntax: true,
} as const;

const DEFAULT_MEGACROW_EXTENSIONS = {
  targetTeam: false,
  coopSpawningWaypointIcon: false,
  doubleJump: false,
  notBuiltIn: false,
  compileMissingBaseFromSource: false,
  megacrowVersionString: false,
  preventShadowing: false,
  reservedKeywords: false,
  supportLegacySyntax: false,
} as const;

let client: LanguageClient | undefined;
let versionStatusBar: StatusBarItem | undefined;
/** Document URIs already offered a version picker this session. */
const promptedVersionUris = new Set<string>();

const getServerModule = (extensionContext: ExtensionContext): string =>
  extensionContext.asAbsolutePath(path.join("dist", "server.js"));

const readConfiguredVersion = (): MegaloVersionId => {
  const raw = workspace
    .getConfiguration("megacrow")
    .get<string>("megaloVersion", DEFAULT_MEGALO_VERSION);
  return isMegaloVersionId(raw) ? raw : DEFAULT_MEGALO_VERSION;
};

const writeConfiguredVersion = async (
  version: MegaloVersionId
): Promise<void> => {
  await workspace
    .getConfiguration("megacrow")
    .update("megaloVersion", version, true);
};

const updateVersionStatusBar = (): void => {
  if (!versionStatusBar) {
    return;
  }
  const editor = window.activeTextEditor;
  if (!editor || editor.document.languageId !== "megalo") {
    versionStatusBar.hide();
    return;
  }
  const version = readConfiguredVersion();
  versionStatusBar.text = `Megalo ${version}`;
  versionStatusBar.tooltip = labelForMegaloVersion(version);
  versionStatusBar.show();
};

/** The whole server configuration, built from the `megacrow.*` settings. */
const buildServerConfig = (): MegacrowConfig => {
  const config = workspace.getConfiguration("megacrow");
  return {
    compilerSettings: {
      strictStringLiterals: config.get<boolean>("strictStringLiterals", false),
      creatorGamertag: config.get<string>("gametypeAuthor", "MegaCrow"),
    },
    locale: config.get<string>("locale", "en") === "ja" ? "ja" : "en",
    megacrowExtensions: config.get<boolean>("megacrowExtensions", true)
      ? ALL_MEGACROW_EXTENSIONS
      : DEFAULT_MEGACROW_EXTENSIONS,
    megaloVersion: readConfiguredVersion(),
    // VS Code uses the bundled object lists and always resolves base files.
    objectLists: null,
    resolveBaseFile: true,
  };
};

/** Send the whole configuration; the server re-analyzes only if it changed. */
const syncServerSettings = async (
  languageClient: LanguageClient
): Promise<void> => {
  await languageClient.sendNotification("workspace/didChangeConfiguration", {
    settings: { [MEGACROW_CONFIGURATION_SECTION]: buildServerConfig() },
  });
  updateVersionStatusBar();
};

const selectMegaloVersion = async (options?: {
  force?: boolean;
}): Promise<MegaloVersionId | undefined> => {
  const current = readConfiguredVersion();
  const picked = await window.showQuickPick(
    MEGALO_VERSION_OPTIONS.map((option) => ({
      label: option.label,
      description: option.description,
      detail: option.id === current ? "Current" : undefined,
      id: option.id,
    })),
    {
      title: "Megalo version",
      placeHolder: "Select the Megalo engine profile for this editor",
      ignoreFocusOut: true,
    }
  );
  if (!picked) {
    return options?.force ? undefined : current;
  }
  const next = picked.id;
  if (next !== current) {
    // The configuration-change listener sends the new version to the server.
    await writeConfiguredVersion(next);
  }
  updateVersionStatusBar();
  return next;
};

const maybePromptVersionForDocument = async (
  document: TextDocument
): Promise<void> => {
  if (document.languageId !== "megalo" || document.uri.scheme !== "file") {
    return;
  }
  const key = document.uri.toString();
  if (promptedVersionUris.has(key)) {
    return;
  }
  promptedVersionUris.add(key);
  await selectMegaloVersion();
};

const createClient = (extensionContext: ExtensionContext): LanguageClient => {
  const serverModule = getServerModule(extensionContext);
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.stdio },
    debug: {
      module: serverModule,
      transport: TransportKind.stdio,
      options: { execArgv: ["--nolazy", "--inspect=6009"] },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "megalo" }],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher("**/*.{txt,mglo}"),
    },
    outputChannelName: "MegaCrow Megalo",
    initializationOptions: (): MegacrowInitializationOptions => ({
      config: buildServerConfig(),
    }),
  };

  const languageClient = new LanguageClient(
    "megacrow",
    "MegaCrow Megalo",
    serverOptions,
    clientOptions
  );

  languageClient.onRequest(
    MEGACROW_RESOLVE_INCLUDE_METHOD,
    (params: ResolveIncludeParams) => handleResolveInclude(params)
  );
  languageClient.onRequest(
    MEGACROW_RESOLVE_BASE_FILE_METHOD,
    (params: ResolveBaseFileParams) => handleResolveBaseFile(params)
  );
  languageClient.onRequest(
    MEGACROW_LIST_DIRECTORY_METHOD,
    (params: ListDirectoryParams) => handleListDirectory(params)
  );

  return languageClient;
};

const startClient = async (
  extensionContext: ExtensionContext
): Promise<void> => {
  client = createClient(extensionContext);
  // Settings go in `initializationOptions`; later changes use
  // `workspace/didChangeConfiguration` (see `syncServerSettings`).
  await client.start();
  updateVersionStatusBar();
};

export async function activate(
  extensionContext: ExtensionContext
): Promise<void> {
  versionStatusBar = window.createStatusBarItem(StatusBarAlignment.Right, 100);
  versionStatusBar.command = "megacrow.selectMegaloVersion";
  extensionContext.subscriptions.push(versionStatusBar);

  extensionContext.subscriptions.push(
    commands.registerCommand("megacrow.restartServer", async () => {
      if (client) {
        await client.stop();
        client = undefined;
      }
      await startClient(extensionContext);
      void window.showInformationMessage("MegaCrow language server restarted.");
    })
  );

  extensionContext.subscriptions.push(
    commands.registerCommand("megacrow.selectMegaloVersion", async () => {
      await selectMegaloVersion({ force: true });
    })
  );

  extensionContext.subscriptions.push(
    workspace.onDidChangeConfiguration((event) => {
      if (!(event.affectsConfiguration("megacrow") && client)) {
        return;
      }
      void syncServerSettings(client);
    })
  );

  extensionContext.subscriptions.push(
    workspace.onDidOpenTextDocument((document) => {
      void maybePromptVersionForDocument(document);
    })
  );

  extensionContext.subscriptions.push(
    window.onDidChangeActiveTextEditor(() => {
      updateVersionStatusBar();
    })
  );

  await startClient(extensionContext);

  const active = window.activeTextEditor?.document;
  if (active) {
    void maybePromptVersionForDocument(active);
  }
  updateVersionStatusBar();
}

export async function deactivate(): Promise<void> {
  if (!client) {
    return;
  }
  await client.stop();
  client = undefined;
}

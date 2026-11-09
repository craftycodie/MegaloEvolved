import { getCurrentWindow } from "@tauri-apps/api/window";
import { docsPageUrl, isTauriRuntime, listenDocsNavigate } from "../desktop";
import "./styles.css";
import { APP_NAME } from "../app/constants";
import { startEventLog } from "../log";

startEventLog();

const DEFAULT_TITLE = `${APP_NAME} Docs`;

const backBtn = document.querySelector<HTMLButtonElement>("#docs-back")!;
const forwardBtn = document.querySelector<HTMLButtonElement>("#docs-forward")!;
const titleEl = document.querySelector<HTMLElement>(".docs-chrome-title")!;
const frame = document.querySelector<HTMLIFrameElement>("#docs-frame")!;
const chrome = document.querySelector<HTMLElement>(".docs-chrome")!;
const controlsHost = document.querySelector("#docs-window-controls")!;

const initialDocsPath = new URLSearchParams(window.location.search).get("path");
frame.src = docsPageUrl(initialDocsPath);

/** Index into the iframe session history we have observed. */
let historyIndex = 0;
let historyLength = 1;
let applyingHistory = false;
let titleObserver: MutationObserver | null = null;

const MAXIMIZE_ICON = `
  <svg aria-hidden="true" viewBox="0 0 12 12">
    <rect fill="none" height="8" stroke="currentColor" stroke-width="1" width="8" x="2" y="2" />
  </svg>
`;

const RESTORE_ICON = `
  <svg aria-hidden="true" viewBox="0 0 12 12">
    <rect fill="none" height="6" stroke="currentColor" stroke-width="1" width="6" x="3.5" y="1.5" />
    <rect fill="#252526" height="6" stroke="currentColor" stroke-width="1" width="6" x="1.5" y="3.5" />
  </svg>
`;

const syncNavButtons = (): void => {
  backBtn.disabled = historyIndex <= 0;
  forwardBtn.disabled = historyIndex >= historyLength - 1;
};

const docsWindow = (): Window | null => frame.contentWindow;

const setChromeTitle = (raw: string): void => {
  const title = raw.trim() || DEFAULT_TITLE;
  titleEl.textContent = title;
  document.title = title;
  if (isTauriRuntime()) {
    void getCurrentWindow().setTitle(title);
  }
};

const syncPageTitle = (): void => {
  try {
    const title = frame.contentDocument?.title?.trim();
    setChromeTitle(title || DEFAULT_TITLE);
  } catch {
    setChromeTitle(DEFAULT_TITLE);
  }
};

const wirePageTitle = (win: Window): void => {
  titleObserver?.disconnect();
  titleObserver = null;
  syncPageTitle();

  const doc = win.document;
  const titleNode = doc.querySelector("title");
  if (!titleNode) {
    return;
  }

  titleObserver = new MutationObserver(() => {
    syncPageTitle();
  });
  titleObserver.observe(titleNode, {
    childList: true,
    characterData: true,
    subtree: true,
  });
};

const goBack = (): void => {
  const win = docsWindow();
  if (!win || historyIndex <= 0) {
    return;
  }
  applyingHistory = true;
  historyIndex -= 1;
  syncNavButtons();
  win.history.back();
  queueMicrotask(() => {
    applyingHistory = false;
    syncPageTitle();
  });
};

const goForward = (): void => {
  const win = docsWindow();
  if (!win || historyIndex >= historyLength - 1) {
    return;
  }
  applyingHistory = true;
  historyIndex += 1;
  syncNavButtons();
  win.history.forward();
  queueMicrotask(() => {
    applyingHistory = false;
    syncPageTitle();
  });
};

const notePush = (): void => {
  if (applyingHistory) {
    return;
  }
  historyIndex += 1;
  historyLength = historyIndex + 1;
  syncNavButtons();
  syncPageTitle();
};

const noteReplace = (): void => {
  syncPageTitle();
};

const wireDocsHistory = (win: Window): void => {
  const { history } = win;
  const pushState = history.pushState.bind(history);
  const replaceState = history.replaceState.bind(history);

  history.pushState = ((data, unused, url) => {
    pushState(data, unused, url);
    notePush();
  }) as History["pushState"];

  history.replaceState = ((data, unused, url) => {
    replaceState(data, unused, url);
    noteReplace();
  }) as History["replaceState"];

  win.addEventListener("popstate", () => {
    if (!applyingHistory) {
      syncNavButtons();
    }
    syncPageTitle();
  });
};

const mountWindowControls = (): void => {
  if (!isTauriRuntime()) {
    return;
  }

  const appWindow = getCurrentWindow();
  controlsHost.innerHTML = `
    <div aria-label="Window controls" class="window-controls" role="group">
      <button aria-label="Minimize" class="window-control" type="button" data-action="minimize">
        <svg aria-hidden="true" viewBox="0 0 12 12">
          <rect fill="currentColor" height="1" width="8" x="2" y="6" />
        </svg>
      </button>
      <button aria-label="Maximize" class="window-control" type="button" data-action="maximize">
        ${MAXIMIZE_ICON}
      </button>
      <button aria-label="Close" class="window-control window-control-close" type="button" data-action="close">
        <svg aria-hidden="true" viewBox="0 0 12 12">
          <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-linecap="round" stroke-width="1.1" />
        </svg>
      </button>
    </div>
  `;

  const maximizeBtn = controlsHost.querySelector<HTMLButtonElement>(
    '[data-action="maximize"]'
  )!;

  const syncMaximized = async (): Promise<void> => {
    const maximized = await appWindow.isMaximized();
    maximizeBtn.innerHTML = maximized ? RESTORE_ICON : MAXIMIZE_ICON;
    maximizeBtn.setAttribute("aria-label", maximized ? "Restore" : "Maximize");
  };

  void syncMaximized();
  void appWindow.onResized(() => {
    void syncMaximized();
  });

  controlsHost.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      "[data-action]"
    );
    if (!target) {
      return;
    }
    switch (target.dataset.action) {
      case "minimize":
        void appWindow.minimize();
        break;
      case "maximize":
        void appWindow.toggleMaximize();
        break;
      case "close":
        void appWindow.close();
        break;
      default:
        break;
    }
  });

  chrome.addEventListener("dblclick", (event) => {
    if ((event.target as HTMLElement).closest("button")) {
      return;
    }
    void appWindow.toggleMaximize();
  });
};

backBtn.addEventListener("click", goBack);
forwardBtn.addEventListener("click", goForward);

const onKeyDown = (event: KeyboardEvent): void => {
  if (event.defaultPrevented) {
    return;
  }
  if (event.key === "BrowserBack" || event.code === "BrowserBack") {
    event.preventDefault();
    goBack();
    return;
  }
  if (event.key === "BrowserForward" || event.code === "BrowserForward") {
    event.preventDefault();
    goForward();
    return;
  }
  if (event.altKey && (event.key === "ArrowLeft" || event.key === "Left")) {
    event.preventDefault();
    goBack();
    return;
  }
  if (event.altKey && (event.key === "ArrowRight" || event.key === "Right")) {
    event.preventDefault();
    goForward();
  }
};

const onMouseUp = (event: MouseEvent): void => {
  if (event.button === 3) {
    event.preventDefault();
    goBack();
  } else if (event.button === 4) {
    event.preventDefault();
    goForward();
  }
};

const onMouseDown = (event: MouseEvent): void => {
  if (event.button === 3 || event.button === 4) {
    event.preventDefault();
  }
};

window.addEventListener("keydown", onKeyDown);
window.addEventListener("mouseup", onMouseUp);
window.addEventListener("mousedown", onMouseDown);

frame.addEventListener("load", () => {
  const win = docsWindow();
  if (!win) {
    return;
  }
  historyIndex = 0;
  historyLength = 1;
  syncNavButtons();
  wireDocsHistory(win);
  wirePageTitle(win);

  try {
    win.addEventListener("keydown", onKeyDown);
    win.addEventListener("mouseup", onMouseUp);
    win.addEventListener("mousedown", onMouseDown);
  } catch {
    // Cross-origin should not happen for packaged docs.
  }
});

if (isTauriRuntime()) {
  void listenDocsNavigate((path) => {
    frame.src = docsPageUrl(path);
  });
}

mountWindowControls();
syncNavButtons();

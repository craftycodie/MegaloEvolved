import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { isTauriRuntime } from "../desktop";
import { useT } from "../localization";

export function WindowControls() {
  const t = useT();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    const appWindow = getCurrentWindow();
    let disposed = false;

    const syncMaximized = async () => {
      const value = await appWindow.isMaximized();
      if (!disposed) {
        setMaximized(value);
      }
    };

    void syncMaximized();

    const unlistenPromise = appWindow.onResized(() => {
      void syncMaximized();
    });

    return () => {
      disposed = true;
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  if (!isTauriRuntime()) {
    return null;
  }

  const appWindow = getCurrentWindow();

  return (
    // biome-ignore lint/a11y/useSemanticElements: a labelled group of window buttons, not a form fieldset.
    <div
      aria-label={t("window_controls")}
      className="window-controls"
      role="group"
    >
      <button
        aria-label={t("window_minimize")}
        className="window-control"
        onClick={() => void appWindow.minimize()}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 12 12">
          <rect fill="currentColor" height="1" width="8" x="2" y="6" />
        </svg>
      </button>
      <button
        aria-label={maximized ? t("window_restore") : t("window_maximize")}
        className="window-control"
        onClick={() => void appWindow.toggleMaximize()}
        type="button"
      >
        {maximized ? (
          <svg aria-hidden="true" viewBox="0 0 12 12">
            <rect
              fill="none"
              height="6"
              stroke="currentColor"
              strokeWidth="1"
              width="6"
              x="3.5"
              y="1.5"
            />
            <rect
              fill="var(--bg-panel)"
              height="6"
              stroke="currentColor"
              strokeWidth="1"
              width="6"
              x="1.5"
              y="3.5"
            />
          </svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 12 12">
            <rect
              fill="none"
              height="8"
              stroke="currentColor"
              strokeWidth="1"
              width="8"
              x="2"
              y="2"
            />
          </svg>
        )}
      </button>
      <button
        aria-label={t("window_close")}
        className="window-control window-control-close"
        onClick={() => void appWindow.close()}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 12 12">
          <path
            d="M2.5 2.5l7 7M9.5 2.5l-7 7"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.1"
          />
        </svg>
      </button>
    </div>
  );
}

import "./editor/monacoBootstrap";
import { _event_status, event } from "@blamnetwork/datamine";
import { MEGACROW_BUILD_STRING } from "@megacrow/megalo";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { APP_NAME } from "./app/constants";
import {
  installNativeContextMenuBlocker,
  installPrintShortcutBlocker,
  isTauriRuntime,
} from "./desktop";
import { installDocumentEffects } from "./stores/documentEffects";
import { installSettingsEffects } from "./stores/settingsEffects";
import { bootstrapSettings } from "./stores/settingsStore";
import "./styles/index.css";
import { startEventLog } from "./log";

startEventLog();
event(
  _event_status,
  "ide:app: %s %s starting (%s, blf %s, %s)",
  APP_NAME,
  MEGACROW_BUILD_STRING,
  isTauriRuntime() ? "desktop" : "browser",
  __BLF_VERSION__,
  navigator.language
);

installPrintShortcutBlocker();
installNativeContextMenuBlocker();
installSettingsEffects();
installDocumentEffects();
void bootstrapSettings();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

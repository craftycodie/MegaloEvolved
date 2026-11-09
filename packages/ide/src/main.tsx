import "./editor/monacoBootstrap";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import {
  installNativeContextMenuBlocker,
  installPrintShortcutBlocker,
} from "./desktop";
import { installDocumentEffects } from "./stores/documentEffects";
import { installSettingsEffects } from "./stores/settingsEffects";
import { bootstrapSettings } from "./stores/settingsStore";
import "./styles/index.css";

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

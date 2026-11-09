import { _event_error, event } from "@blamnetwork/datamine";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isTauriRuntime } from "./tauriRuntime";

export async function openExternalUrl(url: string): Promise<void> {
  if (isTauriRuntime()) {
    try {
      await openUrl(url);
      return;
    } catch (error) {
      event(
        _event_error,
        "ide:desktop: Failed to open external URL via Tauri opener: %s",
        String(error)
      );
    }
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

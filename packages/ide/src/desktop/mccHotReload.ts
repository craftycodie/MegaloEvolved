import { _event_status, event } from "@blamnetwork/datamine";
import { ipcWriteMccHotReloadMglo } from "./ipc";
import { isTauriRuntime } from "./tauriRuntime";

export { isTauriRuntime };

export async function writeMccHotReloadMglo(bytes: Uint8Array): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  const path = await ipcWriteMccHotReloadMglo(bytes);
  event(
    _event_status,
    "ide:desktop: Wrote MCC hot-reload .mglo (%d bytes) -> %s",
    bytes.length,
    path
  );
}

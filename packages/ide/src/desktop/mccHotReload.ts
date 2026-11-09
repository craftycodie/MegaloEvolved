import { APP_NAME } from "../app/constants";
import { ipcWriteMccHotReloadMglo } from "./ipc";
import { isTauriRuntime } from "./tauriRuntime";

export { isTauriRuntime };

export async function writeMccHotReloadMglo(bytes: Uint8Array): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  const path = await ipcWriteMccHotReloadMglo(bytes);
  console.log(
    `[${APP_NAME}] Wrote MCC hot-reload .mglo (${bytes.length} bytes) -> ${path}`
  );
}

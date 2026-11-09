import { ipcCliComplete, ipcCliLog, ipcGetCliArgs } from "../desktop/ipc";
import { startEventLog } from "../log";
import { runCli } from "./runCli";
import { createTauriFilesystem } from "./tauriFilesystem";

function hookConsole(): void {
  const forward =
    (level: "log" | "error") =>
    (...args: unknown[]) => {
      const line = args
        .map((value) =>
          typeof value === "string" ? value : JSON.stringify(value)
        )
        .join(" ");
      void ipcCliLog(level, line);
    };

  // The IDE log (src/log) writes through all five methods.
  console.log = forward("log");
  console.info = forward("log");
  console.debug = forward("log");
  console.warn = forward("error");
  console.error = forward("error");
}

async function main(): Promise<void> {
  hookConsole();
  startEventLog();
  const args = await ipcGetCliArgs();
  const filesystem = createTauriFilesystem();
  const code = await runCli(args, filesystem);
  await ipcCliComplete(code);
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  try {
    await ipcCliComplete(1);
  } catch {
    // If the runtime is already tearing down, fall back to a hard exit code.
  }
});

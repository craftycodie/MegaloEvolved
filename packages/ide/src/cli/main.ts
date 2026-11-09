import { startEventLog } from "../log";
import { createNodeFilesystem } from "./nodeFilesystem";
import { runCli } from "./runCli";

startEventLog();

runCli(process.argv.slice(2), createNodeFilesystem())
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });

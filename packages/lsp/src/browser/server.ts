import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
} from "vscode-languageserver/browser";
import { startMegacrowLanguageServer } from "../createServer";
import { startLspEventLog } from "../eventLog";

startLspEventLog();

const reader = new BrowserMessageReader(self as DedicatedWorkerGlobalScope);
const writer = new BrowserMessageWriter(self as DedicatedWorkerGlobalScope);
const connection = createConnection(reader, writer);
startMegacrowLanguageServer(connection);

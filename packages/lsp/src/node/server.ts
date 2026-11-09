import { createConnection, ProposedFeatures } from "vscode-languageserver/node";
import { startMegacrowLanguageServer } from "../createServer";
import { startLspEventLog } from "../eventLog";

const connection = createConnection(ProposedFeatures.all);
// After createConnection, which points the console at the client.
startLspEventLog();
startMegacrowLanguageServer(connection);

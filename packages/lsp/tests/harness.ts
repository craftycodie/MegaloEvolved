import { createConnection } from "vscode-languageserver/node";
import {
  AbstractMessageReader,
  AbstractMessageWriter,
  createProtocolConnection,
  type DataCallback,
  Disposable,
  type Message,
  type ProtocolConnection,
  type PublishDiagnosticsParams,
} from "vscode-languageserver-protocol/node";
import { startMegacrowLanguageServer } from "../src/createServer";
import { startLspEventLog } from "../src/eventLog";
import {
  MEGACROW_LIST_DIRECTORY_METHOD,
  MEGACROW_RESOLVE_BASE_FILE_METHOD,
  MEGACROW_RESOLVE_INCLUDE_METHOD,
} from "../src/protocol";

/** In-memory JSON-RPC pipe end. Messages are JSON round-tripped like a real transport. */
class MemoryReader extends AbstractMessageReader {
  private callback: DataCallback | undefined;
  private readonly queued: Message[] = [];

  listen(callback: DataCallback): Disposable {
    this.callback = callback;
    for (const message of this.queued.splice(0)) {
      callback(message);
    }
    return Disposable.create(() => {
      this.callback = undefined;
    });
  }

  deliver(message: Message): void {
    if (this.callback) {
      this.callback(message);
    } else {
      this.queued.push(message);
    }
  }
}

class MemoryWriter extends AbstractMessageWriter {
  constructor(private readonly target: MemoryReader) {
    super();
  }

  write(message: Message): Promise<void> {
    const copy = JSON.parse(JSON.stringify(message)) as Message;
    setTimeout(() => this.target.deliver(copy), 0);
    return Promise.resolve();
  }

  end(): void {
    // nothing to flush
  }
}

export interface TestServer {
  client: ProtocolConnection;
  dispose: () => void;
  /** Every `textDocument/publishDiagnostics` the server sent, in order. */
  published: PublishDiagnosticsParams[];
}

/** Start the MegaCrow server over an in-memory connection and run `initialize`. */
export const startTestServer = async (
  initializationOptions?: unknown
): Promise<TestServer> => {
  const toServer = new MemoryReader();
  const toClient = new MemoryReader();

  const server = createConnection(toServer, new MemoryWriter(toClient));
  // As the real server entries do, so lsp: events reach the console.
  startLspEventLog();
  startMegacrowLanguageServer(server);

  const client = createProtocolConnection(toClient, new MemoryWriter(toServer));
  const published: PublishDiagnosticsParams[] = [];
  client.onNotification(
    "textDocument/publishDiagnostics",
    (params: PublishDiagnosticsParams) => {
      published.push(params);
    }
  );
  // Test documents have no includes / base files; answer like a host with no files.
  client.onRequest(MEGACROW_RESOLVE_INCLUDE_METHOD, () => ({
    error: "not found",
  }));
  client.onRequest(MEGACROW_RESOLVE_BASE_FILE_METHOD, () => ({
    error: "not found",
  }));
  client.onRequest(MEGACROW_LIST_DIRECTORY_METHOD, () => ({
    error: "not found",
  }));
  client.listen();

  await client.sendRequest("initialize", {
    processId: null,
    rootUri: null,
    capabilities: {},
    initializationOptions,
  });
  await client.sendNotification("initialized", {});

  return {
    client,
    published,
    dispose: () => {
      client.dispose();
      server.dispose();
    },
  };
};

export const openDocument = (
  client: ProtocolConnection,
  uri: string,
  text: string,
  version = 1
): Promise<void> =>
  client.sendNotification("textDocument/didOpen", {
    textDocument: { uri, languageId: "megalo", version, text },
  });

/** A small script that lowers and encodes without includes or a base file. */
export const VALID_SOURCE = `variables global
\tlocal number n 0
end
trigger general
\taction set n set_to 2
end
`;

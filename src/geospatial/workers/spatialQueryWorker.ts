import * as duckdb from "@duckdb/duckdb-wasm";

type RequestMessage = { id: string; type: string; sql?: string; params?: unknown[]; name?: string; url?: string; file?: File };
let db: duckdb.AsyncDuckDB | null = null;
let connection: duckdb.AsyncDuckDBConnection | null = null;

function send(message: Record<string, unknown>) { self.postMessage(message); }

async function initialize() {
  if (db) return;
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
  if (!bundle.mainModule || !bundle.mainWorker) throw new Error("spatial.wasmBundleUnavailable");
  const workerUrl = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" }));
  const worker = new Worker(workerUrl);
  db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  connection = await db.connect();
  try { await connection.query("LOAD spatial"); } catch { throw new Error("spatial.extensionUnavailable"); }
}

function serializable(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Uint8Array) return Array.from(value);
  if (Array.isArray(value)) return value.map(serializable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, serializable(entry)]));
  return value;
}

self.onmessage = async (event: MessageEvent<RequestMessage>) => {
  const message = event.data;
  try {
    if (message.type === "initialize") await initialize();
    else {
      await initialize();
      if (!db || !connection) throw new Error("spatial.notInitialized");
      if (message.type === "register-file") {
        if (!message.file || !message.name) throw new Error("spatial.fileUnavailable");
        await db.registerFileBuffer(message.name, new Uint8Array(await message.file.arrayBuffer()));
      } else if (message.type === "register-url") {
        if (!message.url || !message.name || !/^https?:\/\//i.test(message.url)) throw new Error("spatial.invalidUrl");
        await db.registerFileURL(message.name, message.url, duckdb.DuckDBDataProtocol.HTTP, false);
      } else if (message.type === "query") {
        const statement = await connection.prepare(message.sql!);
        const result = await statement.query(...(message.params ?? []));
        await statement.close();
        send({ id: message.id, type: "result", rows: result.toArray().map((row) => serializable(row.toJSON())) });
        return;
      } else if (message.type === "dispose") {
        await connection.close(); await db.terminate(); db = null; connection = null;
      }
    }
    send({ id: message.id, type: "ok" });
  } catch (error) {
    send({ id: message.id, type: "error", message: error instanceof Error ? error.message : "spatial.operationFailed" });
  }
};

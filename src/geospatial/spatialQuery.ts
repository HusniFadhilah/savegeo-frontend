import type { ColumnInfo, SpatialQueryService, TableInfo } from "./types";
import { clearGeospatialCache } from "./cache";
import { validateIdentifier, validateSpatialQuery } from "./queryValidation";

type WorkerEvent = { id: string; type: "ok" | "result" | "error"; rows?: unknown[]; message?: string };
let singleton: BrowserSpatialQueryService | null = null;

class BrowserSpatialQueryService implements SpatialQueryService {
  private worker: Worker | null = null;
  private readonly pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

  private request<T>(type: string, payload: Record<string, unknown> = {}): Promise<T> {
    if (!this.worker) return Promise.reject(new Error("spatial.notInitialized"));
    const id = crypto.randomUUID();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      this.worker!.postMessage({ id, type, ...payload });
    });
  }

  async initialize(): Promise<void> {
    if (this.worker) return;
    if (typeof Worker === "undefined" || typeof WebAssembly === "undefined") throw new Error("spatial.wasmUnsupported");
    this.worker = new Worker(new URL("./workers/spatialQueryWorker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<WorkerEvent>) => {
      const pending = this.pending.get(event.data.id);
      if (!pending) return;
      this.pending.delete(event.data.id);
      if (event.data.type === "error") pending.reject(new Error(event.data.message ?? "spatial.operationFailed"));
      else pending.resolve(event.data.rows ?? undefined);
    };
    this.worker.onerror = () => { for (const pending of this.pending.values()) pending.reject(new Error("spatial.workerFailed")); this.pending.clear(); };
    try { await this.request<void>("initialize"); } catch (error) { this.worker.terminate(); this.worker = null; throw error; }
  }

  async registerFile(file: File, name = file.name): Promise<void> { await this.request("register-file", { file, name }); }
  async registerUrl(url: string, name: string): Promise<void> { await this.request("register-url", { url, name }); }
  async listTables(): Promise<TableInfo[]> { return this.query<TableInfo>("SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'main'"); }
  async describeTable(table: string): Promise<ColumnInfo[]> { return this.query<ColumnInfo>(`SELECT column_name AS name, data_type AS type, is_nullable = 'YES' AS nullable FROM information_schema.columns WHERE table_name = ? ORDER BY ordinal_position`, [table]); }
  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> { return this.request<T[]>("query", { sql: validateSpatialQuery(sql), params }); }
  async cancel(_queryId: string): Promise<void> { /* DuckDB-WASM has no portable interrupt API; worker termination is the safe boundary. */ }
  async clearCache(): Promise<void> { await clearGeospatialCache(); }
  async dispose(): Promise<void> { if (this.worker) { await this.request("dispose").catch(() => undefined); this.worker.terminate(); this.worker = null; } }
}

export function getSpatialQueryService(): SpatialQueryService {
  return singleton ??= new BrowserSpatialQueryService();
}

export { validateIdentifier };


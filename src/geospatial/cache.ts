const DB_NAME = "savegeo-geospatial";
const STORE = "entries";
const VERSION = 1;
const memory = new Map<string, unknown>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("cache.unavailable"));
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("cache.unavailable"));
  });
}

export async function cacheKey(datasetId: string, datasetVersion = "latest", queryHash = "", applicationVersion = "1"): Promise<string> {
  const input = `${datasetId}|${datasetVersion}|${queryHash}|${applicationVersion}`;
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return `savegeo:${Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function getCached<T>(key: string): Promise<T | undefined> {
  if (memory.has(key)) return memory.get(key) as T;
  try {
    const db = await openDb();
    return await new Promise<T | undefined>((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    });
  } catch { return undefined; }
}

export async function setCached<T>(key: string, value: T): Promise<void> {
  memory.set(key, value);
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch { /* memory cache remains a safe fallback */ }
}

export async function clearGeospatialCache(): Promise<void> {
  memory.clear();
  if (typeof indexedDB === "undefined") return;
  try { const db = await openDb(); await new Promise<void>((resolve, reject) => { const request = db.transaction(STORE, "readwrite").objectStore(STORE).clear(); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); }); } catch { /* best effort */ }
}


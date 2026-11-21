import type { FieldCaptureDraft } from "./api";

interface QueuedCapture extends FieldCaptureDraft {
  project_id: string;
  principal_key: string;
}

const DB_NAME = "savegeo-dmrv-field-capture-v1";
const STORE = "pending";

function openQueue(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) {
      reject(new Error("Penyimpanan offline tidak tersedia di peramban ini."));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "capture_id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Antrean offline gagal dibuka."));
  });
}

export async function saveQueuedCapture(projectId: string, principalKey: string, draft: FieldCaptureDraft): Promise<void> {
  const db = await openQueue();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ ...draft, project_id: projectId, principal_key: principalKey } satisfies QueuedCapture);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Catatan gagal disimpan di perangkat."));
    tx.onabort = () => reject(tx.error || new Error("Penyimpanan catatan dibatalkan."));
  });
  db.close();
}

export async function listQueuedCaptures(projectId: string, principalKey: string): Promise<FieldCaptureDraft[]> {
  const db = await openQueue();
  const rows = await new Promise<QueuedCapture[]>((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as QueuedCapture[]);
    request.onerror = () => reject(request.error || new Error("Antrean offline gagal dibaca."));
  });
  db.close();
  return rows.filter((row) => row.project_id === projectId && row.principal_key === principalKey)
    .map(({ project_id: _project, principal_key: _principal, ...draft }) => draft);
}

export async function removeQueuedCapture(captureId: string): Promise<void> {
  const db = await openQueue();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(captureId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Catatan tersinkron tetapi antrean lokal belum dibersihkan."));
  });
  db.close();
}

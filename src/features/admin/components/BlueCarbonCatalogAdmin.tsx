import { useEffect, useState, type FormEvent } from "react";
import { useAdmin } from "../AdminContext";
import { getConfig, saveConfig } from "../api";
import { useAuthStore } from "@/hooks/useAuthStore";
import { hasAdminPermission } from "@/auth/access";

const CONFIG_KEY = "carbon.bluecarbon_profiles";
const POOLS = [
  ["agb", "AGB"],
  ["bgb", "BGB"],
  ["soc", "SOC sedimen"],
  ["litter", "Serasah"],
  ["deadwood", "Kayu mati"],
] as const;

type BlueCarbonRecord = {
  id: string;
  name: string;
  habitat: string;
  data_kind: string;
  region: string;
  period: string;
  resolution_m: number | null;
  source_name: string;
  source_url: string;
  citation: string;
  notes: string;
  status: "draft" | "published";
  values: Partial<Record<(typeof POOLS)[number][0], number | null>>;
  updated_at: string;
};

const emptyRecord = (): BlueCarbonRecord => ({
  id: "",
  name: "",
  habitat: "Mangrove",
  data_kind: "dataset",
  region: "",
  period: "",
  resolution_m: null,
  source_name: "",
  source_url: "",
  citation: "",
  notes: "",
  status: "draft",
  values: {},
  updated_at: "",
});

function parseRecords(raw?: string | null): BlueCarbonRecord[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is BlueCarbonRecord => Boolean(item && typeof item === "object" && "id" in item)) : [];
  } catch {
    return [];
  }
}

export default function BlueCarbonCatalogAdmin() {
  const { notify } = useAdmin();
  const user = useAuthStore((state) => state.user);
  const canWrite = hasAdminPermission(user, "config.write");
  const [records, setRecords] = useState<BlueCarbonRecord[]>([]);
  const [draft, setDraft] = useState<BlueCarbonRecord>(emptyRecord());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const { config } = await getConfig();
      const setting = Object.values(config).flat().find((item) => item.key === CONFIG_KEY);
      setRecords(parseRecords(setting?.raw_value));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Katalog blue carbon gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void reload(); }, []);

  const patch = (update: Partial<BlueCarbonRecord>) => setDraft((current) => ({ ...current, ...update }));
  const patchValue = (key: (typeof POOLS)[number][0], value: string) => {
    setDraft((current) => ({
      ...current,
      values: { ...current.values, [key]: value.trim() === "" ? null : Number(value) },
    }));
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    if (draft.source_url && !/^https:\/\//i.test(draft.source_url)) {
      setError("Tautan sumber harus menggunakan HTTPS.");
      return;
    }
    const next = {
      ...draft,
      id: draft.id || crypto.randomUUID(),
      resolution_m: draft.resolution_m == null ? null : Number(draft.resolution_m),
      updated_at: new Date().toISOString(),
    };
    const updated = [next, ...records.filter((record) => record.id !== next.id)];
    setSaving(true);
    setError(null);
    try {
      const response = await saveConfig([{ key: CONFIG_KEY, value: JSON.stringify(updated) }]);
      if (response.errors.length) throw new Error(response.errors.map((item) => item.error).join("; "));
      setRecords(updated);
      setDraft(emptyRecord());
      notify("Rekaman blue carbon berhasil disimpan.", "s");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Rekaman gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(recordId: string) {
    if (!canWrite) return;
    const updated = records.filter((record) => record.id !== recordId);
    setSaving(true);
    try {
      const response = await saveConfig([{ key: CONFIG_KEY, value: JSON.stringify(updated) }]);
      if (response.errors.length) throw new Error(response.errors.map((item) => item.error).join("; "));
      setRecords(updated);
      notify("Rekaman blue carbon dihapus.", "s");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Rekaman gagal dihapus.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-card bluecarbon-admin">
      <div className="admin-card-head">
        <div>
          <span className="calibration-eyebrow">DATA KARBON BIRU</span>
          <h2>Katalog Blue Carbon</h2>
          <p>Catat sumber, periode, habitat, dan nilai tiap pool. Hanya rekaman berstatus publik yang tampil pada halaman pengguna.</p>
        </div>
        <span className="stat-badge badge-blue">{records.length} rekaman</span>
      </div>
      {error && <div className="alert alert-warning py-2" role="alert">{error}</div>}
      {loading ? <div className="empty-state">Memuat katalog…</div> : (
        <>
          <div className="bluecarbon-admin__records">
            {records.map((record) => (
              <article className="bluecarbon-admin__record" key={record.id}>
                <div>
                  <strong>{record.name}</strong>
                  <span>{record.habitat} · {record.region || "Wilayah belum diisi"} · {record.period || "Periode belum diisi"}</span>
                  <small>{record.source_name || "Sumber belum diisi"} · {record.status === "published" ? "Dipublikasikan" : "Draf"}</small>
                </div>
                {canWrite && <div className="bluecarbon-admin__record-actions">
                  <button type="button" className="btn btn-sm btn-outline-secondary" disabled={saving} onClick={() => setDraft(record)} aria-label={`Edit ${record.name}`}><i className="bi bi-pencil" /></button>
                  <button type="button" className="btn btn-sm btn-outline-danger" disabled={saving} onClick={() => void remove(record.id)} aria-label={`Hapus ${record.name}`}><i className="bi bi-trash3" /></button>
                </div>}
              </article>
            ))}
            {!records.length && <div className="empty-state">Belum ada rekaman blue carbon. Tambahkan dataset atau hasil pengukuran lapangan untuk mulai mengisi katalog.</div>}
          </div>
          {canWrite ? (
            <form className="bluecarbon-admin__form" onSubmit={(event) => void submit(event)}>
              <div className="bluecarbon-admin__form-heading">
                <h3>{draft.id ? "Ubah rekaman" : "Tambah rekaman"}</h3>
                {draft.id && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setDraft(emptyRecord())}>Batal edit</button>}
              </div>
              <div className="bluecarbon-admin__fields">
                <label>Nama dataset / pengukuran<input required className="form-control" value={draft.name} onChange={(event) => patch({ name: event.target.value })} /></label>
                <label>Habitat<select className="form-select" value={draft.habitat} onChange={(event) => patch({ habitat: event.target.value })}><option>Mangrove</option><option>Lamun</option><option>Rawa asin</option><option>Ekosistem pesisir lainnya</option></select></label>
                <label>Jenis sumber<select className="form-select" value={draft.data_kind} onChange={(event) => patch({ data_kind: event.target.value })}><option value="dataset">Dataset geospasial</option><option value="field_observation">Pengukuran lapangan</option><option value="literature">Literatur / publikasi</option></select></label>
                <label>Wilayah / cakupan<input className="form-control" value={draft.region} onChange={(event) => patch({ region: event.target.value })} placeholder="Contoh: Teluk Bintuni, Papua Barat" /></label>
                <label>Periode data<input className="form-control" value={draft.period} onChange={(event) => patch({ period: event.target.value })} placeholder="Contoh: 2022–2024" /></label>
                <label>Resolusi sumber (m)<input type="number" min="0" step="any" className="form-control" value={draft.resolution_m ?? ""} onChange={(event) => patch({ resolution_m: event.target.value === "" ? null : Number(event.target.value) })} /></label>
                <label>Nama penyedia / sumber<input required className="form-control" value={draft.source_name} onChange={(event) => patch({ source_name: event.target.value })} /></label>
                <label>Tautan sumber HTTPS<input type="url" className="form-control" value={draft.source_url} onChange={(event) => patch({ source_url: event.target.value })} placeholder="https://…" /></label>
                <label>Status publik<select className="form-select" value={draft.status} onChange={(event) => patch({ status: event.target.value as BlueCarbonRecord["status"] })}><option value="draft">Draf · admin saja</option><option value="published">Publikasikan untuk pengguna</option></select></label>
              </div>
              <div className="bluecarbon-admin__pool-fields">
                {POOLS.map(([key, label]) => <label key={key}>{label} (Mg C/ha)<input type="number" min="0" step="any" className="form-control" value={draft.values[key] ?? ""} onChange={(event) => patchValue(key, event.target.value)} /></label>)}
              </div>
              <label className="bluecarbon-admin__wide">Sitasi / referensi<input className="form-control" value={draft.citation} onChange={(event) => patch({ citation: event.target.value })} placeholder="Penulis, tahun, DOI atau nomor laporan" /></label>
              <label className="bluecarbon-admin__wide">Catatan metode<textarea rows={3} className="form-control" value={draft.notes} onChange={(event) => patch({ notes: event.target.value })} /></label>
              <div className="bluecarbon-admin__note"><i className="bi bi-info-circle" /> Pastikan unit, kedalaman sedimen, batas habitat, metode, dan sitasi mengikuti sumber asli. Nilai yang diinput ditampilkan sebagai data sumber, bukan hasil validasi SaveGeo.</div>
              <div className="d-flex justify-content-end"><button type="submit" className="btn btn-success" disabled={saving}>{saving ? "Menyimpan…" : "Simpan rekaman"}</button></div>
            </form>
          ) : <div className="alert alert-info mt-3 mb-0">Akun ini hanya memiliki akses baca katalog. Hak <code>config.write</code> diperlukan untuk mengubah data.</div>}
        </>
      )}
    </section>
  );
}

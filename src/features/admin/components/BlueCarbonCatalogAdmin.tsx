import { useEffect, useState, type FormEvent } from "react";
import { useAdmin } from "../AdminContext";
import { getConfig, saveConfig } from "../api";
import { useAuthStore } from "@/hooks/useAuthStore";
import { hasAdminPermission } from "@/auth/access";
import InfoTip from "@/components/ui/InfoTip";
import { safeHttpUrl } from "@/utils/safeHttpUrl";

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

  const poolValueCount = (record: BlueCarbonRecord) => POOLS.filter(([key]) => record.values?.[key] != null).length;

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
    <section className="bluecarbon-admin" aria-labelledby="bluecarbon-admin-title">
      <div className="bluecarbon-admin__intro">
        <div className="bluecarbon-admin__intro-copy">
          <span className="bluecarbon-admin__eyebrow">DATA KARBON BIRU</span>
          <div className="bluecarbon-admin__title-row">
            <h2 id="bluecarbon-admin-title">Katalog Blue Carbon</h2>
            <InfoTip
              label="Tentang katalog Blue Carbon"
              content={<>Katalog ini menyimpan sumber data, periode, habitat, cakupan wilayah, dan nilai karbon biru per pool. Rekaman berstatus <strong>Dipublikasikan</strong> akan ditampilkan kepada pengguna; draf hanya terlihat oleh admin. Pastikan satuan, kedalaman sedimen, batas habitat, metode, dan sitasi mengikuti sumber aslinya. Nilai dicatat sebagai data sumber dan bukan validasi lapangan SaveGeo.</>}
            />
          </div>
        </div>
        <span className="bluecarbon-admin__count"><i className="bi bi-database" aria-hidden="true" /> {records.length} rekaman</span>
      </div>

      {error && <div className="alert alert-warning py-2" role="alert">{error}</div>}
      {loading ? <div className="bluecarbon-admin__loading" role="status"><span className="spinner-border spinner-border-sm" aria-hidden="true" /> Memuat katalog…</div> : (
        <div className="bluecarbon-admin__layout">
          {canWrite ? (
            <section className="bluecarbon-admin__card" aria-labelledby="bluecarbon-form-title">
              <header className="bluecarbon-admin__card-header">
                <div className="bluecarbon-admin__card-heading">
                  <span className="bluecarbon-admin__header-icon"><i className="bi bi-plus-lg" aria-hidden="true" /></span>
                  <h3 id="bluecarbon-form-title">{draft.id ? "Ubah rekaman" : "Tambah rekaman"}</h3>
                  <InfoTip
                    label="Panduan mengisi rekaman Blue Carbon"
                    content={<>Isi identitas dataset atau pengukuran, habitat, wilayah, periode, resolusi, penyedia, dan tautan HTTPS. Nilai pool menggunakan Mg C/ha sesuai sumber. Isi sitasi atau nomor laporan agar rekaman dapat ditelusuri. Status draf hanya tersedia di admin; pilih publikasi setelah metadata dan sumber diperiksa.</>}
                  />
                </div>
                {draft.id && <button type="button" className="btn btn-sm btn-light bluecarbon-admin__cancel" onClick={() => setDraft(emptyRecord())}><i className="bi bi-x-lg" aria-hidden="true" /> Batal edit</button>}
              </header>
              <form className="bluecarbon-admin__form" onSubmit={(event) => void submit(event)}>
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
                <div className="bluecarbon-admin__pool-section">
                  <div className="bluecarbon-admin__subheading"><h4>Nilai pool karbon</h4><span>Mg C/ha</span><InfoTip label="Tentang nilai pool karbon" content="Masukkan nilai berdasarkan dataset, publikasi, atau pengukuran yang dipilih. Biarkan kosong bila sumber tidak menyediakan pool tersebut; jangan mengisi nilai perkiraan sebagai data terukur." /></div>
                  <div className="bluecarbon-admin__pool-fields">
                    {POOLS.map(([key, label]) => <label key={key}>{label}<input type="number" min="0" step="any" className="form-control" value={draft.values[key] ?? ""} onChange={(event) => patchValue(key, event.target.value)} /></label>)}
                  </div>
                </div>
                <div className="bluecarbon-admin__fields bluecarbon-admin__fields--references">
                  <label className="bluecarbon-admin__wide">Sitasi / referensi<input className="form-control" value={draft.citation} onChange={(event) => patch({ citation: event.target.value })} placeholder="Penulis, tahun, DOI atau nomor laporan" /></label>
                  <label className="bluecarbon-admin__wide">Catatan metode<textarea rows={2} className="form-control" value={draft.notes} onChange={(event) => patch({ notes: event.target.value })} /></label>
                </div>
                <div className="bluecarbon-admin__form-actions">
                  <button type="submit" className="btn btn-success" disabled={saving}><i className={`bi ${saving ? "bi-arrow-repeat" : "bi-check2"}`} aria-hidden="true" /> {saving ? "Menyimpan…" : "Simpan rekaman"}</button>
                </div>
              </form>
            </section>
          ) : <div className="alert alert-info mb-0">Akun ini hanya memiliki akses baca katalog. Hak <code>config.write</code> diperlukan untuk mengubah data.</div>}

          <section className="bluecarbon-admin__card" aria-labelledby="bluecarbon-records-title">
            <header className="bluecarbon-admin__card-header">
              <div className="bluecarbon-admin__card-heading">
                <span className="bluecarbon-admin__header-icon"><i className="bi bi-collection" aria-hidden="true" /></span>
                <h3 id="bluecarbon-records-title">Daftar rekaman</h3>
                <InfoTip label="Tentang daftar rekaman" content="Daftar ini berisi metadata sumber dan nilai pool yang disimpan di katalog. Gunakan tombol pensil untuk memuat rekaman ke formulir, atau tombol hapus untuk mengeluarkannya dari katalog." />
              </div>
              <span className="bluecarbon-admin__header-count">{records.length}</span>
            </header>
            <div className="bluecarbon-admin__records">
              {!records.length ? (
                <div className="bluecarbon-admin__empty"><span><i className="bi bi-water" aria-hidden="true" /></span><strong>Belum ada rekaman</strong><small>Rekaman yang disimpan akan muncul di sini.</small></div>
              ) : records.map((record) => (
                <article className="bluecarbon-admin__record" key={record.id}>
                  <span className="bluecarbon-admin__record-icon"><i className="bi bi-tree" aria-hidden="true" /></span>
                  <div className="bluecarbon-admin__record-main">
                    <div className="bluecarbon-admin__record-title"><strong>{record.name}</strong><span className={`bluecarbon-admin__status ${record.status === "published" ? "is-published" : "is-draft"}`}>{record.status === "published" ? "Publik" : "Draf"}</span></div>
                    <div className="bluecarbon-admin__record-meta"><span>{record.habitat}</span><span>{record.region || "Wilayah belum diisi"}</span><span>{record.period || "Periode belum diisi"}</span></div>
                    <div className="bluecarbon-admin__record-footer">
                      <span><i className="bi bi-database" aria-hidden="true" /> {record.source_name || "Sumber belum diisi"}</span>
                      <span><i className="bi bi-layers" aria-hidden="true" /> {poolValueCount(record)} dari {POOLS.length} pool</span>
                      <InfoTip label={`Sumber dan sitasi ${record.name}`} content={<>{record.citation && <span>{record.citation}</span>}{record.notes && <p className="mb-0 mt-1">{record.notes}</p>}{safeHttpUrl(record.source_url) && <a href={safeHttpUrl(record.source_url)} target="_blank" rel="noopener noreferrer">Buka tautan sumber</a>}{!record.citation && !record.notes && !record.source_url && <span>Belum ada sitasi atau tautan tambahan.</span>}</>} />
                    </div>
                  </div>
                  {canWrite && <div className="bluecarbon-admin__record-actions">
                    <button type="button" className="bluecarbon-admin__icon-button" disabled={saving} onClick={() => setDraft(record)} aria-label={`Edit ${record.name}`} title="Edit rekaman"><i className="bi bi-pencil-square" /></button>
                    <button type="button" className="bluecarbon-admin__icon-button is-danger" disabled={saving} onClick={() => void remove(record.id)} aria-label={`Hapus ${record.name}`} title="Hapus rekaman"><i className="bi bi-trash3" /></button>
                  </div>}
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

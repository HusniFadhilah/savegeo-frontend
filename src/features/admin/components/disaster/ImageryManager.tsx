import { useState } from "react";
import { createDisasterImagery, setPrimaryImagery } from "../../api";
import type { ImageryPhase, SatelliteImagery } from "../../types";
import { useAdmin } from "../../AdminContext";

const SATELLITE_OPTIONS = ["Sentinel-1 SAR GRD", "Sentinel-2 Optical", "Landsat 8", "Landsat 9", "Other"];

interface Props {
  eventId: number;
  imagery: { pre: SatelliteImagery[]; post: SatelliteImagery[] };
  onChanged: () => void;
}

/** Pre/post imagery list + add form + "Set as Primary" per row, per spec §4. */
export default function ImageryManager({ eventId, imagery, onChanged }: Props) {
  const { notify } = useAdmin();
  const [phase, setPhase] = useState<ImageryPhase>("pre");
  const [busyId, setBusyId] = useState<number | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [satellite, setSatellite] = useState(SATELLITE_OPTIONS[0]);
  const [acquisitionDate, setAcquisitionDate] = useState("");
  const [sensor, setSensor] = useState("");
  const [resolutionM, setResolutionM] = useState("");
  const [cloudPct, setCloudPct] = useState("");
  const [dataSource, setDataSource] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const rows = phase === "pre" ? imagery.pre : imagery.post;

  const resetForm = () => {
    setSatellite(SATELLITE_OPTIONS[0]);
    setAcquisitionDate("");
    setSensor("");
    setResolutionM("");
    setCloudPct("");
    setDataSource("");
    setIsPrimary(false);
    setFormError(null);
  };

  const handleAdd = async () => {
    if (!acquisitionDate) {
      setFormError("Tanggal akuisisi diperlukan");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await createDisasterImagery(eventId, {
        phase,
        satellite,
        acquisition_date: acquisitionDate,
        sensor: sensor.trim() || undefined,
        resolution_m: resolutionM ? Number(resolutionM) : undefined,
        cloud_coverage_pct: cloudPct ? Number(cloudPct) : undefined,
        data_source: dataSource.trim() || undefined,
        is_primary: isPrimary,
      });
      notify("Citra satelit ditambahkan", "s");
      setFormOpen(false);
      resetForm();
      onChanged();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menambah citra";
      setFormError(msg);
      notify(msg, "e");
    } finally {
      setSaving(false);
    }
  };

  const handleSetPrimary = async (imageryId: number) => {
    setBusyId(imageryId);
    try {
      await setPrimaryImagery(eventId, imageryId);
      notify("Citra utama diperbarui", "s");
      onChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal mengubah citra utama", "e");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card">
      <div className="card-header-custom">
        <span>Citra Satelit</span>
        <button type="button" className="btn-sm primary" onClick={() => setFormOpen((o) => !o)}>
          <i className="bi bi-plus-lg" /> Tambah Citra
        </button>
      </div>
      <div className="card-body-custom">
        <div style={{ display: "flex", gap: 6, marginBottom: "0.75rem" }}>
          <button type="button" className={`btn-sm ${phase === "pre" ? "primary" : ""}`} onClick={() => setPhase("pre")}>
            Pra-bencana ({imagery.pre.length})
          </button>
          <button type="button" className={`btn-sm ${phase === "post" ? "primary" : ""}`} onClick={() => setPhase("post")}>
            Pasca-bencana ({imagery.post.length})
          </button>
        </div>

        <div className={`collapse-form ${formOpen ? "open" : ""}`}>
          <div className="three-col" style={{ marginBottom: "0.5rem" }}>
            <div className="form-field">
              <label className="form-label">Satelit *</label>
              <select className="form-select" value={satellite} onChange={(e) => setSatellite(e.target.value)}>
                {SATELLITE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Tanggal Akuisisi *</label>
              <input className="form-input" type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Sensor</label>
              <input className="form-input" placeholder="cth: MSI, C-SAR" value={sensor} onChange={(e) => setSensor(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Resolusi (m)</label>
              <input
                className="form-input"
                type="number"
                min="0"
                step="0.1"
                placeholder="10"
                value={resolutionM}
                onChange={(e) => setResolutionM(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Tutupan Awan (%)</label>
              <input
                className="form-input"
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="0"
                value={cloudPct}
                onChange={(e) => setCloudPct(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Sumber Data</label>
              <input
                className="form-input"
                placeholder="cth: Copernicus Hub"
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value)}
              />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "0.75rem" }}>
            <input type="checkbox" id="im-primary" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
            <label htmlFor="im-primary" style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Jadikan citra utama untuk fase {phase === "pre" ? "pra-bencana" : "pasca-bencana"} ini
            </label>
          </div>
          {formError && <div className="alert alert-danger py-1 px-2 small">{formError}</div>}
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="btn-sm primary" disabled={saving} onClick={handleAdd}>
              <i className="bi bi-save" /> {saving ? "Menyimpan..." : "Simpan"}
            </button>
            <button type="button" className="btn-sm" onClick={() => setFormOpen(false)}>
              Batal
            </button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="tbl tbl-wide">
            <colgroup>
              <col style={{ width: "20%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "12%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Satelit</th>
                <th>Tanggal</th>
                <th>Sensor</th>
                <th>Resolusi</th>
                <th>Awan</th>
                <th>Sumber</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    Belum ada citra {phase === "pre" ? "pra-bencana" : "pasca-bencana"}.
                  </td>
                </tr>
              )}
              {rows.map((img) => (
                <tr key={img.id}>
                  <td>
                    {img.satellite}
                    {img.is_primary && <span className="stat-badge badge-blue" style={{ marginLeft: 6 }}>Utama</span>}
                  </td>
                  <td>{img.acquisition_date}</td>
                  <td>{img.sensor || "—"}</td>
                  <td>{img.resolution_m != null ? `${img.resolution_m} m` : "—"}</td>
                  <td>{img.cloud_coverage_pct != null ? `${img.cloud_coverage_pct}%` : "—"}</td>
                  <td style={{ fontSize: 10 }}>{img.data_source || "—"}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-sm"
                      style={{ padding: "2px 6px", fontSize: 10 }}
                      disabled={img.is_primary || busyId === img.id}
                      onClick={() => handleSetPrimary(img.id)}
                    >
                      {img.is_primary ? "Utama" : "Jadikan Utama"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

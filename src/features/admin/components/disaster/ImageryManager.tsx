import { AdminTableNumberCell, AdminTableNumberHeader } from "@/features/admin/components/AdminTableNumber";
import { useState } from "react";
import { createDisasterImagery, setPrimaryImagery, uploadDisasterImageryGeoTiff } from "../../api";
import type { ImageryPhase, SatelliteImagery } from "../../types";
import { useAdmin } from "../../AdminContext";
import { useI18nStore } from "@/hooks/useI18nStore";

const SATELLITE_OPTIONS = ["Sentinel-1 SAR GRD", "Sentinel-2 Optical", "Landsat 8", "Landsat 9", "Other"];

interface Props {
  eventId: number;
  imagery: { pre: SatelliteImagery[]; post: SatelliteImagery[] };
  onChanged: () => void;
}

/** Pre/post imagery list + add form + "Set as Primary" per row, per spec §4. */
export default function ImageryManager({ eventId, imagery, onChanged }: Props) {
  const t = useI18nStore((state) => state.t);
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
  const [geoTiffFile, setGeoTiffFile] = useState<File | null>(null);
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
    setGeoTiffFile(null);
    setIsPrimary(false);
    setFormError(null);
  };

  const handleAdd = async () => {
    if (!acquisitionDate) {
      setFormError(t("admin.disaster.acquisitionRequired"));
      return;
    }
    if (geoTiffFile && !/\.(tif|tiff|zip)$/i.test(geoTiffFile.name)) {
      setFormError(t("admin.disaster.imageryFormat"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (geoTiffFile) {
        await uploadDisasterImageryGeoTiff(eventId, {
          file: geoTiffFile,
          phase,
          satellite,
          acquisition_date: acquisitionDate,
          sensor: sensor.trim() || undefined,
          resolution_m: resolutionM ? Number(resolutionM) : undefined,
          cloud_coverage_pct: cloudPct ? Number(cloudPct) : undefined,
          data_source: dataSource.trim() || geoTiffFile.name,
          is_primary: isPrimary,
        });
      } else {
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
      }
      notify(geoTiffFile ? t("admin.disaster.imageryUploaded") : t("admin.disaster.imageryAdded"), "s");
      setFormOpen(false);
      resetForm();
      onChanged();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("admin.disaster.addImageryFailed");
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
      notify(t("admin.disaster.primaryUpdated"), "s");
      onChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : t("admin.disaster.primaryUpdateFailed"), "e");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card">
      <div className="card-header-custom">
        <span>{t("admin.disaster.satellite")}</span>
        <button type="button" className="btn-sm primary" onClick={() => setFormOpen((o) => !o)}>
          <i className="bi bi-plus-lg" /> {t("admin.disaster.addImage")}
        </button>
      </div>
      <div className="card-body-custom">
        <div style={{ display: "flex", gap: 6, marginBottom: "0.75rem" }}>
          <button type="button" className={`btn-sm ${phase === "pre" ? "primary" : ""}`} onClick={() => setPhase("pre")}>
            {t("admin.disaster.preImageryLabel", { count: imagery.pre.length })}
          </button>
          <button type="button" className={`btn-sm ${phase === "post" ? "primary" : ""}`} onClick={() => setPhase("post")}>
            {t("admin.disaster.postImageryLabel", { count: imagery.post.length })}
          </button>
        </div>

        <div className={`collapse-form ${formOpen ? "open" : ""}`}>
          <div className="three-col" style={{ marginBottom: "0.5rem" }}>
            <div className="form-field">
              <label className="form-label">{t("admin.disaster.satelliteField")}</label>
              <select className="form-select" value={satellite} onChange={(e) => setSatellite(e.target.value)}>
                {SATELLITE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">{t("admin.disaster.acquisitionDate")}</label>
              <input className="form-input" type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">{t("admin.disaster.sensor")}</label>
              <input className="form-input" placeholder={t("admin.disaster.sensorPlaceholder")} value={sensor} onChange={(e) => setSensor(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">{t("admin.disaster.resolution")}</label>
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
              <label className="form-label">{t("admin.disaster.clouds")}</label>
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
              <label className="form-label">{t("admin.disaster.dataSource")}</label>
              <input
                className="form-input"
                placeholder={t("admin.disaster.sourceDataPlaceholder")}
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">{t("admin.disaster.uploadImagery")}</label>
              <input
                className="form-input"
                type="file"
                accept=".tif,.tiff,.zip"
                onChange={(e) => setGeoTiffFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          {geoTiffFile && (
            <div className="alert alert-info py-1 px-2 small">
              <i className="bi bi-file-earmark-richtext me-1" />
              {geoTiffFile.name} {t("admin.disaster.cogNotice")}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "0.75rem" }}>
            <input type="checkbox" id="im-primary" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
            <label htmlFor="im-primary" style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {t("admin.disaster.primaryForPhase", { phase: phase === "pre" ? t("admin.disaster.phasePre") : t("admin.disaster.phasePost") })}
            </label>
          </div>
          {formError && <div className="alert alert-danger py-1 px-2 small">{formError}</div>}
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="btn-sm primary" disabled={saving} onClick={handleAdd}>
            <i className="bi bi-save" /> {saving ? t("admin.disaster.saving") : t("admin.disaster.save")}
            </button>
            <button type="button" className="btn-sm" onClick={() => setFormOpen(false)}>
              {t("admin.disaster.cancel")}
            </button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="tbl tbl-wide">
            <colgroup>
              <col className="admin-table-number-col" />
              <col style={{ width: "calc(20% - 0.65rem)" }} />
              <col style={{ width: "calc(14% - 0.455rem)" }} />
              <col style={{ width: "calc(14% - 0.455rem)" }} />
              <col style={{ width: "calc(12% - 0.39rem)" }} />
              <col style={{ width: "calc(12% - 0.39rem)" }} />
              <col style={{ width: "calc(16% - 0.52rem)" }} />
              <col style={{ width: "calc(12% - 0.39rem)" }} />
            </colgroup>
            <thead>
              <tr>
                <AdminTableNumberHeader />
                  <th>{t("admin.disaster.satellite")}</th>
                <th>{t("admin.disaster.imageryDate")}</th>
                <th>{t("admin.disaster.sensor")}</th>
                <th>{t("admin.disaster.resolution")}</th>
                <th>{t("admin.disaster.cloudColumn")}</th>
                <th>{t("admin.disaster.imagerySource")}</th>
                <th>{t("admin.disaster.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    {t("admin.disaster.noImageryPhase", { phase: phase === "pre" ? t("admin.disaster.phasePre") : t("admin.disaster.phasePost") })}
                  </td>
                </tr>
              )}
              {rows.map((img, index) => (
                <tr key={img.id}>
                  <AdminTableNumberCell index={index} />
                  <td>
                    {img.satellite}
                    {img.is_primary && <span className="stat-badge badge-blue" style={{ marginLeft: 6 }}>{t("admin.disaster.primary")}</span>}
                    {img.source_kind === "local_upload" && (
                      <span className="stat-badge badge-green" style={{ marginLeft: 6 }}>{t("admin.disaster.geoTiff")}</span>
                    )}
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
                      {img.is_primary ? t("admin.disaster.primary") : t("admin.disaster.makePrimaryAction")}
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

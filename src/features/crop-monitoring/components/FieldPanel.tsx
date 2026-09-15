import { useEffect, useState } from "react";
import AoiPickerModal from "@/components/map/AoiPickerModal";
import AoiUploadTab from "@/features/carbon/components/AoiUploadTab";
import { boundsFromGeoJSON, areaKm2 } from "@/features/carbon/lib/geo";
import { useAoiStore } from "@/hooks/useAoiStore";
import { useFieldStore } from "@/hooks/useFieldStore";
import { useI18nStore } from "@/hooks/useI18nStore";
import { ApiError } from "@/services/apiClient";
import type { AoiState } from "@/features/carbon/types";
import type { AoiFeature } from "@/types/map";
import type { Commodity, Field } from "../types";

interface Props {
  commodities: Commodity[];
}

type TabKey = "draw" | "upload" | "existing";

/**
 * AOI draw/upload for a brand-new Field, or picking an already-saved one.
 * Drawing opens a wide modal map so the crop workflow sidebar stays compact.
 * Indonesia Admin/Coordinate/Company boundary tabs are out of scope for this
 * module (Fields are field-scale polygons, not administrative regions).
 */
export default function FieldPanel({ commodities }: Props) {
  const t = useI18nStore((state) => state.t);
  const aoi = useAoiStore((s) => s.aoi);
  const setAoi = useAoiStore((s) => s.setAoi);
  const { fields, selectedField, loading, loadFields, selectField, saveField, clearSelection } =
    useFieldStore();

  const [activeTab, setActiveTab] = useState<TabKey>("existing");
  const [aoiModalOpen, setAoiModalOpen] = useState(false);

  const [name, setName] = useState("");
  const [commodity, setCommodity] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    void loadFields();
  }, [loadFields]);

  useEffect(() => {
    if (!commodity && commodities.length) setCommodity(commodities[0].key);
  }, [commodities, commodity]);

  function handleDrawChange(feature: AoiFeature | null) {
    if (selectedField) clearSelection();
    if (!feature) {
      setAoi(null);
      return;
    }
    const bounds = boundsFromGeoJSON(feature);
    const area = areaKm2(feature, bounds);
    setAoi({ source: "drawn", name: "Poligon Baru", areaKm2: area, feature, bounds });
  }

  function handleUploadApply(feature: AoiFeature, fileName: string) {
    if (selectedField) clearSelection();
    const bounds = boundsFromGeoJSON(feature);
    const area = areaKm2(feature, bounds);
    setAoi({ source: "upload", name: fileName, areaKm2: area, feature, bounds });
  }

  function handleModalAoiChange(nextAoi: AoiState | null) {
    if (selectedField) clearSelection();
    if (nextAoi && !name.trim()) setName(nextAoi.name);
    setSaveError(null);
    setAoi(nextAoi);
  }

  async function handleSaveField() {
    if (!aoi?.feature) {
      setSaveError(t("crop.field.drawOrUpload"));
      return;
    }
    if (!name.trim()) {
      setSaveError(t("crop.field.nameRequired"));
      return;
    }
    if (!commodity) {
      setSaveError(t("crop.field.commodityRequired"));
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const field = await saveField({
        name: name.trim(),
        geojson: aoi.feature.geometry,
        commodity,
      });
      setName("");
      setActiveTab("existing");
      // Reflect the persisted field's own geometry/area back onto the AOI store.
      if (field.geojson) {
        setAoi({
          source: "drawn",
          name: field.name,
          areaKm2: field.area_ha / 100,
          feature: { type: "Feature", properties: {}, geometry: field.geojson },
          bounds: aoi.bounds,
        });
      }
    } catch (err) {
      setSaveError(err instanceof ApiError ? (err.payload as { detail?: string })?.detail ?? err.message : t("crop.field.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSelectExisting(field: Field) {
    await selectField(field.id);
  }

  return (
    <div className="card mb-3">
      <div className="card-header">
        <i className="bi bi-geo-alt-fill me-1" /> {t("crop.field.title")}
      </div>
      <div className="card-body">
        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button type="button" className={`nav-link ${activeTab === "existing" ? "active" : ""}`} onClick={() => setActiveTab("existing")}>
              <i className="bi bi-list-ul me-1" /> {t("crop.field.saved")}
            </button>
          </li>
          <li className="nav-item">
            <button type="button" className={`nav-link ${activeTab === "draw" ? "active" : ""}`} onClick={() => setActiveTab("draw")}>
              <i className="bi bi-vector-pen me-1" /> {t("crop.field.drawNew")}
            </button>
          </li>
          <li className="nav-item">
            <button type="button" className={`nav-link ${activeTab === "upload" ? "active" : ""}`} onClick={() => setActiveTab("upload")}>
              <i className="bi bi-upload me-1" /> {t("crop.field.upload")}
            </button>
          </li>
        </ul>

        {activeTab === "existing" && (
          <div className="mb-3">
            {loading && <div className="text-muted small">{t("crop.field.loading")}</div>}
            {!loading && fields.length === 0 && (
              <div className="alert alert-secondary py-2 small mb-0">
                {t("crop.field.empty")}
              </div>
            )}
            {fields.length > 0 && (
              <div className="list-group" style={{ maxHeight: 260, overflowY: "auto" }}>
                {fields.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`list-group-item list-group-item-action ${selectedField?.id === f.id ? "active" : ""}`}
                    onClick={() => void handleSelectExisting(f)}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <strong>{f.name}</strong>
                      <span className="badge bg-secondary">{f.commodity}</span>
                    </div>
                    <small className={selectedField?.id === f.id ? "" : "text-muted"}>
                      {f.area_ha.toFixed(2)} ha
                      {f.season_label ? ` · ${f.season_label}` : ""}
                    </small>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "upload" && (
          <div className="mb-3">
            <AoiUploadTab onApply={handleUploadApply} />
          </div>
        )}

        {activeTab === "draw" && (
          <button type="button" className="btn btn-outline-success w-100 mb-3" onClick={() => setAoiModalOpen(true)}>
            <i className="bi bi-vector-pen me-1" /> {t("crop.field.openAoiMap")}
          </button>
        )}

        {aoi && (
          <div className="alert alert-success mt-3 mb-0 py-2">
            <i className="bi bi-check-circle-fill me-1" />
            AOI: <strong>{aoi.name}</strong>
            {aoi.areaKm2 != null && <> &middot; {(aoi.areaKm2 * 100).toFixed(2)} ha</>}
          </div>
        )}

        {aoi && !selectedField && (
          <div className="mt-3 pt-3 border-top">
            <label className="form-label">{t("crop.field.saveNew")}</label>
            <input
              type="text"
              className="form-control form-control-sm mb-2"
              placeholder="Nama lahan (mis. Sawah Blok A)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select
              className="form-select form-select-sm mb-2"
              value={commodity}
              onChange={(e) => setCommodity(e.target.value)}
            >
              {commodities.length === 0 && <option value="">{t("crop.field.loadingCommodity")}</option>}
              {commodities.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-primary btn-sm w-100" onClick={handleSaveField} disabled={saving}>
              {saving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" /> {t("crop.field.saving")}
                </>
              ) : (
                <>
                  <i className="bi bi-save-fill me-1" /> {t("crop.field.saveButton")}
                </>
              )}
            </button>
            {saveError && <div className="alert alert-danger py-1 px-2 mt-2 small mb-0">{saveError}</div>}
          </div>
        )}

        {selectedField && (
          <div className="mt-3 pt-3 border-top d-flex justify-content-between align-items-center">
            <div>
              <i className="bi bi-check2-square me-1 text-success" />
              Lahan aktif: <strong>{selectedField.name}</strong>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => {
                clearSelection();
                setAoi(null);
              }}
            >
              Ganti
            </button>
          </div>
        )}
      </div>

      <AoiPickerModal
        open={aoiModalOpen}
        id="cropFieldAoiModalMap"
        title="Gambar Batas Lahan"
        description="Pilih wilayah, koordinat, gambar polygon/rectangle, unggah file, atau gunakan batas perusahaan."
        aoi={aoi}
        onAoiChange={handleModalAoiChange}
        onClose={() => setAoiModalOpen(false)}
      />
    </div>
  );
}

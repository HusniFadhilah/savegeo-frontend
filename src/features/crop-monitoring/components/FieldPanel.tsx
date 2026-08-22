import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import AoiDrawingTools, { SyncAoiToGroup } from "@/components/map/AoiDrawingTools";
import AoiUploadTab from "@/features/carbon/components/AoiUploadTab";
import { boundsFromGeoJSON, areaKm2 } from "@/features/carbon/lib/geo";
import { useAoiStore } from "@/hooks/useAoiStore";
import { useFieldStore } from "@/hooks/useFieldStore";
import { ApiError } from "@/services/apiClient";
import type { AoiFeature } from "@/types/map";
import type { Commodity, Field } from "../types";

interface Props {
  commodities: Commodity[];
}

type TabKey = "draw" | "upload" | "existing";

/**
 * AOI draw/upload for a brand-new Field, or picking an already-saved one.
 * Embeds its own <MapView> + AoiDrawingTools (own FeatureGroup ref), same
 * pattern as features/carbon/components/AoiPanel.tsx, but only 2 AOI input
 * tabs (draw/upload) - Indonesia Admin/Coordinate/Company boundary tabs are
 * out of scope for this module (Fields are field-scale polygons, not
 * administrative regions).
 */
export default function FieldPanel({ commodities }: Props) {
  const aoi = useAoiStore((s) => s.aoi);
  const setAoi = useAoiStore((s) => s.setAoi);
  const { fields, selectedField, loading, loadFields, selectField, saveField, clearSelection } =
    useFieldStore();

  const [activeTab, setActiveTab] = useState<TabKey>("existing");
  const groupRef = useRef<L.FeatureGroup | null>(null);

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

  async function handleSaveField() {
    if (!aoi?.feature) {
      setSaveError("Gambar atau unggah batas lahan terlebih dahulu.");
      return;
    }
    if (!name.trim()) {
      setSaveError("Isi nama lahan.");
      return;
    }
    if (!commodity) {
      setSaveError("Pilih komoditas.");
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
      setSaveError(err instanceof ApiError ? (err.payload as { detail?: string })?.detail ?? err.message : "Gagal menyimpan lahan.");
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
        <i className="bi bi-geo-alt-fill me-1" /> Lahan (Field)
      </div>
      <div className="card-body">
        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button type="button" className={`nav-link ${activeTab === "existing" ? "active" : ""}`} onClick={() => setActiveTab("existing")}>
              <i className="bi bi-list-ul me-1" /> Lahan Tersimpan
            </button>
          </li>
          <li className="nav-item">
            <button type="button" className={`nav-link ${activeTab === "draw" ? "active" : ""}`} onClick={() => setActiveTab("draw")}>
              <i className="bi bi-vector-pen me-1" /> Gambar Baru
            </button>
          </li>
          <li className="nav-item">
            <button type="button" className={`nav-link ${activeTab === "upload" ? "active" : ""}`} onClick={() => setActiveTab("upload")}>
              <i className="bi bi-upload me-1" /> Unggah File
            </button>
          </li>
        </ul>

        {activeTab === "existing" && (
          <div className="mb-3">
            {loading && <div className="text-muted small">Memuat daftar lahan...</div>}
            {!loading && fields.length === 0 && (
              <div className="alert alert-secondary py-2 small mb-0">
                Belum ada lahan tersimpan. Gambar atau unggah batas lahan di tab lain, lalu simpan.
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
          <div className="alert alert-info py-2 small mb-3">
            <i className="bi bi-info-circle me-1" />
            Gambar polygon/rectangle batas lahan langsung di peta di bawah.
          </div>
        )}

        {/* Map stays mounted regardless of active tab (matches AoiPanel.tsx's
            pattern) - only the tab switches which input form shows above it.
            Keeping it tab-gated meant picking an existing Field (the default
            "existing" tab) set the AOI in the store correctly but showed no
            map anywhere to reflect it - looked like the AOI silently failed
            to load. */}
        <MapView id="cropFieldMap">
          <BasemapSwitcher />
          <AoiDrawingTools onChange={handleDrawChange} externalGroupRef={groupRef} />
          <SyncAoiToGroup aoi={aoi?.feature ?? null} groupRef={groupRef} />
        </MapView>

        {aoi && (
          <div className="alert alert-success mt-3 mb-0 py-2">
            <i className="bi bi-check-circle-fill me-1" />
            AOI: <strong>{aoi.name}</strong>
            {aoi.areaKm2 != null && <> &middot; {(aoi.areaKm2 * 100).toFixed(2)} ha</>}
          </div>
        )}

        {aoi && !selectedField && (
          <div className="mt-3 pt-3 border-top">
            <label className="form-label">Simpan sebagai Lahan Baru</label>
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
              {commodities.length === 0 && <option value="">Memuat komoditas...</option>}
              {commodities.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-primary btn-sm w-100" onClick={handleSaveField} disabled={saving}>
              {saving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" /> Menyimpan...
                </>
              ) : (
                <>
                  <i className="bi bi-save-fill me-1" /> Simpan sebagai Lahan
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
    </div>
  );
}

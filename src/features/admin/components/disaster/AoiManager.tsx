import { useRef, useState } from "react";
import type { Map as LeafletMap, FeatureGroup } from "leaflet";
import MapView from "@/components/map/MapView";
import AoiDrawingTools, { setAoiOnMap } from "@/components/map/AoiDrawingTools";
import type { AoiFeature } from "@/types/map";
import { createDisasterAoi } from "../../api";
import type { DisasterAoi } from "../../types";
import { useAdmin } from "../../AdminContext";

/** Best-effort Feature/Polygon/MultiPolygon/FeatureCollection -> single Feature
 * conversion for an uploaded GeoJSON file. Only takes the first feature of a
 * FeatureCollection - matches this manager's "one AOI shape at a time" model
 * (same constraint AoiDrawingTools already enforces for hand-drawn shapes). */
function toAoiFeature(parsed: unknown): AoiFeature | null {
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as { type?: string; features?: unknown[]; geometry?: unknown };
  if (obj.type === "FeatureCollection" && Array.isArray(obj.features) && obj.features.length) {
    return toAoiFeature(obj.features[0]);
  }
  if (obj.type === "Feature" && obj.geometry) {
    return parsed as AoiFeature;
  }
  if (obj.type === "Polygon" || obj.type === "MultiPolygon") {
    return { type: "Feature", geometry: parsed as GeoJSON.Polygon | GeoJSON.MultiPolygon, properties: {} };
  }
  return null;
}

interface Props {
  eventId: number;
  aoi: DisasterAoi | null;
  onSaved: (aoi: DisasterAoi) => void;
}

/**
 * Draw (via the shared AoiDrawingTools) or upload a GeoJSON file, then POST
 * to `/admin/disasters/{id}/aoi`. area_ha/centroid/bbox shown below the map
 * come straight back from that save response (backend computes them via
 * geo_utils, never client-side).
 */
export default function AoiManager({ eventId, aoi, onSaved }: Props) {
  const { notify } = useAdmin();
  const mapRef = useRef<LeafletMap | null>(null);
  const groupRef = useRef<FeatureGroup | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [feature, setFeature] = useState<AoiFeature | null>(null);
  const [source, setSource] = useState<"draw" | "upload_geojson">("draw");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrawChange = (f: AoiFeature | null) => {
    setFeature(f);
    setSource("draw");
  };

  const handleFile = async (f: File | null) => {
    if (!f) return;
    try {
      const text = await f.text();
      const parsed = JSON.parse(text);
      const feat = toAoiFeature(parsed);
      if (!feat) {
        setError("File GeoJSON tidak valid (harus Feature/Polygon/MultiPolygon)");
        return;
      }
      setError(null);
      setFeature(feat);
      setSource("upload_geojson");
      if (mapRef.current && groupRef.current) {
        setAoiOnMap(mapRef.current, groupRef.current, feat);
      }
    } catch {
      setError("Gagal membaca file GeoJSON");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!feature) {
      setError("Gambar AOI di peta atau unggah file GeoJSON terlebih dahulu");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await createDisasterAoi(eventId, {
        geojson: feature as unknown as Record<string, unknown>,
        source,
      });
      notify("AOI tersimpan", "s");
      onSaved(saved);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan AOI";
      setError(msg);
      notify(msg, "e");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header-custom">
        <span>Area of Interest (AOI)</span>
      </div>
      <div className="card-body-custom">
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="btn-sm" onClick={() => fileInputRef.current?.click()}>
            <i className="bi bi-upload" /> Unggah GeoJSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".geojson,.json"
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          <button type="button" className="btn-sm primary" disabled={saving || !feature} onClick={handleSave}>
            <i className="bi bi-save" /> {saving ? "Menyimpan..." : "Simpan AOI"}
          </button>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Gunakan alat gambar di peta (kiri atas) atau unggah file .geojson/.json
          </span>
        </div>
        {error && <div className="alert alert-danger py-1 px-2 small">{error}</div>}

        <div style={{ marginBottom: 8 }}>
          <MapView
            id="disaster-aoi-map"
            onMapReady={(m) => {
              mapRef.current = m;
            }}
          >
            <AoiDrawingTools onChange={handleDrawChange} externalGroupRef={groupRef} />
          </MapView>
        </div>

        {aoi && (
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-val">
                {aoi.area_ha != null ? aoi.area_ha.toLocaleString("id-ID", { maximumFractionDigits: 2 }) : "—"}
              </div>
              <div className="stat-label">Luas (ha)</div>
            </div>
            <div className="stat-card">
              <div className="stat-val" style={{ fontSize: 13 }}>
                {aoi.centroid ? `${aoi.centroid.lat.toFixed(4)}, ${aoi.centroid.lng.toFixed(4)}` : "—"}
              </div>
              <div className="stat-label">Centroid</div>
            </div>
            <div className="stat-card">
              <div className="stat-val" style={{ fontSize: 11 }}>
                {aoi.bbox ? aoi.bbox.map((n) => n.toFixed(2)).join(", ") : "—"}
              </div>
              <div className="stat-label">Bbox</div>
            </div>
            <div className="stat-card">
              <div className="stat-val" style={{ fontSize: 13 }}>
                {aoi.source}
              </div>
              <div className="stat-label">Sumber</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useCallback, useRef, useState } from "react";
import type { Map as LeafletMap, FeatureGroup } from "leaflet";
import MapView from "@/components/map/MapView";
import AoiDrawingTools, { setAoiOnMap } from "@/components/map/AoiDrawingTools";
import type { AoiFeature } from "@/types/map";
import { createDisasterAoi } from "../../api";
import type { DisasterAoi } from "../../types";
import { useAdmin } from "../../AdminContext";

const ALLOWED_AOI_EXTENSIONS = [".geojson", ".json", ".kml", ".gpx", ".zip"];
const MAX_AOI_FILE_BYTES = 50 * 1024 * 1024;

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
}

function toAoiFeature(parsed: unknown): AoiFeature | null {
  if (!parsed || typeof parsed !== "object") return null;
  const gj = parsed as GeoJSON.GeoJSON;
  const geometries: (GeoJSON.Polygon | GeoJSON.MultiPolygon)[] = [];

  const collect = (geometry: GeoJSON.Geometry | null | undefined) => {
    if (!geometry) return;
    if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") geometries.push(geometry);
    if (geometry.type === "GeometryCollection") geometry.geometries.forEach(collect);
  };

  if (gj.type === "FeatureCollection") {
    gj.features.forEach((feature) => collect(feature.geometry));
  } else if (gj.type === "Feature") {
    collect(gj.geometry);
  } else {
    collect(gj as GeoJSON.Geometry);
  }

  const coordinates: GeoJSON.Position[][][] = [];
  for (const geometry of geometries) {
    if (geometry.type === "Polygon") coordinates.push(geometry.coordinates);
    else coordinates.push(...geometry.coordinates);
  }
  if (!coordinates.length) return null;
  if (coordinates.length === 1) {
    return { type: "Feature", geometry: { type: "Polygon", coordinates: coordinates[0] }, properties: {} };
  }
  return { type: "Feature", geometry: { type: "MultiPolygon", coordinates }, properties: {} };
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
  const [source, setSource] = useState<"draw" | "upload_geojson" | "upload_shp" | "upload_kml">("draw");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrawChange = (f: AoiFeature | null) => {
    setFeature(f);
    setSource("draw");
  };

  const handleFile = useCallback(async (f: File | null) => {
    if (!f) return;
    const ext = getExtension(f.name);
    if (!ALLOWED_AOI_EXTENSIONS.includes(ext)) {
      setError(`Format AOI tidak didukung. Gunakan ${ALLOWED_AOI_EXTENSIONS.join(", ")}`);
      return;
    }
    if (f.size > MAX_AOI_FILE_BYTES) {
      setError("File AOI terlalu besar (maks 50 MB)");
      return;
    }
    try {
      let parsed: unknown;
      if (ext === ".geojson" || ext === ".json") {
        const text = await f.text();
        parsed = JSON.parse(text);
      } else if (ext === ".kml" || ext === ".gpx") {
        const text = await f.text();
        const dom = new DOMParser().parseFromString(text, "text/xml");
        const togeojson = await import("@tmcw/togeojson");
        parsed = ext === ".kml" ? togeojson.kml(dom) : togeojson.gpx(dom);
      } else {
        const shpModule = await import("shpjs");
        const result = await shpModule.default(await f.arrayBuffer());
        parsed = Array.isArray(result) ? result[0] : result;
      }
      const feat = toAoiFeature(parsed);
      if (!feat) {
        setError("File AOI tidak memiliki Polygon/MultiPolygon yang valid");
        return;
      }
      setError(null);
      setFeature(feat);
      setSource(ext === ".zip" ? "upload_shp" : ext === ".kml" || ext === ".gpx" ? "upload_kml" : "upload_geojson");
      if (mapRef.current && groupRef.current) {
        setAoiOnMap(mapRef.current, groupRef.current, feat);
      }
    } catch (err) {
      setError(`Gagal membaca file AOI: ${err instanceof Error ? err.message : "format tidak valid"}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

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
            <i className="bi bi-upload" /> Unggah AOI
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_AOI_EXTENSIONS.join(",")}
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          <button type="button" className="btn-sm primary" disabled={saving || !feature} onClick={handleSave}>
            <i className="bi bi-save" /> {saving ? "Menyimpan..." : "Simpan AOI"}
          </button>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Gambar di peta, atau unggah .geojson/.json/.kml/.gpx/.zip shapefile
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

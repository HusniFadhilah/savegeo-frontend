import { useCallback, useRef, useState } from "react";
import type { AoiFeature } from "@/types/map";

interface Props {
  onApply: (feature: AoiFeature, name: string) => void;
}

const ALLOWED_EXTENSIONS = [".geojson", ".json", ".kml", ".gpx", ".zip"];
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
}

/** First geometry-bearing feature from a Feature/FeatureCollection/bare geometry. */
function normalizeToFeature(parsed: unknown): AoiFeature | null {
  const gj = parsed as GeoJSON.GeoJSON;
  if (!gj || typeof gj !== "object") return null;
  if (gj.type === "FeatureCollection") {
    const withGeom = gj.features.find((f) => f.geometry);
    if (!withGeom) return null;
    return { type: "Feature", geometry: withGeom.geometry as AoiFeature["geometry"], properties: withGeom.properties ?? {} };
  }
  if (gj.type === "Feature") {
    if (!gj.geometry) return null;
    return { type: "Feature", geometry: gj.geometry as AoiFeature["geometry"], properties: gj.properties ?? {} };
  }
  // Bare geometry object
  if ("type" in gj && "coordinates" in gj) {
    return { type: "Feature", geometry: gj as unknown as AoiFeature["geometry"], properties: {} };
  }
  return null;
}

/**
 * Ported from module-carbon.html's #aoiUpload tab + main.js
 * handleAOIFileChange/handleAOIFileDrop/processAOIFile(): drag-and-drop or
 * browse for .geojson/.json/.kml/.gpx/.zip (shapefile), parsed fully
 * client-side. Extension whitelist + size cap enforced before any parsing.
 */
export default function AoiUploadTab({ onApply }: Props) {
  const [status, setStatus] = useState<{ type: "info" | "success" | "danger"; text: string } | null>(
    null,
  );
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      const ext = getExtension(file.name);
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setStatus({
          type: "danger",
          text: `Format tidak didukung. Gunakan ${ALLOWED_EXTENSIONS.join(", ")}.`,
        });
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setStatus({ type: "danger", text: "Ukuran file melebihi batas 20MB." });
        return;
      }

      setStatus({ type: "info", text: "Memproses file..." });

      try {
        let parsed: unknown;

        if (ext === ".geojson" || ext === ".json") {
          const text = await file.text();
          try {
            parsed = JSON.parse(text);
          } catch {
            throw new Error("File bukan JSON yang valid.");
          }
        } else if (ext === ".kml" || ext === ".gpx") {
          const text = await file.text();
          const dom = new DOMParser().parseFromString(text, "text/xml");
          const togeojson = await import("@tmcw/togeojson");
          parsed = ext === ".kml" ? togeojson.kml(dom) : togeojson.gpx(dom);
        } else if (ext === ".zip") {
          const shpModule = await import("shpjs");
          const buffer = await file.arrayBuffer();
          const result = await shpModule.default(buffer);
          parsed = Array.isArray(result) ? result[0] : result;
        }

        const feature = normalizeToFeature(parsed);
        if (!feature) {
          throw new Error("File tidak berisi geometri yang valid.");
        }

        onApply(feature, file.name);
        setStatus({ type: "success", text: `File "${file.name}" berhasil dimuat sebagai AOI.` });
      } catch (err) {
        setStatus({
          type: "danger",
          text: `Gagal memuat file: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
      }
    },
    [onApply],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void processFile(file);
    },
    [processFile],
  );

  return (
    <div>
      <label className="form-label fw-semibold">Unggah file batas AOI</label>
      <div
        className="border border-2 rounded p-4 text-center"
        style={{
          cursor: "pointer",
          borderStyle: "dashed",
          borderColor: dragOver ? "#0d6efd" : "#adb5bd",
          minHeight: 110,
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <i className="bi bi-cloud-arrow-up-fill fs-2 text-muted mb-2 d-block" />
        <p className="mb-2 text-muted small">Tarik &amp; letakkan file di sini, atau</p>
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          <i className="bi bi-folder2-open me-1" /> Pilih File
        </button>
        <input
          ref={inputRef}
          type="file"
          style={{ display: "none" }}
          accept={ALLOWED_EXTENSIONS.join(",")}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void processFile(file);
            e.target.value = "";
          }}
        />
      </div>
      <small className="text-muted d-block mt-1">
        Format didukung: <code>.geojson</code>, <code>.json</code>, <code>.kml</code>,{" "}
        <code>.gpx</code>, <code>.zip</code> (shapefile - ZIP berisi .shp + .dbf + .prj). Maks 20MB.
      </small>
      {status && (
        <div className={`alert alert-${status.type} py-2 mt-2 mb-0 small`}>{status.text}</div>
      )}
    </div>
  );
}

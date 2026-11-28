import type { CarbonResult } from "@/features/carbon/types";
import { useI18nStore } from "@/hooks/useI18nStore";

interface Props {
  result: CarbonResult;
}

function validationLabel(kind: string | undefined, language: string): string {
  if (!kind || kind === "not_validated") return language === "id" ? "Belum divalidasi" : "Not validated";
  const normalized = kind.toLowerCase();
  if (normalized.includes("field") || normalized.includes("plot")) {
    return language === "id" ? `Bukti plot lapangan (${kind})` : `Field plot evidence (${kind})`;
  }
  if (normalized.includes("spatial") && normalized.includes("reference")) {
    return language === "id" ? "Spatial holdout terhadap raster referensi" : "Spatial holdout against a reference raster";
  }
  if (normalized.includes("reference")) {
    return language === "id" ? `Kesesuaian terhadap raster referensi (${kind})` : `Agreement with reference raster (${kind})`;
  }
  return kind;
}

export default function CarbonProvenancePanel({ result }: Props) {
  const language = useI18nStore((state) => state.language);
  const id = language === "id";
  const model = result.model_info || {};
  const quality = result.data_quality;
  const sources = quality?.source_provenance || [];
  const hasSceneMetadata = sources.some((source) => (source.scenes || []).length > 0);

  return (
    <details className="cs-card mt-3">
      <summary className="cs-card-header" role="button">
        <i className="bi bi-diagram-3 me-1" />{id ? "Provenance dan validasi" : "Provenance and validation"}
      </summary>
      <div className="cs-card-body">
        <div className="cs-config-grid">
          <div className="cs-config-item">
            <span className="cs-config-label">{id ? "Snapshot analisis" : "Analysis snapshot"}</span>
            <span className="cs-config-value">{result.analysis_snapshot_id || (id ? "Tidak tersedia" : "Unavailable")}</span>
          </div>
          <div className="cs-config-item">
            <span className="cs-config-label">{id ? "Model / versi" : "Model / version"}</span>
            <span className="cs-config-value">{model.model_name || "—"}{model.model_version ? ` · ${model.model_version}` : ""}</span>
          </div>
          <div className="cs-config-item">
            <span className="cs-config-label">{id ? "Bukti validasi" : "Validation evidence"}</span>
            <span className="cs-config-value">{validationLabel(model.validation_type, language)}</span>
          </div>
          <div className="cs-config-item">
            <span className="cs-config-label">{id ? "Grid / CRS" : "Grid / CRS"}</span>
            <span className="cs-config-value">{model.map_resolution_m ? `${model.map_resolution_m} m` : "—"}{model.map_resolution_crs ? ` · ${model.map_resolution_crs}` : ""}</span>
          </div>
        </div>
        {model.calibration && (
          <div className={`alert ${model.calibration.status === "applied" ? "alert-success" : "alert-warning"} py-2 mt-3 mb-0`} role="status">
            <strong>{id ? "Kalibrasi" : "Calibration"}: {model.calibration.status || "unknown"}</strong>
            {model.calibration.model_id != null && <span> · {id ? "versi" : "version"} #{model.calibration.model_id}{model.calibration.model_version ? ` / ${model.calibration.model_version}` : ""}</span>}
            {model.calibration.reason && <div className="small">{id ? "Tidak diterapkan" : "Not applied"}: {model.calibration.reason}</div>}
            {(model.calibration.warning || model.calibration.note) && <div className="small">{String(model.calibration.warning || model.calibration.note)}</div>}
          </div>
        )}
        {hasSceneMetadata ? (
          <div className="mt-3">
            <h6>{id ? "Sumber citra dan komposit" : "Imagery sources and composite"}</h6>
            {sources.map((source, sourceIndex) => (
              <section className="border rounded p-2 mb-2" key={`${source.collection_id || "source"}-${sourceIndex}`}>
                <div><strong>{source.provider || (id ? "Penyedia tidak tercatat" : "Provider not recorded")}</strong></div>
                <div className="small text-break">{source.collection_id || (id ? "Produk tidak tercatat" : "Product not recorded")}</div>
                <div className="small">
                  {source.start_date_inclusive || "—"} – {source.end_date_exclusive || "—"}
                  {source.scene_count != null ? ` · ${source.scene_count} ${id ? "observasi" : "observations"}` : ""}
                  {source.cloud_threshold_pct_used != null ? ` · ${id ? "ambang awan" : "cloud threshold"} ${source.cloud_threshold_pct_used}%` : ""}
                </div>
                {source.aerosol_handling && <p className="small mb-2 mt-1">{source.aerosol_handling}</p>}
                <details>
                  <summary className="small">{id ? "Daftar scene" : "Scene list"} ({(source.scenes || []).length}{source.scene_manifest_truncated ? "+" : ""})</summary>
                  <ul className="small mb-0 mt-1">
                    {(source.scenes || []).map((scene, sceneIndex) => (
                      <li key={`${scene.scene_id || "scene"}-${sceneIndex}`}>
                        <code>{scene.scene_id || (id ? "ID tidak tersedia" : "ID unavailable")}</code>
                        {scene.acquired_at_utc ? ` · ${scene.acquired_at_utc}` : ""}
                        {scene.cloudy_pixel_percentage != null ? ` · ${scene.cloudy_pixel_percentage}% cloud` : ""}
                        {scene.mgrs_tile ? ` · ${scene.mgrs_tile}` : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              </section>
            ))}
          </div>
        ) : (
          <p className="alert alert-warning py-2 mt-3 mb-0" role="status">
            {id ? "Metadata scene rinci tidak tersedia untuk hasil ini. Provenance yang hilang tidak disimpulkan." : "Detailed scene metadata is unavailable for this result. Missing provenance is not inferred."}
          </p>
        )}
        {quality?.cloud_mask_technique && (
          <p className="small text-muted mb-0">{id ? "Mask awan" : "Cloud mask"}: {quality.cloud_mask_technique}</p>
        )}
      </div>
    </details>
  );
}

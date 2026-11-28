import { useEffect, useMemo, useState } from "react";
import { listCarbonCalibrationModels, type CarbonCalibrationOption } from "@/features/carbon/api";
import type { CarbonModelListItem, CarbonParams } from "@/features/carbon/types";
import { useI18nStore } from "@/hooks/useI18nStore";

interface Props {
  params: CarbonParams;
  selectedModel: CarbonModelListItem | null;
  onParamsChange: (patch: Partial<CarbonParams>) => void;
}

export default function CarbonCalibrationPanel({ params, selectedModel, onParamsChange }: Props) {
  const language = useI18nStore((state) => state.language);
  const id = language === "id";
  const [models, setModels] = useState<CarbonCalibrationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    listCarbonCalibrationModels()
      .then((items) => { if (current) setModels(items); })
      .catch((reason: unknown) => { if (current) setError(reason instanceof Error ? reason.message : (id ? "Katalog kalibrasi gagal dimuat." : "Could not load calibration catalog.")); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [id]);

  const compatible = useMemo(() => models.filter((item) => {
    if (!selectedModel || item.baseline_model.id !== selectedModel.name) return false;
    if (selectedModel.version && item.baseline_model.version !== selectedModel.version) return false;
    const preprocessing = selectedModel.metadata_json?.preprocessing_version;
    if (!preprocessing || item.baseline_model.preprocessing_version !== preprocessing) return false;
    const modelPool = selectedModel.metadata_json?.target_pool;
    if (!modelPool || item.target_pool !== modelPool) return false;
    return item.application_scope.compatible_analysis_years?.includes(params.year) === true;
  }), [models, selectedModel, params.year]);

  useEffect(() => {
    if (!loading && !error && selectedModel && params.calibrationModelId != null
      && !compatible.some((item) => item.id === params.calibrationModelId)) {
      onParamsChange({ calibrationModelId: null });
    }
  }, [compatible, error, loading, onParamsChange, params.calibrationModelId, selectedModel]);

  return (
    <details className="border rounded p-3 mb-3">
      <summary className="fw-semibold" role="button">
        <i className="bi bi-sliders me-1" />{id ? "Kalibrasi karbon lokal" : "Local carbon calibration"}
      </summary>
      <div className="mt-2">
        <p className="small text-muted mb-2">
          {id
            ? "Hanya versi active_local dengan approval, sensor, plot holdout, cakupan lokasi, dan model dasar yang cocok yang dapat dipilih."
            : "Only active_local versions with current approval, sensor, plot holdout, site scope, and matching base model can be selected."}
        </p>
        {loading && <div role="status" className="small">{id ? "Memuat versi kalibrasi…" : "Loading calibration versions…"}</div>}
        {error && <div role="alert" className="alert alert-warning py-2">{error}</div>}
        {!loading && !error && models.length === 0 && <div role="status" className="small">{id ? "Belum ada kalibrasi lokal aktif yang disetujui." : "No approved active local calibration is available."}</div>}
        {!loading && !error && models.length > 0 && compatible.length === 0 && (
          <div role="status" className="small">{id ? "Tidak ada kalibrasi untuk versi model, pool, dan tahun analisis ini." : "No calibration matches this model version, carbon pool, and analysis year."}</div>
        )}
        {compatible.length > 0 && (
          <>
            <label className="form-label small" htmlFor="carbonCalibrationVersion">{id ? "Versi kalibrasi" : "Calibration version"}</label>
            <select
              id="carbonCalibrationVersion"
              className="form-select form-select-sm"
              value={params.calibrationModelId ?? ""}
              onChange={(event) => onParamsChange({ calibrationModelId: event.target.value ? Number(event.target.value) : null })}
            >
              <option value="">{id ? "Tanpa kalibrasi tambahan" : "No additional calibration"}</option>
              {compatible.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.model_name} · {item.version} · {item.application_scope.site || item.dataset_id || item.target_pool}
                </option>
              ))}
            </select>
            <div className="small text-warning mt-2" role="note">
              {id
                ? "Penerapan memerlukan kecocokan approval, model dasar, pool, sensor, wilayah, dan tahun. Status beserta alasan dicatat pada provenance dan ekspor CSV."
                : "Application requires a matching approval, base model, pool, sensor, area, and year. Status and reason are recorded in provenance and CSV."}
            </div>
          </>
        )}
      </div>
    </details>
  );
}

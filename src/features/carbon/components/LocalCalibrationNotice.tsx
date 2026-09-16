import { useEffect, useState } from "react";
import { apiClient } from "@/services/apiClient";
import { useI18nStore } from "@/hooks/useI18nStore";

interface LocalCalibrationModel { model_id: string; model_name: string; version: string; target_pool: string; target_unit: string; metadata?: Record<string, unknown> | null; }

export default function LocalCalibrationNotice() {
  const t = useI18nStore((state) => state.t);
  const [models, setModels] = useState<LocalCalibrationModel[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient.get<{ models: LocalCalibrationModel[] }>("/carbon/calibration-models")
      .then((result) => { if (!cancelled) setModels(result.models ?? []); })
      .catch(() => { if (!cancelled) setModels([]); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="local-calibration-notice" aria-live="polite">
      <div className="d-flex align-items-start gap-2"><i className="bi bi-shield-check" /><div><strong>{t("carbon.calibration.badge")}</strong><small>{t("carbon.calibration.scope")}</small></div></div>
      {loaded && models.length > 0 ? <div className="local-calibration-model">{models.map((model) => <span key={model.model_id}>{model.model_name} · {model.target_unit}</span>)}</div> : <small className="text-muted">{t("carbon.calibration.noActive")}</small>}
      <small className="text-muted d-block mt-1">{t("carbon.calibration.note")}</small>
    </div>
  );
}

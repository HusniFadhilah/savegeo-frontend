import { useEffect, useState } from "react";
import { listCarbonSegmentationModels, type CarbonSegmentationModelStatus } from "@/features/carbon/api";
import { useI18nStore } from "@/hooks/useI18nStore";

export default function CarbonSegmentationStatusPanel() {
  const language = useI18nStore((state) => state.language);
  const id = language === "id";
  const [models, setModels] = useState<CarbonSegmentationModelStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    listCarbonSegmentationModels()
      .then((value) => { if (current) setModels(value); })
      .catch((reason: unknown) => {
        if (current) setError(reason instanceof Error ? reason.message : (id ? "Status model tidak dapat dimuat." : "Could not load model status."));
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [id]);

  return (
    <details className="border rounded p-3 mb-3">
      <summary className="fw-semibold" role="button">
        <i className="bi bi-grid-3x3-gap me-1" />{id ? "Model segmentasi tutupan lahan" : "Land-cover segmentation model"}
      </summary>
      <div className="mt-2">
        <p className="small text-muted mb-2">
          {id
            ? "Segmentasi tutupan lahan dan regresi stok karbon memakai target serta evaluasi yang terpisah."
            : "Land-cover segmentation and carbon-stock regression use separate targets and evaluations."}
        </p>
        {loading && <div role="status" className="small">{id ? "Memuat status model…" : "Loading model status…"}</div>}
        {error && <div role="alert" className="alert alert-warning py-2">{error}</div>}
        {!loading && !error && models.length === 0 && <div role="status" className="small">{id ? "Katalog model belum tersedia." : "Model catalog is unavailable."}</div>}
        {models.map((model) => (
          <section key={`${model.id}-${model.sensor_mode}`} className="border rounded p-2 mb-2">
            <div className="d-flex flex-wrap justify-content-between gap-2">
              <strong>{model.name}</strong>
              <span className="badge text-bg-warning">{id ? "Eksperimental · belum tervalidasi" : "Experimental · unvalidated"}</span>
            </div>
            <div className="small mt-1">{model.architecture} · {model.sensor_mode.replace(/_/g, " ")}</div>
            <div className="small text-muted">{id ? "Urutan kanal" : "Channel order"}: {model.channel_order.join(", ")}</div>
            <div className="small text-warning mt-1" role="status">
              {id ? "Tidak tersedia untuk inferensi" : "Unavailable for inference"}: {model.availability_reason}
            </div>
            <div className="small text-muted mt-1">
              {id ? "Sumber label/lisensi" : "Label source/license"}: {model.label_source || "—"} / {model.label_license || "—"}
              {" · "}{id ? "bobot" : "weights"}: {model.weights_available ? (id ? "tersedia" : "available") : (id ? "belum tersedia" : "not available")}
            </div>
          </section>
        ))}
        {models[0]?.class_map && (
          <details className="small">
            <summary>{id ? `Legenda kelas (${models[0].class_schema})` : `Class legend (${models[0].class_schema})`}</summary>
            <ul className="list-unstyled mt-2 mb-0">
              {models[0].class_order.map((code) => {
                const item = models[0].class_map[code];
                return item ? <li key={code} className="mb-1"><span aria-hidden="true" className="d-inline-block border me-2" style={{ width: 12, height: 12, backgroundColor: item.color }} />{code}: {item.label}</li> : null;
              })}
            </ul>
          </details>
        )}
      </div>
    </details>
  );
}

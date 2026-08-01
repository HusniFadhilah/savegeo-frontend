import { DISASTER_TYPE_LABELS, type EventMapResult } from "../types";

interface Props {
  loading: boolean;
  error: string | null;
  result: EventMapResult | null;
}

/**
 * Ported from DisasterMapping.renderEventSummary() (main.js ~L5243-5271),
 * the metric-card row shown after "Deteksi Area Terdampak" resolves.
 */
export default function EventSummary({ loading, error, result }: Props) {
  if (loading) {
    return (
      <div className="alert alert-info py-2 mb-0">
        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
        Memproses citra sebelum/sesudah...
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-danger py-2 mb-0">{error}</div>;
  }

  if (!result) return null;

  const typeLabel =
    (result.event_type && DISASTER_TYPE_LABELS[result.event_type as keyof typeof DISASTER_TYPE_LABELS]) ||
    result.event_type ||
    "-";

  return (
    <div className="row g-2">
      <div className="col-md-4">
        <div className="metric-card">
          <div className="metric-value">{typeLabel}</div>
          <div className="metric-label">Jenis Bencana</div>
        </div>
      </div>
      <div className="col-md-4">
        <div className="metric-card">
          <div className="metric-value">
            {Number(result.area_ha || 0).toLocaleString("id-ID", { maximumFractionDigits: 1 })}
            <small> ha</small>
          </div>
          <div className="metric-label">Area Terdampak Terdeteksi</div>
        </div>
      </div>
      <div className="col-md-4">
        <div className="metric-card">
          <div className="metric-value">
            {result.scale ?? "-"}
            <small> m</small>
          </div>
          <div className="metric-label">Resolusi Analisis</div>
        </div>
      </div>
      <div className="col-12">
        <div className="alert alert-secondary py-2 mb-0 small">
          <strong>{result.title}</strong> {result.source ? `· ${result.source}` : ""}
          <br />
          Sebelum: {result.before_period?.start} s/d {result.before_period?.end} · Sesudah:{" "}
          {result.after_period?.start} s/d {result.after_period?.end}
          <br />
          {result.method_note}
        </div>
      </div>
    </div>
  );
}

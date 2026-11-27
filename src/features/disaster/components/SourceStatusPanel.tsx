import type { DisasterSourcesMap } from "../types";
import { safeHttpUrl } from "@/utils/safeHttpUrl";
import { useBilingualCopy } from "@/hooks/useBilingualCopy";

interface Props {
  loading: boolean;
  error: string | null;
  sources: DisasterSourcesMap | null;
}

/**
 * Ported from DisasterMapping.loadOfficialSources() card rendering
 * (main.js ~L5283-5335). The tile/WMS overlays themselves are added to the
 * Leaflet map by DisasterEventMap; this panel only renders the
 * configured/not-configured status cards.
 */
export default function SourceStatusPanel({ loading, error, sources }: Props) {
  const c = useBilingualCopy();
  if (loading) {
    return (
      <div className="alert alert-info py-2 mb-3">
        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
        {c("Memuat konfigurasi sumber resmi…", "Loading official source configuration…")}
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-danger py-2 mb-3">{error}</div>;
  }

  if (!sources) return null;

  const entries = Object.entries(sources);
  if (!entries.length) {
    return <div className="alert alert-secondary py-2 mb-3">{c("Belum ada sumber resmi yang terdaftar.", "No official sources are registered.")}</div>;
  }

  return (
    <div className="row g-2 mb-3">
      {entries.map(([key, item]) => (
        <div className="col-md-4" key={key}>
          <div className={`alert ${item.configured ? "alert-success" : "alert-warning"} py-2 h-100 mb-0`}>
            <strong>{item.name}</strong>
            <div className="small">{item.type}</div>
            <div className="small">{item.configured ? c("Terkonfigurasi", "Configured") : c("Belum dikonfigurasi di .env", "Not configured in .env")}</div>
            {safeHttpUrl(item.official_url) && (
              <a href={safeHttpUrl(item.official_url)} target="_blank" rel="noopener noreferrer" className="small">
                {c("Sumber resmi", "Official source")}
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

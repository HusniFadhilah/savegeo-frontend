import type { DisasterAnalysisEntry, DisasterSatelliteLayers } from "../types";

interface Props {
  satellite: DisasterSatelliteLayers | null;
  analyses: DisasterAnalysisEntry[];
  checkedAnalyses: Set<string>;
  onToggleAnalysis: (modelId: string) => void;
  showSatellite: boolean;
  onToggleSatellite: () => void;
  showAoi: boolean;
  onToggleAoi: () => void;
  showHotspots: boolean;
  onToggleHotspots: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  change_detection: "Change Detection",
  segmentation: "Segmentation",
  damage_assessment: "Damage Assessment",
};

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category;
}

/**
 * Layer visibility control for the main results map (spec section 29 -
 * Satellite / Change Detection / Segmentation / Reference groups). Purely
 * presentational: fetches nothing itself, just wires checkbox state the
 * parent (`DisasterDashboard`) already holds - this doubles as the "Analysis
 * selector" checkbox list (spec section D.3): disabled + "Not Available"
 * label whenever `available:false`, only ever the human `user_label` (never
 * `model_id`).
 */
export default function LayerPanel({
  satellite,
  analyses,
  checkedAnalyses,
  onToggleAnalysis,
  showSatellite,
  onToggleSatellite,
  showAoi,
  onToggleAoi,
  showHotspots,
  onToggleHotspots,
}: Props) {
  const groups = new Map<string, DisasterAnalysisEntry[]>();
  for (const entry of analyses) {
    const list = groups.get(entry.category) ?? [];
    list.push(entry);
    groups.set(entry.category, list);
  }

  return (
    <div className="card mb-3 disaster-modern-card disaster-layer-panel">
      <div className="card-header py-2 disaster-soft-header">
        <i className="bi bi-layers-fill" /> Layer
      </div>
      <div className="card-body py-2">
        <div className="mb-2">
          <div className="fw-semibold small text-muted text-uppercase mb-1">Satellite</div>
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              id="layerSatellite"
              checked={showSatellite}
              disabled={!satellite?.post_tile_url && !satellite?.pre_tile_url}
              onChange={onToggleSatellite}
            />
            <label className="form-check-label small" htmlFor="layerSatellite">
              Citra satelit (referensi)
            </label>
          </div>
        </div>

        {[...groups.entries()].map(([category, entries]) => (
          <div className="mb-2" key={category}>
            <div className="fw-semibold small text-muted text-uppercase mb-1">
              {categoryLabel(category)}
            </div>
            {entries.map((entry) => (
              <div className="form-check form-switch" key={entry.model_id}>
                <input
                  className="form-check-input"
                  type="checkbox"
                  id={`layer-${entry.model_id}`}
                  checked={checkedAnalyses.has(entry.model_id)}
                  disabled={!entry.available}
                  onChange={() => onToggleAnalysis(entry.model_id)}
                />
                <label className="form-check-label small" htmlFor={`layer-${entry.model_id}`}>
                  {entry.user_label}
                  {!entry.available && <span className="text-muted ms-1">(Not Available)</span>}
                </label>
                {entry.damage_model === false && <div className="text-muted ms-4 small">Proksi tutupan lahan; bukan kelas kerusakan</div>}
              </div>
            ))}
          </div>
        ))}

        <div>
          <div className="fw-semibold small text-muted text-uppercase mb-1">Reference</div>
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              id="layerAoi"
              checked={showAoi}
              onChange={onToggleAoi}
            />
            <label className="form-check-label small" htmlFor="layerAoi">
              Batas AOI
            </label>
          </div>
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              id="layerHotspots"
              checked={showHotspots}
              onChange={onToggleHotspots}
            />
            <label className="form-check-label small" htmlFor="layerHotspots">
              Hotspot
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

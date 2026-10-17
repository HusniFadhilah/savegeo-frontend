import { useState } from "react";
import type { DisasterAnalysisEntry, DisasterSatelliteLayers } from "../types";
import InfoTip from "@/components/ui/InfoTip";
import { useI18nStore } from "@/hooks/useI18nStore";

interface Props {
  satellite: DisasterSatelliteLayers | null;
  analyses: DisasterAnalysisEntry[];
  checkedAnalyses: Set<string>;
  onToggleAnalysis: (modelId: string) => void;
  showSatellite: boolean;
  onToggleSatellite: () => void;
  enhanceSatelliteImagery: boolean;
  onToggleSatelliteEnhancement: () => void;
  showAoi: boolean;
  onToggleAoi: () => void;
  showHotspots: boolean;
  onToggleHotspots: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  change_detection: "Change Detection",
  segmentation: "Satellite imagery / Segmentation",
  water_inundation: "Water / Inundation",
  land_cover: "Land Cover",
  building_exposure: "Building Exposure",
  road_exposure: "Road Exposure",
  landcover_impact: "Landcover Impact",
  building_change: "Building Change",
  damage_candidate: "Damage Candidate",
  official_observation: "Official Intensity",
  damage_assessment: "Damage Candidate",
};

const LAYER_LABELS: Record<string, string> = {
  dynamic_world_v1: "Dynamic World",
  earthquake_building_segmentation_v1: "Building segmentation",
  earthquake_road_impact_v1: "Road impact",
};

function categoryLabel(category: string): string {
  const normalized = category.toLowerCase();
  return CATEGORY_LABELS[normalized] || normalized.replace(/[_-]+/g, " ");
}

function layerInfo(entry: DisasterAnalysisEntry): string {
  return [
    !entry.available && entry.availability_reason?.length
      ? `Belum tersedia: ${entry.availability_reason.join("; ")}`
      : !entry.available
        ? "Layer ini belum tersedia."
        : null,
    entry.damage_model === false ? "Indikator/paparan; bukan kerusakan terkonfirmasi." : null,
    entry.validation_status === "review_required" ? "Perlu ditinjau sebelum publikasi." : null,
    ...(entry.limitations ?? []).slice(0, 2),
  ]
    .filter(Boolean)
    .join(" ");
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
  enhanceSatelliteImagery,
  onToggleSatelliteEnhancement,
  showAoi,
  onToggleAoi,
  showHotspots,
  onToggleHotspots,
}: Props) {
  const t = useI18nStore((state) => state.t);
  const [satelliteOptionsOpen, setSatelliteOptionsOpen] = useState(false);
  const groups = new Map<string, DisasterAnalysisEntry[]>();
  for (const entry of analyses) {
    const list = groups.get(entry.category) ?? [];
    list.push(entry);
    groups.set(entry.category, list);
  }

  return (
    <>
      <svg
        className="disaster-imagery-filter-defs"
        aria-hidden="true"
        focusable="false"
        width="0"
        height="0"
      >
        <defs>
          <filter
            id="savegeo-image-sharpen"
            colorInterpolationFilters="sRGB"
            x="-2%"
            y="-2%"
            width="104%"
            height="104%"
          >
            <feConvolveMatrix
              order="3"
              kernelMatrix="-0.034 -0.069 -0.034 -0.069 1.412 -0.069 -0.034 -0.069 -0.034"
              edgeMode="duplicate"
              preserveAlpha="true"
            />
          </filter>
        </defs>
      </svg>
      <div className="card mb-3 disaster-modern-card disaster-layer-panel">
        <div className="card-header py-2 disaster-soft-header">
          <i className="bi bi-layers-fill" /> Layer
        </div>
        <div className="card-body py-2">
          <div className="mb-2">
            <div className="fw-semibold small text-muted text-uppercase mb-1">Satellite</div>
            <div className="disaster-layer-satellite-row">
              <div className="form-check form-switch flex-grow-1">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="layerSatellite"
                  checked={showSatellite}
                  disabled={!satellite?.post_tile_url && !satellite?.pre_tile_url}
                  onChange={onToggleSatellite}
                />
                <label className="form-check-label small" htmlFor="layerSatellite">
                  {t("disaster.layer.referenceSatellite")}
                </label>
              </div>
              <button
                type="button"
                className="disaster-layer-accordion-toggle"
                aria-expanded={satelliteOptionsOpen}
                aria-controls="layerSatelliteOptions"
                aria-label={
                  satelliteOptionsOpen
                    ? t("disaster.layer.hideSatelliteOptions")
                    : t("disaster.layer.showSatelliteOptions")
                }
                title={
                  satelliteOptionsOpen
                    ? t("disaster.layer.hideSatelliteOptions")
                    : t("disaster.layer.showSatelliteOptions")
                }
                onClick={() => setSatelliteOptionsOpen((open) => !open)}
              >
                <i
                  className={`bi bi-chevron-${satelliteOptionsOpen ? "up" : "down"}`}
                  aria-hidden="true"
                />
              </button>
            </div>
            {satelliteOptionsOpen && (
              <div
                id="layerSatelliteOptions"
                className="form-check form-switch disaster-layer-enhancement"
              >
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="layerSatelliteEnhancement"
                  checked={enhanceSatelliteImagery}
                  onChange={onToggleSatelliteEnhancement}
                />
                <label className="form-check-label small" htmlFor="layerSatelliteEnhancement">
                  <i className="bi bi-magic me-1" aria-hidden="true" />
                  {t("disaster.layer.visualEnhancement")}
                </label>
                <InfoTip
                  label={t("disaster.layer.visualEnhancementInfo")}
                  content={t("disaster.layer.visualEnhancementDescription")}
                />
              </div>
            )}
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
                  <label
                    className={`form-check-label small ${entry.available ? "" : "text-muted"}`}
                    htmlFor={`layer-${entry.model_id}`}
                  >
                    {LAYER_LABELS[entry.model_id] ?? entry.user_label}
                  </label>
                  {layerInfo(entry) && (
                    <InfoTip
                      label={`Info ${LAYER_LABELS[entry.model_id] ?? entry.user_label}`}
                      content={layerInfo(entry)}
                    />
                  )}
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
    </>
  );
}

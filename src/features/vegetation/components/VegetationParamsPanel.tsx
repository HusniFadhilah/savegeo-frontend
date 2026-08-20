import { useEffect, useState } from "react";
import type { CloudMaskTechnique, CloudMaskTechniqueInfo, SatelliteProvider, VegetationParams } from "@/features/vegetation/types";
import { VEGETATION_INDICES } from "@/features/vegetation/indices";
import { getCloudMaskTechniques, getVegetationCatalog, getVegetationSatellites } from "@/features/vegetation/api";

interface Props {
  params: VegetationParams;
  onParamsChange: (patch: Partial<VegetationParams>) => void;
}

interface BadgeIndex {
  code: string;
  label: string;
  description: string;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

const FALLBACK_BADGES: BadgeIndex[] = VEGETATION_INDICES.map((i) => ({
  code: i.code,
  label: i.label,
  description: i.description,
}));

/**
 * Ported from module-carbon.html's #vegetationParams block. Index badges are
 * fetched from GET /vegetation/catalog (16 indices as of writing) instead of
 * only the 8 hardcoded in indices.ts - falls back to that static list if the
 * catalog request fails, so the panel still works offline.
 */
export default function VegetationParamsPanel({ params, onParamsChange }: Props) {
  const [badges, setBadges] = useState<BadgeIndex[]>(FALLBACK_BADGES);
  const [satellites, setSatellites] = useState<Record<string, SatelliteProvider>>({});
  const [techniques, setTechniques] = useState<Record<string, CloudMaskTechniqueInfo>>({});

  useEffect(() => {
    let cancelled = false;
    getVegetationCatalog()
      .then((res) => {
        if (cancelled || !res?.indices) return;
        const list = Object.entries(res.indices).map(([code, meta]) => ({
          code,
          label: code,
          description: meta.description || meta.name || code,
        }));
        if (list.length) setBadges(list);
      })
      .catch(() => {
        /* keep static fallback badges */
      });
    getVegetationSatellites()
      .then((res) => {
        if (cancelled || !res?.satellites) return;
        setSatellites(res.satellites);
      })
      .catch(() => {
        /* satellite picker just won't render options; backend still defaults to Sentinel-2 */
      });
    getCloudMaskTechniques()
      .then((res) => {
        if (cancelled || !res?.techniques) return;
        setTechniques(res.techniques);
      })
      .catch(() => {
        /* technique picker just won't render options; backend still defaults to SCL */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeSatellite = satellites[params.satellite];
  const activeTechnique = techniques[params.cloudMaskTechnique];
  const isLandsat = params.satellite !== "sentinel2";

  function toggleIndex(code: string) {
    const active = params.indices.includes(code);
    const next = active ? params.indices.filter((i) => i !== code) : [...params.indices, code];
    onParamsChange({ indices: next });
  }

  return (
    <div id="vegetationParams">
      <h6 className="mb-3">
        <i className="bi bi-flower1 me-1" /> Parameter Citra
      </h6>

      <div className="mb-3">
        <label className="form-label">Provider Satelit</label>
        <select
          className="form-select"
          value={params.satellite}
          onChange={(e) => onParamsChange({ satellite: e.target.value })}
          disabled={Object.keys(satellites).length === 0}
        >
          {Object.values(satellites).map((sat) => (
            <option key={sat.key} value={sat.key}>
              {sat.name} — {sat.resolution_label} · revisit {sat.revisit_days} hari
            </option>
          ))}
        </select>
        {activeSatellite && (
          <div className="mt-2 p-2 border rounded" style={{ fontSize: ".78rem" }}>
            <div className="d-flex flex-wrap gap-3 mb-1">
              <span>
                <i className="bi bi-building me-1" /> <strong>{activeSatellite.provider}</strong>
              </span>
              <span>
                <i className="bi bi-aspect-ratio me-1" /> {activeSatellite.resolution_label}
              </span>
              <span>
                <i className="bi bi-arrow-repeat me-1" /> Revisit {activeSatellite.revisit_days} hari
              </span>
              <span>
                <i className="bi bi-calendar-event me-1" /> Sejak {activeSatellite.launch}
              </span>
            </div>
            <div className="text-muted mb-1">{activeSatellite.description}</div>
            <div className="text-muted">
              <i className="bi bi-layers me-1" /> Band: {activeSatellite.bands_available.join(", ")}
            </div>
          </div>
        )}
      </div>

      <div className="mb-3">
        <label className="form-label">Teknik Pemrosesan Awan</label>
        <select
          className="form-select"
          value={params.cloudMaskTechnique}
          onChange={(e) => onParamsChange({ cloudMaskTechnique: e.target.value as CloudMaskTechnique })}
          disabled={isLandsat || Object.keys(techniques).length === 0}
        >
          {Object.entries(techniques).map(([key, info]) => (
            <option key={key} value={key}>
              {info.label}
            </option>
          ))}
        </select>
        {isLandsat ? (
          <small className="text-muted d-block mt-1">
            Landsat pakai masking QA_PIXEL sendiri - opsi ini hanya berlaku untuk Sentinel-2.
          </small>
        ) : (
          activeTechnique && <small className="text-muted d-block mt-1">{activeTechnique.description}</small>
        )}
      </div>

      <div className="mb-3">
        <label className="form-label">Rentang Bulan</label>
        <div className="d-flex gap-2">
          <select
            className="form-select"
            id="startMonth"
            value={params.startMonth}
            onChange={(e) => onParamsChange({ startMonth: Number(e.target.value) })}
          >
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <span className="align-self-center">s/d</span>
          <select
            className="form-select"
            id="endMonth"
            value={params.endMonth}
            onChange={(e) => onParamsChange({ endMonth: Number(e.target.value) })}
          >
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label">Ambang Awan (%)</label>
        <input
          id="cloudSlider"
          type="range"
          className="form-range"
          min={0}
          max={100}
          value={params.cloudThreshold}
          onChange={(e) => onParamsChange({ cloudThreshold: Number(e.target.value) })}
        />
        <div className="text-center">
          <strong>{params.cloudThreshold}</strong>%
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label">Indeks Vegetasi</label>
        <div id="indicesContainer">
          {badges.map((idx) => (
            <span
              key={idx.code}
              className={`index-badge ${params.indices.includes(idx.code) ? "active" : ""}`}
              title={idx.description}
              onClick={() => toggleIndex(idx.code)}
            >
              {idx.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

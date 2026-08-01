import type { VegetationParams } from "@/features/vegetation/types";
import { VEGETATION_INDICES } from "@/features/vegetation/indices";

interface Props {
  params: VegetationParams;
  onParamsChange: (patch: Partial<VegetationParams>) => void;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

/** Ported from module-carbon.html's #vegetationParams block. */
export default function VegetationParamsPanel({ params, onParamsChange }: Props) {
  function toggleIndex(code: string) {
    const active = params.indices.includes(code);
    const next = active ? params.indices.filter((i) => i !== code) : [...params.indices, code];
    onParamsChange({ indices: next });
  }

  return (
    <div id="vegetationParams">
      <h6 className="mb-3">
        <i className="bi bi-flower1 me-1" /> Parameter Sentinel-2
      </h6>

      <div className="mb-3">
        <label className="form-label">Rentang Bulan</label>
        <div className="d-flex gap-2">
          <select
            className="form-select"
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
          {VEGETATION_INDICES.map((idx) => (
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

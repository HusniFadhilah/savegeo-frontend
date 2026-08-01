import type { AnalysisType } from "@/features/carbon/types";

interface Props {
  value: AnalysisType;
  onChange: (value: AnalysisType) => void;
}

const OPTIONS: { value: AnalysisType; label: string }[] = [
  { value: "landcover", label: "Land Cover" },
  { value: "vegetation", label: "Indeks Vegetasi" },
  { value: "carbon", label: "Estimasi Stok Karbon" },
  { value: "combined", label: "Analisis Gabungan" },
];

/** Ported from module-carbon.html's #analysisType selector. */
export default function AnalysisTypeSelector({ value, onChange }: Props) {
  return (
    <div className="mb-3">
      <label className="form-label">Jenis Analisis</label>
      <select
        className="form-select"
        value={value}
        onChange={(e) => onChange(e.target.value as AnalysisType)}
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

import { useI18nStore } from "@/hooks/useI18nStore";
import type { AnalysisType } from "@/features/carbon/types";

interface Props {
  value: AnalysisType;
  onChange: (value: AnalysisType) => void;
}

/** Ported from module-carbon.html's #analysisType selector. */
export default function AnalysisTypeSelector({ value, onChange }: Props) {
  const t = useI18nStore((s) => s.t);
  const options: { value: AnalysisType; label: string }[] = [
    { value: "landcover", label: t("carbon.analysisType.landcover") },
    { value: "vegetation", label: t("carbon.analysisType.vegetation") },
    { value: "carbon", label: t("carbon.analysisType.carbon") },
    { value: "combined", label: t("carbon.analysisType.combined") },
  ];
  return (
    <div className="mb-3">
      <label className="form-label">{t("carbon.analysisType.label")}</label>
      <select
        id="analysisType"
        className="form-select"
        value={value}
        onChange={(e) => onChange(e.target.value as AnalysisType)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

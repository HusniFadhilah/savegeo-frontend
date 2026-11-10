import { useI18nStore } from "@/hooks/useI18nStore";
import type { AnalysisType } from "@/features/carbon/types";

interface Props {
  value: AnalysisType;
  onChange: (value: AnalysisType) => void;
  availableTypes?: AnalysisType[];
}

/** Ported from module-carbon.html's #analysisType selector. */
export default function AnalysisTypeSelector({ value, onChange, availableTypes }: Props) {
  const t = useI18nStore((s) => s.t);
  const allOptions: { value: AnalysisType; label: string }[] = [
    { value: "landcover", label: t("carbon.analysisType.landcover") },
    { value: "vegetation", label: t("carbon.analysisType.vegetation") },
    { value: "carbon", label: t("carbon.analysisType.carbon") },
    { value: "bluecarbon", label: "Blue carbon" },
    { value: "green_rankings", label: t("carbon.analysisType.green_rankings") },
    { value: "productivity", label: t("carbon.analysisType.productivity") },
    { value: "combined", label: t("carbon.analysisType.combined") },
  ];
  const options = availableTypes ? allOptions.filter((option) => availableTypes.includes(option.value)) : allOptions;
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

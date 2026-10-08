import type { MapLegendEntry } from "@/types/map";

interface DensityScale {
  min: number;
  max: number;
  unit: string;
  colors: string[];
}

interface Props {
  title?: string;
  entries: MapLegendEntry[];
  scale?: DensityScale;
}

function formatScaleValue(value: number) {
  return Math.abs(value) >= 100 ? Math.round(value).toString() : Number(value.toFixed(2)).toString();
}

export default function MapLegend({ title, entries, scale }: Props) {
  if (!entries.length && !scale) return null;

  return (
    <div className="legend">
      {title && <div className="fw-semibold mb-2">{title}</div>}
      {scale && (
        <div className="mb-1">
          <div
            role="img"
            aria-label={"Skala densitas " + formatScaleValue(scale.min) + " sampai " + formatScaleValue(scale.max) + " " + scale.unit}
            style={{
              height: 14,
              borderRadius: 4,
              border: "1px solid #666",
              background: "linear-gradient(90deg, " + scale.colors.join(", ") + ")",
            }}
          />
          <div className="d-flex justify-content-between mt-1 small text-muted">
            <span>{formatScaleValue(scale.min)}</span>
            <span>{formatScaleValue((scale.min + scale.max) / 2)}</span>
            <span>{formatScaleValue(scale.max)}</span>
          </div>
          <div className="text-end small text-muted">{scale.unit}</div>
        </div>
      )}
      {entries.map((e) => (
        <div className="legend-item" key={e.label}>
          <span className="legend-color" style={{ backgroundColor: e.color }} />
          <span>{e.label}</span>
          {e.value !== undefined && <span className="ms-auto small text-muted">{e.value}</span>}
        </div>
      ))}
    </div>
  );
}

import type { MapLegendEntry } from "@/types/map";

interface Props {
  title?: string;
  entries: MapLegendEntry[];
}

export default function MapLegend({ title, entries }: Props) {
  if (!entries.length) return null;

  return (
    <div className="legend">
      {title && <div className="fw-semibold mb-2">{title}</div>}
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

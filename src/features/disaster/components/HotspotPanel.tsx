import { useState } from "react";
import type { HotspotRecord } from "../types";
import { SEVERITY_LABELS, type EventSeverity } from "../types";

interface Props {
  hotspots: HotspotRecord[];
  highlightedHotspotId: number | null;
  onZoom: (hotspot: HotspotRecord) => void;
  onHighlight: (hotspotId: number) => void;
}

function impactLabel(level: string): string {
  return SEVERITY_LABELS[level as EventSeverity] || level;
}

function impactBadgeClass(level: string): string {
  switch (level) {
    case "critical":
      return "bg-danger";
    case "high":
      return "bg-warning text-dark";
    case "medium":
      return "bg-info text-dark";
    default:
      return "bg-secondary";
  }
}

/**
 * Item 8 of the redesign spec (D.8): list from `GET /disasters/{id}/hotspots`
 * (already published-only - the backend never returns unpublished hotspots
 * to User routes). View-only per the contract doc: Zoom/Highlight/View
 * Detail buttons only, no edit affordance anywhere.
 */
export default function HotspotPanel({ hotspots, highlightedHotspotId, onZoom, onHighlight }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (!hotspots.length) {
    return <div className="alert alert-secondary py-2 mb-3">Belum ada hotspot yang dipublikasikan untuk event ini.</div>;
  }

  return (
    <div className="card mb-3">
      <div className="card-header py-2">
        <i className="bi bi-geo-alt-fill" /> Hotspot ({hotspots.length})
      </div>
      <div className="list-group list-group-flush">
        {hotspots.map((hotspot) => (
          <div
            className={`list-group-item ${hotspot.id === highlightedHotspotId ? "list-group-item-warning" : ""}`}
            key={hotspot.id}
          >
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span className={`badge ${impactBadgeClass(hotspot.impact_level)}`}>{impactLabel(hotspot.impact_level)}</span>
              <span className="fw-semibold">{hotspot.name}</span>
              <div className="btn-group btn-group-sm ms-auto">
                <button type="button" className="btn btn-outline-primary" onClick={() => onZoom(hotspot)}>
                  <i className="bi bi-zoom-in" /> Zoom
                </button>
                <button type="button" className="btn btn-outline-secondary" onClick={() => onHighlight(hotspot.id)}>
                  <i className="bi bi-stars" /> Highlight
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setExpandedId((id) => (id === hotspot.id ? null : hotspot.id))}
                >
                  <i className={`bi ${expandedId === hotspot.id ? "bi-chevron-up" : "bi-chevron-down"}`} /> Detail
                </button>
              </div>
            </div>
            {expandedId === hotspot.id && (
              <div className="small text-muted mt-2">
                {hotspot.stats && Object.keys(hotspot.stats).length ? (
                  <ul className="mb-0 ps-3">
                    {Object.entries(hotspot.stats).map(([key, value]) => (
                      <li key={key}>
                        {key}: {String(value)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span>Tidak ada detail statistik tambahan.</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

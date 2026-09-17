import { useEffect, useState } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { fetchWindLayer } from "@/features/disaster/api";
import type { WindLayerResponse } from "@/features/disaster/types";

function directionLabel(degrees: number) {
  return ["U", "TL", "T", "TG", "S", "BD", "B", "BL"][Math.round(degrees / 45) % 8];
}

function arrowIcon(direction: number) {
  return L.divIcon({
    className: "wildfire-wind-arrow-icon",
    html: `<span style="transform: rotate(${direction}deg)" aria-hidden="true">➤</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export default function WindArrowLayer({ bbox, date }: { bbox: [number, number, number, number]; date?: string }) {
  const [data, setData] = useState<WindLayerResponse | null>(null);
  const [west, south, east, north] = bbox;

  useEffect(() => {
    let cancelled = false;
    fetchWindLayer({ west, south, east, north, date })
      .then((response) => { if (!cancelled) setData(response); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [west, south, east, north, date]);

  if (!data) return null;
  return <>
    {data.points.map((point) => (
      <Marker key={`${point.lat}-${point.lon}`} position={[point.lat, point.lon]} icon={arrowIcon(point.direction_deg)}>
        <Popup>
          <div className="wildfire-wind-popup">
            <strong>Arah angin</strong>
            <span>{directionLabel(point.direction_deg)} · {point.direction_deg.toFixed(0)}°</span>
            <span>{point.speed_kmh.toFixed(1)} km/jam</span>
            <small>{data.source} · {data.valid_time_utc ?? data.date}</small>
          </div>
        </Popup>
      </Marker>
    ))}
  </>;
}

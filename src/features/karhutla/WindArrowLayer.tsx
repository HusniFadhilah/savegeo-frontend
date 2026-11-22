import { useEffect, useState } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { fetchWindLayer } from "@/features/disaster/api";
import type { WindLayerResponse } from "@/features/disaster/types";
import { formatNumber, useI18nStore } from "@/hooks/useI18nStore";

function directionLabel(degrees: number, language: "id" | "en") {
  const directions = language === "en"
    ? ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    : ["U", "TL", "T", "TG", "S", "BD", "B", "BL"];
  return directions[Math.round(degrees / 45) % 8];
}

function arrowIcon(direction: number) {
  // The value comes from an API response and is interpolated into HTML; accept
  // only a finite number at runtime.
  const degrees = Number.isFinite(Number(direction)) ? Number(direction) : 0;
  return L.divIcon({
    className: "wildfire-wind-arrow-icon",
    html: `<span style="transform: rotate(${degrees}deg)" aria-hidden="true">➤</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export default function WindArrowLayer({ bbox, date }: { bbox: [number, number, number, number]; date?: string }) {
  const { language, t } = useI18nStore();
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
            <strong>{t("wildfire.wind.direction")}</strong>
            <span>{directionLabel(point.direction_deg, language)} · {formatNumber(point.direction_deg, language, { maximumFractionDigits: 0 })}°</span>
            <span>{formatNumber(point.speed_kmh, language, { maximumFractionDigits: 1 })} {t("wildfire.wind.kmh")}</span>
            <small>{data.source} · {data.valid_time_utc ?? data.date}</small>
          </div>
        </Popup>
      </Marker>
    ))}
  </>;
}

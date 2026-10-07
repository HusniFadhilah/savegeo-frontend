import { useEffect, useRef, useState } from "react";
import { Popup, useMap } from "react-leaflet";
import type { LeafletMouseEvent, Popup as LeafletPopup, PopupEvent } from "leaflet";
import { fetchWildfireCamsPoint } from "@/features/disaster/api";
import { useI18nStore } from "@/hooks/useI18nStore";
import type { CamsPointSample } from "./types";

interface ProbeLayer {
  layerId: string;
  frameId: string;
}

interface ProbeResult {
  requestId: number;
  position: [number, number];
  loading: boolean;
  entries: Array<{ layerId: string; sample: CamsPointSample | null }>;
}

export default function CamsPointProbe({ slug, layers }: { slug: string; layers: ProbeLayer[] }) {
  const map = useMap();
  const { t, language } = useI18nStore();
  const [result, setResult] = useState<ProbeResult | null>(null);
  const popupRef = useRef<LeafletPopup | null>(null);
  // A new parent array with the same frames must not clear an open popup.
  const selectionKey = JSON.stringify(layers);

  useEffect(() => {
    const targets: ProbeLayer[] = JSON.parse(selectionKey);
    let active = true;
    let requestVersion = 0;
    setResult(null);
    if (!targets.length) return undefined;
    const click = (event: LeafletMouseEvent) => {
      const version = ++requestVersion;
      const { lat, lng } = event.latlng;
      // Leaflet permits repeated worlds; sample the equivalent longitude.
      const lon = lng >= -180 && lng <= 180 ? lng : ((lng + 180) % 360 + 360) % 360 - 180;
      const position: [number, number] = [lat, lng];
      setResult({ requestId: version, position, loading: true, entries: [] });
      Promise.all(targets.map(async ({ layerId, frameId }) => {
        try {
          return { layerId, sample: await fetchWildfireCamsPoint(slug, layerId, frameId, lat, lon) };
        } catch {
          return { layerId, sample: null };
        }
      })).then((entries) => {
        if (active && version === requestVersion) setResult({ requestId: version, position, loading: false, entries });
      });
    };
    const close = (event: PopupEvent) => {
      if (!active || event.popup !== popupRef.current) return;
      ++requestVersion;
      setResult(null);
    };
    map.on("click", click);
    map.on("popupclose", close);
    return () => {
      active = false;
      map.off("click", click);
      map.off("popupclose", close);
    };
  }, [map, selectionKey, slug]);

  if (!result) return null;
  const locale = language === "id" ? "id-ID" : "en-GB";
  const number = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 3 });
  const date = (value: string) => new Date(value).toLocaleString(locale, { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" });
  const coordinate = (value: number, positive: string, negative: string) => `${Math.abs(value).toFixed(3)}° ${value < 0 ? negative : positive}`;
  return <Popup key={result.requestId} ref={popupRef} position={result.position} className="cams-point-popup" minWidth={250} maxWidth={320}>
    <div className="cams-point-content" aria-live="polite">
      {result.loading ? <p role="status">{t("wildfire.cams.pointLoading")}</p> : result.entries.map(({ layerId, sample }) => (
        <section key={layerId}>
          <h4>{t(`wildfire.cams.layer.${layerId}`)}</h4>
          {!sample ? <p role="alert">{t("wildfire.cams.pointError")}</p> : <>
            {!sample.data_available ? <p>{t(sample.reason === "outside_coverage" ? "wildfire.cams.pointOutside" : "wildfire.cams.pointMissing")}</p> : <>
              <span className="cams-point-label">{t(layerId === "burnt_carbon" ? "wildfire.cams.cellEmission" : "wildfire.cams.cellAod")}</span>
              <strong className="cams-point-value">{number(sample.mass_tonnes ?? sample.value!)} {sample.mass_tonnes != null ? "t C" : sample.unit}</strong>
              {sample.mass_tonnes != null && sample.value != null && <small>{t("wildfire.cams.intensity")}: {number(sample.value)} {sample.unit}</small>}
            </>}
            {sample.center && <>
              <span className="cams-point-label">{t("wildfire.cams.cellCenter")}</span>
              <strong>{coordinate(sample.center.lat, "N", "S")}, {coordinate(sample.center.lon, "E", "W")}</strong>
            </>}
            <footer>{date(sample.valid_at)} UTC{sample.interval_end && <span> – {date(sample.interval_end)} UTC</span>}
              {sample.is_forecast && <span className="cams-point-forecast">{t("wildfire.cams.forecast")}{sample.leadtime_hours != null ? ` · +${sample.leadtime_hours} h` : ""}</span>}
            </footer>
          </>}
        </section>
      ))}
      {!result.loading && <small className="cams-point-note">{t("wildfire.cams.nativeCell")}</small>}
    </div>
  </Popup>;
}

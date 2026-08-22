import { useState } from "react";
import { useI18nStore } from "@/hooks/useI18nStore";
import RichText from "@/components/ui/RichText";
import type { AoiFeature } from "@/types/map";

interface Props {
  onApply: (feature: AoiFeature, name: string) => void;
  /** Controlled so a map click (see MapClickPicker in AoiPanel) can fill these too. */
  lat: string;
  lon: string;
  onLatChange: (v: string) => void;
  onLonChange: (v: string) => void;
}

/**
 * Ported from module-carbon.html's #aoiCoord tab + main.js setCoordinateAOI():
 * builds a square buffer polygon (approx. km -> degrees) around a lat/lon.
 * Lat/lon are lifted to AoiPanel so clicking the map (MapClickPicker) can
 * fill them too, not just typing them in here.
 */
export default function AoiCoordinateTab({ onApply, lat, lon, onLatChange, onLonChange }: Props) {
  const t = useI18nStore((s) => s.t);
  const [buffer, setBuffer] = useState("10");
  const [error, setError] = useState<string | null>(null);

  function handleApply() {
    const latN = parseFloat(lat);
    const lonN = parseFloat(lon);
    const bufN = parseFloat(buffer);
    if (!Number.isFinite(latN) || !Number.isFinite(lonN) || !Number.isFinite(bufN)) {
      setError(t("carbon.aoiCoord.err.invalidInput"));
      return;
    }
    setError(null);
    const bufferDeg = bufN / 111;
    const coords: [number, number][] = [
      [lonN - bufferDeg, latN - bufferDeg],
      [lonN + bufferDeg, latN - bufferDeg],
      [lonN + bufferDeg, latN + bufferDeg],
      [lonN - bufferDeg, latN + bufferDeg],
      [lonN - bufferDeg, latN - bufferDeg],
    ];
    const feature: AoiFeature = {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [coords] },
      properties: {},
    };
    onApply(feature, `${t("carbon.aoiCoord.pointLabel")} (${latN.toFixed(4)}, ${lonN.toFixed(4)})`);
  }

  return (
    <div>
      <div className="alert alert-info py-2 small mb-3">
        <i className="bi bi-info-circle me-1" />
        <RichText text={t("carbon.aoiCoord.info")} />
      </div>
      <div className="row">
        <div className="col-md-4 mb-3">
          <label className="form-label">{t("carbon.aoiCoord.latitude")}</label>
          <input
            type="number"
            className="form-control"
            step="0.0001"
            value={lat}
            onChange={(e) => onLatChange(e.target.value)}
          />
        </div>
        <div className="col-md-4 mb-3">
          <label className="form-label">{t("carbon.aoiCoord.longitude")}</label>
          <input
            type="number"
            className="form-control"
            step="0.0001"
            value={lon}
            onChange={(e) => onLonChange(e.target.value)}
          />
        </div>
        <div className="col-md-4 mb-3">
          <label className="form-label">{t("carbon.aoiCoord.buffer")}</label>
          <input
            type="number"
            className="form-control"
            min={1}
            max={50}
            value={buffer}
            onChange={(e) => setBuffer(e.target.value)}
          />
        </div>
      </div>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      <button className="btn btn-success" onClick={handleApply}>
        <i className="bi bi-check-lg" /> {t("carbon.aoiCoord.setAoi")}
      </button>
    </div>
  );
}

import type { AoiFeature } from "@/types/map";
import { calcAreaKm2 } from "../utils";
import { useBilingualCopy } from "@/hooks/useBilingualCopy";

interface Props {
  aoi: AoiFeature | null;
}

/**
 * Mirrors the legacy #disasterAoiStatus banner. The legacy app read AOI from
 * the Carbon module's shared `currentAOI` global; this rebuild has no
 * cross-module AOI store yet (see report), so the disaster module carries
 * its own AOI drawn directly on its map instead.
 */
export default function AoiStatusCard({ aoi }: Props) {
  const c = useBilingualCopy();
  if (!aoi) {
    return (
      <div className="alert alert-warning py-2" style={{ fontSize: ".82rem" }}>
        <i className="bi bi-exclamation-triangle-fill" /> {c("Belum ada AOI. Gambar poligon atau kotak AOI di peta untuk memulai.", "No AOI selected. Draw a polygon or rectangle on the map to get started.")}
      </div>
    );
  }

  const areaKm2 = calcAreaKm2(aoi.geometry);

  return (
    <div className="alert alert-success py-2" style={{ fontSize: ".82rem" }}>
      <i className="bi bi-check-circle-fill" /> <strong>{c("AOI dipilih", "AOI selected")}</strong> ·{" "}
      {areaKm2.toLocaleString(c("id-ID", "en-US"), { maximumFractionDigits: 2 })} km²
    </div>
  );
}

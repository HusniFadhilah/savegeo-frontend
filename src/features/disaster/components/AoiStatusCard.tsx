import type { AoiFeature } from "@/types/map";
import { calcAreaKm2 } from "../utils";

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
  if (!aoi) {
    return (
      <div className="alert alert-warning py-2" style={{ fontSize: ".82rem" }}>
        <i className="bi bi-exclamation-triangle-fill" /> Belum ada AOI. Gambar poligon/kotak AOI di peta
        untuk memulai.
      </div>
    );
  }

  const areaKm2 = calcAreaKm2(aoi.geometry);

  return (
    <div className="alert alert-success py-2" style={{ fontSize: ".82rem" }}>
      <i className="bi bi-check-circle-fill" /> <strong>AOI dipilih</strong> ·{" "}
      {areaKm2.toLocaleString("id-ID", { maximumFractionDigits: 2 })} km²
    </div>
  );
}

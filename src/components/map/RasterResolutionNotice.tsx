import { useState } from "react";
import { useMapEvents } from "react-leaflet";
import { nativeZoomForResolution } from "@/config/mapZoom";
import { useI18nStore } from "@/hooks/useI18nStore";

export default function RasterResolutionNotice({
  layers,
}: {
  layers: Array<{
    label: string;
    resolutionM?: number | null;
    nativeZoom?: number;
    tileUrl?: string | null;
  }>;
}) {
  const [zoom, setZoom] = useState<number>();
  const map = useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const t = useI18nStore((state) => state.t);
  return (
    <div
      className="raster-resolution-notice"
      title={t("map.resolution.label")}
      aria-label={t("map.resolution.label")}
    >
      {layers.map((layer, index) => {
        const nativeZoom = layer.nativeZoom ?? nativeZoomForResolution(layer.resolutionM);
        return (
          <div
            key={index}
            data-native-resolution={layer.resolutionM ?? "unknown"}
            data-native-zoom={nativeZoom}
            data-tile-url={import.meta.env.DEV ? layer.tileUrl : undefined}
          >
            {layer.resolutionM ? `${layer.resolutionM.toFixed(2)} m` : t("map.resolution.unavailable")}
            {(zoom ?? map.getZoom()) > nativeZoom && ` ${t("map.resolution.enlarged")}`}
          </div>
        );
      })}
    </div>
  );
}

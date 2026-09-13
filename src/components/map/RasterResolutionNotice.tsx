import { useState } from "react";
import { useMapEvents } from "react-leaflet";
import { nativeZoomForResolution } from "@/config/mapZoom";

export default function RasterResolutionNotice({ layers }: { layers: Array<{ label: string; resolutionM?: number | null; nativeZoom?: number; tileUrl?: string | null }> }) {
  const [zoom, setZoom] = useState<number>();
  const map = useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  return <div className="raster-resolution-notice" style={{ position: "absolute", bottom: 58, right: 8, zIndex: 800, background: "rgba(255,255,255,.9)", padding: "3px 6px", fontSize: 11, maxWidth: "70%", pointerEvents: "none" }}>
    {layers.map((layer, index) => {
      const nativeZoom = layer.nativeZoom ?? nativeZoomForResolution(layer.resolutionM);
      return <div key={index} data-native-resolution={layer.resolutionM ?? "unknown"} data-native-zoom={nativeZoom}
        data-tile-url={import.meta.env.DEV ? layer.tileUrl : undefined}>
        {layer.label}: {layer.resolutionM ? `${layer.resolutionM} m` : "resolusi belum tersedia"}
        {(zoom ?? map.getZoom()) > nativeZoom && " · diperbesar, tanpa detail tambahan"}
      </div>;
    })}
  </div>;
}

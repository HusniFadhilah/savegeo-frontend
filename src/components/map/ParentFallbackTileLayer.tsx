import { useEffect } from "react";
import L, {
  type Coords,
  type DoneCallback,
  type GridLayerOptions,
  type LatLngBoundsExpression,
  type TileEvent,
} from "leaflet";
import { useMap } from "react-leaflet";

export type ParentFallbackTileStatus = "loading" | "ready" | "fallback" | "error";

interface Props {
  url: string;
  opacity?: number;
  pane?: string;
  attribution?: string;
  className?: string;
  bounds?: LatLngBoundsExpression;
  maxZoom?: number;
  /** Highest source zoom to try before falling back to an ancestor tile. */
  maxNativeZoom?: number;
  /** Limit retries when a provider has no tile at the requested zoom. */
  fallbackLevels?: number;
  onStatus?: (status: ParentFallbackTileStatus) => void;
}

interface FallbackLayerOptions extends GridLayerOptions {
  sourceMaxNativeZoom: number;
  fallbackLevels: number;
}

/**
 * Wayback releases do not all contain tiles through the same zoom level.
 * Keep the requested map zoom, but if a tile is absent, request its nearest
 * available parent and crop the matching quadrant with a CSS background.
 * This preserves the requested geographic coverage without canvas/CORS reads.
 */
class ParentFallbackGridLayer extends L.GridLayer {
  private readonly template: string;
  private readonly sourceMaxNativeZoom: number;
  private readonly fallbackLevels: number;
  private readonly pendingImages = new Set<HTMLImageElement>();

  constructor(url: string, options: FallbackLayerOptions) {
    const { sourceMaxNativeZoom, fallbackLevels, ...leafletOptions } = options;
    super(leafletOptions);
    this.template = url;
    this.sourceMaxNativeZoom = sourceMaxNativeZoom;
    this.fallbackLevels = fallbackLevels;
  }

  protected createTile(coords: Coords, done: DoneCallback): HTMLElement {
    const tile = L.DomUtil.create("div", "leaflet-tile");
    const size = this.getTileSize();
    tile.style.width = `${size.x}px`;
    tile.style.height = `${size.y}px`;
    tile.style.backgroundRepeat = "no-repeat";

    const firstZoom = Math.min(coords.z, this.sourceMaxNativeZoom);
    const lastZoom = Math.max(0, firstZoom - this.fallbackLevels);

    const requestAtZoom = (zoom: number) => {
      const scale = 2 ** (coords.z - zoom);
      const parentX = Math.floor(coords.x / scale);
      const parentY = Math.floor(coords.y / scale);
      const tileUrl = L.Util.template(this.template, {
        x: parentX,
        y: parentY,
        z: zoom,
        s: "",
      });
      const image = new Image();
      this.pendingImages.add(image);

      const release = () => {
        image.onload = null;
        image.onerror = null;
        this.pendingImages.delete(image);
      };

      image.onload = () => {
        release();
        if (zoom < firstZoom) {
          const offsetX = coords.x - parentX * scale;
          const offsetY = coords.y - parentY * scale;
          tile.dataset.parentFallbackZoom = String(zoom);
          tile.style.backgroundImage = `url(${JSON.stringify(tileUrl)})`;
          tile.style.backgroundSize = `${size.x * scale}px ${size.y * scale}px`;
          tile.style.backgroundPosition = `${-offsetX * size.x}px ${-offsetY * size.y}px`;
        } else {
          tile.style.backgroundImage = `url(${JSON.stringify(tileUrl)})`;
          tile.style.backgroundSize = `${size.x}px ${size.y}px`;
          tile.style.backgroundPosition = "0 0";
        }
        done(undefined, tile);
      };

      image.onerror = () => {
        release();
        if (zoom > lastZoom) requestAtZoom(zoom - 1);
        else done(new Error("Wayback tile is unavailable at this location and zoom."), tile);
      };

      image.src = tileUrl;
    };

    requestAtZoom(firstZoom);
    return tile;
  }

  onRemove(map: L.Map): this {
    for (const image of this.pendingImages) {
      image.onload = null;
      image.onerror = null;
      image.src = "";
    }
    this.pendingImages.clear();
    return super.onRemove(map);
  }
}

export default function ParentFallbackTileLayer({
  url,
  opacity = 1,
  pane,
  attribution,
  className,
  bounds,
  maxZoom,
  maxNativeZoom = 18,
  fallbackLevels = 6,
  onStatus,
}: Props) {
  const map = useMap();

  useEffect(() => {
    const layer = new ParentFallbackGridLayer(url, {
      tileSize: 256,
      opacity,
      pane,
      attribution,
      className,
      bounds,
      maxZoom,
      sourceMaxNativeZoom: maxNativeZoom,
      fallbackLevels,
    });
    let failed = false;
    let usedFallback = false;

    layer.on({
      loading: () => {
        failed = false;
        usedFallback = false;
        onStatus?.("loading");
      },
      tileload: (event: TileEvent) => {
        if (event.tile.dataset.parentFallbackZoom) usedFallback = true;
      },
      tileerror: () => {
        failed = true;
        onStatus?.("error");
      },
      load: () => onStatus?.(failed ? "error" : usedFallback ? "fallback" : "ready"),
    });
    layer.addTo(map);

    return () => {
      layer.off();
      if (map.hasLayer(layer)) map.removeLayer(layer);
    };
  }, [attribution, bounds, fallbackLevels, map, maxNativeZoom, maxZoom, onStatus, opacity, pane, url]);

  return null;
}

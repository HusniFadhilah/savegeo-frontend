import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { TileLayer, useMap } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import MapView from "@/components/map/MapView";

export type SwipeOrientation = "vertical" | "horizontal";

const BEFORE_PANE = "swipe-before-pane";
const AFTER_PANE = "swipe-after-pane";
// Above RESULT_PANE (350) so the "after" tile draws on top of the "before"
// tile, below overlayPane (400) so AOI polygons/markers stay on top of both.
const AFTER_PANE_Z_INDEX = 360;

function SwipePaneSetup({ onReady }: { onReady: () => void }) {
  const map = useMap();
  useEffect(() => {
    const beforePane = map.getPane(BEFORE_PANE) ?? map.createPane(BEFORE_PANE);
    const pane = map.getPane(AFTER_PANE) ?? map.createPane(AFTER_PANE);
    beforePane.style.zIndex = String(AFTER_PANE_Z_INDEX - 1);
    beforePane.style.pointerEvents = "none";
    beforePane.style.position = "absolute";
    beforePane.style.left = "0";
    beforePane.style.top = "0";
    beforePane.style.width = "100%";
    beforePane.style.height = "100%";
    beforePane.style.overflow = "hidden";
    pane.style.zIndex = String(AFTER_PANE_Z_INDEX);
    pane.style.pointerEvents = "none";
    pane.style.position = "absolute";
    pane.style.left = "0";
    pane.style.top = "0";
    pane.style.width = "100%";
    pane.style.height = "100%";
    pane.style.overflow = "hidden";
    onReady();
  }, [map, onReady]);
  return null;
}

type ClipPoint = { x: number; y: number };

function clipPolygon(points: ClipPoint[], inside: (point: ClipPoint) => boolean, intersect: (a: ClipPoint, b: ClipPoint) => ClipPoint) {
  if (!points.length) return [];
  const output: ClipPoint[] = [];
  let previous = points[points.length - 1];
  let previousInside = inside(previous);
  for (const current of points) {
    const currentInside = inside(current);
    if (currentInside !== previousInside) output.push(intersect(previous, current));
    if (currentInside) output.push(current);
    previous = current;
    previousInside = currentInside;
  }
  return output;
}

function clipRingToMap(points: ClipPoint[], width: number, height: number, orientation: SwipeOrientation, percent: number, side: "before" | "after") {
  const divider = orientation === "vertical" ? (width * percent) / 100 : (height * percent) / 100;
  const edges: Array<{ inside: (point: ClipPoint) => boolean; intersect: (a: ClipPoint, b: ClipPoint) => ClipPoint }> = [
    { inside: (p) => p.x >= 0, intersect: (a, b) => ({ x: 0, y: a.y + ((b.y - a.y) * (0 - a.x)) / (b.x - a.x) }) },
    { inside: (p) => p.x <= width, intersect: (a, b) => ({ x: width, y: a.y + ((b.y - a.y) * (width - a.x)) / (b.x - a.x) }) },
    { inside: (p) => p.y >= 0, intersect: (a, b) => ({ x: a.x + ((b.x - a.x) * (0 - a.y)) / (b.y - a.y), y: 0 }) },
    { inside: (p) => p.y <= height, intersect: (a, b) => ({ x: a.x + ((b.x - a.x) * (height - a.y)) / (b.y - a.y), y: height }) },
  ];
  if (orientation === "vertical") {
    edges.push(
      side === "before"
        ? { inside: (p) => p.x <= divider, intersect: (a, b) => ({ x: divider, y: a.y + ((b.y - a.y) * (divider - a.x)) / (b.x - a.x) }) }
        : { inside: (p) => p.x >= divider, intersect: (a, b) => ({ x: divider, y: a.y + ((b.y - a.y) * (divider - a.x)) / (b.x - a.x) }) },
    );
  } else {
    edges.push(
      side === "before"
        ? { inside: (p) => p.y <= divider, intersect: (a, b) => ({ x: a.x + ((b.x - a.x) * (divider - a.y)) / (b.y - a.y), y: divider }) }
        : { inside: (p) => p.y >= divider, intersect: (a, b) => ({ x: a.x + ((b.x - a.x) * (divider - a.y)) / (b.y - a.y), y: divider }) },
    );
  }
  return edges.reduce((result, edge) => clipPolygon(result, edge.inside, edge.intersect), points);
}

function aoiPath(
  geometry: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
  map: ReturnType<typeof useMap>,
  width: number,
  height: number,
  orientation: SwipeOrientation,
  percent: number,
  side: "before" | "after",
) {
  const polygons = geometry.geometry.type === "Polygon" ? [geometry.geometry.coordinates] : geometry.geometry.coordinates;
  const paths = polygons.flatMap((polygon) => {
    const ring = polygon[0]?.map(([lng, lat]) => {
      const point = map.latLngToLayerPoint([lat, lng]);
      return { x: point.x, y: point.y };
    });
    if (!ring || ring.length < 3) return [];
    const clipped = clipRingToMap(ring, width, height, orientation, percent, side);
    if (clipped.length < 3) return [];
    return [`M ${clipped.map((point) => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" L ")} Z`];
  });
  return paths.length ? `path("${paths.join(" ")}")` : "none";
}

/**
 * Clips the "after" pane with a CSS clip-path so only the portion past the
 * divider is visible - the "before" tile underneath shows through the rest.
 * This is what actually produces the swipe-reveal effect; no plugin needed.
 */
function ClipController({
  percent,
  orientation,
  paneReady,
  paneName,
  side,
  clipGeometry,
}: {
  percent: number;
  orientation: SwipeOrientation;
  paneReady: boolean;
  paneName: string;
  side: "before" | "after";
  clipGeometry?: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null;
}) {
  const map = useMap();
  useEffect(() => {
    const pane = map.getPane(paneName);
    if (!pane || !paneReady) return;
    pane.style.position = "absolute";
    pane.style.left = "0";
    pane.style.top = "0";
    pane.style.width = "100%";
    pane.style.height = "100%";
    pane.style.overflow = "hidden";
    const updateClip = () => {
      const size = map.getSize();
      const clip = clipGeometry
        ? aoiPath(clipGeometry, map, size.x, size.y, orientation, percent, side)
        : side === "after"
          ? orientation === "vertical" ? `inset(0 0 0 ${percent}%)` : `inset(${percent}% 0 0 0)`
          : "none";
      pane.style.clipPath = clip;
      pane.style.setProperty("-webkit-clip-path", clip);
    };
    updateClip();
    map.on("move zoom resize", updateClip);
    return () => {
      map.off("move zoom resize", updateClip);
    };
  }, [clipGeometry, map, paneName, paneReady, percent, orientation, side]);
  return null;
}

/**
 * Disables/enables map panning (drag-to-move, incl. touch drag) without
 * touching zoom (scroll/pinch/+-/double-click zoom are separate Leaflet
 * options, left untouched) - user request: dragging the swipe divider handle
 * could accidentally also pan the map underneath it (pointer events landing
 * just off the handle), shifting the comparison framing mid-drag. Locked by
 * default; a small toggle button lets the user re-enable panning if they
 * need to reposition before locking again.
 */
function PanLockController({ locked }: { locked: boolean }) {
  const map = useMap();
  useEffect(() => {
    // Leaflet's Dragging handler covers both mouse and touch drag uniformly
    // (the old separate Tap handler was for a delayed-click workaround, not
    // panning, and isn't present in this Leaflet version's types/runtime).
    if (locked) {
      map.dragging.disable();
    } else {
      map.dragging.enable();
    }
    return () => {
      map.dragging.enable();
    };
  }, [map, locked]);
  return null;
}

interface Props {
  id: string;
  beforeUrl: string | null;
  afterUrl: string | null;
  beforeLabel?: string;
  afterLabel?: string;
  orientation: SwipeOrientation;
  onOrientationChange?: (o: SwipeOrientation) => void;
  center?: [number, number];
  zoom?: number;
  maxZoom?: number;
  maxNativeZoom?: number;
  beforeMaxNativeZoom?: number;
  afterMaxNativeZoom?: number;
  beforeCrossOrigin?: "anonymous" | "use-credentials";
  afterCrossOrigin?: "anonymous" | "use-credentials";
  /** Same AOI bounds for both imagery layers. Prevents a scene tile from
   * rendering outside the selected comparison area. */
  bounds?: LatLngBoundsExpression;
  initialPercent?: number;
  opacity?: number;
  /** Exact AOI geometry used to clip both imagery panes before the swipe
   * divider is applied. The basemap and AOI overlays remain visible outside. */
  clipGeometry?: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null;
  /** Rendered inside the map, unclipped (e.g. AOI GeoJSON boundary). */
  children?: ReactNode;
}

/**
 * Single-map swipe/compare slider (à la Juxtapose / MapWarper) reused across
 * modules to compare imagery/land-cover/carbon-stock tiles from two
 * different years or sources. Both tiles load into the same Leaflet map,
 * stacked in separate panes; a draggable divider clips the top ("after")
 * pane. Vertical (left/right) and horizontal (top/bottom) both supported.
 */
export default function SwipeCompareMap({
  id,
  beforeUrl,
  afterUrl,
  beforeLabel = "Sebelum",
  afterLabel = "Sesudah",
  orientation,
  onOrientationChange,
  center,
  zoom,
  maxZoom,
  maxNativeZoom,
  beforeMaxNativeZoom,
  afterMaxNativeZoom,
  beforeCrossOrigin,
  afterCrossOrigin,
  bounds,
  initialPercent = 50,
  opacity = 1,
  clipGeometry,
  children,
}: Props) {
  const [percent, setPercent] = useState(Math.min(100, Math.max(0, initialPercent)));
  const [panLocked, setPanLocked] = useState(true);
  const [afterPaneReady, setAfterPaneReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const markAfterPaneReady = useCallback(() => setAfterPaneReady(true), []);

  const updateFromClientPos = (clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct =
      orientation === "vertical"
        ? ((clientX - rect.left) / rect.width) * 100
        : ((clientY - rect.top) / rect.height) * 100;
    setPercent(Math.min(100, Math.max(0, pct)));
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      updateFromClientPos(e.clientX, e.clientY);
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      updateFromClientPos(e.clientX, e.clientY);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orientation]);

  // Re-center the divider when the orientation flips, so it doesn't stay
  // pinned at an edge-looking spot from the other axis.
  useEffect(() => {
    setPercent(50);
  }, [orientation]);

  return (
    <div ref={containerRef} className="swipe-compare-wrap">
      <MapView id={id} center={center} zoom={zoom} maxZoom={maxZoom}>
        <SwipePaneSetup onReady={markAfterPaneReady} />
        {children}
        {beforeUrl && (
          <TileLayer
            key={beforeUrl}
            url={beforeUrl}
            opacity={opacity}
            pane={BEFORE_PANE}
            attribution="Google Earth Engine"
            crossOrigin={beforeCrossOrigin}
            bounds={bounds}
            maxNativeZoom={beforeMaxNativeZoom ?? maxNativeZoom}
            maxZoom={maxZoom}
          />
        )}
        {afterPaneReady && afterUrl && (
          <TileLayer
            key={afterUrl}
            url={afterUrl}
            opacity={opacity}
            pane={AFTER_PANE}
            attribution="Google Earth Engine"
            crossOrigin={afterCrossOrigin}
            bounds={bounds}
            maxNativeZoom={afterMaxNativeZoom ?? maxNativeZoom}
            maxZoom={maxZoom}
          />
        )}
        <ClipController
          percent={percent}
          orientation={orientation}
          paneReady={afterPaneReady}
          paneName={BEFORE_PANE}
          side="before"
          clipGeometry={clipGeometry}
        />
        <ClipController
          percent={percent}
          orientation={orientation}
          paneReady={afterPaneReady}
          paneName={AFTER_PANE}
          side="after"
          clipGeometry={clipGeometry}
        />
        <PanLockController locked={panLocked} />
      </MapView>

      <div className="swipe-label swipe-label-before">{beforeLabel}</div>
      <div className="swipe-label swipe-label-after">{afterLabel}</div>

      <div
        className={`swipe-divider swipe-divider-${orientation}`}
        style={orientation === "vertical" ? { left: `${percent}%` } : { top: `${percent}%` }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          draggingRef.current = true;
          updateFromClientPos(e.clientX, e.clientY);
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          draggingRef.current = true;
          updateFromClientPos(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          e.stopPropagation();
          if (draggingRef.current) updateFromClientPos(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          draggingRef.current = false;
          e.currentTarget.releasePointerCapture?.(e.pointerId);
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
      >
        <div className="swipe-handle">
          <i
            className={`fas ${orientation === "vertical" ? "fa-arrows-alt-h" : "fa-arrows-alt-v"}`}
          />
        </div>
      </div>

      {onOrientationChange && (
        <div className="swipe-orientation-toggle" role="group" aria-label="Arah slider">
          <button
            type="button"
            className={`btn btn-sm ${orientation === "vertical" ? "btn-primary" : "btn-outline-secondary"}`}
            title="Slider vertikal (kiri/kanan)"
            onClick={() => onOrientationChange("vertical")}
          >
            <i className="fas fa-grip-lines-vertical" />
          </button>
          <button
            type="button"
            className={`btn btn-sm ${orientation === "horizontal" ? "btn-primary" : "btn-outline-secondary"}`}
            title="Slider horizontal (atas/bawah)"
            onClick={() => onOrientationChange("horizontal")}
          >
            <i className="fas fa-grip-lines" />
          </button>
          <button
            type="button"
            className={`btn btn-sm ${panLocked ? "btn-primary" : "btn-outline-secondary"}`}
            title={
              panLocked
                ? "Posisi peta terkunci (geser divider tidak menggeser peta) - klik untuk buka kunci"
                : "Posisi peta bebas digeser - klik untuk kunci lagi"
            }
            onClick={() => setPanLocked((v) => !v)}
          >
            <i className={`fas ${panLocked ? "fa-lock" : "fa-lock-open"}`} />
          </button>
        </div>
      )}
    </div>
  );
}

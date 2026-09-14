import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TileLayer, useMap } from "react-leaflet";
import type {
  LatLngBoundsExpression,
  TileLayer as LeafletTileLayer,
  Map as LeafletMap,
} from "leaflet";
import RasterResolutionNotice from "./RasterResolutionNotice";
import MapView from "@/components/map/MapView";
import "@/styles/disaster-swipe.css";

export type SwipeOrientation = "vertical" | "horizontal";

const BEFORE_PANE = "swipe-before";
const AFTER_PANE = "swipe-after";
// Above RESULT_PANE (350) so the "after" tile draws on top of the "before"
// tile, below overlayPane (400) so AOI polygons/markers stay on top of both.
const AFTER_PANE_Z_INDEX = 360;

type TileStatus = "loading" | "ready" | "error";

// Subscribe before TileLayer mounts, including cached tiles. Keep the layer
// mounted while the divider moves; only source/AOI changes replace it.
function CompareTile({
  onStatus,
  ...props
}: React.ComponentProps<typeof TileLayer> & {
  onStatus: (status: TileStatus) => void;
}) {
  const layer = useRef<LeafletTileLayer>(null);
  const failed = useRef(false);
  const handlers = useMemo(
    () => ({
      loading: () => {
        failed.current = false;
        onStatus("loading");
      },
      tileerror: () => {
        failed.current = true;
        onStatus("error");
      },
      load: () => onStatus(failed.current ? "error" : "ready"),
    }),
    [onStatus],
  );
  useEffect(() => {
    if (layer.current && !layer.current.isLoading()) {
      onStatus(failed.current ? "error" : "ready");
    }
  }, [onStatus]);
  return <TileLayer {...props} ref={layer} eventHandlers={handlers} />;
}

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
    beforePane.style.width = `${map.getSize().x}px`;
    beforePane.style.height = `${map.getSize().y}px`;
    beforePane.style.clipPath = 'path("M 0 0 Z")';
    beforePane.style.overflow = "visible";
    pane.style.zIndex = String(AFTER_PANE_Z_INDEX);
    pane.style.pointerEvents = "none";
    pane.style.position = "absolute";
    pane.style.left = "0";
    pane.style.top = "0";
    pane.style.width = `${map.getSize().x}px`;
    pane.style.height = `${map.getSize().y}px`;
    pane.style.clipPath = 'path("M 0 0 Z")';
    pane.style.overflow = "visible";
    onReady();
  }, [map, onReady]);
  return null;
}

type ClipPoint = { x: number; y: number };

function clipPolygon(
  points: ClipPoint[],
  inside: (point: ClipPoint) => boolean,
  intersect: (a: ClipPoint, b: ClipPoint) => ClipPoint,
) {
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

function clipRingToMap(
  points: ClipPoint[],
  width: number,
  height: number,
  orientation: SwipeOrientation,
  percent: number,
  side: "before" | "after",
) {
  const divider = orientation === "vertical" ? (width * percent) / 100 : (height * percent) / 100;
  const edges: Array<{
    inside: (point: ClipPoint) => boolean;
    intersect: (a: ClipPoint, b: ClipPoint) => ClipPoint;
  }> = [
    {
      inside: (p) => p.x >= 0,
      intersect: (a, b) => ({ x: 0, y: a.y + ((b.y - a.y) * (0 - a.x)) / (b.x - a.x) }),
    },
    {
      inside: (p) => p.x <= width,
      intersect: (a, b) => ({ x: width, y: a.y + ((b.y - a.y) * (width - a.x)) / (b.x - a.x) }),
    },
    {
      inside: (p) => p.y >= 0,
      intersect: (a, b) => ({ x: a.x + ((b.x - a.x) * (0 - a.y)) / (b.y - a.y), y: 0 }),
    },
    {
      inside: (p) => p.y <= height,
      intersect: (a, b) => ({ x: a.x + ((b.x - a.x) * (height - a.y)) / (b.y - a.y), y: height }),
    },
  ];
  if (orientation === "vertical") {
    edges.push(
      side === "before"
        ? {
            inside: (p) => p.x <= divider,
            intersect: (a, b) => ({
              x: divider,
              y: a.y + ((b.y - a.y) * (divider - a.x)) / (b.x - a.x),
            }),
          }
        : {
            inside: (p) => p.x >= divider,
            intersect: (a, b) => ({
              x: divider,
              y: a.y + ((b.y - a.y) * (divider - a.x)) / (b.x - a.x),
            }),
          },
    );
  } else {
    edges.push(
      side === "before"
        ? {
            inside: (p) => p.y <= divider,
            intersect: (a, b) => ({
              x: a.x + ((b.x - a.x) * (divider - a.y)) / (b.y - a.y),
              y: divider,
            }),
          }
        : {
            inside: (p) => p.y >= divider,
            intersect: (a, b) => ({
              x: a.x + ((b.x - a.x) * (divider - a.y)) / (b.y - a.y),
              y: divider,
            }),
          },
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
  const polygons =
    geometry.geometry.type === "Polygon"
      ? [geometry.geometry.coordinates]
      : geometry.geometry.coordinates;
  const origin = map.containerPointToLayerPoint([0, 0]);
  const paths = polygons.flatMap((polygon) =>
    polygon.flatMap((coordinates) => {
      const ring = coordinates.map(([lng, lat]) => {
        const point = map.latLngToContainerPoint([lat, lng]);
        return { x: point.x, y: point.y };
      });
      if (!ring || ring.length < 3) return [];
      const clipped = clipRingToMap(ring, width, height, orientation, percent, side);
      if (clipped.length < 3) return [];
      return [
        `M ${clipped.map((point) => `${(point.x + origin.x).toFixed(1)} ${(point.y + origin.y).toFixed(1)}`).join(" L ")} Z`,
      ];
    }),
  );
  // Empty intersection must hide imagery; `none` would expose the entire scene.
  return paths.length ? `path(evenodd, "${paths.join(" ")}")` : 'path("M 0 0 Z")';
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
    // Leaflet's mapPane is translated and has no viewport dimensions. Keep
    // tiles in its coordinate system; clipping alone supplies the viewport.
    pane.style.overflow = "visible";
    const updateClip = () => {
      const size = map.getSize();
      pane.style.width = `${size.x}px`;
      pane.style.height = `${size.y}px`;
      const origin = map.containerPointToLayerPoint([0, 0]);
      const cutX = orientation === "vertical" ? (size.x * percent) / 100 : 0;
      const cutY = orientation === "horizontal" ? (size.y * percent) / 100 : 0;
      const left = origin.x + (side === "after" ? cutX : 0);
      const top = origin.y + (side === "after" ? cutY : 0);
      const right = origin.x + (side === "before" && orientation === "vertical" ? cutX : size.x);
      const bottom = origin.y + (side === "before" && orientation === "horizontal" ? cutY : size.y);
      const clip = clipGeometry
        ? aoiPath(clipGeometry, map, size.x, size.y, orientation, percent, side)
        : `polygon(${left}px ${top}px, ${right}px ${top}px, ${right}px ${bottom}px, ${left}px ${bottom}px)`;
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
  beforeResolutionM?: number;
  afterResolutionM?: number;
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
  beforeResolutionM,
  afterResolutionM,
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
  const [retry, setRetry] = useState(0);
  const sourceKey = useMemo(
    () =>
      JSON.stringify([
        beforeUrl,
        afterUrl,
        bounds,
        clipGeometry,
        retry,
        beforeMaxNativeZoom,
        afterMaxNativeZoom,
        maxNativeZoom,
        maxZoom,
      ]),
    [
      beforeUrl,
      afterUrl,
      bounds,
      clipGeometry,
      retry,
      beforeMaxNativeZoom,
      afterMaxNativeZoom,
      maxNativeZoom,
      maxZoom,
    ],
  );
  const [beforeStatus, setBeforeStatus] = useState<{ key: string; status: TileStatus }>();
  const [afterStatus, setAfterStatus] = useState<{ key: string; status: TileStatus }>();
  const reportBefore = useCallback(
    (status: TileStatus) => setBeforeStatus({ key: sourceKey, status }),
    [sourceKey],
  );
  const reportAfter = useCallback(
    (status: TileStatus) => setAfterStatus({ key: sourceKey, status }),
    [sourceKey],
  );
  const ready =
    (!beforeUrl || (beforeStatus?.key === sourceKey && beforeStatus.status === "ready")) &&
    (!afterUrl || (afterStatus?.key === sourceKey && afterStatus.status === "ready"));
  const hasError =
    (beforeUrl && beforeStatus?.key === sourceKey && beforeStatus.status === "error") ||
    (afterUrl && afterStatus?.key === sourceKey && afterStatus.status === "error");
  // A missing tile should not disable the whole comparison. Leaflet can still
  // render the other tiles, and the user can retry only the affected source.
  const enabled = !!beforeUrl && !!afterUrl && (ready || !!hasError);
  const mapRef = useRef<LeafletMap | null>(null);
  const restorePanRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const frameRef = useRef<number>();
  const markAfterPaneReady = useCallback(() => setAfterPaneReady(true), []);
  const finishDrag = useCallback(() => {
    draggingRef.current = false;
    if (restorePanRef.current) mapRef.current?.dragging.enable();
    restorePanRef.current = false;
  }, []);

  const updateFromClientPos = (clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct =
      orientation === "vertical"
        ? ((clientX - rect.left) / rect.width) * 100
        : ((clientY - rect.top) / rect.height) * 100;
    if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = undefined;
      setPercent(Math.min(100, Math.max(0, pct)));
    });
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      updateFromClientPos(e.clientX, e.clientY);
    };
    const onUp = finishDrag;
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      updateFromClientPos(e.clientX, e.clientY);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onUp);
      finishDrag();
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orientation, finishDrag]);

  useEffect(() => {
    finishDrag();
  }, [sourceKey, orientation, enabled, finishDrag]);

  return (
    <div ref={containerRef} className="swipe-compare-wrap">
      <MapView
        id={id}
        center={center}
        zoom={zoom}
        maxZoom={maxZoom}
        onMapReady={(map) => {
          mapRef.current = map;
        }}
      >
        <SwipePaneSetup onReady={markAfterPaneReady} />
        {children}
        {afterPaneReady && beforeUrl && (
          <CompareTile
            key={`before-${sourceKey}`}
            onStatus={reportBefore}
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
          <CompareTile
            key={`after-${sourceKey}`}
            onStatus={reportAfter}
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
          percent={!afterUrl ? 100 : !beforeUrl ? 0 : percent}
          orientation={orientation}
          paneReady={afterPaneReady}
          paneName={BEFORE_PANE}
          side="before"
          clipGeometry={clipGeometry}
        />
        <ClipController
          percent={!afterUrl ? 100 : !beforeUrl ? 0 : percent}
          orientation={orientation}
          paneReady={afterPaneReady}
          paneName={AFTER_PANE}
          side="after"
          clipGeometry={clipGeometry}
        />
        <PanLockController locked={panLocked} />
        {(beforeResolutionM || afterResolutionM) && (
          <RasterResolutionNotice
            layers={[
              {
                label: beforeLabel,
                resolutionM: beforeResolutionM,
                nativeZoom: beforeMaxNativeZoom ?? maxNativeZoom,
                tileUrl: beforeUrl,
              },
              {
                label: afterLabel,
                resolutionM: afterResolutionM,
                nativeZoom: afterMaxNativeZoom ?? maxNativeZoom,
                tileUrl: afterUrl,
              },
            ]}
          />
        )}
      </MapView>

      <div
        className={`swipe-label swipe-label-before swipe-label-${orientation}`}
        style={
          orientation === "horizontal"
            ? { top: 52, bottom: "auto", left: "auto", right: 8, maxWidth: "calc(100% - 80px)" }
            : undefined
        }
      >
        {beforeLabel}
      </div>
      <div
        className={`swipe-label swipe-label-after swipe-label-${orientation}`}
        style={orientation === "horizontal" ? { top: 8, bottom: "auto" } : undefined}
      >
        {afterLabel}
      </div>
      {!enabled && (
        <div className="swipe-status" aria-live="polite">
          {hasError ? (
            <>
              Sebagian tile gagal dimuat.{" "}
              <button
                type="button"
                className="swipe-retry"
                onClick={() => setRetry((value) => value + 1)}
              >
                Coba lagi
              </button>
            </>
          ) : !beforeUrl || !afterUrl ? (
            "Perbandingan memerlukan dua layer. Layer yang tersedia tetap ditampilkan."
          ) : (
            "Memuat kedua citra…"
          )}
        </div>
      )}

      <div
        className={`swipe-divider swipe-divider-${orientation}`}
        role="slider"
        tabIndex={enabled ? 0 : -1}
        aria-label={`${beforeLabel} / ${afterLabel}`}
        aria-orientation={orientation === "vertical" ? "horizontal" : "vertical"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-disabled={!enabled}
        onKeyDown={(e) => {
          if (!enabled) return;
          const direction = ["ArrowRight", "ArrowDown"].includes(e.key)
            ? 1
            : ["ArrowLeft", "ArrowUp"].includes(e.key)
              ? -1
              : 0;
          if (!direction && e.key !== "Home" && e.key !== "End") return;
          e.preventDefault();
          e.stopPropagation();
          setPercent((value) =>
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? 100
                : Math.max(0, Math.min(100, value + direction * (e.shiftKey ? 10 : 1))),
          );
        }}
        style={orientation === "vertical" ? { left: `${percent}%` } : { top: `${percent}%` }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!enabled) return;
          restorePanRef.current = mapRef.current?.dragging.enabled() ?? false;
          mapRef.current?.dragging.disable();
          draggingRef.current = true;
          updateFromClientPos(e.clientX, e.clientY);
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!enabled || draggingRef.current) return;
          restorePanRef.current = mapRef.current?.dragging.enabled() ?? false;
          mapRef.current?.dragging.disable();
          draggingRef.current = true;
          updateFromClientPos(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          e.stopPropagation();
          if (draggingRef.current) updateFromClientPos(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          finishDrag();
          if (e.currentTarget.hasPointerCapture?.(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          finishDrag();
        }}
        onLostPointerCapture={finishDrag}
      >
        <div className="swipe-handle">
          <i
            className={`fas ${orientation === "vertical" ? "fa-arrows-alt-h" : "fa-arrows-alt-v"}`}
          />
        </div>
      </div>

      {
        <div className="swipe-orientation-toggle" role="group" aria-label="Arah slider">
          {onOrientationChange && (
            <>
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
            </>
          )}
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
      }
    </div>
  );
}

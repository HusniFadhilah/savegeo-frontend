import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { TileLayer, useMap } from "react-leaflet";
import MapView from "@/components/map/MapView";
import { RESULT_PANE } from "@/config/mapPanes";

export type SwipeOrientation = "vertical" | "horizontal";

const AFTER_PANE = "swipe-after-pane";
// Above RESULT_PANE (350) so the "after" tile draws on top of the "before"
// tile, below overlayPane (400) so AOI polygons/markers stay on top of both.
const AFTER_PANE_Z_INDEX = 360;

function AfterPaneSetup({ onReady }: { onReady: () => void }) {
  const map = useMap();
  useEffect(() => {
    const pane = map.getPane(AFTER_PANE) ?? map.createPane(AFTER_PANE);
    pane.style.zIndex = String(AFTER_PANE_Z_INDEX);
    pane.style.pointerEvents = "none";
    pane.style.inset = "0";
    pane.style.width = "100%";
    pane.style.height = "100%";
    pane.style.overflow = "hidden";
    onReady();
  }, [map, onReady]);
  return null;
}

/**
 * Clips the "after" pane with a CSS clip-path so only the portion past the
 * divider is visible - the "before" tile underneath shows through the rest.
 * This is what actually produces the swipe-reveal effect; no plugin needed.
 */
function ClipController({
  percent,
  orientation,
}: {
  percent: number;
  orientation: SwipeOrientation;
}) {
  const map = useMap();
  useEffect(() => {
    const pane = map.getPane(AFTER_PANE);
    if (!pane) return;
    pane.style.inset = "0";
    pane.style.width = "100%";
    pane.style.height = "100%";
    pane.style.overflow = "hidden";
    pane.style.clipPath =
      orientation === "vertical" ? `inset(0 0 0 ${percent}%)` : `inset(${percent}% 0 0 0)`;
  }, [map, percent, orientation]);
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
  opacity?: number;
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
  opacity = 1,
  children,
}: Props) {
  const [percent, setPercent] = useState(50);
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
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
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
        <AfterPaneSetup onReady={markAfterPaneReady} />
        {children}
        {beforeUrl && (
          <TileLayer
            url={beforeUrl}
            opacity={opacity}
            pane={RESULT_PANE}
            attribution="Google Earth Engine"
            maxNativeZoom={maxNativeZoom}
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
            maxNativeZoom={maxNativeZoom}
            maxZoom={maxZoom}
          />
        )}
        <ClipController percent={percent} orientation={orientation} />
        <PanLockController locked={panLocked} />
      </MapView>

      <div className="swipe-label swipe-label-before">{beforeLabel}</div>
      <div className="swipe-label swipe-label-after">{afterLabel}</div>

      <div
        className={`swipe-divider swipe-divider-${orientation}`}
        style={orientation === "vertical" ? { left: `${percent}%` } : { top: `${percent}%` }}
        onPointerDown={(e) => {
          draggingRef.current = true;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
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

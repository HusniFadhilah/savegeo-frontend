import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMap } from "react-leaflet";
import { useI18nStore } from "@/hooks/useI18nStore";
import "./ResultMapLegendControl.css";

interface Props {
  children: ReactNode;
}

/** Icon control aligned below the map export button, with a legend popover. */
export default function ResultMapLegendControl({ children }: Props) {
  const map = useMap();
  const t = useI18nStore((state) => state.t);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return createPortal(
    <div
      ref={rootRef}
      className="result-map-legend-control"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="result-map-legend-control__trigger"
        aria-label={t("carbon.resultsMap.legendControl")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        title={t("carbon.resultsMap.legendControl")}
        onClick={() => setOpen((value) => !value)}
      >
        <i className="bi bi-palette" aria-hidden="true" />
      </button>
      {open && (
        <section
          id={popoverId}
          className="result-map-legend-control__popover"
          role="dialog"
          aria-label={t("carbon.resultsMap.legendTitle")}
        >
          <div className="result-map-legend-control__heading">
            {t("carbon.resultsMap.legendTitle")}
          </div>
          <div className="result-map-legend-control__content">{children}</div>
        </section>
      )}
    </div>,
    map.getContainer(),
  );
}

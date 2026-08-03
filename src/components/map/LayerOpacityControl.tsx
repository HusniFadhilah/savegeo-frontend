import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

interface Props {
  opacity: number;
  onChange: (value: number) => void;
  label?: string;
}

/**
 * Real Leaflet control (topleft), rendered as a map child so it stacks
 * directly under the zoom/fullscreen buttons in the same corner column
 * instead of floating above the map as a separate card. Collapsed to a
 * single icon by default - the slider only appears on hover, mirroring
 * BasemapSwitcher's trigger/panel pattern.
 */
export default function LayerOpacityControl({ opacity, onChange, label = "Opacity" }: Props) {
  const map = useMap();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const sliderRef = useRef<HTMLInputElement | null>(null);
  const valueRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const control = new L.Control({ position: "topleft" });

    control.onAdd = () => {
      const wrapper = L.DomUtil.create("div", "leaflet-bar leaflet-control opacity-control");

      const trigger = L.DomUtil.create("a", "opacity-trigger", wrapper) as HTMLAnchorElement;
      trigger.href = "#";
      trigger.title = label;
      trigger.innerHTML = '<i class="bi bi-droplet-half"></i>';
      L.DomEvent.on(trigger, "click", (e) => L.DomEvent.preventDefault(e));

      const panel = L.DomUtil.create("div", "opacity-panel", wrapper);
      panel.innerHTML =
        `<label class="opacity-panel-label">${label}: <span class="opacity-value"></span></label>` +
        `<input type="range" class="form-range" min="0" max="1" step="0.05" />`;

      const slider = panel.querySelector("input") as HTMLInputElement;
      const valueLabel = panel.querySelector(".opacity-value") as HTMLSpanElement;
      sliderRef.current = slider;
      valueRef.current = valueLabel;
      slider.value = String(opacity);
      valueLabel.textContent = `${Math.round(opacity * 100)}%`;

      L.DomEvent.on(slider, "input", () => {
        onChangeRef.current(Number(slider.value));
      });

      L.DomEvent.disableClickPropagation(wrapper);
      L.DomEvent.disableScrollPropagation(wrapper);

      return wrapper;
    };

    control.addTo(map);

    return () => {
      map.removeControl(control);
      sliderRef.current = null;
      valueRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, label]);

  useEffect(() => {
    if (sliderRef.current) sliderRef.current.value = String(opacity);
    if (valueRef.current) valueRef.current.textContent = `${Math.round(opacity * 100)}%`;
  }, [opacity]);

  return null;
}

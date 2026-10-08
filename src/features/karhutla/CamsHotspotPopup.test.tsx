import { useEffect, useRef } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { CircleMarker, MapContainer, useMap } from "react-leaflet";
import { Browser, type CircleMarker as LeafletCircleMarker, type Map as LeafletMap } from "leaflet";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CamsHotspotPopup from "./CamsHotspotPopup";
import type { CamsPointSample } from "./types";

const fetchPoint = vi.hoisted(() => vi.fn());
vi.mock("@/features/disaster/api", () => ({ fetchWildfireCamsPoint: fetchPoint }));
vi.mock("@/hooks/useI18nStore", () => ({ useI18nStore: () => ({ language: "en", t: (key: string) => key }) }));

const sample: CamsPointSample = {
  layer_id: "organic_aod", frame_id: "aod", product: "ifs_cams", valid_at: "2026-10-06T12:00:00Z",
  interval_end: null, is_forecast: false, forecast_reference_time: null, leadtime_hours: null,
  data_available: true, reason: null, value: 0.4, unit: "AOD 550 nm", source_value: 0.4, source_unit: "1",
  center: { lat: -2.4, lon: 114.4 }, cell_area_km2: 1967, mass_tonnes: null,
};
let map: LeafletMap;
let marker: LeafletCircleMarker;
const supportsSvg = Browser.svg;
function Scene({ enabled = true }: { enabled?: boolean }) {
  const markerRef = useRef<LeafletCircleMarker>(null);
  function Capture() {
    const instance = useMap();
    useEffect(() => { map = instance; marker = markerRef.current!; }, [instance]);
    return null;
  }
  return <MapContainer center={[-2.4, 114.2]} zoom={6} style={{ width: 800, height: 600 }}>
    <CircleMarker ref={markerRef} center={[-2.4, 114.2]} radius={5} bubblingMouseEvents={false}>
      <CamsHotspotPopup slug="kalimantan-2026" position={[-2.4, 114.2]} layers={enabled ? [
        { layerId: "burnt_carbon", frameId: "gfas" },
        { layerId: "organic_aod", frameId: "aod", scope: "world" },
      ] : []}><strong>Hotspot coordinates</strong></CamsHotspotPopup>
    </CircleMarker>
    <Capture />
  </MapContainer>;
}
const clickBackground = () => act(() => {
  const event = { latlng: { lat: 20, lng: 30 }, originalEvent: new MouseEvent("click") };
  map.fire("preclick", event);
  map.fire("click", event);
});
const clickMarker = () => act(() => { marker.fire("click", { latlng: marker.getLatLng() }); });

describe("CAMS values at hotspot points", () => {
  beforeEach(() => {
    Object.defineProperty(Browser, "svg", { value: true, configurable: true });
    fetchPoint.mockReset();
    fetchPoint.mockResolvedValue(sample);
  });
  afterEach(() => { Object.defineProperty(Browser, "svg", { value: supportsSvg, configurable: true }); });

  it("does not read cells on load or background clicks, and queries the marker coordinates only", async () => {
    render(<Scene />);
    expect(fetchPoint).not.toHaveBeenCalled();
    clickBackground();
    expect(fetchPoint).not.toHaveBeenCalled();
    expect(screen.queryByText("wildfire.cams.pointLoading")).toBeNull();
    clickMarker();
    expect(await screen.findAllByText("0.4 AOD 550 nm")).toHaveLength(2);
    expect(screen.getByText("Hotspot coordinates")).toBeTruthy();
    expect(fetchPoint).toHaveBeenNthCalledWith(1, "kalimantan-2026", "burnt_carbon", "gfas", -2.4, 114.2, "event");
    expect(fetchPoint).toHaveBeenNthCalledWith(2, "kalimantan-2026", "organic_aod", "aod", -2.4, 114.2, "world");
    clickBackground();
    expect(fetchPoint).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Hotspot coordinates")).toBeNull();
    clickMarker();
    await waitFor(() => expect(fetchPoint).toHaveBeenCalledTimes(4));
  });

  it("ignores an unfinished request when the popup closes", async () => {
    let resolve!: (value: CamsPointSample) => void;
    fetchPoint.mockReturnValue(new Promise<CamsPointSample>((done) => { resolve = done; }));
    render(<Scene />);
    clickMarker();
    await screen.findByText("wildfire.cams.pointLoading");
    clickBackground();
    await act(async () => { resolve(sample); });
    expect(screen.queryByText("0.4 AOD 550 nm")).toBeNull();
    expect(fetchPoint).toHaveBeenCalledTimes(2);
  });

  it("keeps the normal hotspot popup without reading CAMS when the layers are disabled", () => {
    render(<Scene enabled={false} />);
    clickMarker();
    expect(screen.getByText("Hotspot coordinates")).toBeTruthy();
    expect(fetchPoint).not.toHaveBeenCalled();
  });
});

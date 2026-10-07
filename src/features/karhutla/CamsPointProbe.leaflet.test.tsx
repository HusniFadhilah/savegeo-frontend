import { useEffect } from "react";
import { act, render, screen } from "@testing-library/react";
import { MapContainer, useMap } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import { expect, it, vi } from "vitest";
import CamsPointProbe from "./CamsPointProbe";
import type { CamsPointSample } from "./types";

const fetchPoint = vi.hoisted(() => vi.fn());
vi.mock("@/features/disaster/api", () => ({ fetchWildfireCamsPoint: fetchPoint }));
vi.mock("@/hooks/useI18nStore", () => ({ useI18nStore: () => ({ language: "en", t: (key: string) => key }) }));

it("opens a real Leaflet popup again on repeated clicks, including the same point", async () => {
  let map!: LeafletMap;
  function CaptureMap() {
    const instance = useMap();
    useEffect(() => { map = instance; }, [instance]);
    return null;
  }
  const sample: CamsPointSample = {
    layer_id: "organic_aod", frame_id: "aod", product: "ifs_cams", valid_at: "2026-10-05T00:00:00Z",
    interval_end: null, is_forecast: false, forecast_reference_time: null, leadtime_hours: null,
    data_available: true, reason: null, value: 0.4, unit: "AOD 550 nm", source_value: 0.4, source_unit: "1",
    center: { lat: -2.4, lon: 114.4 }, cell_area_km2: 1967, mass_tonnes: null,
  };
  fetchPoint.mockResolvedValue(sample);
  render(<MapContainer center={[-2.4, 114.2]} zoom={6} style={{ width: 800, height: 600 }}>
    <CaptureMap />
    <CamsPointProbe slug="test" layers={[{ layerId: "organic_aod", frameId: "aod" }]} />
  </MapContainer>);
  const click = () => act(() => {
    const event = { latlng: { lat: -2.4, lng: 114.2 }, originalEvent: new MouseEvent("click") };
    // Leaflet closes the previous standalone popup before its click event.
    map.fire("preclick", event);
    map.fire("click", event);
  });
  click();
  await screen.findByText("0.4 AOD 550 nm");
  let resolve!: (value: CamsPointSample) => void;
  fetchPoint.mockReturnValue(new Promise<CamsPointSample>((done) => { resolve = done; }));
  click();
  await screen.findByText("wildfire.cams.pointLoading");
  await act(async () => { resolve({ ...sample, value: 1.25 }); });
  expect(await screen.findByText("1.25 AOD 550 nm")).toBeTruthy();
  expect(document.querySelectorAll(".cams-point-popup")).toHaveLength(1);
});

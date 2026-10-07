import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CamsPointProbe from "./CamsPointProbe";
import type { CamsPointSample } from "./types";

const mocks = vi.hoisted(() => ({
  fetchPoint: vi.fn(),
  listeners: new Map<string, (event: unknown) => void>(),
  map: { on: vi.fn(), off: vi.fn() },
  currentPopup: {} as object,
}));
vi.mock("@/features/disaster/api", () => ({ fetchWildfireCamsPoint: mocks.fetchPoint }));
vi.mock("@/hooks/useI18nStore", () => ({ useI18nStore: () => ({ language: "en", t: (key: string) => key }) }));
vi.mock("react-leaflet", () => ({
  useMap: () => mocks.map,
  Popup: forwardRef(function MockPopup({ children }: { children: ReactNode }, ref) {
    const instance = useRef({ options: { className: "cams-point-popup" } }).current;
    useImperativeHandle(ref, () => instance);
    mocks.currentPopup = instance;
    // Leaflet emits popupclose when React removes an older popup instance.
    useEffect(() => () => { mocks.listeners.get("popupclose")?.({ popup: instance }); }, [instance]);
    return <div role="dialog">{children}</div>;
  }),
}));
const sample = (overrides: Partial<CamsPointSample> = {}): CamsPointSample => ({
  layer_id: "organic_aod", frame_id: "aod", product: "ifs_cams", valid_at: "2026-10-05T00:00:00Z",
  interval_end: null, is_forecast: false, forecast_reference_time: null, leadtime_hours: null,
  data_available: true, reason: null, value: 0.4, unit: "AOD 550 nm", source_value: 0.4, source_unit: "1",
  center: { lat: -2.45, lon: 114.25 }, cell_area_km2: 120, mass_tonnes: null, ...overrides,
});
const click = (lat = -2.4, lng = 114.2) => act(() => {
  mocks.listeners.get("click")?.({ latlng: { lat, lng } });
});

describe("CAMS point popup", () => {
  beforeEach(() => {
    mocks.fetchPoint.mockReset();
    mocks.listeners.clear();
    mocks.map.on.mockImplementation((name, handler) => { mocks.listeners.set(name, handler); });
    mocks.map.off.mockImplementation((name) => { mocks.listeners.delete(name); });
  });
  it("shows both active fields, native centre, emission mass and forecast time", async () => {
    mocks.fetchPoint.mockImplementation((_slug, layerId) => Promise.resolve(layerId === "burnt_carbon"
      ? sample({ layer_id: layerId, frame_id: "gfas", mass_tonnes: 20559, value: 12, unit: "t C/km²/day", interval_end: "2026-10-06T00:00:00Z" })
      : sample({ is_forecast: true, leadtime_hours: 24 })));
    render(<CamsPointProbe slug="kalimantan-2026" layers={[{ layerId: "burnt_carbon", frameId: "gfas" }, { layerId: "organic_aod", frameId: "aod" }]} />);
    click();
    expect(await screen.findByText("20,559 t C")).toBeTruthy();
    expect(screen.getByText("0.4 AOD 550 nm")).toBeTruthy();
    expect(screen.getAllByText("2.450° S, 114.250° E")).toHaveLength(2);
    expect(screen.getByText("wildfire.cams.forecast · +24 h")).toBeTruthy();
    expect(mocks.fetchPoint).toHaveBeenNthCalledWith(1, "kalimantan-2026", "burnt_carbon", "gfas", -2.4, 114.2, "event");
    expect(mocks.fetchPoint).toHaveBeenNthCalledWith(2, "kalimantan-2026", "organic_aod", "aod", -2.4, 114.2, "event");
  });
  it("ignores a slow earlier click and clears when frames change or layers are disabled", async () => {
    let finishFirst!: (value: CamsPointSample) => void;
    mocks.fetchPoint.mockReturnValueOnce(new Promise<CamsPointSample>((resolve) => { finishFirst = resolve; }))
      .mockResolvedValue(sample({ value: 0.7 }));
    const view = render(<CamsPointProbe slug="test" layers={[{ layerId: "organic_aod", frameId: "first" }]} />);
    click();
    click(-3, 115);
    await screen.findByText("0.7 AOD 550 nm");
    await act(async () => { finishFirst(sample({ value: 0.1 })); });
    expect(screen.queryByText("0.1 AOD 550 nm")).toBeNull();
    view.rerender(<CamsPointProbe slug="test" layers={[{ layerId: "organic_aod", frameId: "second" }]} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    view.rerender(<CamsPointProbe slug="test" layers={[]} />);
    expect(mocks.listeners.has("click")).toBe(false);
  });
  it("keeps zero distinct from nodata and allows retry after a failed request", async () => {
    mocks.fetchPoint.mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(sample({ data_available: false, reason: "nodata", value: null }))
      .mockResolvedValueOnce(sample({ value: 0 }));
    render(<CamsPointProbe slug="test" layers={[{ layerId: "organic_aod", frameId: "aod" }]} />);
    click();
    await screen.findByText("wildfire.cams.pointError");
    click();
    await screen.findByText("wildfire.cams.pointMissing");
    expect(screen.queryByText("0 AOD 550 nm")).toBeNull();
    click();
    await screen.findByText("0 AOD 550 nm");
  });
  it("closing the popup prevents a pending response reopening it", async () => {
    let finish!: (value: CamsPointSample) => void;
    mocks.fetchPoint.mockReturnValue(new Promise<CamsPointSample>((resolve) => { finish = resolve; }));
    render(<CamsPointProbe slug="test" layers={[{ layerId: "organic_aod", frameId: "aod" }]} />);
    click();
    act(() => { mocks.listeners.get("popupclose")?.({ popup: mocks.currentPopup }); });
    await act(async () => { finish(sample()); });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

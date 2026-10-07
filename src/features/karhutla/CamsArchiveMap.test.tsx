import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CamsArchiveMap from "./CamsArchiveMap";
import type { CamsArchive, CamsFrame } from "./types";

const getArchive = vi.hoisted(() => vi.fn());
vi.mock("@/features/disaster/api", () => ({ fetchWildfireCamsArchive: getArchive }));
vi.mock("@/hooks/useI18nStore", () => ({ useI18nStore: () => ({ language: "en", t: (key: string) => key }) }));
vi.mock("@/components/map/MapView", () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/map/BasemapSwitcher", () => ({ default: () => null }));
vi.mock("react-leaflet", () => ({ TileLayer: ({ url }: { url: string }) => <div data-testid="tile-url">{url}</div> }));
const frame = (id: string, date: string, kg: number | null): CamsFrame => ({
  id, valid_at: `${date}T00:00:00Z`, interval_end: null, version: "1.4.2", sha256: "a".repeat(64),
  forecast_reference_time: null, leadtime_hours: null, is_forecast: false,
  summary: { unit: "kg", valid_cell_count: kg === null ? 0 : 1, missing_cell_count: 0, integrated_mass_kg: kg },
  regions: [], provenance: { source_url: "https://ads.atmosphere.copernicus.eu", source_unit: "kg m-2 s-1", source_valid_at: `${date}T00:00:00Z`, retrieved_at: `${date}T00:00:00Z`, fire_only: true },
});
const archive: CamsArchive = {
  event_slug: "kalimantan-2026", bbox: [108, -5, 120, 6], updated_at: "2026-10-07T00:00:00Z",
  layers: { burnt_carbon: { product: "gfas", variable: "burnt_carbon", source_unit: "kg m-2 s-1",
    display_unit: "t C/km²/day", palette: ["542400", "fffbd6"], maximum: 2, resolution_degrees: 0.1,
    frames: [frame("first", "2026-10-03", 12000), frame("missing", "2026-10-04", null), frame("last", "2026-10-05", 25000)] } },
};
describe("CAMS archive map", () => {
  beforeEach(() => { getArchive.mockReset(); getArchive.mockResolvedValue(archive); });
  it("uses the archived frame time in the tile URL and converts kilograms to tonnes", async () => {
    render(<CamsArchiveMap slug="kalimantan-2026" />);
    expect((await screen.findByTestId("tile-url")).textContent).toContain("/burnt_carbon/last/");
    expect(screen.getByText("25")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("wildfire.cams.timeSlider"), { target: { value: "0" } });
    expect(screen.getByTestId("tile-url").textContent).toContain("/burnt_carbon/first/");
    expect(screen.getByText("12")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("wildfire.cams.timeSlider"), { target: { value: "1" } });
    expect(screen.getByText("—")).toBeTruthy();
  });
  it("shows an unavailable range without displaying a stale tile", async () => {
    render(<CamsArchiveMap slug="kalimantan-2026" />);
    await screen.findByTestId("tile-url");
    fireEvent.change(screen.getByLabelText("wildfire.cams.from"), { target: { value: "2026-10-07" } });
    expect(screen.getByText("wildfire.cams.noFrames")).toBeTruthy();
    expect(screen.queryByTestId("tile-url")).toBeNull();
  });
});

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import L from "leaflet";
import SatelliteViewer from "./SatelliteViewer";
import type { SegmentationResult } from "./SegmentationComparison";
import type { DisasterAnalysisEntry, SatelliteImageryRecord } from "../types";

const mountedMaps = vi.hoisted(() => new Set<import("leaflet").Map>());
const testBasemaps = vi.hoisted(() => [{ id: "mapbox-satellite", name: "Mapbox Satellite", url: "https://tiles.mapbox.test/{z}/{x}/{y}.jpg",
  attribution: "Mapbox", maxZoom: 22, maxNativeZoom: 22, isDefault: false, order: 1 }]);
vi.mock("@/hooks/useI18nStore", () => ({
  useI18nStore: (selector?: (state: unknown) => unknown) => {
    const state = { language: "id", t: (key: string) => key };
    return selector ? selector(state) : state;
  },
}));
vi.mock("@/hooks/useBasemaps", () => ({
  useBasemaps: () => ({
    basemaps: testBasemaps,
    loading: false,
  }),
}));
vi.mock("react-leaflet", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-leaflet")>();
  return { ...original, GeoJSON: () => null, CircleMarker: () => null, Pane: () => null,
    TileLayer: ({url, opacity, maxNativeZoom}: {url: string; opacity: number; maxNativeZoom: number}) =>
      <div data-testid="tile" data-url={url} data-opacity={opacity} data-native-zoom={maxNativeZoom} />,
  };
});
vi.mock("@/components/map/MapView", async () => {
  const { MapContainer, useMap } = await import("react-leaflet");
  const { useEffect } = await import("react");
  function CaptureMap() {
    const map = useMap();
    useEffect(() => {
      mountedMaps.add(map);
      return () => { mountedMaps.delete(map); };
    }, [map]);
    return null;
  }
  return { default: ({id, children}: {id: string; children: React.ReactNode}) =>
    <div data-testid="viewer-map" data-map-id={id}>
      <MapContainer center={[-8.6, 122.2]} zoom={10}><CaptureMap />{children}</MapContainer>
    </div>,
  };
});
vi.mock("@/components/map/SwipeCompareMap", async () => {
  const { default: MapView } = await import("@/components/map/MapView");
  return { default: ({id, beforeUrl, afterUrl, beforeOverlayUrl, afterOverlayUrl, beforeLabel, afterLabel, opacity, overlayOpacity, children}: {
    id: string; beforeUrl: string; afterUrl: string; beforeLabel: string; afterLabel: string;
    beforeOverlayUrl: string | null; afterOverlayUrl: string | null;
    opacity: number; overlayOpacity: number; children: React.ReactNode;
  }) => <MapView id={id}>
    <div data-testid="swipe" data-pre={beforeUrl} data-post={afterUrl}
      data-pre-overlay={beforeOverlayUrl ?? ""} data-post-overlay={afterOverlayUrl ?? ""}
      data-opacity={opacity} data-overlay-opacity={overlayOpacity}>
      {beforeLabel} / {afterLabel}
    </div>{children}
  </MapView> };
});
vi.mock("@/components/map/BasemapSwitcher", () => ({ default: () => null }));
vi.mock("@/components/map/LayerOpacityControl", () => ({ default: () => null }));
vi.mock("@/components/map/RasterResolutionNotice", () => ({ default: () => null }));
vi.mock("@/components/map/HistoricalImageryControl", () => ({ HistoricalAoiClipController: () => null }));
vi.mock("@/components/ui/InfoTip", () => ({ default: () => null }));
vi.mock("@/features/imagery/api", () => ({ listImageryScenes: vi.fn(), getImagerySceneTile: vi.fn() }));
vi.mock("@/features/imagery/wayback", () => ({ ESRI_WAYBACK_START_DATE: "2014-01-01", listEsriWaybackScenes: vi.fn(), selectEsriWaybackScene: vi.fn() }));

const polygon: GeoJSON.Polygon = { type: "Polygon", coordinates: [[[122.1, -8.7], [122.3, -8.7], [122.3, -8.5], [122.1, -8.5], [122.1, -8.7]]] };
const comparison: SegmentationResult = {
  model_id: "dynamic_world_v1", model_version: "1.0", method: "Dynamic World", damage_model: false,
  aoi: polygon, resolution_m: 10, crs: "EPSG:4326", pre_tile_url: "https://tiles.test/pre/{z}/{x}/{y}",
  post_tile_url: "https://tiles.test/post/{z}/{x}/{y}", change_tile_url: "https://tiles.test/change/{z}/{x}/{y}",
  pre: { date: "2026-08-13", scene_count: 1 }, post: { date: "2026-08-18", scene_count: 2 },
  aoi_area_ha: 100, valid_area_ha: 90, no_data_area_ha: 10, changed_area_ha: 20, unchanged_area_ha: 70, coverage_note: "Shared valid pixels",
  classes: [{ class_id: 0, label: "Air", color: "#00f", pre_area_ha: 50, post_area_ha: 30, change_area_ha: -20,
    pre_percentage: 50, post_percentage: 30, pre_pixel_count: 50, post_pixel_count: 30, pre_confidence: 0.9, post_confidence: 0.8,
    gained_area_ha: 0, lost_area_ha: 20, unchanged_area_ha: 30 }],
  transitions: [{ pre_class_id: 0, post_class_id: 1, area_ha: 20, label: "Air → Pohon", color: "#0f0" }],
};
function analysis(modelId = "dynamic_world_v1"): DisasterAnalysisEntry {
  return { model_id: modelId, user_label: modelId, category: "segmentation", available: true, run: null,
    result: { id: 1, run_id: 1, tile_url: "https://tiles.test/duplicate", statistics: {}, legend: [], confidence_summary: null,
      is_published: true, published_at: null, publication_version: 1, created_at: null,
      comparison: modelId === comparison.model_id ? comparison : { ...comparison, model_id: modelId, post_tile_url: "https://tiles.test/second" } },
  };
}
function image(id: number, phase: "pre" | "post", date: string): SatelliteImageryRecord {
  return { id, event_id: 1, phase, satellite: "Sentinel-2", acquisition_date: date, sensor: null, resolution_m: 10,
    cloud_coverage_pct: null, data_source: "gee", is_primary: true, preview_tile_url: `https://tiles.test/raw-${id}`,
    source_kind: "gee", created_at: null };
}
const pre = image(1, "pre", "2026-06-29");
const post = image(2, "post", "2026-08-16");
const props = { aoi: null, imagery: { pre: [pre, image(3, "pre", "2026-06-30")], post: [post] },
  primaryImagery: { pre, post }, analyses: [analysis()], checkedAnalyses: new Set([comparison.model_id]) };

afterEach(() => { cleanup(); mountedMaps.clear(); });
describe("Shared disaster imagery and segmentation viewer", () => {
  it("previews an admin review result without requiring event imagery", () => {
    render(<SatelliteViewer aoi={null} imagery={{ pre: [], post: [] }} primaryImagery={{ pre: null, post: null }}
      initialOutput="classes" comparisonResults={[{ model_id: comparison.model_id, user_label: "Dynamic World", comparison }]} />);
    expect(screen.getAllByTestId("viewer-map")).toHaveLength(1);
    expect(screen.getByTestId("swipe").dataset.pre).toBe(comparison.pre_tile_url);
    expect(screen.queryByLabelText("Citra Sebelum (Pre)")).toBeNull();
    expect(screen.getByRole("region", { name: "Statistik segmentasi" })).toBeTruthy();
  });

  it("switches stored outputs on the same viewer and retains raw scene dates and all statistics", () => {
    render(<SatelliteViewer {...props} />);
    expect(screen.getAllByTestId("viewer-map")).toHaveLength(1);
    expect(screen.getByTestId("swipe").dataset.pre).toBe(pre.preview_tile_url);
    fireEvent.click(screen.getByRole("button", { name: "Segmentasi multi-kelas" }));
    expect(screen.getAllByTestId("viewer-map")).toHaveLength(1);
    expect(screen.getByTestId("swipe").dataset.pre).toBe(pre.preview_tile_url);
    expect(screen.getByTestId("swipe").dataset.preOverlay).toBe(comparison.pre_tile_url);
    expect(screen.getByTestId("swipe").dataset.postOverlay).toBe(comparison.post_tile_url);
    expect(screen.getByRole("region", { name: "Metadata segmentasi" }).textContent).toContain(comparison.pre.date);
    fireEvent.click(screen.getByRole("button", { name: "Transisi utama" }));
    expect(screen.getByRole("region", { name: "Statistik segmentasi" }).textContent).toContain("Air → Pohon: 20 ha");
    fireEvent.click(screen.getByRole("button", { name: "Perubahan" }));
    expect(screen.getAllByTestId("viewer-map")).toHaveLength(1);
    expect(screen.getAllByTestId("tile").map(tile => tile.dataset.url)).toContain(comparison.change_tile_url);
    fireEvent.change(screen.getByLabelText("Citra Sebelum (Pre)"), { target: { value: "3" } });
    expect(screen.getByTestId("swipe").dataset.pre).toBe("https://tiles.test/raw-3");
    expect(screen.getByTestId("swipe").textContent).toContain("2026-06-30");
  });

  it("keeps independent imagery and segmentation opacity", () => {
    render(<SatelliteViewer {...props} />);
    fireEvent.change(screen.getByLabelText("Opasitas citra"), { target: { value: "0.4" } });
    fireEvent.click(screen.getByRole("button", { name: "Segmentasi multi-kelas" }));
    fireEvent.change(screen.getByLabelText("Opasitas segmentasi"), { target: { value: "0.7" } });
    expect(screen.getByTestId("swipe").dataset.overlayOpacity).toBe("0.7");
    fireEvent.click(screen.getByRole("button", { name: "Citra satelit" }));
    expect(screen.getByTestId("swipe").dataset.opacity).toBe("0.4");
  });

  it("offers Mapbox imagery for both phases and distinguishes duplicate-date scenes", async () => {
    const firstScene = { ...image(4, "pre", "2026-06-30"), scene_id: "sentinel-scene-a" };
    const duplicate = { ...firstScene, id: 5 };
    const sameDateScene = { ...image(6, "pre", "2026-06-30"), scene_id: "sentinel-scene-b" };
    const aoi = { id: 1, event_id: 1, area_ha: 10, centroid: null, bbox: [122.1, -8.7, 122.3, -8.5] as [number, number, number, number],
      source: "test", created_at: null, geojson: { type: "Feature" as const, properties: {}, geometry: polygon } };
    const { container } = render(<SatelliteViewer {...props} aoi={aoi}
      imagery={{ pre: [pre, firstScene, duplicate, sameDateScene], post: [post] }} />);
    const preSelect = screen.getByLabelText("Citra Sebelum (Pre)") as HTMLSelectElement;
    const postSelect = screen.getByLabelText("Citra Sesudah (Post)") as HTMLSelectElement;
    expect([...preSelect.options].some(option => option.value === "source:mapbox-satellite")).toBe(true);
    expect([...postSelect.options].some(option => option.value === "source:mapbox-satellite")).toBe(true);
    const sameDateOptions = [...preSelect.options].filter(option => option.textContent?.includes("2026-06-30"));
    expect(sameDateOptions).toHaveLength(2);
    expect(sameDateOptions[0].textContent).not.toBe(sameDateOptions[1].textContent);

    fireEvent.change(preSelect, { target: { value: "source:mapbox-satellite" } });
    await waitFor(() => expect(screen.getByTestId("swipe").dataset.pre).toBe("https://tiles.mapbox.test/{z}/{x}/{y}.jpg"));
    expect(container.textContent).toContain("tanggal historis tidak tersedia");
  });

  it("uses one selected model and falls back to raw imagery when checked analyses are removed", () => {
    const analyses = [analysis(), analysis("second-model")];
    const { rerender } = render(<SatelliteViewer {...props} analyses={analyses} checkedAnalyses={new Set(analyses.map(a => a.model_id))} />);
    fireEvent.click(screen.getByRole("button", { name: "Segmentasi multi-kelas" }));
    fireEvent.change(screen.getByLabelText("Hasil analisis"), { target: { value: "second-model" } });
    expect(screen.getByTestId("swipe").dataset.postOverlay).toBe("https://tiles.test/second");
    expect(screen.queryByTestId("tile")).toBeNull();
    expect(screen.getAllByTestId("viewer-map")).toHaveLength(1);
    rerender(<SatelliteViewer {...props} checkedAnalyses={new Set()} />);
    expect(screen.getByTestId("swipe").dataset.post).toBe(post.preview_tile_url);
    expect(screen.queryByRole("region", { name: "Statistik segmentasi" })).toBeNull();
  });

  it("synchronizes real Leaflet split maps and preserves the viewport when switching layout", () => {
    render(<SatelliteViewer {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Berdampingan" }));
    const [left, right] = [...mountedMaps];
    expect(mountedMaps.size).toBe(2);
    act(() => { left.setView(L.latLng(-8.55, 122.22), 13, { animate: false }); });
    expect(right.getCenter().equals(left.getCenter())).toBe(true);
    expect(right.getZoom()).toBe(13);
    fireEvent.click(screen.getByRole("button", { name: "Geser" }));
    expect(mountedMaps.size).toBe(1);
    const [swipe] = [...mountedMaps];
    expect(swipe.getCenter().equals(L.latLng(-8.55, 122.22))).toBe(true);
    expect(swipe.getZoom()).toBe(13);
  });
});

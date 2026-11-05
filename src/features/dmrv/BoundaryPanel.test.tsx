import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/services/apiClient";
import { useI18nStore } from "@/hooks/useI18nStore";
import BoundaryPanel from "./BoundaryPanel";
import * as api from "./api";
import type { BoundaryVersion } from "./types";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return { ...actual, listBoundaries: vi.fn(), addBoundary: vi.fn() };
});

const POLYGON = { type: "Polygon", coordinates: [[[110, -7], [110.01, -7], [110.01, -6.99], [110, -6.99], [110, -7]]] };
const version = (over: Partial<BoundaryVersion> = {}): BoundaryVersion => ({
  id: "b-1", version: 1, crs: "EPSG:4326", area_ha: 122.2, area_method: "geodesic_wgs84_pyproj",
  checksum: "abcdef0123456789abcdef", created_by: "admin:1", reason: "awal", created_at: null,
  validated_geojson: POLYGON, overlap: null, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  useI18nStore.getState().setLanguage("id");
});
afterEach(cleanup);

function fill(geojson: string, reason = "revisi lapangan") {
  fireEvent.change(screen.getByLabelText("GeoJSON (Polygon atau MultiPolygon)"), { target: { value: geojson } });
  fireEvent.change(screen.getByLabelText("Alasan versi ini"), { target: { value: reason } });
}

describe("BoundaryPanel", () => {
  it("shows an empty state that tells the user what to do next", async () => {
    vi.mocked(api.listBoundaries).mockResolvedValue([]);
    render(<BoundaryPanel projectId="p-1" canWrite />);
    expect(await screen.findByText(/Belum ada batas wilayah/)).toBeInTheDocument();
  });

  it("lists versions with area, a short checksum and the reason", async () => {
    vi.mocked(api.listBoundaries).mockResolvedValue([version()]);
    render(<BoundaryPanel projectId="p-1" canWrite />);
    expect(await screen.findByText("122,20")).toBeInTheDocument();
    expect(screen.getByText("abcdef012345")).toBeInTheDocument();
    expect(screen.getByText("awal")).toBeInTheDocument();
  });

  it("rejects text that is not JSON without calling the server", async () => {
    vi.mocked(api.listBoundaries).mockResolvedValue([]);
    render(<BoundaryPanel projectId="p-1" canWrite />);
    await screen.findByText(/Belum ada batas wilayah/);
    fill("{not json");
    fireEvent.click(screen.getByRole("button", { name: "Simpan versi baru" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Teks bukan JSON yang valid.");
    expect(api.addBoundary).not.toHaveBeenCalled();
  });

  it("shows the server validation code and message", async () => {
    vi.mocked(api.listBoundaries).mockResolvedValue([]);
    vi.mocked(api.addBoundary).mockRejectedValue(
      new ApiError("Geometri tidak valid", 422, { code: "invalid_geometry", message: "Geometri tidak valid (mis. self-intersection)." }),
    );
    render(<BoundaryPanel projectId="p-1" canWrite />);
    await screen.findByText(/Belum ada batas wilayah/);
    fill(JSON.stringify(POLYGON));
    fireEvent.click(screen.getByRole("button", { name: "Simpan versi baru" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("invalid_geometry: Geometri tidak valid (mis. self-intersection).");
  });

  it("saves a version, refreshes the list and reports overlap counts only", async () => {
    vi.mocked(api.listBoundaries).mockResolvedValueOnce([version()]).mockResolvedValueOnce([version(), version({ id: "b-2", version: 2 })]);
    vi.mocked(api.addBoundary).mockResolvedValue(version({ id: "b-2", version: 2, overlap: { other_projects: 1, overlap_ha: 61.1 } }));
    render(<BoundaryPanel projectId="p-1" canWrite />);
    await screen.findByText("122,20");
    fill(JSON.stringify(POLYGON));
    fireEvent.click(screen.getByRole("button", { name: "Simpan versi baru" }));
    await waitFor(() => expect(api.addBoundary).toHaveBeenCalledWith("p-1", POLYGON, "revisi lapangan"));
    expect(await screen.findByRole("status")).toHaveTextContent("Versi 2 disimpan.");
    expect(screen.getByRole("status")).toHaveTextContent("Tumpang tindih dengan 1 proyek lain, sekitar 61,10 ha.");
    expect(api.listBoundaries).toHaveBeenCalledTimes(2);
  });

  it("is read-only for roles without boundary.write", async () => {
    vi.mocked(api.listBoundaries).mockResolvedValue([version()]);
    render(<BoundaryPanel projectId="p-1" canWrite={false} />);
    await screen.findByText("122,20");
    expect(screen.getByText("Peran Anda hanya dapat melihat batas wilayah.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Alasan versi ini")).not.toBeInTheDocument();
  });

  it("fills the text area from an uploaded GeoJSON file", async () => {
    vi.mocked(api.listBoundaries).mockResolvedValue([]);
    render(<BoundaryPanel projectId="p-1" canWrite />);
    await screen.findByText(/Belum ada batas wilayah/);
    const file = new File([JSON.stringify(POLYGON)], "area.geojson", { type: "application/geo+json" });
    fireEvent.change(screen.getByLabelText("Atau unggah berkas .geojson / .json"), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByLabelText("GeoJSON (Polygon atau MultiPolygon)")).toHaveValue(JSON.stringify(POLYGON)));
  });
});

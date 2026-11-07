import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/hooks/useI18nStore";
import MonitoringPeriodPanel from "./MonitoringPeriodPanel";
import * as api from "./api";
import type { BoundaryVersion, MonitoringPeriod } from "./types";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    createMonitoringPeriod: vi.fn(),
    listBoundaries: vi.fn(),
    listMonitoringPeriods: vi.fn(),
    newIdempotencyKey: vi.fn(() => "period-key"),
    updateMonitoringPeriod: vi.fn(),
  };
});

const boundary: BoundaryVersion = {
  id: "boundary-1", version: 1, crs: "EPSG:4326", area_ha: 10, area_method: "test",
  checksum: "0123456789abcdef", created_by: "admin:1", reason: "fixture", created_at: null,
  validated_geojson: null, overlap: null,
};
const period: MonitoringPeriod = {
  id: "period-1", project_id: "p-1", boundary_version: 1, boundary_checksum: boundary.checksum,
  name: "2025", start_date: "2025-01-01", end_date: "2025-12-31", status: "planned",
  revision: 1, created_at: null, updated_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listBoundaries).mockResolvedValue([boundary]);
  vi.mocked(api.listMonitoringPeriods).mockResolvedValue([period]);
  useI18nStore.getState().setLanguage("id");
});
afterEach(cleanup);

describe("MonitoringPeriodPanel", () => {
  it("creates a planned period against a selected boundary and displays its lifecycle", async () => {
    vi.mocked(api.createMonitoringPeriod).mockResolvedValue(period);
    vi.mocked(api.listMonitoringPeriods)
      .mockResolvedValueOnce([period])
      .mockResolvedValueOnce([period])
      .mockResolvedValueOnce([{ ...period, status: "in_progress", revision: 2 }]);
    vi.mocked(api.updateMonitoringPeriod).mockResolvedValue({ ...period, status: "in_progress", revision: 2 });
    render(<MonitoringPeriodPanel projectId="p-1" canWrite />);

    expect(await screen.findByText("2025")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nama periode"), { target: { value: "2026" } });
    fireEvent.change(screen.getByLabelText("Tanggal mulai"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("Tanggal akhir"), { target: { value: "2026-12-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Buat periode" }));
    await waitFor(() => expect(api.createMonitoringPeriod).toHaveBeenCalledWith("p-1", {
      name: "2026", start_date: "2026-01-01", end_date: "2026-12-31", boundary_version: 1,
    }, "period-key"));

    fireEvent.click(await screen.findByRole("button", { name: "Mulai" }));
    await waitFor(() => expect(api.updateMonitoringPeriod).toHaveBeenCalledWith("p-1", period, "in_progress"));
    expect(await screen.findByText("Berjalan")).toBeInTheDocument();
  });

  it("disables period creation until a boundary version exists", async () => {
    vi.mocked(api.listBoundaries).mockResolvedValue([]);
    render(<MonitoringPeriodPanel projectId="p-1" canWrite />);
    expect(await screen.findByText(/Buat versi batas sebelum/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buat periode" })).toBeDisabled();
  });
});

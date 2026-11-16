import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useI18nStore } from "@/hooks/useI18nStore";
import { getDmrvSnapshot } from "./api";
import type { DmrvSnapshot } from "./types";
import SnapshotResultPanel from "./SnapshotResultPanel";
vi.mock("./api", () => ({ getDmrvSnapshot: vi.fn() }));
vi.mock("./SnapshotRasterMap", () => ({
  default: ({ layer }: { layer: { key: string } }) => (
    <div data-testid="raster-map">{layer.key}</div>
  ),
}));
const row: DmrvSnapshot = {
  id: "s1",
  project_id: "p1",
  job_id: "j1",
  kind: "carbon",
  snapshot_hash: "checksum1",
  created_by: "user:1",
  created_at: null,
  inputs: {
    context: { period: { start: "2026-01-01", end: "2026-12-31" }, boundary: { version: 3 } },
  },
  outputs: {
    carbon_estimated: {
      statistics: { mean: 0 },
      unit: "Mg C/ha",
      tile_url: "/api/raster/{z}/{x}/{y}",
    },
  },
};
beforeEach(() => {
  vi.resetAllMocks();
  useI18nStore.getState().setLanguage("id");
  vi.mocked(getDmrvSnapshot).mockResolvedValue(row);
});
afterEach(cleanup);
it("opens the stored result and its map without submitting an analysis", async () => {
  const close = vi.fn();
  render(<SnapshotResultPanel projectId="p1" snapshotId="s1" onClose={close} />);
  expect(await screen.findByText("0 Mg C/ha")).toBeInTheDocument();
  expect(await screen.findByTestId("raster-map")).toHaveTextContent("carbon_estimated");
  expect(getDmrvSnapshot).toHaveBeenCalledWith("p1", "s1");
  expect(getDmrvSnapshot).toHaveBeenCalledTimes(1);
  expect(screen.getByText("checksum1")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tutup hasil" }));
  expect(close).toHaveBeenCalledOnce();
});
it("does not display stale data when the result becomes inaccessible", async () => {
  const view = render(<SnapshotResultPanel projectId="p1" snapshotId="s1" onClose={() => {}} />);
  await screen.findByText("0 Mg C/ha");
  vi.mocked(getDmrvSnapshot).mockRejectedValueOnce(new Error("private provider error"));
  view.rerender(<SnapshotResultPanel projectId="p1" snapshotId="s2" onClose={() => {}} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Hasil tidak tersedia atau akses sudah tidak diizinkan.",
  );
  expect(screen.queryByText("0 Mg C/ha")).not.toBeInTheDocument();
  expect(screen.queryByText("private provider error")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));
  await waitFor(() => expect(getDmrvSnapshot).toHaveBeenCalledTimes(3));
});
it("distinguishes missing maps from missing statistics", async () => {
  vi.mocked(getDmrvSnapshot).mockResolvedValue({
    ...row,
    outputs: { carbon_estimated: { statistics: { mean: 31 }, unit: "Mg C/ha" } },
  });
  render(<SnapshotResultPanel projectId="p1" snapshotId="s1" onClose={() => {}} />);
  expect(await screen.findByText("31 Mg C/ha")).toBeInTheDocument();
  expect(
    screen.getByText("Snapshot ini tidak memiliki layer raster tersimpan."),
  ).toBeInTheDocument();
  expect(screen.queryByTestId("raster-map")).not.toBeInTheDocument();
});

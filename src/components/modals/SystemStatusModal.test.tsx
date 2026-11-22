import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useI18nStore } from "@/hooks/useI18nStore";
import SystemStatusModal from "./SystemStatusModal";

vi.mock("@/config/version", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/version")>();
  return { ...actual, fetchFrontendBuildMetadata: vi.fn().mockRejectedValue(new Error("unavailable")) };
});
vi.mock("@/services/releaseService", () => ({ fetchBackendVersion: vi.fn().mockRejectedValue(new Error("unavailable")) }));

beforeEach(() => useI18nStore.getState().setLanguage("id"));
afterEach(cleanup);

it("reports a reachable backend separately from degraded database and initialized Earth Engine", async () => {
  render(<SystemStatusModal open onClose={() => {}} recheck={async () => {}} checking={false}
    checkedAt={new Date()} health={{ status: "degraded", database_connected: false, ee_initialized: true, active_models: 0 }} />);
  const backend = await screen.findByText("Backend");
  expect(within(backend.parentElement!.parentElement!).getByText("Terhubung")).toBeInTheDocument();
  const database = screen.getByText("Database");
  expect(within(database.parentElement!.parentElement!).getByText("Tidak terhubung")).toBeInTheDocument();
  const gee = screen.getByText("Google Earth Engine");
  expect(within(gee.parentElement!.parentElement!).getByText("Aktif")).toBeInTheDocument();
  const models = screen.getByText("Model Aktif");
  expect(within(models.parentElement!.parentElement!).getByText("0")).toBeInTheDocument();
});

it("explains degraded status caused by an unavailable model catalog and outdated schema", async () => {
  render(<SystemStatusModal open onClose={() => {}} recheck={async () => {}} checking={false}
    checkedAt={new Date()} health={{ status: "degraded", database_connected: true, ee_initialized: true,
      active_model_catalog_available: false, model_lifecycle_schema_current: false, active_models: 0 }} />);
  expect(await screen.findByText("Migrasi diperlukan")).toBeInTheDocument();
  expect(screen.getAllByText("Tidak tersedia")).toHaveLength(2);
});

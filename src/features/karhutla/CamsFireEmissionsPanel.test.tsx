import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CamsFireEmissionsPanel from "./CamsFireEmissionsPanel";
import type { WildfireCamsCapabilities } from "./types";

const fetchCapabilities = vi.hoisted(() => vi.fn());

vi.mock("@/features/disaster/api", () => ({
  fetchWildfireCamsCapabilities: fetchCapabilities,
}));

vi.mock("@/hooks/useI18nStore", () => ({
  useI18nStore: () => ({ t: (key: string) => key }),
}));

const capabilities: WildfireCamsCapabilities = {
  status: "needs_credentials",
  credentials_configured: false,
  terms_accepted_by_operator: false,
  provider_ready: false,
  data_available: false,
  blocked_reason: "ads_credentials_missing",
  integration_stage: "ads_transport_and_fixture_math; raster_provider_unverified",
  attribution: "CAMS / ECMWF Atmosphere Data Store (ADS), CC-BY 4.0",
  disclaimer: "No field loaded.",
  products: [
    {
      id: "gfas",
      label: "GFAS fire emissions",
      dataset_id: "cams-global-fire-emissions-gfas",
      source_url: "https://ads.atmosphere.copernicus.eu/datasets/cams-global-fire-emissions-gfas",
      provider: "CAMS / ECMWF",
      license: "CC-BY-4.0",
      doi: "10.24381/a05253c7",
      resolution_degrees: 0.1,
      spatial_coverage: "global grid",
      time_basis: "UTC",
      products: [
        { version: "1.2", coverage_start: "2003-01-01", coverage_end: "2025-12-31", temporal_steps: ["daily"], notes: "daily" },
        { version: "1.4.2", coverage_start: "2026-01-01", coverage_end: null, temporal_steps: ["hourly", "rolling_24h"], notes: "hourly" },
      ],
      variables: {
        co2: { label: "CO2 flux", symbol: "CO2", source_name: "Wildfire flux of carbon dioxide", unit: "kg m-2 s-1", kind: "emission_flux" },
      },
      method: "FRP based estimate",
      data_kind: "emission estimate",
    },
    {
      id: "ifs_cams",
      label: "IFS-CAMS atmospheric composition forecast",
      dataset_id: "cams-global-atmospheric-composition-forecasts",
      source_url: "https://ads.atmosphere.copernicus.eu/datasets/cams-global-atmospheric-composition-forecasts",
      provider: "CAMS / ECMWF",
      license: "CC-BY-4.0",
      doi: "10.24381/04a0b097",
      resolution_degrees: 0.4,
      spatial_coverage: "global grid",
      time_basis: "UTC",
      initialization_hours_utc: [0, 12],
      forecast_horizon_hours: 120,
      single_level_step_hours: 1,
      variables: {
        pm25: { label: "PM2.5 concentration", symbol: "PM2.5", source_name: "Particulate matter PM2.5", unit: "kg m-3", kind: "atmospheric_concentration" },
      },
      method: "Atmospheric forecast",
      data_kind: "atmospheric forecast",
    },
  ],
};

describe("CamsFireEmissionsPanel", () => {
  beforeEach(() => fetchCapabilities.mockReset());

  it("does not request capabilities while the fallback event is unconfirmed", async () => {
    const { container } = render(<CamsFireEmissionsPanel slug="kalimantan-2026" eventConfirmed={false} />);
    expect(container.querySelector("details")?.open).toBe(false);

    fireEvent.click(screen.getByText("wildfire.cams.title"));

    expect(await screen.findByText("wildfire.cams.eventUnconfirmed")).toBeTruthy();
    expect(fetchCapabilities).not.toHaveBeenCalled();
  });

  it("fetches capabilities after expansion and shows separate products with an honest blocked state", async () => {
    fetchCapabilities.mockResolvedValue(capabilities);
    render(<CamsFireEmissionsPanel slug="kalimantan-2026" eventConfirmed />);
    fireEvent.click(screen.getByText("wildfire.cams.title"));

    expect(await screen.findByText("wildfire.cams.status.needsCredentials")).toBeTruthy();
    expect(screen.getByText("wildfire.cams.gfas.title")).toBeTruthy();
    expect(screen.getByText("wildfire.cams.ifs.title")).toBeTruthy();
    expect(screen.getAllByText("wildfire.cams.visualizationUnavailable")).toHaveLength(2);
    expect(fetchCapabilities).toHaveBeenCalledTimes(1);
    expect(fetchCapabilities).toHaveBeenCalledWith("kalimantan-2026");

    fireEvent.click(screen.getByText("wildfire.cams.title"));
    fireEvent.click(screen.getByText("wildfire.cams.title"));
    await waitFor(() => expect(fetchCapabilities).toHaveBeenCalledTimes(1));
  });

  it("distinguishes configured credentials from upstream validation", async () => {
    fetchCapabilities.mockResolvedValue({
      ...capabilities,
      status: "upstream_validation_blocked",
      credentials_configured: true,
      terms_accepted_by_operator: true,
      blocked_reason: "provider_and_live_data_validation_pending",
    });
    render(<CamsFireEmissionsPanel slug="kalimantan-2026" eventConfirmed />);
    fireEvent.click(screen.getByText("wildfire.cams.title"));

    expect(await screen.findByText("wildfire.cams.status.validationBlocked")).toBeTruthy();
  });
});

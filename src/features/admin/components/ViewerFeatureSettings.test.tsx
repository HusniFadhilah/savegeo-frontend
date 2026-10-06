import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VIEWER_FEATURE_CODES } from "@/auth/viewerFeatures";
import { getViewerFeatureSettings, saveViewerFeatureSettings } from "../api";
import type { ViewerFeatureSetting, ViewerFeatureSettingsResponse } from "../types";
import ViewerFeatureSettings from "./ViewerFeatureSettings";

const { notifyMock, translateMock } = vi.hoisted(() => ({
  notifyMock: vi.fn(),
  translateMock: (key: string) => key,
}));

vi.mock("../api", () => ({
  getViewerFeatureSettings: vi.fn(),
  saveViewerFeatureSettings: vi.fn(),
}));
vi.mock("../AdminContext", () => ({ useAdmin: () => ({ notify: notifyMock }) }));
vi.mock("@/hooks/useI18nStore", () => ({
  useI18nStore: (selector: (state: { t: (key: string) => string }) => unknown) => selector({ t: translateMock }),
}));

function response(enabled: string[]): ViewerFeatureSettingsResponse {
  return {
    configured: true,
    features: VIEWER_FEATURE_CODES.map((code) => ({
      code,
      name: code,
      description: code,
      enabled: enabled.includes(code),
    } satisfies ViewerFeatureSetting)),
  };
}

function checkbox(code: string) {
  return screen.getByRole("checkbox", { name: `admin.viewerFeatures.${code.replace("app.feature.", "")}.name` });
}

describe("ViewerFeatureSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("loads, validates, confirms and saves while exposing the saving state", async () => {
    let finishSave!: (value: ViewerFeatureSettingsResponse) => void;
    vi.mocked(getViewerFeatureSettings).mockResolvedValueOnce(response(["app.feature.carbon_stock"]));
    vi.mocked(saveViewerFeatureSettings).mockImplementationOnce(() => new Promise((resolve) => { finishSave = resolve; }));

    render(<ViewerFeatureSettings />);
    expect(await screen.findByRole("checkbox", { name: "admin.viewerFeatures.carbon_stock.name" })).toBeChecked();
    fireEvent.click(checkbox("app.feature.land_cover"));
    fireEvent.click(screen.getByRole("button", { name: "admin.viewerFeatures.save" }));

    await waitFor(() => expect(saveViewerFeatureSettings).toHaveBeenCalledWith([
      "app.feature.carbon_stock",
      "app.feature.land_cover",
    ]));
    expect(window.confirm).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "admin.viewerFeatures.saving" })).toBeDisabled();
    expect(checkbox("app.feature.land_cover")).toBeDisabled();

    finishSave(response(["app.feature.carbon_stock", "app.feature.land_cover"]));
    expect(await screen.findByRole("status")).toHaveTextContent("admin.viewerFeatures.saved");
  });

  it("cancels draft edits and reloads the saved configuration", async () => {
    vi.mocked(getViewerFeatureSettings)
      .mockResolvedValueOnce(response(["app.feature.carbon_stock"]))
      .mockResolvedValueOnce(response(["app.feature.crop_monitoring"]));

    render(<ViewerFeatureSettings />);
    await screen.findByRole("checkbox", { name: "admin.viewerFeatures.carbon_stock.name" });
    fireEvent.click(checkbox("app.feature.land_cover"));
    fireEvent.click(screen.getByRole("button", { name: "admin.viewerFeatures.cancel" }));
    expect(checkbox("app.feature.land_cover")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "admin.viewerFeatures.save" })).toBeDisabled();

    fireEvent.click(checkbox("app.feature.land_cover"));
    fireEvent.click(screen.getByRole("button", { name: "admin.viewerFeatures.reload" }));
    await waitFor(() => expect(checkbox("app.feature.crop_monitoring")).toBeChecked());
    expect(checkbox("app.feature.carbon_stock")).not.toBeChecked();
  });

  it("shows a recoverable load error and rejects malformed API responses", async () => {
    vi.mocked(getViewerFeatureSettings)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ configured: true, features: [] } as ViewerFeatureSettingsResponse);

    render(<ViewerFeatureSettings />);
    expect(await screen.findByRole("alert")).toHaveTextContent("offline");
    fireEvent.click(screen.getByRole("button", { name: "admin.viewerFeatures.reload" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("admin.viewerFeatures.invalidResponse");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("keeps edits after save failure and leaves the user able to retry", async () => {
    vi.mocked(getViewerFeatureSettings).mockResolvedValueOnce(response([]));
    vi.mocked(saveViewerFeatureSettings).mockRejectedValueOnce(new Error("save unavailable"));

    render(<ViewerFeatureSettings />);
    await screen.findByRole("checkbox", { name: "admin.viewerFeatures.carbon_stock.name" });
    fireEvent.click(checkbox("app.feature.disaster_mapping"));
    fireEvent.click(screen.getByRole("button", { name: "admin.viewerFeatures.save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("save unavailable");
    expect(checkbox("app.feature.disaster_mapping")).toBeChecked();
    expect(screen.getByRole("button", { name: "admin.viewerFeatures.save" })).toBeEnabled();
    expect(notifyMock).toHaveBeenCalledWith("save unavailable", "e");
  });
});

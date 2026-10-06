import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedAppRoute from "./ProtectedAppRoute";
import AnalysisTypeSelector from "@/features/carbon/components/AnalysisTypeSelector";

const session = vi.hoisted(() => ({
  admin: { user: { role: "viewer" }, isAuthenticated: true, isLoading: false },
  user: { isAuthenticated: false, isLoading: false },
  featureState: {
    features: ["app.feature.carbon_stock"],
    isLoading: false,
    error: null,
    load: vi.fn(),
  },
}));

vi.mock("@/hooks/useAuthStore", () => ({
  useAuthStore: (selector: (state: typeof session.admin) => unknown) => selector(session.admin),
}));
vi.mock("@/hooks/useUserAuthStore", () => ({
  useUserAuthStore: (selector: (state: typeof session.user) => unknown) => selector(session.user),
}));
vi.mock("@/hooks/useViewerFeatures", () => ({
  useViewerFeatures: (selector: (state: typeof session.featureState) => unknown) => selector(session.featureState),
}));
vi.mock("@/hooks/useI18nStore", () => ({
  useI18nStore: (selector: (state: { t: (key: string) => string }) => unknown) => selector({ t: (key) => key }),
}));

describe("Viewer route and mode gates", () => {
  beforeEach(() => {
    session.admin.user.role = "viewer";
    session.admin.isAuthenticated = true;
    session.user.isAuthenticated = false;
    session.featureState.features = ["app.feature.carbon_stock"];
    session.featureState.isLoading = false;
    session.featureState.error = null;
  });

  it("rejects a direct deep link to a disabled Carbon workspace mode", () => {
    render(
      <MemoryRouter initialEntries={["/carbon-estimation?mode=vegetation"]}>
        <Routes>
          <Route
            path="/carbon-estimation"
            element={
              <ProtectedAppRoute anyFeature={["app.feature.carbon_stock", "app.feature.vegetation_indices"]}>
                <div data-testid="protected-content" />
              </ProtectedAppRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "access.title" })).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("renders only allowed Carbon modes in the shared workspace selector", () => {
    render(<AnalysisTypeSelector value="carbon" onChange={vi.fn()} availableTypes={["carbon"]} />);

    const select = screen.getByRole("combobox");
    expect(select.querySelectorAll("option")).toHaveLength(1);
    expect(select.querySelector("option")?.value).toBe("carbon");
  });
});

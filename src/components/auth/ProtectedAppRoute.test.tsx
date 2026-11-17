import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedAppRoute from "./ProtectedAppRoute";
import AnalysisTypeSelector from "@/features/carbon/components/AnalysisTypeSelector";

const session = vi.hoisted(() => ({
  admin: { user: { role: "viewer", is_viewer: true }, isAuthenticated: true, isLoading: false },
  user: { isAuthenticated: false, isLoading: false },
  featureState: {
    features: ["app.feature.carbon_stock"] as string[] | null,
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
  afterEach(cleanup);
  beforeEach(() => {
    session.admin.user.role = "viewer";
    session.admin.user.is_viewer = true;
    session.admin.isAuthenticated = true;
    session.user.isAuthenticated = false;
    session.featureState.features = ["app.feature.carbon_stock"];
    session.featureState.isLoading = false;
    session.featureState.error = null;
    session.featureState.load.mockReset();
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

  it("opens a signed-in profile without depending on analysis permissions", () => {
    session.featureState.features = null;
    render(<MemoryRouter initialEntries={["/profile"]}>
      <ProtectedAppRoute checkFeatureAccess={false}><input aria-label="Full name" /></ProtectedAppRoute>
    </MemoryRouter>);
    expect(screen.getByRole("textbox", { name: "Full name" })).toBeInTheDocument();
    fireEvent(window, new Event("focus"));
    expect(session.featureState.load).not.toHaveBeenCalled();
  });

  it("still requires a session when opening a profile without feature checks", () => {
    session.admin.isAuthenticated = false;
    render(<MemoryRouter initialEntries={["/profile"]}><Routes>
      <Route path="/profile" element={<ProtectedAppRoute checkFeatureAccess={false}><input aria-label="Full name" /></ProtectedAppRoute>} />
      <Route path="/login" element={<div>Sign in first</div>} />
    </Routes></MemoryRouter>);
    expect(screen.getByText("Sign in first")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renders only allowed Carbon modes in the shared workspace selector", () => {
    render(<AnalysisTypeSelector value="carbon" onChange={vi.fn()} availableTypes={["carbon"]} />);

    const select = screen.getByRole("combobox");
    expect(select.querySelectorAll("option")).toHaveLength(1);
    expect(select.querySelector("option")?.value).toBe("carbon");
  });

  it("preserves the workspace when focus triggers a background permission check", () => {
    const workspace = () => (
      <MemoryRouter initialEntries={["/carbon-estimation?mode=carbon"]}>
        <ProtectedAppRoute feature="app.feature.carbon_stock">
          <input aria-label="Analysis note" defaultValue="" />
        </ProtectedAppRoute>
      </MemoryRouter>
    );
    const view = render(workspace());
    const input = screen.getByRole("textbox", { name: "Analysis note" });
    fireEvent.change(input, { target: { value: "Keep the current analysis" } });
    fireEvent(window, new Event("focus"));
    expect(session.featureState.load).toHaveBeenCalledWith(true);

    session.featureState.isLoading = true;
    view.rerender(workspace());
    expect(screen.getByRole("textbox", { name: "Analysis note" })).toBe(input);
    expect(input).toHaveValue("Keep the current analysis");

    session.featureState.isLoading = false;
    view.rerender(workspace());
    expect(screen.getByRole("textbox", { name: "Analysis note" })).toBe(input);

    // A completed permission change still removes access immediately.
    session.featureState.features = [];
    view.rerender(workspace());
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("access.denied")).toBeInTheDocument();
  });
});

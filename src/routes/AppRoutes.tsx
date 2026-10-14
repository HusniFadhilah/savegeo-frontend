import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import LandingPage from "@/pages/LandingPage";
import AppLoginPage from "@/pages/AppLoginPage";
import RegisterUserPage from "@/pages/RegisterUserPage";
import DashboardPage from "@/pages/DashboardPage";
import AdminPage from "@/pages/AdminPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import DisasterListPage from "@/features/disaster/DisasterListPage";
import DisasterDashboard from "@/features/disaster/DisasterDashboard";
import { ADMIN_DISASTER_EVENT_ROUTE, ADMIN_DISASTER_NEW_PATH, DEFAULT_ADMIN_SECTION } from "@/routes/adminSectionRoutes";
import type { DashboardModule } from "@/hooks/useUiStore";
import type { AdminSection } from "@/features/admin/types";
import ProtectedAppRoute from "@/components/auth/ProtectedAppRoute";
import DashboardEntryRoute from "@/routes/DashboardEntryRoute";
import WorkflowBuilderPage from "@/pages/WorkflowBuilderPage";
import EmbedPage from "@/pages/EmbedPage";
import PluginManagerPage from "@/pages/PluginManagerPage";
import DatasetViewerPage from "@/pages/DatasetViewerPage";
import { KarhutlaDetailPage, KarhutlaIndexPage } from "@/features/karhutla/components";
import DashboardShell from "@/components/layout/DashboardShell";
import NoFeatureAccessPage from "@/pages/NoFeatureAccessPage";
import { VIEWER_FEATURE_CODES } from "@/auth/viewerFeatures";

function CarbonEstimationRoute() {
  const location = useLocation();
  if (new URLSearchParams(location.search).get("mode") === "landcover_change") {
    return <Navigate to={`/land-cover-change${location.search}`} replace />;
  }
  return (
    <ProtectedAppRoute anyFeature={[
      "app.feature.carbon_stock",
      "app.feature.land_cover",
      "app.feature.vegetation_indices",
    ]}>
      <DashboardPage module="carbon" />
    </ProtectedAppRoute>
  );
}

/**
 * Gates `/pemetaan-bencana*` behind the user auth store, mirroring exactly
 * how `pages/AdminPage.tsx` gates `/admin` today (`isAuthenticated` from the
 * store -> else render the login page). There's no separate `/register`
 * route (file boundary only allows adding the list/dashboard routes here),
 * so Login/Register is a local view toggle within this same gate instead of
 * navigation - see `LoginUserPage.tsx`/`RegisterUserPage.tsx`'s
 * `onSwitchTo*` props.
 */
export default function AppRoutes() {
  const dashboardRoutes: { path: string; module: DashboardModule }[] = [
    { path: "/carbon-estimation", module: "carbon" },
    { path: "/land-cover-change", module: "lc-change" },
    { path: "/lc-change", module: "lc-change" },
    { path: "/satellite-imagery", module: "imagery" },
    { path: "/imagery", module: "imagery" },
    { path: "/crop-monitoring", module: "crop-monitoring" },
    { path: "/disaster", module: "disaster" },
    { path: "/guide", module: "guide" },
    { path: "/about", module: "about" },
  ];
  const adminRoutes: { path: string; section: AdminSection }[] = [
    { path: "/admin", section: DEFAULT_ADMIN_SECTION },
    { path: "/admin/overview", section: "ov" },
    { path: "/admin/gee-credentials", section: "ge" },
    { path: "/admin/arcgis", section: "ag" },
    { path: "/admin/ml-models", section: "ml" },
    { path: "/admin/carbon-calibration", section: "cc" },
    { path: "/admin/system-config", section: "cf" },
    { path: "/admin/users", section: "us" },
    { path: "/admin/viewer-features", section: "vf" },
    { path: "/admin/satellite-providers", section: "sp" },
    { path: "/admin/company-boundaries", section: "co" },
    { path: ADMIN_DISASTER_NEW_PATH, section: "ds" },
    { path: ADMIN_DISASTER_EVENT_ROUTE, section: "ds" },
    { path: "/admin/disasters", section: "ds" },
    { path: "/admin/geospatial-data", section: "gd" },
    { path: "/admin/research-information", section: "ri" },
    { path: "/admin/profile", section: "profile" },
  ];

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AppLoginPage />} />
      <Route path="/register" element={<RegisterUserPage />} />
      <Route
        path="/dashboard"
        element={<DashboardEntryRoute />}
      />
      {dashboardRoutes.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={route.path === "/carbon-estimation" ? <CarbonEstimationRoute /> : <ProtectedAppRoute
            anyFeature={route.module === "carbon" ? [
              "app.feature.carbon_stock",
              "app.feature.land_cover",
              "app.feature.vegetation_indices",
            ] : route.module === "lc-change" ? ["app.feature.land_cover_change"] :
              route.module === "imagery" ? ["app.feature.satellite_exploration"] :
              route.module === "disaster" ? ["app.feature.disaster_mapping"] :
              route.module === "crop-monitoring" ? ["app.feature.crop_monitoring"] : undefined}
          ><DashboardPage module={route.module} /></ProtectedAppRoute>}
        />
      ))}
      {adminRoutes.map((route) => (
        <Route key={route.path} path={route.path} element={<AdminPage section={route.section} />} />
      ))}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/no-features" element={<ProtectedAppRoute><NoFeatureAccessPage /></ProtectedAppRoute>} />
      <Route path="/workflow" element={<ProtectedAppRoute anyFeature={[...VIEWER_FEATURE_CODES]}><WorkflowBuilderPage /></ProtectedAppRoute>} />
      <Route path="/workflow/new" element={<ProtectedAppRoute anyFeature={[...VIEWER_FEATURE_CODES]}><WorkflowBuilderPage /></ProtectedAppRoute>} />
      <Route path="/workflow/:id/edit" element={<ProtectedAppRoute anyFeature={[...VIEWER_FEATURE_CODES]}><WorkflowBuilderPage /></ProtectedAppRoute>} />
      <Route path="/workflow/:id/run" element={<ProtectedAppRoute anyFeature={[...VIEWER_FEATURE_CODES]}><WorkflowBuilderPage /></ProtectedAppRoute>} />
      <Route path="/embed/workflow/:workflowId" element={<EmbedPage />} />
      <Route path="/embed/map/:mapId" element={<EmbedPage />} />
      <Route path="/settings/plugins" element={<ProtectedAppRoute anyFeature={[...VIEWER_FEATURE_CODES]}><PluginManagerPage /></ProtectedAppRoute>} />
      <Route path="/dataset-viewer" element={<ProtectedAppRoute anyFeature={[...VIEWER_FEATURE_CODES]}><DatasetViewerPage /></ProtectedAppRoute>} />
      <Route
        path="/pemetaan-bencana"
        element={<ProtectedAppRoute feature="app.feature.disaster_mapping"><DashboardShell><DisasterListPage /></DashboardShell></ProtectedAppRoute>}
      />
      <Route
        path="/pemetaan-bencana/karhutla"
        element={<ProtectedAppRoute feature="app.feature.disaster_mapping"><DashboardShell><KarhutlaIndexPage /></DashboardShell></ProtectedAppRoute>}
      />
      <Route
        path="/pemetaan-bencana/karhutla/:eventSlug"
        element={<ProtectedAppRoute feature="app.feature.disaster_mapping"><DashboardShell><KarhutlaDetailPage /></DashboardShell></ProtectedAppRoute>}
      />
      <Route
        path="/pemetaan-bencana/:eventId"
        element={<ProtectedAppRoute feature="app.feature.disaster_mapping"><DashboardShell><DisasterDashboard /></DashboardShell></ProtectedAppRoute>}
      />
      <Route path="/disaster/event/:eventId" element={<ProtectedAppRoute feature="app.feature.disaster_mapping"><DashboardShell><DisasterDashboard /></DashboardShell></ProtectedAppRoute>} />
      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}

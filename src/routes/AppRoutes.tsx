import { Routes, Route } from "react-router-dom";
import LandingPage from "@/pages/LandingPage";
import AppLoginPage from "@/pages/AppLoginPage";
import RegisterUserPage from "@/pages/RegisterUserPage";
import DashboardPage from "@/pages/DashboardPage";
import AdminPage from "@/pages/AdminPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import DisasterListPage from "@/features/disaster/DisasterListPage";
import DisasterDashboard from "@/features/disaster/DisasterDashboard";
import { DEFAULT_ADMIN_SECTION } from "@/routes/adminSectionRoutes";
import type { DashboardModule } from "@/hooks/useUiStore";
import type { AdminSection } from "@/features/admin/types";
import ProtectedAppRoute from "@/components/auth/ProtectedAppRoute";
import DashboardEntryRoute from "@/routes/DashboardEntryRoute";

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
    { path: "/guide", module: "guide" },
    { path: "/about", module: "about" },
  ];
  const adminRoutes: { path: string; section: AdminSection }[] = [
    { path: "/admin", section: DEFAULT_ADMIN_SECTION },
    { path: "/admin/overview", section: "ov" },
    { path: "/admin/gee-credentials", section: "ge" },
    { path: "/admin/arcgis", section: "ag" },
    { path: "/admin/ml-models", section: "ml" },
    { path: "/admin/system-config", section: "cf" },
    { path: "/admin/users", section: "us" },
    { path: "/admin/satellite-providers", section: "sp" },
    { path: "/admin/company-boundaries", section: "co" },
    { path: "/admin/disasters", section: "ds" },
    { path: "/admin/research-information", section: "ri" },
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
          element={<ProtectedAppRoute><DashboardPage module={route.module} /></ProtectedAppRoute>}
        />
      ))}
      {adminRoutes.map((route) => (
        <Route key={route.path} path={route.path} element={<AdminPage section={route.section} />} />
      ))}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/pemetaan-bencana"
        element={<ProtectedAppRoute><DisasterListPage /></ProtectedAppRoute>}
      />
      <Route
        path="/pemetaan-bencana/:eventId"
        element={<ProtectedAppRoute><DisasterDashboard /></ProtectedAppRoute>}
      />
      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}

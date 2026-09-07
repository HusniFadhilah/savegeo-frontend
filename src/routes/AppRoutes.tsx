import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import DashboardPage from "@/pages/DashboardPage";
import AdminPage from "@/pages/AdminPage";
import LoginUserPage from "@/pages/LoginUserPage";
import RegisterUserPage from "@/pages/RegisterUserPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";
import DisasterListPage from "@/features/disaster/DisasterListPage";
import DisasterDashboard from "@/features/disaster/DisasterDashboard";
import { DEFAULT_DASHBOARD_MODULE } from "@/routes/dashboardModuleRoutes";
import { DEFAULT_ADMIN_SECTION } from "@/routes/adminSectionRoutes";
import type { DashboardModule } from "@/hooks/useUiStore";
import type { AdminSection } from "@/features/admin/types";

/**
 * Gates `/pemetaan-bencana*` behind the user auth store, mirroring exactly
 * how `pages/AdminPage.tsx` gates `/admin` today (`isAuthenticated` from the
 * store -> else render the login page). There's no separate `/register`
 * route (file boundary only allows adding the list/dashboard routes here),
 * so Login/Register is a local view toggle within this same gate instead of
 * navigation - see `LoginUserPage.tsx`/`RegisterUserPage.tsx`'s
 * `onSwitchTo*` props.
 */
function DisasterUserGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated: isUserAuthenticated } = useUserAuthStore();
  const { isAuthenticated: isAdminAuthenticated } = useAuthStore();
  const [view, setView] = useState<"login" | "register">("login");

  if (!isUserAuthenticated && !isAdminAuthenticated) {
    return view === "login" ? (
      <LoginUserPage onSwitchToRegister={() => setView("register")} />
    ) : (
      <RegisterUserPage onSwitchToLogin={() => setView("login")} />
    );
  }

  return <>{children}</>;
}

export default function AppRoutes() {
  const dashboardRoutes: { path: string; module: DashboardModule }[] = [
    { path: "/", module: DEFAULT_DASHBOARD_MODULE },
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
      {dashboardRoutes.map((route) => (
        <Route key={route.path} path={route.path} element={<DashboardPage module={route.module} />} />
      ))}
      {adminRoutes.map((route) => (
        <Route key={route.path} path={route.path} element={<AdminPage section={route.section} />} />
      ))}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/pemetaan-bencana"
        element={
          <DisasterUserGate>
            <DisasterListPage />
          </DisasterUserGate>
        }
      />
      <Route
        path="/pemetaan-bencana/:eventId"
        element={
          <DisasterUserGate>
            <DisasterDashboard />
          </DisasterUserGate>
        }
      />
      <Route path="*" element={<DashboardPage />} />
    </Routes>
  );
}

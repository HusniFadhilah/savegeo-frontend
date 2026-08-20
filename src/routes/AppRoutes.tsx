import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import DashboardPage from "@/pages/DashboardPage";
import AdminPage from "@/pages/AdminPage";
import LoginUserPage from "@/pages/LoginUserPage";
import RegisterUserPage from "@/pages/RegisterUserPage";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";
import DisasterListPage from "@/features/disaster/DisasterListPage";
import DisasterDashboard from "@/features/disaster/DisasterDashboard";

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
  const { isAuthenticated } = useUserAuthStore();
  const [view, setView] = useState<"login" | "register">("login");

  if (!isAuthenticated) {
    return view === "login" ? (
      <LoginUserPage onSwitchToRegister={() => setView("register")} />
    ) : (
      <RegisterUserPage onSwitchToLogin={() => setView("login")} />
    );
  }

  return <>{children}</>;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/admin" element={<AdminPage />} />
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

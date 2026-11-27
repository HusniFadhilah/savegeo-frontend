import { useEffect, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/hooks/useAuthStore";
import { canAccessAdminSection, firstAccessibleAdminSection, isViewerRole } from "@/auth/access";
import LoginPage from "@/pages/LoginPage";
import AdminDashboard from "@/features/admin/AdminDashboard";
import { DEFAULT_ADMIN_SECTION, getAdminSectionPath } from "@/routes/adminSectionRoutes";
import type { AdminSection } from "@/features/admin/types";
import { useBilingualCopy } from "@/hooks/useBilingualCopy";

export default function AdminPage({ section = DEFAULT_ADMIN_SECTION }: { section?: AdminSection }) {
  const c = useBilingualCopy();
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const navigate = useNavigate();
  const previousAuth = useRef<boolean | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (previousAuth.current === false && isAuthenticated) {
      navigate("/carbon-estimation", { replace: true });
    }
    previousAuth.current = isAuthenticated;
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    return <div className="d-flex min-vh-100 align-items-center justify-content-center">{c("Memverifikasi sesi…", "Verifying session…")}</div>;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (isViewerRole(user)) {
    return <Navigate to="/carbon-estimation" replace />;
  }

  if (!canAccessAdminSection(user, section)) {
    const fallbackSection = firstAccessibleAdminSection(user);
    return <Navigate to={fallbackSection ? getAdminSectionPath(fallbackSection as AdminSection) : "/carbon-estimation"} replace />;
  }

  return <AdminDashboard section={section} />;
}

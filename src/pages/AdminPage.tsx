import { useAuthStore } from "@/hooks/useAuthStore";
import { canAccessAdminSection, firstAccessibleAdminSection, isViewerRole } from "@/auth/access";
import LoginPage from "@/pages/LoginPage";
import AdminDashboard from "@/features/admin/AdminDashboard";
import { DEFAULT_ADMIN_SECTION, getAdminSectionPath } from "@/routes/adminSectionRoutes";
import type { AdminSection } from "@/features/admin/types";
import { Navigate } from "react-router-dom";

export default function AdminPage({ section = DEFAULT_ADMIN_SECTION }: { section?: AdminSection }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return <div className="d-flex min-vh-100 align-items-center justify-content-center">Memverifikasi sesi...</div>;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (isViewerRole(user?.role)) {
    return <Navigate to="/carbon-estimation" replace />;
  }

  if (!canAccessAdminSection(user, section)) {
    const fallbackSection = firstAccessibleAdminSection(user);
    return <Navigate to={fallbackSection ? getAdminSectionPath(fallbackSection as AdminSection) : "/carbon-estimation"} replace />;
  }

  return <AdminDashboard section={section} />;
}

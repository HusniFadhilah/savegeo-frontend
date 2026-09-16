import { Navigate } from "react-router-dom";
import { getDashboardEntryPath } from "@/auth/access";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";

/** Role-aware entry point for the shared /dashboard link. */
export default function DashboardEntryRoute() {
  const isAdminAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const adminRole = useAuthStore((state) => state.user?.role);
  const isUserAuthenticated = useUserAuthStore((state) => state.isAuthenticated);
  const isAdminLoading = useAuthStore((state) => state.isLoading);
  const isUserLoading = useUserAuthStore((state) => state.isLoading);

  if (isAdminLoading || isUserLoading) {
    return <div className="d-flex min-vh-100 align-items-center justify-content-center">Memverifikasi sesi...</div>;
  }

  // An admin may also have a public user cookie from an earlier session. The
  // explicit non-viewer admin session wins, while viewer accounts stay in the
  // regular application dashboard and never enter the admin dashboard loop.
  const destination = getDashboardEntryPath({ isAdminAuthenticated, isUserAuthenticated, adminRole });
  return <Navigate to={destination} replace />;
}

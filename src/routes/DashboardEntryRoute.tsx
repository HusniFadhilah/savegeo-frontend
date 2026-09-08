import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";

/** Role-aware entry point for the shared /dashboard link. */
export default function DashboardEntryRoute() {
  const isAdminAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isUserAuthenticated = useUserAuthStore((state) => state.isAuthenticated);
  const isAdminLoading = useAuthStore((state) => state.isLoading);
  const isUserLoading = useUserAuthStore((state) => state.isLoading);

  if (isAdminLoading || isUserLoading) {
    return <div className="d-flex min-vh-100 align-items-center justify-content-center">Memverifikasi sesi...</div>;
  }

  if (!isAdminAuthenticated && !isUserAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // An admin may also have a public user cookie from an earlier session. The
  // explicit admin session must win for the shared Dashboard entry point.
  const destination = isAdminAuthenticated ? "/admin" : "/carbon-estimation";
  return <Navigate to={destination} replace />;
}

import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";

/** Role-aware entry point for the shared /dashboard link. */
export default function DashboardEntryRoute() {
  const isAdminAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isUserAuthenticated = useUserAuthStore((state) => state.isAuthenticated);

  if (!isAdminAuthenticated && !isUserAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const destination = isAdminAuthenticated && !isUserAuthenticated ? "/admin" : "/carbon-estimation";
  return <Navigate to={destination} replace />;
}

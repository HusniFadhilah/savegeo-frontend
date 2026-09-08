import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";

export default function ProtectedAppRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isUserAuthenticated = useUserAuthStore((state) => state.isAuthenticated);
  const isAdminAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isUserLoading = useUserAuthStore((state) => state.isLoading);
  const isAdminLoading = useAuthStore((state) => state.isLoading);

  if (isUserLoading || isAdminLoading) {
    return <div className="d-flex min-vh-100 align-items-center justify-content-center">Memverifikasi sesi...</div>;
  }

  if (!isUserAuthenticated && !isAdminAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }

  return <>{children}</>;
}

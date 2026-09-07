import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";

export default function ProtectedAppRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isUserAuthenticated = useUserAuthStore((state) => state.isAuthenticated);
  const isAdminAuthenticated = useAuthStore((state) => state.isAuthenticated);

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

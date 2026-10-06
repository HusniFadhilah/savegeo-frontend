import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { getDashboardEntryPath, isViewerRole } from "@/auth/access";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";
import { useViewerFeatures } from "@/hooks/useViewerFeatures";
import { getViewerLandingPath } from "@/auth/viewerFeatures";
import { useI18nStore } from "@/hooks/useI18nStore";

/** Role-aware entry point for the shared /dashboard link. */
export default function DashboardEntryRoute() {
  const isAdminAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const adminRole = useAuthStore((state) => state.user?.role);
  const isUserAuthenticated = useUserAuthStore((state) => state.isAuthenticated);
  const isAdminLoading = useAuthStore((state) => state.isLoading);
  const isUserLoading = useUserAuthStore((state) => state.isLoading);
  const features = useViewerFeatures((state) => state.features);
  const featuresLoading = useViewerFeatures((state) => state.isLoading);
  const featureError = useViewerFeatures((state) => state.error);
  const loadFeatures = useViewerFeatures((state) => state.load);
  const t = useI18nStore((state) => state.t);
  const isViewerPrincipal = isUserAuthenticated || isViewerRole(adminRole);

  useEffect(() => {
    if (!isAdminLoading && !isUserLoading && isViewerPrincipal && features === null) void loadFeatures();
  }, [isAdminLoading, isUserLoading, isViewerPrincipal, features, loadFeatures]);

  if (isAdminLoading || isUserLoading) {
    return <div className="d-flex min-vh-100 align-items-center justify-content-center">{t("auth.verifyingSession")}</div>;
  }
  if (isViewerPrincipal && (features === null || featuresLoading)) {
    return <div className="d-flex min-vh-100 align-items-center justify-content-center" role="status">{t("access.loadingFeatures")}</div>;
  }
  if (isViewerPrincipal && featureError) {
    return (
      <main className="container py-5" role="alert">
        <h1>{t("access.title")}</h1>
        <p>{t("access.loadFailed")}</p>
        <button type="button" className="btn btn-outline-primary" onClick={() => void loadFeatures(true)}>{t("access.retry")}</button>
      </main>
    );
  }

  // An admin may also have a public user cookie from an earlier session. The
  // explicit non-viewer admin session wins, while viewer accounts stay in the
  // regular application dashboard and never enter the admin dashboard loop.
  const destination = isViewerPrincipal
    ? getViewerLandingPath(features)
    : getDashboardEntryPath({ isAdminAuthenticated, isUserAuthenticated, adminRole });
  return <Navigate to={destination} replace />;
}

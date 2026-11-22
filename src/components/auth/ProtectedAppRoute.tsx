import { useEffect, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";
import { useI18nStore } from "@/hooks/useI18nStore";
import { isViewerRole } from "@/auth/access";
import { useViewerFeatures, type ViewerFeatureCode } from "@/hooks/useViewerFeatures";

export default function ProtectedAppRoute({
  children,
  feature,
  anyFeature,
  checkFeatureAccess = true,
}: {
  children: ReactNode;
  feature?: ViewerFeatureCode;
  anyFeature?: ViewerFeatureCode[];
  checkFeatureAccess?: boolean;
}) {
  const location = useLocation();
  const isUserAuthenticated = useUserAuthStore((state) => state.isAuthenticated);
  const isAdminAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isUserLoading = useUserAuthStore((state) => state.isLoading);
  const isAdminLoading = useAuthStore((state) => state.isLoading);
  const adminAccount = useAuthStore((state) => state.user);
  const features = useViewerFeatures((state) => state.features);
  const featureError = useViewerFeatures((state) => state.error);
  const loadFeatures = useViewerFeatures((state) => state.load);
  const isViewerPrincipal = isAdminAuthenticated
    ? isViewerRole(adminAccount)
    : isUserAuthenticated;
  const t = useI18nStore((state) => state.t);

  useEffect(() => {
    if (checkFeatureAccess && isViewerPrincipal && features === null) void loadFeatures();
  }, [checkFeatureAccess, isViewerPrincipal, features, loadFeatures]);

  useEffect(() => {
    if (!checkFeatureAccess || !isViewerPrincipal) return;
    const refresh = () => void loadFeatures(true);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [checkFeatureAccess, isViewerPrincipal, loadFeatures]);

  if (isUserLoading || isAdminLoading) {
    return <div className="d-flex min-vh-100 align-items-center justify-content-center">{t("auth.verifyingSession")}</div>;
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

  // A focus-triggered refresh must not unmount an already-authorized workspace
  // and discard its analysis/map state. Gate only the initial permission load.
  if (checkFeatureAccess && isViewerPrincipal && features === null) {
    return <div className="d-flex min-vh-100 align-items-center justify-content-center" role="status">{t("access.loadingFeatures")}</div>;
  }
  if (checkFeatureAccess && isViewerPrincipal && featureError) {
    return (
      <main className="container py-5" role="alert">
        <h1>{t("access.title")}</h1>
        <p>{t("access.loadFailed")}</p>
        <button type="button" className="btn btn-outline-primary" onClick={() => void loadFeatures(true)}>{t("access.retry")}</button>
      </main>
    );
  }
  const modeFeature: Record<string, ViewerFeatureCode> = {
    carbon: "app.feature.carbon_stock",
    vegetation: "app.feature.vegetation_indices",
    landcover: "app.feature.land_cover",
    landcover_change: "app.feature.land_cover_change",
  };
  const requestedMode = location.pathname.endsWith("carbon-estimation")
    ? new URLSearchParams(location.search).get("mode")
    : null;
  const requestedModeFeature = requestedMode ? modeFeature[requestedMode] : undefined;
  const hasRequestedFeature = !checkFeatureAccess || !isViewerPrincipal || (
    (!feature || features?.includes(feature)) &&
    (!anyFeature || anyFeature.some((code) => features?.includes(code))) &&
    (!requestedModeFeature || features?.includes(requestedModeFeature))
  );
  if (!hasRequestedFeature) {
    return (
      <main className="container py-5" role="alert">
        <h1>{t("access.title")}</h1>
        <p>{t("access.denied")}</p>
        <Link className="btn btn-outline-primary" to="/dashboard">{t("access.backToDashboard")}</Link>
      </main>
    );
  }

  return <>{children}</>;
}

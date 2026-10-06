import { Link, Navigate } from "react-router-dom";
import { useI18nStore } from "@/hooks/useI18nStore";
import { useViewerFeatures } from "@/hooks/useViewerFeatures";

export default function NoFeatureAccessPage() {
  const t = useI18nStore((state) => state.t);
  const features = useViewerFeatures((state) => state.features);
  if (features === null) return <Navigate to="/dashboard" replace />;
  if (features.length > 0) return <Navigate to="/dashboard" replace />;
  return (
    <main className="container py-5">
      <div className="card mx-auto" style={{ maxWidth: 720 }}>
        <div className="card-body p-4">
          <h1 className="h3">{t("access.title")}</h1>
          <p>{t("access.none")}</p>
          <p className="text-muted">{t("access.noneAdminHint")}</p>
          <div className="d-flex gap-2">
            <Link className="btn btn-outline-primary" to="/guide">{t("access.guide")}</Link>
            <Link className="btn btn-outline-secondary" to="/about">{t("access.about")}</Link>
          </div>
        </div>
      </div>
    </main>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { VIEWER_FEATURE_CODES } from "@/auth/viewerFeatures";
import { getViewerFeatureSettings, saveViewerFeatureSettings } from "../api";
import type { ViewerFeatureSetting } from "../types";
import { useI18nStore } from "@/hooks/useI18nStore";
import { useAdmin } from "../AdminContext";

function isValidViewerFeatureResponse(response: { features: ViewerFeatureSetting[] }): boolean {
  if (!response || !Array.isArray(response.features)) return false;
  if (!response.features.every((feature) =>
    feature &&
    typeof feature.code === "string" &&
    typeof feature.name === "string" &&
    typeof feature.description === "string" &&
    typeof feature.enabled === "boolean"
  )) return false;
  const codes = response.features.map((feature) => feature.code);
  return codes.length === VIEWER_FEATURE_CODES.length &&
    new Set(codes).size === codes.length &&
    codes.every((code) => (VIEWER_FEATURE_CODES as readonly string[]).includes(code));
}

export default function ViewerFeatureSettings() {
  const t = useI18nStore((state) => state.t);
  const { notify } = useAdmin();
  const [features, setFeatures] = useState<ViewerFeatureSetting[]>([]);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const dirty = useMemo(
    () => features.some((feature) => Boolean(draft[feature.code]) !== feature.enabled),
    [features, draft],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getViewerFeatureSettings();
      if (!isValidViewerFeatureResponse(response)) {
        throw new Error(t("admin.viewerFeatures.invalidResponse"));
      }
      setFeatures(response.features);
      setDraft(Object.fromEntries(response.features.map((feature) => [feature.code, feature.enabled])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("admin.viewerFeatures.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const cancel = () => {
    setDraft(Object.fromEntries(features.map((feature) => [feature.code, feature.enabled])));
    setError(null);
    setMessage(null);
  };

  const save = async () => {
    if (!dirty || saving) return;
    const confirmed = window.confirm(t("admin.viewerFeatures.confirm"));
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const enabled = features.filter((feature) => draft[feature.code]).map((feature) => feature.code);
      const response = await saveViewerFeatureSettings(enabled);
      if (!isValidViewerFeatureResponse(response)) {
        throw new Error(t("admin.viewerFeatures.invalidResponse"));
      }
      setFeatures(response.features);
      setDraft(Object.fromEntries(response.features.map((feature) => [feature.code, feature.enabled])));
      setMessage(t("admin.viewerFeatures.saved"));
      notify(t("admin.viewerFeatures.saved"), "s");
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : t("admin.viewerFeatures.saveError");
      setError(detail);
      notify(detail, "e");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card">
      <div className="card-header-custom">
        <span>{t("admin.viewerFeatures.heading")}</span>
      </div>
      <div className="card-body-custom">
        <p className="text-muted small mb-3">{t("admin.viewerFeatures.description")}</p>
        {loading ? (
          <div className="py-4 text-center" role="status" aria-live="polite">{t("admin.viewerFeatures.loading")}</div>
        ) : error && features.length === 0 ? (
          <div>
            <div className="alert alert-danger" role="alert">{error}</div>
            <button type="button" className="btn-sm" disabled={loading} onClick={() => void load()}>
              {t("admin.viewerFeatures.reload")}
            </button>
          </div>
        ) : (
          <>
            <fieldset className="d-grid gap-2 border-0 p-0 m-0" disabled={saving}>
              <legend className="visually-hidden">{t("admin.viewerFeatures.heading")}</legend>
              {features.map((feature) => {
                const featureKey = feature.code.replace("app.feature.", "");
                const label = t(`admin.viewerFeatures.${featureKey}.name`);
                return (
                <label key={feature.code} className="d-flex gap-3 align-items-start border rounded p-3">
                  <input
                    type="checkbox"
                    className="form-check-input mt-1"
                    checked={Boolean(draft[feature.code])}
                    onChange={(event) => setDraft((current) => ({ ...current, [feature.code]: event.target.checked }))}
                    aria-label={label}
                  />
                  <span>
                    <strong className="d-block">{label}</strong>
                    <span className="small text-muted">{t(`admin.viewerFeatures.${featureKey}.description`)}</span>
                  </span>
                </label>
                );
              })}
            </fieldset>
            {error && <div className="alert alert-danger mt-3 mb-0" role="alert">{error}</div>}
            {message && <div className="alert alert-success mt-3 mb-0" role="status">{message}</div>}
            <div className="d-flex gap-2 mt-3">
              <button type="button" className="btn-sm primary" disabled={!dirty || saving} onClick={() => void save()}>
                <i className="bi bi-save" aria-hidden="true" /> {saving ? t("admin.viewerFeatures.saving") : t("admin.viewerFeatures.save")}
              </button>
              <button type="button" className="btn-sm" disabled={!dirty || saving} onClick={cancel}>
                {t("admin.viewerFeatures.cancel")}
              </button>
              <button type="button" className="btn-sm" disabled={saving} onClick={() => void load()}>
                <i className="bi bi-arrow-repeat" aria-hidden="true" /> {t("admin.viewerFeatures.reload")}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

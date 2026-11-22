import { useCallback, useEffect, useState } from "react";
import { getOllamaModels, getOpenRouterModels } from "../api";
import { AI_PROVIDERS } from "../types";
import type { AdminConfigItem, OllamaCatalog, OpenRouterModelInfo } from "../types";
import SearchableSelect, { type SearchableOption } from "./SearchableSelect";
import { useI18nStore } from "@/hooks/useI18nStore";

interface Props {
  items: AdminConfigItem[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  providerStatus: Record<string, boolean>;
}

const PROVIDER_TRANSLATIONS: Record<string, { label: string; hint: string }> = {
  anthropic: { label: "admin.config.ai.provider.anthropic", hint: "admin.config.ai.provider.anthropicHint" },
  openai: { label: "admin.config.ai.provider.openai", hint: "admin.config.ai.provider.openaiHint" },
  openrouter: { label: "admin.config.ai.provider.openrouter", hint: "admin.config.ai.provider.openrouterHint" },
  deepseek: { label: "admin.config.ai.provider.deepseek", hint: "admin.config.ai.provider.deepseekHint" },
  gemini: { label: "admin.config.ai.provider.gemini", hint: "admin.config.ai.provider.geminiHint" },
  ollama: { label: "admin.config.ai.provider.ollama", hint: "admin.config.ai.provider.ollamaHint" },
  opencode: { label: "admin.config.ai.provider.opencode", hint: "admin.config.ai.provider.opencodeHint" },
};

/**
 * Renders the "ai" system-config category: the provider selector cards,
 * write-only secret (API key) fields with configured/not-configured badges,
 * and the OpenRouter model picker. Ported from admin-scripts.js's `_cfgRow`
 * special cases + `_initORPicker`, minus Tom Select (see SearchableSelect.tsx).
 */
export default function AiProviderConfig({ items, values, onChange, providerStatus }: Props) {
  const t = useI18nStore((state) => state.t);
  const groupOrder = [
    { id: "free", label: t("admin.config.ai.group.free") },
    { id: "paid", label: t("admin.config.ai.group.paid") },
  ];
  const providerItem = items.find((i) => i.key === "ai.provider");
  const currentProvider = values["ai.provider"] ?? providerItem?.raw_value ?? "anthropic";

  const [orModels, setOrModels] = useState<OpenRouterModelInfo[] | null>(null);
  const [orLoading, setOrLoading] = useState(false);
  const [orError, setOrError] = useState<string | null>(null);
  // Real Ollama state from /admin/ollama/models - never assumed healthy.
  const [ollama, setOllama] = useState<OllamaCatalog | null>(null);
  const [ollamaLoading, setOllamaLoading] = useState(false);

  const probeOllama = useCallback(() => {
    setOllamaLoading(true);
    getOllamaModels()
      .then(setOllama)
      .catch(() =>
        setOllama({ reachable: false, models: [], latency_ms: null, error: "request_failed", message: t("admin.config.ai.ollama.probeFailed") }),
      )
      .finally(() => setOllamaLoading(false));
  }, [t]);

  useEffect(() => {
    probeOllama();
  }, [probeOllama]);

  useEffect(() => {
    if (currentProvider !== "openrouter" || orModels !== null || orLoading) return;
    let cancelled = false;
    setOrLoading(true);
    setOrError(null);
    getOpenRouterModels()
      .then((r) => {
        if (cancelled) return;
        if (r.error) throw new Error(r.error);
        setOrModels(r.models || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setOrError(err instanceof Error ? err.message : t("admin.config.ai.openRouter.loadFailed"));
        setOrModels([]);
      })
      .finally(() => {
        if (!cancelled) setOrLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProvider, t]);

  const orOptions: SearchableOption[] = (orModels || []).map((m) => ({
    value: m.id,
    label: m.name,
    group: m.is_free ? "free" : "paid",
    isFree: m.is_free,
    inputPerM: m.input_per_m,
    outputPerM: m.output_per_m,
    contextLength: m.context_length,
  }));

  return (
    <>
      {items.map((item) => {
        const itemLabelKey = `admin.config.item.${item.key}.label`;
        const translatedItemLabel = t(itemLabelKey);
        const keyLabel = translatedItemLabel === itemLabelKey ? item.label || item.key.split(".").pop() : translatedItemLabel;
        const itemDescriptionKey = `admin.config.item.${item.key}.description`;
        const translatedItemDescription = t(itemDescriptionKey);
        const itemDescription = translatedItemDescription === itemDescriptionKey ? item.description : translatedItemDescription;

        if (item.key === "ai.provider") {
          return (
            <div className="cfg-row cfg-row-provider" key={item.key}>
              <span className="cfg-key" title={item.key}>
                {keyLabel}
              </span>
              <div className="cfg-val">
                <div className="cfg-provider-list">
                  {AI_PROVIDERS.map((p) => {
                    const ok = p.id === "ollama" ? Boolean(ollama?.reachable) : !p.needsKey || providerStatus[p.id];
                    const active = p.id === currentProvider;
                    return (
                      <label key={p.id} className={`cfg-provider-card ${active ? "active" : ""}`}>
                        <input
                          type="radio"
                          name="ai_provider_radio"
                          value={p.id}
                          checked={active}
                          onChange={() => onChange("ai.provider", p.id)}
                          style={{ display: "none" }}
                        />
                        <span className="cfg-provider-icon">{p.icon}</span>
                        <span className="cfg-provider-name">{t(PROVIDER_TRANSLATIONS[p.id]?.label ?? "admin.config.ai.provider.openai")}</span>
                        <span className="cfg-provider-hint">{t(PROVIDER_TRANSLATIONS[p.id]?.hint ?? "admin.config.ai.provider.openaiHint")}</span>
                        <span className={ok ? "cfg-secret-ok" : "cfg-secret-empty"} style={{ fontSize: 10, marginLeft: "auto" }}>
                          {p.id === "ollama"
                            ? ollama === null
                              ? t("admin.config.ai.ollama.checking")
                              : ok
                                ? t("admin.config.ai.ollama.ready")
                                : t("admin.config.ai.ollama.unreachable")
                            : ok
                              ? t("admin.config.ai.ollama.ready")
                              : t("admin.config.ai.provider.keyRequired")}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <span className="cfg-type" />
            </div>
          );
        }

        if (item.key === "ai.model") {
          const isOR = currentProvider === "openrouter";
          const isOllama = currentProvider === "ollama";
          const ollamaOptions: SearchableOption[] = (ollama?.models ?? []).map((m) => ({
            value: m.name,
            label: m.parameter_size ? `${m.name} (${m.parameter_size})` : m.name,
          }));
          return (
            <div className="cfg-row" key={item.key}>
              <span className="cfg-key" title={item.key}>
                {keyLabel}
              </span>
              <div className="cfg-val">
                {orError && <div className="adm-inline-error">{orError}</div>}
                <SearchableSelect
                  id="or-model-select"
                  value={values[item.key] ?? item.raw_value ?? ""}
                  onChange={(v) => onChange("ai.model", v)}
                  options={isOR ? orOptions : isOllama ? ollamaOptions : []}
                  groupOrder={isOR ? groupOrder : undefined}
                  loading={isOR && orLoading}
                  placeholder={
                    isOR
                      ? t("admin.config.ai.model.search")
                      : currentProvider === "ollama"
                        ? t("admin.config.ai.model.ollamaExample")
                        : t("admin.config.ai.model.defaultProviderHint")
                  }
                  allowCustomValue={!isOllama || !ollama?.reachable}
                />
                {isOllama && (
                  <small className="text-muted d-block mt-1">
                    {ollamaLoading || ollama === null
                      ? t("admin.config.ai.ollama.checkingServer")
                      : ollama.reachable
                        ? t("admin.config.ai.ollama.connectedSummary", { latency: ollama.latency_ms ?? "?", count: ollama.models.length })
                        : t("admin.config.ai.ollama.unreachableSummary", { message: ollama.message ?? t("admin.config.ai.ollama.noResponse") })}{" "}
                    <button type="button" className="btn btn-link btn-sm p-0" onClick={probeOllama} disabled={ollamaLoading}>
                      {t("admin.config.ai.ollama.checkAgain")}
                    </button>
                    {" · "}{t("admin.config.ai.ollama.urlConfiguredAt")} <code>ollama_base_url</code>.
                  </small>
                )}
              </div>
              <span className="cfg-type" />
            </div>
          );
        }

        if (item.key === "ai.daily_budget_usd") {
          return (
            <div className="cfg-row" key={item.key}>
              <span className="cfg-key" title={item.key}>{t("admin.ai.dailyBudget.label")}</span>
              <div className="cfg-val">
                <input
                  type="number"
                  min="0"
                  max="2000"
                  step="0.01"
                  value={values[item.key] ?? item.raw_value ?? "0"}
                  onChange={(e) => onChange(item.key, e.target.value)}
                  aria-label={t("admin.ai.dailyBudget.label")}
                />
                <small className="text-muted d-block mt-1">
                  {t("admin.ai.dailyBudget.hint")}
                </small>
              </div>
              <span className="cfg-type">{t("admin.ai.dailyBudget.unit")}</span>
            </div>
          );
        }

        if (item.key === "ai.model_pricing_json") {
          return (
            <div className="cfg-row" key={item.key}>
              <span className="cfg-key" title={item.key}>{t("admin.ai.modelPricing.label")}</span>
              <div className="cfg-val">
                <textarea
                  rows={5}
                  spellCheck={false}
                  value={values[item.key] ?? item.raw_value ?? "{}"}
                  onChange={(e) => onChange(item.key, e.target.value)}
                  aria-label={t("admin.ai.modelPricing.label")}
                  placeholder={'{"openai:gpt-4o":{"input_per_million_usd":2.5,"output_per_million_usd":10}}'}
                />
                <small className="text-muted d-block mt-1">
                  {t("admin.ai.modelPricing.hint")}
                </small>
              </div>
              <span className="cfg-type">JSON</span>
            </div>
          );
        }

        if (item.is_secret) {
          const configured = item.is_configured;
          return (
            <div className="cfg-row" key={item.key}>
              <span className="cfg-key" title={item.key}>
                {keyLabel}
              </span>
              <div className="cfg-val">
                <div className="cfg-secret-wrap">
                  <input
                    type="password"
                    autoComplete="new-password"
                    title={itemDescription}
                    placeholder={configured ? t("admin.config.secretReplacePlaceholder") : t("admin.config.secretMissingPlaceholder")}
                    value={values[item.key] ?? ""}
                    onChange={(e) => onChange(item.key, e.target.value)}
                  />
                  <span className={configured ? "cfg-secret-ok" : "cfg-secret-empty"}>
                    <i className={`bi ${configured ? "bi-check-circle-fill" : "bi-exclamation-circle-fill"}`} />{" "}
                    {configured ? t("admin.config.configured") : t("admin.config.empty")}
                  </span>
                </div>
              </div>
              <span className="cfg-type">{item.value_type}</span>
            </div>
          );
        }

        return (
          <div className="cfg-row" key={item.key}>
            <span className="cfg-key" title={item.key}>
              {keyLabel}
            </span>
            <div className="cfg-val">
              <input
                title={itemDescription}
                value={values[item.key] ?? ""}
                onChange={(e) => onChange(item.key, e.target.value)}
              />
            </div>
            <span className="cfg-type">{item.value_type}</span>
          </div>
        );
      })}
    </>
  );
}

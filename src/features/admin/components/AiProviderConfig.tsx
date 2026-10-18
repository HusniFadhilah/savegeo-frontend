import { useEffect, useState } from "react";
import { getOllamaModels, getOpenRouterModels } from "../api";
import { AI_PROVIDERS } from "../types";
import type { AdminConfigItem, OllamaCatalog, OpenRouterModelInfo } from "../types";
import SearchableSelect, { type SearchableOption } from "./SearchableSelect";

interface Props {
  items: AdminConfigItem[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  providerStatus: Record<string, boolean>;
}

const GROUP_ORDER = [
  { id: "free", label: "✅  Model Gratis" },
  { id: "paid", label: "\u{1F4B0}  Model Berbayar" },
];

/**
 * Renders the "ai" system-config category: the provider selector cards,
 * write-only secret (API key) fields with configured/not-configured badges,
 * and the OpenRouter model picker. Ported from admin-scripts.js's `_cfgRow`
 * special cases + `_initORPicker`, minus Tom Select (see SearchableSelect.tsx).
 */
export default function AiProviderConfig({ items, values, onChange, providerStatus }: Props) {
  const providerItem = items.find((i) => i.key === "ai.provider");
  const currentProvider = values["ai.provider"] ?? providerItem?.raw_value ?? "anthropic";

  const [orModels, setOrModels] = useState<OpenRouterModelInfo[] | null>(null);
  const [orLoading, setOrLoading] = useState(false);
  const [orError, setOrError] = useState<string | null>(null);
  // Real Ollama state from /admin/ollama/models - never assumed healthy.
  const [ollama, setOllama] = useState<OllamaCatalog | null>(null);
  const [ollamaLoading, setOllamaLoading] = useState(false);

  const probeOllama = () => {
    setOllamaLoading(true);
    getOllamaModels()
      .then(setOllama)
      .catch(() =>
        setOllama({ reachable: false, models: [], latency_ms: null, error: "request_failed", message: "Gagal memeriksa Ollama." }),
      )
      .finally(() => setOllamaLoading(false));
  };

  useEffect(() => {
    probeOllama();
  }, []);

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
        setOrError(err instanceof Error ? err.message : "Gagal memuat daftar model OpenRouter");
        setOrModels([]);
      })
      .finally(() => {
        if (!cancelled) setOrLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProvider]);

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
        const keyLabel = item.key.split(".").pop();

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
                        <span className="cfg-provider-name">{p.label}</span>
                        <span className="cfg-provider-hint">{p.hint}</span>
                        <span className={ok ? "cfg-secret-ok" : "cfg-secret-empty"} style={{ fontSize: 10, marginLeft: "auto" }}>
                          {p.id === "ollama"
                            ? ollama === null
                              ? "Memeriksa…"
                              : ok
                                ? "Siap"
                                : "Tidak terjangkau"
                            : ok
                              ? "Siap"
                              : "Perlu key"}
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
                  groupOrder={isOR ? GROUP_ORDER : undefined}
                  loading={isOR && orLoading}
                  placeholder={
                    isOR
                      ? "Cari atau ketik nama model..."
                      : currentProvider === "ollama"
                        ? "Contoh: qwen3:8b (sesuai ollama list)"
                        : "Kosong = default provider"
                  }
                  allowCustomValue={!isOllama || !ollama?.reachable}
                />
                {isOllama && (
                  <small className="text-muted d-block mt-1">
                    {ollamaLoading || ollama === null
                      ? "Memeriksa server Ollama…"
                      : ollama.reachable
                        ? `Terhubung (${ollama.latency_ms ?? "?"} ms) · ${ollama.models.length} model terpasang. Hanya model terpasang yang dapat disimpan.`
                        : `Ollama tidak terjangkau: ${ollama.message ?? "tidak ada respons"}. Nama model dapat diisi manual, tetapi belum diverifikasi.`}{" "}
                    <button type="button" className="btn btn-link btn-sm p-0" onClick={probeOllama} disabled={ollamaLoading}>
                      Periksa ulang
                    </button>
                    {" · "}URL diatur pada baris <code>ollama_base_url</code>.
                  </small>
                )}
              </div>
              <span className="cfg-type" />
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
                    title={item.description}
                    placeholder={configured ? "Isi untuk mengganti" : "Belum dikonfigurasi"}
                    value={values[item.key] ?? ""}
                    onChange={(e) => onChange(item.key, e.target.value)}
                  />
                  <span className={configured ? "cfg-secret-ok" : "cfg-secret-empty"}>
                    <i className={`bi ${configured ? "bi-check-circle-fill" : "bi-exclamation-circle-fill"}`} />{" "}
                    {configured ? "Dikonfigurasi" : "Belum diisi"}
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
                title={item.description}
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

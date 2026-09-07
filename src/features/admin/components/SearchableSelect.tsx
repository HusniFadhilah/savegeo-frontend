import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Small dependency-free searchable/creatable combobox, built to replace the
 * legacy admin panel's Tom Select (CDN dependency, not available as an npm
 * package that matches the exact custom-option-rendering the OpenRouter
 * model picker needs). Supports: text filtering, optional grouping, a
 * "create/use free-typed value" affordance, keyboard nav, and a clear button
 * — the subset of Tom Select actually used by admin-scripts.js's
 * `_initORPicker`.
 */
export interface SearchableOption {
  value: string;
  label: string;
  group?: string;
  isFree?: boolean;
  inputPerM?: number;
  outputPerM?: number;
  contextLength?: number;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  groupOrder?: { id: string; label: string }[];
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  allowCustomValue?: boolean;
  emptyHint?: string;
  id?: string;
  variant?: "model" | "plain";
  className?: string;
}

function formatCtx(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M ctx`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K ctx`;
  return `${n} ctx`;
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  groupOrder,
  placeholder = "Cari...",
  loading = false,
  disabled = false,
  allowCustomValue = true,
  emptyHint = "Tidak ditemukan",
  id,
  variant = "model",
  className = "",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
      : options;
    if (!groupOrder) return base;
    return [...base].sort((a, b) => {
      const ga = groupOrder.findIndex((g) => g.id === a.group);
      const gb = groupOrder.findIndex((g) => g.id === b.group);
      return ga - gb;
    });
  }, [options, query, groupOrder]);

  const showCreate = allowCustomValue && query.trim() && !filtered.some((o) => o.value === query.trim());

  const flatList: (SearchableOption | { create: true; value: string })[] = showCreate
    ? [...filtered, { create: true, value: query.trim() }]
    : filtered;

  useEffect(() => {
    setActiveIdx(0);
  }, [query, open]);

  const commit = (val: string) => {
    onChange(val);
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, flatList.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatList[activeIdx];
      if (item) commit(item.value);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  let lastGroup: string | undefined;
  const inputValue = variant === "plain" && !open && selected ? selected.label : open ? query : "";
  const inputPlaceholder = loading ? "Memuat..." : selected ? selected.label : placeholder;

  return (
    <div className={`adm-ssel adm-ssel-${variant} ${className}`.trim()} ref={rootRef}>
      <div className={`adm-ssel-control ${open ? "open" : ""} ${disabled ? "disabled" : ""}`}>
        <input
          id={id}
          ref={inputRef}
          className="adm-ssel-input"
          type="text"
          disabled={disabled || loading}
          placeholder={inputPlaceholder}
          value={inputValue}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        {value && !disabled && (
          <button
            type="button"
            className="adm-ssel-clear"
            title="Kosongkan"
            onClick={(e) => {
              e.stopPropagation();
              commit("");
            }}
          >
            <i className="bi bi-x-lg" />
          </button>
        )}
      </div>
      {open && !disabled && (
        <div className="adm-ssel-dropdown">
          {flatList.length === 0 && <div className="adm-ssel-empty">{emptyHint}</div>}
          {flatList.map((item, idx) => {
            if ("create" in item) {
              return (
                <div
                  key="__create"
                  className={`adm-ssel-create ${idx === activeIdx ? "active" : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(item.value);
                  }}
                >
                  Gunakan model: <strong>{item.value}</strong>
                </div>
              );
            }
            const opt = item as SearchableOption;
            const groupLabel = groupOrder?.find((g) => g.id === opt.group)?.label;
            const showHeader = groupOrder && opt.group !== lastGroup;
            lastGroup = opt.group;
            return (
              <div key={opt.value}>
                {showHeader && groupLabel && <div className="adm-ssel-group-header">{groupLabel}</div>}
                <div
                  className={`adm-ssel-option ${idx === activeIdx ? "active" : ""} ${opt.value === value ? "selected" : ""}`}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(opt.value);
                  }}
                >
                  <div className="adm-ssel-opt-name">{opt.label}</div>
                  {variant === "model" && (
                    <div className="adm-ssel-opt-meta">
                      <code className="adm-ssel-opt-id">{opt.value}</code>
                      {typeof opt.contextLength === "number" && (
                        <span className="or-ctx">{formatCtx(opt.contextLength)}</span>
                      )}
                      {opt.isFree ? (
                        <span className="or-badge-free">GRATIS</span>
                      ) : opt.inputPerM !== undefined ? (
                        <span className="or-badge-paid">
                          ${opt.inputPerM}/${opt.outputPerM}/1M
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Generic app-wide searchable dropdown (Select2-style type-to-filter),
 * replacing plain `<select>` for any list long/lookup-y enough that
 * scrolling through it is annoying (regions, models, datasets, companies).
 * Not meant for tiny fixed enumerations (month picker, clip mode, etc.) -
 * a native `<select>` is still the right, simpler choice there.
 *
 * For the admin panel's OpenRouter model picker (which needs grouping +
 * price/context metadata + "use free-typed value"), see
 * `features/admin/components/SearchableSelect.tsx` instead - that one is a
 * separate, more specialized component scoped to `.admin-panel` CSS.
 */
export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
  /** Optional group header shown above consecutive options sharing the same value. */
  group?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  emptyHint?: string;
  clearable?: boolean;
  id?: string;
  className?: string;
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Cari...",
  loading = false,
  disabled = false,
  emptyHint = "Tidak ditemukan",
  clearable = false,
  id,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q),
    );
  }, [options, query]);

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
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[activeIdx];
      if (opt) commit(opt.value);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={`sg-ssel ${className ?? ""}`} ref={rootRef}>
      <div className={`sg-ssel-control ${open ? "open" : ""} ${disabled ? "disabled" : ""}`}>
        <input
          id={id}
          className="sg-ssel-input"
          type="text"
          disabled={disabled || loading}
          placeholder={loading ? "Memuat..." : selected ? selected.label : placeholder}
          value={open ? query : ""}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        <i className="bi bi-search sg-ssel-icon" />
        {clearable && value && !disabled && (
          <button
            type="button"
            className="sg-ssel-clear"
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
        <div className="sg-ssel-dropdown">
          {filtered.length === 0 && <div className="sg-ssel-empty">{emptyHint}</div>}
          {filtered.map((opt, idx) => {
            const showGroup = opt.group && opt.group !== filtered[idx - 1]?.group;
            return (
              <div key={opt.value}>
                {showGroup && <div className="sg-ssel-opt-group">{opt.group}</div>}
                <div
                  className={`sg-ssel-option ${idx === activeIdx ? "active" : ""} ${opt.value === value ? "selected" : ""}`}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(opt.value);
                  }}
                >
                  <div className="sg-ssel-opt-label">{opt.label}</div>
                  {opt.description && <div className="sg-ssel-opt-desc">{opt.description}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

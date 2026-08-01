import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Multi-value counterpart to `SearchableSelect.tsx` - Select2-style
 * type-to-filter dropdown with checkbox rows and removable chips for the
 * current selection. Use for any multi-select list long/lookup-y enough
 * that a native `<select multiple>` (scroll-and-ctrl-click) is annoying.
 */
export interface SearchableMultiSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
  options: SearchableMultiSelectOption[];
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  emptyHint?: string;
  id?: string;
  className?: string;
}

export default function SearchableMultiSelect({
  value,
  onChange,
  options,
  placeholder = "Cari...",
  loading = false,
  disabled = false,
  emptyHint = "Tidak ditemukan",
  id,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOptions = useMemo(
    () => value.map((v) => options.find((o) => o.value === v)).filter(Boolean) as SearchableMultiSelectOption[],
    [value, options],
  );

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
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

  const toggle = (optValue: string) => {
    const isSelected = value.includes(optValue);
    onChange(isSelected ? value.filter((v) => v !== optValue) : [...value, optValue]);
  };

  const remove = (optValue: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange(value.filter((v) => v !== optValue));
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
      if (opt) toggle(opt.value);
    } else if (e.key === "Backspace" && !query && value.length) {
      onChange(value.slice(0, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={`sg-msel ${className ?? ""}`} ref={rootRef}>
      <div
        className={`sg-msel-control ${open ? "open" : ""} ${disabled ? "disabled" : ""}`}
        onClick={() => !disabled && inputRef.current?.focus()}
      >
        {selectedOptions.map((opt) => (
          <span key={opt.value} className="sg-msel-chip">
            {opt.label}
            {!disabled && (
              <button type="button" className="sg-msel-chip-x" onClick={(e) => remove(opt.value, e)}>
                <i className="bi bi-x" />
              </button>
            )}
          </span>
        ))}
        <input
          id={id}
          ref={inputRef}
          className="sg-msel-input"
          type="text"
          disabled={disabled || loading}
          placeholder={loading ? "Memuat..." : selectedOptions.length ? "" : placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
      </div>
      {open && !disabled && (
        <div className="sg-msel-dropdown">
          {filtered.length === 0 && <div className="sg-msel-empty">{emptyHint}</div>}
          {filtered.map((opt, idx) => {
            const checked = value.includes(opt.value);
            return (
              <div
                key={opt.value}
                className={`sg-msel-option ${idx === activeIdx ? "active" : ""} ${checked ? "checked" : ""}`}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggle(opt.value);
                }}
              >
                <span className={`sg-msel-check ${checked ? "on" : ""}`}>
                  {checked && <i className="bi bi-check-lg" />}
                </span>
                <div>
                  <div className="sg-msel-opt-label">{opt.label}</div>
                  {opt.description && <div className="sg-msel-opt-desc">{opt.description}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

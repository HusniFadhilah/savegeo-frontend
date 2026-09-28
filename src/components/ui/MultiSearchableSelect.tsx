import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { SearchableSelectOption } from "@/components/ui/SearchableSelect";

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  emptyHint?: string;
  clearable?: boolean;
  id?: string;
  className?: string;
}

/** Searchable multi-value selector used by the hierarchical administrative AOI picker. */
export default function MultiSearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Pilih satu atau beberapa...",
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
  const selectedSet = useMemo(() => new Set(value), [value]);
  const selectedLabels = useMemo(
    () => options.filter((option) => selectedSet.has(option.value)).map((option) => option.label),
    [options, selectedSet],
  );

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(q) || option.description?.toLowerCase().includes(q),
    );
  }, [options, query]);

  useEffect(() => setActiveIdx(0), [query, open]);

  const toggle = (code: string) => {
    onChange(selectedSet.has(code) ? value.filter((item) => item !== code) : [...value, code]);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIdx((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIdx((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (filtered[activeIdx]) toggle(filtered[activeIdx].value);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const summary = selectedLabels.length
    ? `${selectedLabels.length} wilayah dipilih`
    : placeholder;

  return (
    <div className={`sg-ssel sg-mssel ${className ?? ""}`} ref={rootRef}>
      <div className={`sg-ssel-control ${open ? "open" : ""} ${disabled ? "disabled" : ""}`}>
        <input
          id={id}
          className="sg-ssel-input"
          type="text"
          disabled={disabled || loading}
          placeholder={loading ? "Memuat..." : summary}
          value={open ? query : ""}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        <i className="bi bi-search sg-ssel-icon" />
        {clearable && value.length > 0 && !disabled && (
          <button
            type="button"
            className="sg-ssel-clear"
            title="Kosongkan semua pilihan"
            onClick={(event) => {
              event.stopPropagation();
              onChange([]);
            }}
          >
            <i className="bi bi-x-lg" />
          </button>
        )}
      </div>
      {open && !disabled && (
        <div className="sg-ssel-dropdown">
          {filtered.length === 0 && <div className="sg-ssel-empty">{emptyHint}</div>}
          {filtered.map((option, index) => {
            const selected = selectedSet.has(option.value);
            return (
              <div
                key={option.value}
                className={`sg-ssel-option ${index === activeIdx ? "active" : ""} ${selected ? "selected" : ""}`}
                onMouseEnter={() => setActiveIdx(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  toggle(option.value);
                }}
              >
                <div className="sg-mssel-option-row">
                  <i className={`bi ${selected ? "bi-check-square-fill" : "bi-square"}`} aria-hidden="true" />
                  <span className="sg-ssel-opt-label">{option.label}</span>
                </div>
                {option.description && <div className="sg-ssel-opt-desc">{option.description}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

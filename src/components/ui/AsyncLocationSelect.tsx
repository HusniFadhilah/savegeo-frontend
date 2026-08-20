import { useEffect, useRef, useState } from "react";
import { searchLocations, type LocationSearchResult } from "@/services/analysisService";

interface Props {
  onSelect: (result: LocationSearchResult) => void;
  placeholder?: string;
  /** Currently-picked result's label, shown in the closed input (controlled by the parent, cleared alongside AOI). */
  selectedLabel?: string | null;
  onClear?: () => void;
}

/**
 * Select2-style async search box for free-text place lookup (city/province/
 * district/village/street/address - like Google Maps' search box), backed by
 * GET /utils/geocode/search (Nominatim, restricted to Indonesia). Debounced,
 * min 3 characters before firing a request. Reuses the same `.sg-ssel-*` CSS
 * as the sync SearchableSelect for visual consistency, just with a remote,
 * debounced data source instead of a local option list.
 */
export default function AsyncLocationSelect({ onSelect, placeholder = "Cari kota, provinsi, kecamatan, alamat...", selectedLabel, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const seq = ++requestSeq.current;
    debounceRef.current = setTimeout(() => {
      searchLocations(q).then((r) => {
        if (requestSeq.current !== seq) return; // stale response, a newer query already fired
        setResults(r);
        setLoading(false);
        setActiveIdx(0);
      });
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const commit = (result: LocationSearchResult) => {
    onSelect(result);
    setOpen(false);
    setQuery("");
    setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[activeIdx];
      if (r) commit(r);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="sg-ssel" ref={rootRef}>
      <div className={`sg-ssel-control ${open ? "open" : ""}`}>
        <input
          type="text"
          className="sg-ssel-input"
          placeholder={selectedLabel || placeholder}
          value={open ? query : ""}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        <i className={`bi ${loading ? "bi-hourglass-split" : "bi-search"} sg-ssel-icon`} />
        {selectedLabel && onClear && (
          <button
            type="button"
            className="sg-ssel-clear"
            title="Kosongkan"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
              setQuery("");
            }}
          >
            <i className="bi bi-x-lg" />
          </button>
        )}
      </div>
      {open && (
        <div className="sg-ssel-dropdown">
          {query.trim().length < 3 && <div className="sg-ssel-empty">Ketik minimal 3 huruf...</div>}
          {query.trim().length >= 3 && loading && <div className="sg-ssel-empty">Mencari...</div>}
          {query.trim().length >= 3 && !loading && results.length === 0 && (
            <div className="sg-ssel-empty">Tidak ditemukan</div>
          )}
          {results.map((r, idx) => (
            <div
              key={r.osm_id}
              className={`sg-ssel-option ${idx === activeIdx ? "active" : ""}`}
              onMouseEnter={() => setActiveIdx(idx)}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(r);
              }}
            >
              <div className="sg-ssel-opt-label">{r.display_name}</div>
              <div className="sg-ssel-opt-desc">
                {r.type.replace(/_/g, " ")}
                {!r.geojson && " · titik/perkiraan area (tanpa batas wilayah persis)"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

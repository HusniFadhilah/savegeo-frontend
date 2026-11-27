import { useI18nStore } from "@/hooks/useI18nStore";
import { useEffect, useRef, useState } from "react";
import { searchLocations, type LocationSearchResult } from "@/services/analysisService";
import { useBilingualCopy } from "@/hooks/useBilingualCopy";

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
export default function AsyncLocationSelect({ onSelect, placeholder, selectedLabel, onClear }: Props) {
  const t = useI18nStore(s => s.t);
  const c = useBilingualCopy();
  const searchPlaceholder = placeholder ?? c("Cari kota, provinsi, kecamatan, atau alamat…", "Search for a city, province, district, or address…");
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => () => { requestSeq.current += 1; }, []);

  async function submitSearch() {
    const q = query.trim();
    if (q.length < 3 || loading) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const candidates = await searchLocations(q);
      if (seq !== requestSeq.current) return;
      setResults(candidates);
      setActiveIdx(0);
    } catch {
      if (seq === requestSeq.current) setError(t("location.failed"));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }

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
      else void submitSearch();
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
          placeholder={selectedLabel || searchPlaceholder}
          value={open ? query : ""}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            requestSeq.current += 1;
            setResults([]);
            setLoading(false);
            setSearched(false);
            setError(null);
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        <button type="button" className="btn btn-sm" onClick={() => void submitSearch()} disabled={loading || query.trim().length < 3}>{t("location.search")}</button>
        {selectedLabel && onClear && (
          <button
            type="button"
            className="sg-ssel-clear"
            title={c("Kosongkan", "Clear")}
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
          <div className="sg-ssel-empty sg-ssel-disclosure" role="note">
            {c(
              "Nama tempat yang Anda ketik dikirim ke Nominatim (OpenStreetMap) untuk pencarian. Titik hasil pencarian dipakai untuk menampilkan lokasi di peta.",
              "The place name you enter is sent to Nominatim (OpenStreetMap) for search. The returned point is used to show the location on the map.",
            )}
          </div>
          {query.trim().length < 3 && <div className="sg-ssel-empty">{t("location.minimum")}</div>}
          {query.trim().length >= 3 && loading && <div className="sg-ssel-empty">{t("location.loading")}</div>}
          {query.trim().length >= 3 && searched && !error && !loading && results.length === 0 && (
            <div className="sg-ssel-empty">{t("location.notFound")}</div>
          )}
          {!searched && query.trim().length >= 3 && <div className="sg-ssel-empty">{t("location.enter")}</div>}
          {error && <div role="alert" className="sg-ssel-empty">{error}</div>}
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

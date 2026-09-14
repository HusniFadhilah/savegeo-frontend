import { useEffect, useState } from "react";

export function writeGlobeQuery(values: Record<string, string | number | boolean>, push = false) {
  const url = new URL(window.location.href);
  Object.entries(values).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  window.history[push ? "pushState" : "replaceState"](window.history.state, "", url);
  window.dispatchEvent(new Event("savegeo:map-query"));
}
export function useGlobeQuery() {
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search));
  useEffect(() => {
    const sync = () => setQuery(new URLSearchParams(window.location.search));
    window.addEventListener("popstate", sync);
    window.addEventListener("savegeo:map-query", sync);
    return () => { window.removeEventListener("popstate", sync); window.removeEventListener("savegeo:map-query", sync); };
  }, []);
  return query;
}
export function cameraNumber(query: URLSearchParams, key: string, fallback: number, min: number, max: number) {
  const value = query.get(key);
  const number = value === null ? NaN : Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : fallback;
}

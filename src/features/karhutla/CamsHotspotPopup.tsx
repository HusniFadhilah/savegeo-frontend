import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Popup } from "react-leaflet";
import { fetchWildfireCamsPoint } from "@/features/disaster/api";
import { CamsPointContent, type ProbeLayer } from "./CamsPointProbe";
import type { CamsPointSample } from "./types";

/** Only an opened hotspot popup reads CAMS cells; map background clicks do not. */
export default function CamsHotspotPopup({ slug, layers, position, children }: {
  slug: string;
  layers: ProbeLayer[];
  position: [number, number];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Array<{ layerId: string; sample: CamsPointSample | null }> | null>(null);
  const selectionKey = JSON.stringify(layers);
  const [lat, lng] = position;
  const eventHandlers = useMemo(() => ({
    add: () => setOpen(true),
    remove: () => setOpen(false),
  }), []);

  useEffect(() => {
    setEntries(null);
    if (!open) return undefined;
    const targets: ProbeLayer[] = JSON.parse(selectionKey);
    if (!targets.length) return undefined;
    let active = true;
    const lon = lng >= -180 && lng <= 180 ? lng : ((lng + 180) % 360 + 360) % 360 - 180;
    void Promise.all(targets.map(async ({ layerId, frameId, scope = "event" }) => {
      try {
        return { layerId, sample: await fetchWildfireCamsPoint(slug, layerId, frameId, lat, lon, scope) };
      } catch {
        return { layerId, sample: null };
      }
    })).then((result) => { if (active) setEntries(result); });
    return () => { active = false; };
  }, [open, slug, selectionKey, lat, lng]);

  return <Popup closeButton eventHandlers={eventHandlers} maxWidth={340} className={layers.length ? "cams-point-popup cams-hotspot-popup" : undefined}>
    {children}
    {open && layers.length > 0 && <CamsPointContent loading={entries === null} entries={entries ?? []} />}
  </Popup>;
}

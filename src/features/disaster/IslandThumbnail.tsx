import { useEffect, useId, useState } from "react";
import { fetchIslandGeometry } from "@/services/analysisService";
import { wildfireEventIsland } from "@/features/karhutla/eventRegions";
import { islandGeometryToSvgPath } from "./islandThumbnailGeometry";

const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 168;
const islandPathRequests = new Map<string, Promise<string>>();

function getIslandPath(island: string): Promise<string> {
  const cached = islandPathRequests.get(island);
  if (cached) return cached;

  const request = fetchIslandGeometry(island)
    .then(islandGeometryToSvgPath)
    .then((path) => {
      if (!path) throw new Error("Island boundary has no polygon coordinates");
      return path;
    })
    .catch((error: unknown) => {
      islandPathRequests.delete(island);
      throw error;
    });
  islandPathRequests.set(island, request);
  return request;
}

function islandLabel(island: string): string {
  return island === "Bali_Nusa_Tenggara" ? "Bali & Nusa Tenggara" : island.replace(/_/g, " ");
}

export default function IslandThumbnail({
  slug,
  title,
}: {
  slug: string | null | undefined;
  title: string;
}) {
  const island = slug ? wildfireEventIsland(slug) : undefined;
  const gradientId = `island-fill-${useId().replace(/:/g, "")}`;
  const [path, setPath] = useState("");

  useEffect(() => {
    let cancelled = false;
    setPath("");
    if (!island)
      return () => {
        cancelled = true;
      };

    getIslandPath(island)
      .then((nextPath) => {
        if (!cancelled) setPath(nextPath);
      })
      .catch(() => {
        if (!cancelled) setPath("");
      });
    return () => {
      cancelled = true;
    };
  }, [island]);

  const label = island ? islandLabel(island) : "Wilayah kejadian";
  return (
    <div
      className="disaster-island-thumbnail"
      role="img"
      aria-label={`${title}, peta cakupan ${label}`}
    >
      {path ? (
        <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#72b889" />
              <stop offset="1" stopColor="#27734f" />
            </linearGradient>
          </defs>
          <path
            d={path}
            fill={`url(#${gradientId})`}
            fillRule="evenodd"
            stroke="#19573b"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : (
        <i className="bi bi-map" aria-hidden="true" />
      )}
      <span className="disaster-island-thumbnail-label">{label}</span>
    </div>
  );
}

import type { AoiFeature, AoiGeometry } from "@/types/map";
import type { AoiPayload } from "./types";

/** YYYY-MM-DD, matches the <input type="date"> value format used everywhere here. */
function fmtDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export interface DisasterDateRange {
  beforeStart: string;
  beforeEnd: string;
  afterStart: string;
  afterEnd: string;
}

/**
 * Default before/after windows, ported from DisasterMapping.initializeDateInputs():
 * after = [today-30d, today], before = the 60 days preceding the after-window.
 */
export function defaultDateRange(): DisasterDateRange {
  const today = new Date();
  const afterStart = new Date(today);
  afterStart.setDate(today.getDate() - 30);
  const beforeEnd = new Date(afterStart);
  beforeEnd.setDate(afterStart.getDate() - 1);
  const beforeStart = new Date(beforeEnd);
  beforeStart.setDate(beforeEnd.getDate() - 60);
  return {
    beforeStart: fmtDate(beforeStart),
    beforeEnd: fmtDate(beforeEnd),
    afterStart: fmtDate(afterStart),
    afterEnd: fmtDate(today),
  };
}

/** Builds the {geojson} AOI payload every /disaster/* endpoint expects. */
export function toAoiPayload(aoi: AoiFeature): AoiPayload {
  return { geojson: aoi };
}

const EARTH_RADIUS_M = 6378137;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Geodesic ring area in m^2 (shoelace-on-sphere, same algorithm as turf/geojson-area). */
function ringAreaM2(ring: GeoJSON.Position[]): number {
  if (ring.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    let p1: GeoJSON.Position;
    let p2: GeoJSON.Position;
    if (i === ring.length - 2) {
      p1 = ring[ring.length - 2];
      p2 = ring[0];
    } else if (i === ring.length - 1) {
      p1 = ring[ring.length - 1];
      p2 = ring[1];
    } else {
      p1 = ring[i];
      p2 = ring[i + 1];
    }
    total += (toRad(p2[0]) - toRad(p1[0])) * (2 + Math.sin(toRad(p1[1])) + Math.sin(toRad(p2[1])));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

function polygonAreaM2(rings: GeoJSON.Position[][]): number {
  if (!rings.length) return 0;
  const [outer, ...holes] = rings;
  return holes.reduce((area, hole) => area - ringAreaM2(hole), ringAreaM2(outer));
}

/** Approximate AOI area in km^2, used only for the "AOI selected" status readout. */
export function calcAreaKm2(geometry: AoiGeometry): number {
  const m2 =
    geometry.type === "Polygon"
      ? polygonAreaM2(geometry.coordinates)
      : geometry.coordinates.reduce((sum, poly) => sum + polygonAreaM2(poly), 0);
  return m2 / 1_000_000;
}

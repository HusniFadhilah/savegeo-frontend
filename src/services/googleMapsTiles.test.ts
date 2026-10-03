import { afterEach, describe, expect, it, vi } from "vitest";
import { FALLBACK_BASEMAPS } from "@/config/basemaps";
import { escapeAttributionHtml, fetchGoogleViewportCopyright, withOptionalGoogleSatelliteBasemap } from "./googleMapsTiles";

describe("Google Maps satellite tiles", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("does not expose the option or create a session without a key", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const basemaps = await withOptionalGoogleSatelliteBasemap(FALLBACK_BASEMAPS);

    expect(basemaps.some((basemap) => basemap.id === "google-satellite")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates a satellite session and builds Google tile and viewport requests", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "restricted-browser-key");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ session: "session-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ copyright: "Map data © Google, Maxar" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const basemap = (await withOptionalGoogleSatelliteBasemap(FALLBACK_BASEMAPS)).find((item) => item.id === "google-satellite");
    expect(basemap?.url).toBe("https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=session-token&key=restricted-browser-key");
    expect(basemap?.attribution).toContain("Google Maps");
    expect(basemap?.maxZoom).toBe(22);

    const copyright = await fetchGoogleViewportCopyright({ north: 10, south: -10, east: 140, west: 120 }, 24);
    expect(copyright).toBe("Map data © Google, Maxar");
    const [sessionRequest, viewportRequest] = fetchMock.mock.calls;
    expect(sessionRequest[0]).toBeInstanceOf(URL);
    expect((sessionRequest[0] as URL).searchParams.get("key")).toBe("restricted-browser-key");
    expect(sessionRequest[1]).toMatchObject({ method: "POST" });
    expect((sessionRequest[1] as RequestInit).body).toContain('"mapType":"satellite"');
    expect((viewportRequest[0] as URL).searchParams.get("session")).toBe("session-token");
    expect((viewportRequest[0] as URL).searchParams.get("zoom")).toBe("22");
  });

  it("escapes viewport copyright before inserting it in map controls", () => {
    expect(escapeAttributionHtml("Map <data> & © Google")).toBe("Map &lt;data&gt; &amp; © Google");
  });
});

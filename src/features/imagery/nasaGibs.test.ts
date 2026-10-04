import { describe, expect, it } from "vitest";
import { clampNasaGibsDate, nasaGibsBlackMarbleTileUrl, nasaGibsCityLights2012TileUrl, NASA_GIBS_BLACK_MARBLE_YEARS, NASA_GIBS_VIIRS_NIGHT_FIRST_DATE, nasaGibsDateAt, nasaGibsDateIndex, nasaGibsTimelineTicks, nasaGibsTrueColorTileUrl, nasaGibsViirsNightTileUrl } from "./nasaGibs";

describe("NASA GIBS historical imagery", () => {
  it("creates a date-addressed MODIS Terra WMTS tile template", () => {
    expect(nasaGibsTrueColorTileUrl("2020-01-02")).toBe(
      "https://gibs-a.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2020-01-02/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg",
    );
  });

  it("creates daily VIIRS nighttime tiles and clamps dates to its archive", () => {
    expect(NASA_GIBS_VIIRS_NIGHT_FIRST_DATE).toBe("2016-12-03");
    expect(nasaGibsViirsNightTileUrl("2020-01-02")).toBe(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_DayNightBand_ENCC/default/2020-01-02/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png",
    );
    expect(clampNasaGibsDate("2016-12-02", "2026-10-03", NASA_GIBS_VIIRS_NIGHT_FIRST_DATE)).toBe("2016-12-03");
    const dateIndex = nasaGibsDateIndex("2020-01-02", "2026-10-03", NASA_GIBS_VIIRS_NIGHT_FIRST_DATE);
    expect(nasaGibsDateAt(dateIndex, "2026-10-03", NASA_GIBS_VIIRS_NIGHT_FIRST_DATE)).toBe("2020-01-02");
  });

  it("creates dated Black Marble snapshots for the published years", () => {
    expect(NASA_GIBS_BLACK_MARBLE_YEARS).toEqual([2012, 2016]);
    expect(nasaGibsBlackMarbleTileUrl(2012)).toBe(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2012-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png",
    );
    expect(nasaGibsBlackMarbleTileUrl(2016)).toContain("/2016-01-01/");
  });

  it("uses the default time key for the static Earth at Night 2012 composite", () => {
    expect(nasaGibsCityLights2012TileUrl()).toBe(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_CityLights_2012/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg",
    );
  });

  it("limits dates to valid dates in the archive", () => {
    expect(clampNasaGibsDate("1999-12-31", "2026-10-03")).toBe("2000-02-24");
    expect(clampNasaGibsDate("2026-12-31", "2026-10-03")).toBe("2026-10-03");
    expect(clampNasaGibsDate("2026-02-30", "2026-10-03")).toBe("2026-10-03");
  });

  it("maps daily archive dates to and from horizontal timeline positions", () => {
    const today = "2026-10-03";
    const index = nasaGibsDateIndex("2020-01-02", today);
    expect(nasaGibsDateAt(index, today)).toBe("2020-01-02");
    expect(nasaGibsDateAt(-10, today)).toBe("2000-02-24");
    expect(nasaGibsDateAt(Number.MAX_SAFE_INTEGER, today)).toBe(today);
  });

  it("returns year labels in chronological timeline order", () => {
    const ticks = nasaGibsTimelineTicks("2026-10-03");
    expect(ticks[0]).toEqual({ year: "2000", position: 0 });
    expect(ticks.at(-1)).toEqual({ year: "2026", position: 100 });
    expect(ticks.map((tick) => tick.year)).toEqual([...ticks.map((tick) => tick.year)].sort());
  });
});

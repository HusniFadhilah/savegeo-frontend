import { describe, expect, it } from "vitest";
import { clampNasaGibsDate, nasaGibsTrueColorTileUrl } from "./nasaGibs";

describe("NASA GIBS historical imagery", () => {
  it("creates a date-addressed MODIS Terra WMTS tile template", () => {
    expect(nasaGibsTrueColorTileUrl("2020-01-02")).toBe(
      "https://gibs-a.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2020-01-02/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg",
    );
  });

  it("limits dates to valid dates in the archive", () => {
    expect(clampNasaGibsDate("1999-12-31", "2026-10-03")).toBe("2000-02-24");
    expect(clampNasaGibsDate("2026-12-31", "2026-10-03")).toBe("2026-10-03");
    expect(clampNasaGibsDate("2026-02-30", "2026-10-03")).toBe("2026-10-03");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, setCached } = vi.hoisted(() => ({ get: vi.fn(), setCached: vi.fn() }));

vi.mock("@/services/apiClient", () => ({ apiClient: { get } }));
vi.mock("./cache", () => ({
  cacheKey: vi.fn(async () => "catalog-test-key"),
  getCached: vi.fn(async () => undefined),
  setCached,
}));

import { listCloudDatasets } from "./datasetCatalog";

const dataset = (id: string) => ({
  id,
  name: `Dataset ${id}`,
  format: "cog",
  access: "public",
  sourceType: "backend",
});

describe("cloud dataset catalog pagination", () => {
  beforeEach(() => {
    get.mockReset();
    setCached.mockReset();
  });

  it("fetches all pages while preserving the complete catalog result", async () => {
    get
      .mockResolvedValueOnce({ datasets: [dataset("forest-a")], count: 2 })
      .mockResolvedValueOnce({ datasets: [dataset("forest-b")], count: 2 });

    const rows = await listCloudDatasets({ module: "carbon" });

    expect(rows.map((row) => row.id)).toEqual(["forest-a", "forest-b"]);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[0][0]).toContain("module=carbon&page=1&page_size=100");
    expect(get.mock.calls[1][0]).toContain("module=carbon&page=2&page_size=100");
    expect(setCached).toHaveBeenCalledWith("catalog-test-key", rows);
  });
});

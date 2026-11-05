import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "@/services/apiClient";
import {
  addBoundary,
  commitFieldImport,
  createProject,
  dmrvErrorCode,
  listBoundaries,
  listVisits,
  newIdempotencyKey,
  previewFieldImport,
} from "./api";

vi.mock("@/services/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/apiClient")>();
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), upload: vi.fn() } };
});

beforeEach(() => vi.clearAllMocks());

describe("dMRV api", () => {
  it("creates a project with an idempotency key and app auth", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ id: "p-1" });
    await createProject({ name: "Pilot", methodology_id: "VM0047" }, "key-1");
    expect(apiClient.post).toHaveBeenCalledWith(
      "/dmrv/projects",
      { name: "Pilot", methodology_id: "VM0047" },
      { auth: "app", headers: { "Idempotency-Key": "key-1" } },
    );
  });

  it("url-encodes ids and plot codes", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([]);
    await listBoundaries("a/b");
    await listVisits("p 1", "T1/2");
    expect(apiClient.get).toHaveBeenNthCalledWith(1, "/dmrv/projects/a%2Fb/boundaries", { auth: "app" });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, "/dmrv/projects/p%201/field-data/plots/T1%2F2/visits", { auth: "app" });
  });

  it("posts boundaries as geojson plus reason", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({});
    await addBoundary("p-1", { type: "Polygon", coordinates: [] }, "initial");
    expect(apiClient.post).toHaveBeenCalledWith(
      "/dmrv/projects/p-1/boundaries",
      { geojson: { type: "Polygon", coordinates: [] }, reason: "initial" },
      { auth: "app" },
    );
  });

  it("uploads field data for preview and commit", async () => {
    vi.mocked(apiClient.upload).mockResolvedValue({});
    const form = new FormData();
    await previewFieldImport("p-1", form);
    await commitFieldImport("p-1", form, "key-2");
    expect(apiClient.upload).toHaveBeenNthCalledWith(1, "/dmrv/projects/p-1/field-data/imports/preview", form, { auth: "app" });
    expect(apiClient.upload).toHaveBeenNthCalledWith(2, "/dmrv/projects/p-1/field-data/imports", form, {
      auth: "app",
      headers: { "Idempotency-Key": "key-2" },
    });
  });

  it("reads the server error code from an ApiError payload", () => {
    const error = new ApiError("Sudah dipakai", 422, { code: "idempotency_key_reused", message: "Sudah dipakai" });
    expect(dmrvErrorCode(error)).toBe("idempotency_key_reused");
    expect(dmrvErrorCode(new ApiError("x", 500, "plain"))).toBeNull();
    expect(dmrvErrorCode(new Error("x"))).toBeNull();
  });

  it("generates distinct idempotency keys of at most 64 characters", () => {
    const first = newIdempotencyKey();
    expect(first).not.toBe(newIdempotencyKey());
    expect(first.length).toBeLessThanOrEqual(64);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "./apiClient";
import { authService } from "./authService";
import { userAuthService } from "./userAuthService";

describe.each([authService, userAuthService])("server-confirmed logout", (service) => {
  beforeEach(() => vi.restoreAllMocks());

  it("waits for server revocation", async () => {
    let finish!: () => void;
    vi.spyOn(apiClient, "post").mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    let completed = false;
    const request = service.logout().then(() => { completed = true; });
    await Promise.resolve();
    expect(completed).toBe(false);
    finish();
    await request;
    expect(completed).toBe(true);
  });

  it("reports network failures instead of claiming logout succeeded", async () => {
    vi.spyOn(apiClient, "post").mockRejectedValue(new ApiError("Network error", 0));
    await expect(service.logout()).rejects.toThrow("Network error");
  });

  it("accepts an already expired or revoked session", async () => {
    vi.spyOn(apiClient, "post").mockRejectedValue(new ApiError("Expired", 401));
    await expect(service.logout()).resolves.toBeUndefined();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/services/apiClient";
import { VIEWER_FEATURE_CODES } from "@/auth/viewerFeatures";
import { useViewerFeatures, type ViewerFeatureItem } from "./useViewerFeatures";

vi.mock("@/services/apiClient", () => ({ apiClient: { get: vi.fn() } }));

function response(enabled: string[]) {
  return {
    features: VIEWER_FEATURE_CODES.map((code) => ({
      code,
      name: code,
      description: code,
      enabled: enabled.includes(code),
    } satisfies ViewerFeatureItem)),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("useViewerFeatures session isolation", () => {
  beforeEach(() => {
    useViewerFeatures.getState().reset();
    vi.mocked(apiClient.get).mockReset();
  });

  it("does not let a previous session response overwrite the next login", async () => {
    const oldSession = deferred<{ features: ViewerFeatureItem[] }>();
    const newSession = deferred<{ features: ViewerFeatureItem[] }>();
    vi.mocked(apiClient.get)
      .mockReturnValueOnce(oldSession.promise)
      .mockReturnValueOnce(newSession.promise);

    const oldLoad = useViewerFeatures.getState().load();
    useViewerFeatures.getState().reset();
    const newLoad = useViewerFeatures.getState().load();

    newSession.resolve(response(["app.feature.crop_monitoring"]));
    await newLoad;
    oldSession.resolve(response(["app.feature.carbon_stock"]));
    await oldLoad;

    expect(useViewerFeatures.getState().features).toEqual(["app.feature.crop_monitoring"]);
    expect(useViewerFeatures.getState().error).toBeNull();
    expect(useViewerFeatures.getState().isLoading).toBe(false);
  });

  it("fails closed on malformed permission data", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ features: [] });

    await useViewerFeatures.getState().load();

    expect(useViewerFeatures.getState().features).toEqual([]);
    expect(useViewerFeatures.getState().error).toBeTruthy();
  });
});

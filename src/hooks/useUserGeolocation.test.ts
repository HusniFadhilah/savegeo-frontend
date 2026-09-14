import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useLocationStore, useUserGeolocation } from "./useUserGeolocation";
let success: PositionCallback;
let failure: PositionErrorCallback;
const getCurrentPosition = vi.fn((ok: PositionCallback, fail: PositionErrorCallback) => { success = ok; failure = fail; });
const watchPosition = vi.fn((ok: PositionCallback, fail: PositionErrorCallback) => { success = ok; failure = fail; return 7; });
const clearWatch = vi.fn();
const position = { coords: { latitude: -6.234567, longitude: 106.765432, accuracy: 25, heading: null, speed: null, altitude: null, altitudeAccuracy: null }, timestamp: 123456789 } as GeolocationPosition;
beforeEach(() => {
  vi.stubGlobal("isSecureContext", true);
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition, watchPosition, clearWatch } });
  useLocationStore.getState().setFollow(false);
  useLocationStore.setState({ latitude: null, longitude: null, accuracy: null, timestamp: null, status: "idle", visible: true, revision: 0 });
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/?view=3d&show_user_location=true&follow_user_location=true");
});
afterEach(async () => { cleanup(); await Promise.resolve(); vi.unstubAllGlobals(); });
describe("private shared geolocation", () => {
  it("never requests GPS from mount or URL flags", () => {
    renderHook(useUserGeolocation);
    expect(getCurrentPosition).not.toHaveBeenCalled(); expect(watchPosition).not.toHaveBeenCalled();
  });
  it("requests only after a user action, stores accuracy/time, never changes URL or storage", () => {
    renderHook(useUserGeolocation);
    const url = window.location.href;
    const storage = vi.spyOn(Storage.prototype, "setItem");
    act(() => useLocationStore.getState().locate());
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    act(() => success(position));
    expect(useLocationStore.getState()).toMatchObject({ latitude: position.coords.latitude, accuracy: 25, timestamp: 123456789, status: "active", follow: false });
    expect(window.location.href).toBe(url); expect(storage).not.toHaveBeenCalled(); storage.mockRestore();
  });
  it.each([[1,"denied"],[2,"unavailable"],[3,"timeout"]] as const)("handles GPS error %s", (code,status) => {
    act(() => useLocationStore.getState().locate());
    act(() => failure({ code } as GeolocationPositionError));
    expect(useLocationStore.getState().status).toBe(status);
  });
  it("keeps a single watcher across consumers and clears it on last unmount", async () => {
    const first = renderHook(useUserGeolocation), second = renderHook(useUserGeolocation);
    act(() => useLocationStore.getState().setFollow(true));
    expect(watchPosition).toHaveBeenCalledOnce();
    first.unmount(); await Promise.resolve(); expect(clearWatch).not.toHaveBeenCalled();
    second.unmount(); await Promise.resolve(); expect(clearWatch).toHaveBeenCalledWith(7);
    act(() => success(position)); expect(useLocationStore.getState().latitude).toBeNull();
  });
  it("stops following and rejects late callbacks", () => {
    act(() => useLocationStore.getState().setFollow(true));
    act(() => useLocationStore.getState().setFollow(false));
    act(() => success(position));
    expect(clearWatch).toHaveBeenCalledWith(7); expect(useLocationStore.getState().latitude).toBeNull();
  });
  it("handles missing geolocation and insecure contexts", () => {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined });
    act(() => useLocationStore.getState().locate());
    expect(useLocationStore.getState().status).toBe("unavailable");
  });
});

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/services/apiClient";
import { useWildfireEventQuery, useWildfireEventsQuery } from "./useWildfireCatalog";

const api = vi.hoisted(() => ({ detail: vi.fn(), list: vi.fn() }));
vi.mock("@/features/disaster/api", () => ({ fetchWildfireEvent: api.detail, fetchWildfireEvents: api.list }));
const clients: QueryClient[] = [];
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
  clients.push(client);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
afterEach(() => { cleanup(); clients.forEach((client) => client.clear()); clients.length = 0; vi.useRealTimers(); vi.resetAllMocks(); });

describe("live wildfire catalog", () => {
  it("recovers automatically when a previously missing Kalimantan event becomes published", async () => {
    vi.useFakeTimers();
    api.detail.mockRejectedValueOnce(new ApiError("Not found", 404))
      .mockResolvedValue({ event: { slug: "kalimantan-2026", id: 40 } });
    const { result } = renderHook(() => useWildfireEventQuery("kalimantan-2026"), { wrapper });
    await vi.waitFor(() => expect(result.current.isError).toBe(true));
    await act(() => vi.advanceTimersByTimeAsync(15_000));
    await vi.waitFor(() => expect(result.current.data?.event.slug).toBe("kalimantan-2026"));
    expect(api.detail).toHaveBeenCalledTimes(2);
  });

  it("does not repeatedly request data when authentication is required", async () => {
    vi.useFakeTimers();
    api.detail.mockRejectedValue(new ApiError("Unauthorized", 401));
    const { result } = renderHook(() => useWildfireEventQuery("kalimantan-2026"), { wrapper });
    await vi.waitFor(() => expect(result.current.isError).toBe(true));
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(api.detail).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBeUndefined();
  });

  it("refreshes the catalog with Kalimantan and respects an empty server result", async () => {
    api.list.mockResolvedValueOnce({ events: [{ slug: "kalimantan-2026", hotspot_count: 328360 }] })
      .mockResolvedValue({ events: [] });
    const filters = { search: "", year: "", status: "", province: "", severity: "", sort: "latest" as const };
    const { result } = renderHook(() => useWildfireEventsQuery(filters), { wrapper });
    await waitFor(() => expect(result.current.data?.events[0]?.slug).toBe("kalimantan-2026"));
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.data?.events).toEqual([]));
  });
});

import { useQuery } from "@tanstack/react-query";
import { fetchWildfireEvent, fetchWildfireEvents } from "@/features/disaster/api";
import { ApiError } from "@/services/apiClient";
import type { WildfireFilters } from "./types";

const canRefresh = (error: unknown) =>
  !(error instanceof ApiError && [401, 403].includes(error.status));

export function useWildfireEventsQuery(filters: WildfireFilters) {
  return useQuery({
    queryKey: ["wildfire-catalog", filters],
    queryFn: () => fetchWildfireEvents(filters),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => canRefresh(query.state.error) ? 60_000 : false,
    retry: (count, error) => count < 2 && canRefresh(error),
  });
}

export function useWildfireEventQuery(slug: string) {
  return useQuery({
    queryKey: ["wildfire-event", slug],
    queryFn: async () => {
      const response = await fetchWildfireEvent(slug);
      if (response.event.slug !== slug) throw new Error("Unexpected wildfire event");
      return response;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    // A draft can become published while this page remains open. Recover
    // from an earlier 404 or temporary server failure without stale fallback data.
    refetchInterval: (query) => query.state.status === "error" && canRefresh(query.state.error) ? 15_000 : false,
    retry: (count, error) => count < 2 && canRefresh(error) && !(error instanceof ApiError && error.status === 404),
  });
}

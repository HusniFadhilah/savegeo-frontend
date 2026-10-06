export type WildfireEventLookupStatus = "loading" | "ready" | "unavailable";

/** Only a successfully loaded event for the current route may drive event APIs. */
export function isConfirmedWildfireEventForRoute(
  eventSlug: string | undefined,
  routeSlug: string,
  status: WildfireEventLookupStatus,
): boolean {
  return status === "ready" && eventSlug === routeSlug;
}

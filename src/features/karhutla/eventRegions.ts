/** The island filter must match the event province coverage in the API. */
export function wildfireEventIsland(slug: string): "Kalimantan" | "Sumatra" | undefined {
  if (slug === "kalimantan-2026") return "Kalimantan";
  if (slug === "sumatra-2026") return "Sumatra";
  return undefined;
}

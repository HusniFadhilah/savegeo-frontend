/** The island filter must match the event province coverage in the API. */
const EVENT_ISLANDS: Record<string, string> = {
  "kalimantan-2026": "Kalimantan",
  "sumatra-2026": "Sumatra",
  "jawa-2026": "Jawa",
  "sulawesi-2026": "Sulawesi",
  "bali-nusa-tenggara-2026": "Bali_Nusa_Tenggara",
  "maluku-2026": "Maluku",
  "papua-2026": "Papua",
};

export function wildfireEventIsland(slug: string): string | undefined {
  return EVENT_ISLANDS[slug];
}

export function wildfireEventRegionLabel(slug: string): string {
  return wildfireEventIsland(slug)?.replace(/_/g, " ").replace("Bali Nusa", "Bali & Nusa") ?? "wilayah event";
}

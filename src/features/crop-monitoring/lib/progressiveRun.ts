import type { CropMonitoringRequest, CropMonitoringResult, SubAnalysisKey } from "../types";

/** At most two polling jobs; publish independent sections as soon as they finish. */
export async function progressiveRun(
  payload: CropMonitoringRequest,
  run: (request: CropMonitoringRequest) => Promise<CropMonitoringResult>,
  publish: (result: CropMonitoringResult) => void,
  progress: (finished: number, total: number) => void,
  failed: (sections: SubAnalysisKey[], error: unknown) => void,
  current: () => boolean,
) {
  const selected: SubAnalysisKey[] = [...new Set(payload.sub_analyses ?? [])].filter((key) => key !== "flood");
  const groups: SubAnalysisKey[][] = [
    ["landcover"], ["health", "growth_stage"], ["weather", "water_moisture"],
    ["timeseries"], ["anomaly"], ["productivity_zones"], ["historical_comparison"],
  ].map((group) => group.filter((key) => selected.includes(key as SubAnalysisKey)) as SubAnalysisKey[]).filter((group) => group.length);
  const needsRisk = selected.includes("risk_score");
  const total = groups.length + Number(needsRisk);
  let next = 0;
  let finished = 0;
  let merged: CropMonitoringResult | null = null;
  const execute = async (sections: SubAnalysisKey[]) => {
    try {
      const result = await run({ ...payload, sub_analyses: sections });
      if (!current()) return;
      merged = {
        ...result,
        sub_analyses: { ...merged?.sub_analyses, ...result.sub_analyses },
        skipped: [...(merged?.skipped ?? []).filter((item) => !sections.includes(item.sub_analysis as SubAnalysisKey)), ...result.skipped],
      };
      publish(merged);
    } catch (error) {
      if (current()) failed(sections, error);
    } finally {
      if (current()) progress(++finished, total);
    }
  };
  await Promise.all(Array.from({ length: Math.min(2, groups.length) }, async () => {
    while (current() && next < groups.length) await execute(groups[next++]);
  }));
  // Server derives risk from its own cached sections, never from client statistics.
  if (current() && needsRisk) await execute(selected);
}

import { useEffect, useState, type FormEvent } from "react";
import { getAutomaticImageSnapshots, getRegistryConnectorStatus, importRegistryCsv, saveRecord, syncOfficialRegistry, type AutomaticImageSnapshot, type RegistryConnectorStatus } from "./api";
import { EvidenceField, Field, RecordList, type SectionProps } from "./shared";
import { errorMessage, references, useCopy } from "./helpers";
import type { Category } from "./types";
import { listFieldCaptures } from "../api";
import type { FieldCapture } from "./types";
import type { BoundaryVersion, MonitoringPeriod } from "../types";

const POOLS = ["AGB", "BGB", "SOC", "litter", "deadwood"] as const;
const UNCERTAINTY_SOURCES = [
  ["model", "Ketidakpastian model", "Model uncertainty"],
  ["field_validation", "Validasi lapangan", "Field validation"],
  ["sampling_design", "Rancangan sampel", "Sampling design"],
  ["spatial_variation", "Variasi spasial", "Spatial variation"],
  ["emission_factor", "Faktor emisi", "Emission factor"],
  ["leakage", "Leakage", "Leakage"],
] as const;
const UNCERTAINTY_PAIRS = UNCERTAINTY_SOURCES.flatMap(([a], index) => UNCERTAINTY_SOURCES.slice(index + 1).map(([b]) => [a, b] as const));
const WORKFLOWS = [
  ["method", "Kalkulator VM0047", "VM0047 calculator"],
  ["leakage", "Leakage VMD0054", "VMD0054 leakage"],
  ["uncertainty", "Ketidakpastian", "Uncertainty"],
  ["blue", "Blue carbon", "Blue carbon"],
  ["sampling", "Sampel lapangan", "Field sampling"],
  ["registry", "Rekonsiliasi registry", "Registry reconciliation"],
  ["safeguards", "Manfaat & safeguards", "Benefits & safeguards"],
] as const;
type Workflow = (typeof WORKFLOWS)[number][0];
type StratumDraft = { name: string; area: string; cv: string; geometry: string };
type PoolDraft = { included: boolean; start: string; end: string; startSe: string; endSe: string; correlation: string; cumulativeStart: string; cumulativeEnd: string };
type BluePeriodDraft = { year: string; area: string; biomass: string; soc: string; areaSe: string; biomassSe: string; socSe: string; poolCorrelation: string; erosion: string; submergence: string; ch4: string; n2o: string; seaLevel: string; source: string; baseArea: string; baseBiomass: string; baseSoc: string; baseCh4: string; baseN2o: string; erosionDriver: string; erodedCarbon: string; oxidizedPct: string; slrBuffer: string; erosionBasis: string };
type CarbonOperationsPanelProps = SectionProps & { periods: MonitoringPeriod[]; boundaries: BoundaryVersion[] };

export default function CarbonOperationsPanel(props: CarbonOperationsPanelProps) {
  const c = useCopy();
  const [workflow, setWorkflow] = useState<Workflow>("method");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [evidenceByWorkflow, setEvidenceByWorkflow] = useState<Record<Workflow, string>>({
    method: "", leakage: "", uncertainty: "", blue: "", sampling: "", registry: "", safeguards: "",
  });
  const [benefitEvidence, setBenefitEvidence] = useState("");
  const [approach, setApproach] = useState<"area_based" | "census_based">("area_based");
  const [periodStart, setPeriodStart] = useState("2025-01-01");
  const [periodEnd, setPeriodEnd] = useState("2025-12-31");
  const [monitoringPeriodId, setMonitoringPeriodId] = useState("");
  const [manualArea, setManualArea] = useState("");
  const [emissions, setEmissions] = useState("0");
  const [leakage, setLeakage] = useState("0");
  const [leakageRecordId, setLeakageRecordId] = useState("");
  const [uncertaintyRecordId, setUncertaintyRecordId] = useState("");
  const [poolInputs, setPoolInputs] = useState<Record<(typeof POOLS)[number], PoolDraft>>({
    AGB: { included: true, start: "0", end: "10", startSe: "0", endSe: "0", correlation: "0", cumulativeStart: "", cumulativeEnd: "" },
    BGB: { included: false, start: "0", end: "0", startSe: "0", endSe: "0", correlation: "0", cumulativeStart: "", cumulativeEnd: "" },
    SOC: { included: false, start: "0", end: "0", startSe: "0", endSe: "0", correlation: "0", cumulativeStart: "", cumulativeEnd: "" },
    litter: { included: false, start: "0", end: "0", startSe: "0", endSe: "0", correlation: "0", cumulativeStart: "", cumulativeEnd: "" },
    deadwood: { included: false, start: "0", end: "0", startSe: "0", endSe: "0", correlation: "0", cumulativeStart: "", cumulativeEnd: "" },
  });
  const [leakageBasis, setLeakageBasis] = useState("");
  const [leakageStartDate, setLeakageStartDate] = useState("2025-01-01");
  const [leakageYear, setLeakageYear] = useState("1");
  const [leakageStockLoss, setLeakageStockLoss] = useState("0");
  const [leakageMitigationEmissions, setLeakageMitigationEmissions] = useState("0");
  const [crossCommodity, setCrossCommodity] = useState(false);
  const [leakageCommodityJson, setLeakageCommodityJson] = useState('[{"commodity":"rice","unit":"tonne","complete_crop_rotation_years":3,"historical_project_production":[100,105,102],"monitored_project_production":90,"annual_yield_growth_pct":0,"yield_on_new_land_units_per_ha":4,"increased_supply_pct":50,"new_land_pct":20,"evidence":[]} ]');
  const [plotJson, setPlotJson] = useState("[]");
  const [plantingUnits, setPlantingUnits] = useState("100");
  const [sampledUnits, setSampledUnits] = useState("30");
  const [survivingUnits, setSurvivingUnits] = useState("27");
  const [liveUnitCarbon, setLiveUnitCarbon] = useState("0.02");
  const [liveUnitSe, setLiveUnitSe] = useState("0.005");
  const [density, setDensity] = useState("20");
  const [landUseUnchanged, setLandUseUnchanged] = useState(false);
  const [directPlanting, setDirectPlanting] = useState(false);
  const [soilDisturbance, setSoilDisturbance] = useState("unknown");
  const [preexistingWoodyCover, setPreexistingWoodyCover] = useState("");
  const [censusStartUnits, setCensusStartUnits] = useState("");
  const [censusStartCarbon, setCensusStartCarbon] = useState("");
  const [censusStartSe, setCensusStartSe] = useState("");
  const [assessmentEvidenceComplete, setAssessmentEvidenceComplete] = useState(false);
  const [central, setCentral] = useState("100");
  const [uncertainties, setUncertainties] = useState<Record<string, string>>(
    Object.fromEntries(UNCERTAINTY_SOURCES.map(([key]) => [key, "0"])),
  );
  const [uncertaintyResiduals, setUncertaintyResiduals] = useState<Record<string, string>>(
    Object.fromEntries(UNCERTAINTY_SOURCES.map(([key]) => [key, ""])),
  );
  const [uncertaintyObservationIds, setUncertaintyObservationIds] = useState<Record<string, string>>(
    Object.fromEntries(UNCERTAINTY_SOURCES.map(([key]) => [key, ""])),
  );
  const [correlations, setCorrelations] = useState<Record<string, string>>({});
  const [habitat, setHabitat] = useState("mangrove");
  const [bluePeriods, setBluePeriods] = useState<BluePeriodDraft[]>([
    { year: "2020", area: "100", biomass: "80", soc: "350", areaSe: "", biomassSe: "", socSe: "", poolCorrelation: "0", erosion: "0", submergence: "0", ch4: "", n2o: "", seaLevel: "3", source: "Field plot / habitat map", baseArea: "", baseBiomass: "", baseSoc: "", baseCh4: "", baseN2o: "", erosionDriver: "unknown", erodedCarbon: "", oxidizedPct: "", slrBuffer: "", erosionBasis: "period" },
    { year: "2025", area: "100", biomass: "85", soc: "355", areaSe: "", biomassSe: "", socSe: "", poolCorrelation: "0", erosion: "0", submergence: "0", ch4: "", n2o: "", seaLevel: "3", source: "Field plot / habitat map", baseArea: "", baseBiomass: "", baseSoc: "", baseCh4: "", baseN2o: "", erosionDriver: "unknown", erodedCarbon: "", oxidizedPct: "", slrBuffer: "", erosionBasis: "period" },
  ]);
  const [blueUncertainty, setBlueUncertainty] = useState("20");
  const [blueTemporalCorrelation, setBlueTemporalCorrelation] = useState("0");
  const [strata, setStrata] = useState<StratumDraft[]>([{ name: "Stratum 1", area: "10", cv: "40", geometry: "" }]);
  const [precision, setPrecision] = useState("10");
  const [confidence, setConfidence] = useState("95");
  const [revisit, setRevisit] = useState("12");
  const [plotArea, setPlotArea] = useState("400");
  const [samplingPools, setSamplingPools] = useState<string[]>(["AGB", "BGB"]);
  const [registry, setRegistry] = useState("Verra Registry");
  const [registryUrl, setRegistryUrl] = useState("");
  const [registryFile, setRegistryFile] = useState<File | null>(null);
  const [registryExternalId, setRegistryExternalId] = useState("");
  const [officialRegistry, setOfficialRegistry] = useState("Verra Registry");
  const [registryConnector, setRegistryConnector] = useState<RegistryConnectorStatus | null>(null);
  const [registryConnectorError, setRegistryConnectorError] = useState("");
  const [safeguardPeriod, setSafeguardPeriod] = useState("2026");
  const [indicator, setIndicator] = useState("fpic_sessions");
  const [indicatorValue, setIndicatorValue] = useState("0");
  const [indicatorUnit, setIndicatorUnit] = useState("sessions");
  const [indicatorTarget, setIndicatorTarget] = useState("");
  const [indicatorMethod, setIndicatorMethod] = useState("");
  const [indicatorOwner, setIndicatorOwner] = useState("");
  const [group, setGroup] = useState("");
  const [benefitType, setBenefitType] = useState("cash");
  const [benefitValue, setBenefitValue] = useState("0");
  const [benefitUnit, setBenefitUnit] = useState("IDR");
  const [benefitStatus, setBenefitStatus] = useState("planned");
  const [consentReference, setConsentReference] = useState("");
  const [deliveryReference, setDeliveryReference] = useState("");
  const [recipientAcknowledged, setRecipientAcknowledged] = useState(false);
  const [beneficiaryCount, setBeneficiaryCount] = useState("0");
  const [reviewerNote, setReviewerNote] = useState("");
  const [fieldCaptures, setFieldCaptures] = useState<FieldCapture[]>([]);
  const [fieldCaptureError, setFieldCaptureError] = useState("");
  const [indicatorCaptureIds, setIndicatorCaptureIds] = useState<string[]>([]);
  const [benefitCaptureIds, setBenefitCaptureIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    listFieldCaptures(props.projectId)
      .then((items) => { if (active) setFieldCaptures(items); })
      .catch((cause: unknown) => { if (active) setFieldCaptureError(errorMessage(cause)); });
    return () => { active = false; };
  }, [props.projectId]);

  useEffect(() => {
    let active = true;
    getRegistryConnectorStatus(props.projectId)
      .then((value) => {
        if (!active) return;
        setRegistryConnector(value);
        if (value.provider === "verra_gateway") setOfficialRegistry("Verra Registry");
        if (value.provider === "unfccc_article_6_4") setOfficialRegistry("UNFCCC Article 6.4 Registry");
      })
      .catch((cause: unknown) => { if (active) setRegistryConnectorError(errorMessage(cause)); });
    return () => { active = false; };
  }, [props.projectId]);

  const cats: Category[] = ["methodology_calc", "vmd0054_leakage", "uncertainty", "blue_carbon", "sampling_plan", "registry_import", "safeguard_metric", "community_benefit"];
  const records = props.records.filter((record) => cats.includes(record.category));
  async function save(category: Category, key: string, title: string, payload: Record<string, unknown>) {
    const existing = props.records.find((record) => record.category === category && record.record_key === key);
    await saveRecord(props.projectId, category, key, { title, payload, status: "draft" }, existing?.revision || 0);
    await props.onChanged();
  }
  async function submit(event: FormEvent, action: () => Promise<void>) {
    event.preventDefault();
    if (!props.canWrite || busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(c("Draft tersimpan dan tercatat dalam riwayat revisi.", "Draft saved with a revision history.")); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  const evidence = evidenceByWorkflow[workflow];
  const setEvidence = (value: string) => setEvidenceByWorkflow((old) => ({ ...old, [workflow]: value }));
  const selectedPeriod = props.periods.find((period) => period.id === monitoringPeriodId);
  const latestBoundary = props.boundaries.reduce<BoundaryVersion | null>(
    (latest, boundary) => !latest || boundary.version > latest.version ? boundary : latest,
    null,
  );
  const calculationBoundary = selectedPeriod
    ? props.boundaries.find((boundary) => boundary.version === selectedPeriod.boundary_version) || null
    : latestBoundary;
  const calculationArea = calculationBoundary?.area_ha;
  const ev = references(evidence);
  function jsonValue(value: string, label: string) {
    try { return JSON.parse(value); }
    catch { throw new Error(c(`${label} harus berisi JSON yang valid.`, `${label} must contain valid JSON.`)); }
  }
  const noWrite = !props.canWrite;
  const latestMethodResult = props.records.find((record) => record.category === "methodology_calc")?.result;
  const latestNet = latestMethodResult?.net_screening_tco2e;
  const acceptedLeakageRecords = props.records.filter((record) => record.category === "vmd0054_leakage" && record.status === "accepted");

  return <div>
    <div className="alert alert-info">
      {c("Alat bantu pengukuran dan dokumentasi untuk review proyek. Hasil di bawah bukan sertifikasi atau penerbitan kredit.", "Measurement and documentation tools for project review. Outputs below are not certification or credit issuance.")}
    </div>
    <nav className="integrity-tabs carbon-operations-tabs" aria-label={c("Alur MRV karbon", "Carbon MRV workflows")}>
      {WORKFLOWS.map(([key, id, en]) => <button type="button" key={key} aria-current={workflow === key ? "page" : undefined} className={workflow === key ? "is-active" : ""} onClick={() => { setWorkflow(key); setError(""); setNotice(""); }}>{c(id, en)}</button>)}
    </nav>

    {workflow === "method" ? <form className="integrity-editor" onSubmit={(e) => void submit(e, async () => {
      const pools = approach === "area_based" ? POOLS.filter((item) => poolInputs[item].included).map((item) => ({
        pool: item, start_mg_c_ha: Number(poolInputs[item].start), end_mg_c_ha: Number(poolInputs[item].end),
        start_se_mg_c_ha: Number(poolInputs[item].startSe), end_se_mg_c_ha: Number(poolInputs[item].endSe),
        temporal_correlation: Number(poolInputs[item].correlation),
        cumulative_start_change_mg_c_ha: poolInputs[item].cumulativeStart === "" ? null : Number(poolInputs[item].cumulativeStart),
        cumulative_end_change_mg_c_ha: poolInputs[item].cumulativeEnd === "" ? null : Number(poolInputs[item].cumulativeEnd),
      })) : [];
      const payload: Record<string, unknown> = {
        methodology_id: "VM0047", methodology_version: "1.1", approach, monitoring_period_id: selectedPeriod?.id || null, period_start: periodStart, period_end: periodEnd,
        area_ha: Number(calculationArea ?? manualArea), project_emissions_tco2e: Number(emissions), leakage_tco2e: approach === "area_based" ? Number(leakage) : 0,
        leakage_record_id: approach === "area_based" ? leakageRecordId || null : null,
        uncertainty_record_id: uncertaintyRecordId || null,
        leakage_assessment_basis: leakageBasis, pools, assessment_evidence_complete: assessmentEvidenceComplete,
        evidence: ev,
      };
      if (approach === "area_based") payload.plots = jsonValue(plotJson, "Plot SI");
      else Object.assign(payload, { census_planting_units: Number(plantingUnits), census_sampled_units: Number(sampledUnits), census_surviving_sampled_units: Number(survivingUnits), census_mean_live_unit_mg_c: Number(liveUnitCarbon), census_mean_live_unit_se_mg_c: Number(liveUnitSe), planting_density_per_ha: Number(density), census_land_use_unchanged: landUseUnchanged, census_direct_planting: directPlanting, census_preexisting_woody_cover_pct: preexistingWoodyCover === "" ? null : Number(preexistingWoodyCover), census_site_prep_soil_disturbance: soilDisturbance === "unknown" ? null : soilDisturbance === "yes", census_start_live_units: censusStartUnits === "" ? null : Number(censusStartUnits), census_start_mean_live_unit_mg_c: censusStartCarbon === "" ? null : Number(censusStartCarbon), census_start_mean_live_unit_se_mg_c: censusStartSe === "" ? null : Number(censusStartSe) });
      const key = `vm0047-${periodStart}`;
      await save("methodology_calc", key, `VM0047 v1.1 · ${periodStart} to ${periodEnd}`, payload);
    })}>
      <h3>{c("Kalkulasi metodologi VM0047 v1.1", "VM0047 v1.1 methodology calculation")}</h3>
      <p className="integrity-note">{c("Luas diambil dari batas proyek. Kalkulasi ini menerapkan screening tren Stocking Index berbobot dan perubahan stok per periode; input tetap harus diperiksa terhadap alat/metodologi resmi Verra dan reviewer.", "Area comes from the project boundary. The calculator screens weighted Stocking Index trends and period stock changes; inputs still require comparison with Verra's official tools and reviewer.")}</p>
      <div className="integrity-form-grid">
        <Field label={c("Pendekatan", "Approach")}><select className="form-select" value={approach} onChange={(e) => setApproach(e.target.value as typeof approach)}><option value="area_based">{c("Berbasis area", "Area-based")}</option><option value="census_based">{c("Berbasis sensus", "Census-based")}</option></select></Field>
        <Field label={c("Periode monitoring", "Monitoring period")}><select className="form-select" value={monitoringPeriodId} onChange={(e) => { const nextId = e.target.value; setMonitoringPeriodId(nextId); const nextPeriod = props.periods.find((period) => period.id === nextId); if (nextPeriod) { setPeriodStart(nextPeriod.start_date); setPeriodEnd(nextPeriod.end_date); } }}><option value="">{c("Tidak ditautkan (pakai batas terbaru)", "Not linked (use latest boundary)")}</option>{props.periods.map((period) => <option value={period.id} key={period.id}>{period.name} · {period.start_date} – {period.end_date} · v{period.boundary_version}</option>)}</select></Field>
        <Field label={c("Luas batas tersimpan (ha)", "Saved boundary area (ha)")}><input required min="0.0001" type="number" step="any" className="form-control" readOnly={calculationArea !== undefined} value={calculationArea ?? manualArea} onChange={(e) => setManualArea(e.target.value)} /></Field>
        <Field label={c("Mulai periode", "Period start")}><input required type="date" className="form-control" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></Field>
        <Field label={c("Akhir periode", "Period end")}><input required type="date" className="form-control" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></Field>
        <Field label={c("Emisi proyek (tCO2e)", "Project emissions (tCO2e)")}><input type="number" min="0" step="any" className="form-control" value={emissions} onChange={(e) => setEmissions(e.target.value)} /></Field>
        {approach === "area_based" && <Field label={c("Leakage (tCO2e)", "Leakage (tCO2e)")}><input type="number" min="0" step="any" className="form-control" value={leakage} onChange={(e) => { setLeakage(e.target.value); setLeakageRecordId(""); }} /></Field>}
        {approach === "area_based" && <Field label={c("Hasil VMD0054 yang telah direview", "Reviewed VMD0054 result")}><select className="form-select" value={leakageRecordId} onChange={(e) => { const id = e.target.value; setLeakageRecordId(id); const selected = acceptedLeakageRecords.find((record) => record.id === id); if (typeof selected?.result.total_leakage_tco2e === "number") setLeakage(String(selected.result.total_leakage_tco2e)); }}><option value="">{c("Input manual / tidak ditautkan", "Manual input / not linked")}</option>{acceptedLeakageRecords.map((record) => <option key={record.id} value={record.id}>{record.title} · {String(record.result.total_leakage_tco2e ?? "—")} tCO2e</option>)}</select></Field>}
        <Field label={c("Rentang ketidakpastian yang telah direview", "Reviewed uncertainty range")}><select className="form-select" value={uncertaintyRecordId} onChange={(e) => setUncertaintyRecordId(e.target.value)}><option value="">{c("Tidak ditautkan", "Not linked")}</option>{props.records.filter((record) => record.category === "uncertainty" && record.status === "accepted").map((record) => <option key={record.id} value={record.id}>{record.title}</option>)}</select></Field>
      </div>
      {approach === "area_based" && <>
      <h4 className="h6 mt-3">{c("Input stok per pool (Mg C/ha)", "Pool stock inputs (Mg C/ha)")}</h4>
      {POOLS.map((item) => {
        const poolData = poolInputs[item];
        const updatePool = (patch: Partial<PoolDraft>) => setPoolInputs((old) => ({ ...old, [item]: { ...old[item], ...patch } }));
        return <fieldset className="integrity-methodology-item mb-2" key={item}>
          <legend className="h6"><label className="form-check-label"><input className="form-check-input me-2" type="checkbox" checked={poolData.included} onChange={(e) => updatePool({ included: e.target.checked })} />{item}</label></legend>
          {poolData.included && <div className="integrity-form-grid">
            <Field label={c("Stok awal", "Start stock")}><input type="number" min="0" step="any" className="form-control" value={poolData.start} onChange={(e) => updatePool({ start: e.target.value })} /></Field>
            <Field label={c("Stok akhir", "End stock")}><input type="number" min="0" step="any" className="form-control" value={poolData.end} onChange={(e) => updatePool({ end: e.target.value })} /></Field>
            <Field label={c("SE stok awal", "Start stock SE")}><input type="number" min="0" step="any" className="form-control" value={poolData.startSe} onChange={(e) => updatePool({ startSe: e.target.value })} /></Field>
            <Field label={c("SE stok akhir", "End stock SE")}><input type="number" min="0" step="any" className="form-control" value={poolData.endSe} onChange={(e) => updatePool({ endSe: e.target.value })} /></Field>
          <Field label={c("Korelasi temporal", "Temporal correlation")}><input type="number" min="-1" max="1" step="any" className="form-control" value={poolData.correlation} placeholder={c("0 jika independen", "0 if independent")} onChange={(e) => updatePool({ correlation: e.target.value })} /></Field>
            <Field label={c("Perubahan stok kumulatif awal (Mg C/ha, opsional)", "Cumulative stock change at period start (Mg C/ha, optional)")}><input type="number" step="any" className="form-control" value={poolData.cumulativeStart} onChange={(e) => updatePool({ cumulativeStart: e.target.value })} /></Field>
            <Field label={c("Perubahan stok kumulatif akhir (Mg C/ha, opsional)", "Cumulative stock change at period end (Mg C/ha, optional)")}><input type="number" step="any" className="form-control" value={poolData.cumulativeEnd} onChange={(e) => updatePool({ cumulativeEnd: e.target.value })} /></Field>
          </div>}
        </fieldset>;
      })}
      </>}
      {approach === "area_based" && <Field label={c("Dasar penilaian leakage VMD0054", "VMD0054 leakage assessment basis")}><textarea rows={2} maxLength={4000} className="form-control" value={leakageBasis} onChange={(e) => setLeakageBasis(e.target.value)} /></Field>}
      {approach === "area_based" ? <Field label={c("Seri Stocking Index per pasangan plot (JSON)", "Stocking Index series per matched plot (JSON)")} hint={c("Format: [{\"plot_id\":\"P01\",\"years\":[2022,2023,2024],\"weight\":1,\"project_si\":[...],\"control_si\":[...]}]. Minimal 30 pasangan; weight adalah bobot relatif plot.", "Format: [{\"plot_id\":\"P01\",\"years\":[2022,2023,2024],\"weight\":1,\"project_si\":[...],\"control_si\":[...]}]. At least 30 matched plots; weight is relative plot weight.") }><textarea rows={5} className="form-control font-monospace" value={plotJson} onChange={(e) => setPlotJson(e.target.value)} /></Field> : <>
        <div className="integrity-form-grid">
          <Field label={c("Jumlah unit tanam", "Planting units")}><input required type="number" min="1" step="1" className="form-control" value={plantingUnits} onChange={(e) => setPlantingUnits(e.target.value)} /></Field>
          <Field label={c("Unit sampel", "Sampled units")}><input required type="number" min="1" step="1" className="form-control" value={sampledUnits} onChange={(e) => setSampledUnits(e.target.value)} /></Field>
          <Field label={c("Unit hidup dalam sampel", "Surviving sampled units")}><input required type="number" min="0" step="1" className="form-control" value={survivingUnits} onChange={(e) => setSurvivingUnits(e.target.value)} /></Field>
          <Field label={c("Karbon rata-rata per unit hidup (Mg C)", "Mean carbon per live unit (Mg C)")}><input required type="number" min="0" step="any" className="form-control" value={liveUnitCarbon} onChange={(e) => setLiveUnitCarbon(e.target.value)} /></Field>
          <Field label={c("SE karbon per unit (Mg C)", "Carbon SE per unit (Mg C)")}><input type="number" min="0" step="any" className="form-control" value={liveUnitSe} onChange={(e) => setLiveUnitSe(e.target.value)} /></Field>
          <Field label={c("Kepadatan (unit/ha, maks. 50)", "Planting density (units/ha, max 50)")}><input required type="number" min="0" max="50" step="any" className="form-control" value={density} onChange={(e) => setDensity(e.target.value)} /></Field>
          <Field label={c("Unit hidup pada awal periode", "Live units at period start")}><input type="number" min="0" step="1" className="form-control" value={censusStartUnits} onChange={(e) => setCensusStartUnits(e.target.value)} /></Field>
          <Field label={c("Karbon rata-rata/unit pada awal (Mg C)", "Mean carbon/live unit at period start (Mg C)")}><input type="number" min="0" step="any" className="form-control" value={censusStartCarbon} onChange={(e) => setCensusStartCarbon(e.target.value)} /></Field>
          <Field label={c("SE karbon/unit pada awal (Mg C)", "Carbon SE/live unit at period start (Mg C)")}><input type="number" min="0" step="any" className="form-control" value={censusStartSe} onChange={(e) => setCensusStartSe(e.target.value)} /></Field>
          <Field label={c("Tutupan kayu sebelum proyek (%)", "Pre-project woody cover (%)")}><input type="number" min="0" max="100" step="any" className="form-control" value={preexistingWoodyCover} onChange={(e) => setPreexistingWoodyCover(e.target.value)} /></Field>
        </div>
        <label className="form-check mb-3"><input className="form-check-input" type="checkbox" checked={landUseUnchanged} onChange={(e) => setLandUseUnchanged(e.target.checked)} /> <span className="form-check-label">{c("Konfirmasi: aktivitas tidak mengubah penggunaan lahan", "Confirm: activity does not change land use")}</span></label>
        <label className="form-check mb-3"><input className="form-check-input" type="checkbox" checked={directPlanting} onChange={(e) => setDirectPlanting(e.target.checked)} /> <span className="form-check-label">{c("Konfirmasi: penanaman langsung dan sensus awal lengkap", "Confirm: direct planting and complete initial census")}</span></label>
        <Field label={c("Persiapan lokasi/gangguan tanah", "Site preparation/soil disturbance")}><select className="form-select" value={soilDisturbance} onChange={(e) => setSoilDisturbance(e.target.value)}><option value="unknown">{c("Belum dinilai", "Not assessed")}</option><option value="no">{c("Tidak ada", "None reported")}</option><option value="yes">{c("Ada, perlu ditinjau", "Occurred; review required")}</option></select></Field>
      </>}
      <label className="form-check mb-3"><input className="form-check-input" type="checkbox" checked={assessmentEvidenceComplete} onChange={(e) => setAssessmentEvidenceComplete(e.target.checked)} /> <span className="form-check-label">{c("Checklist kelayakan metodologi dan bukti untuk periode ini sudah dilengkapi", "Methodology eligibility checklist and evidence for this period are complete")}</span></label>
      <EvidenceField value={evidence} onChange={setEvidence} />
      {!calculationBoundary && <p className="small text-danger">{c("Tambahkan batas proyek yang tervalidasi sebelum menghitung.", "Add a validated project boundary before calculating.")}</p>}
      <button className="btn btn-success" disabled={busy || noWrite || !calculationBoundary || (approach === "area_based" && !POOLS.some((item) => poolInputs[item].included))}>{c(busy ? "Menghitung..." : "Hitung dan simpan draft", busy ? "Calculating..." : "Calculate and save draft")}</button>
    </form> : null}

    {workflow === "leakage" ? <form className="integrity-editor" onSubmit={(e) => void submit(e, async () => {
      const parsed = jsonValue(leakageCommodityJson, "Komoditas VMD0054");
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error(c("Masukkan minimal satu komoditas dalam bentuk array JSON.", "Enter at least one commodity as a JSON array."));
      const commodities = (parsed as Record<string, unknown>[]).map((item) => ({ ...item, evidence: Array.isArray(item.evidence) && item.evidence.length ? item.evidence : ev }));
      await save("vmd0054_leakage", `vmd0054-${leakageStartDate}-${leakageYear}`, `VMD0054 v1.1 · ${leakageStartDate} · year ${leakageYear}`, {
        methodology_id: "VM0047", methodology_version: "1.1", vmd0054_version: "1.1",
        project_start_date: leakageStartDate, monitoring_year: Number(leakageYear), cross_commodity_accounting: crossCommodity,
        carbon_stock_loss_t_c_ha: Number(leakageStockLoss), mitigation_emissions_tco2e_cumulative: Number(leakageMitigationEmissions),
        commodities, evidence: ev,
      });
    })}>
      <h3>{c("Skrining leakage pertanian VMD0054 v1.1", "VMD0054 v1.1 agricultural leakage screening")}</h3>
      <p className="integrity-note">{c("Kalkulator memakai data produksi, faktor, dan bukti yang Anda masukkan. Contoh JSON hanya ilustrasi. Periksa kategori komoditas, hierarki sumber, faktor regional, dan applicability terhadap teks resmi serta verifier.", "This calculator uses entered production data, factors, and evidence. The JSON example is illustrative. Verify commodity classification, source hierarchy, regional factors, and applicability against the official method and verifier.")}</p>
      <div className="integrity-form-grid">
        <Field label={c("Tanggal mulai proyek", "Project start date")}><input required type="date" className="form-control" value={leakageStartDate} onChange={(e) => setLeakageStartDate(e.target.value)} /></Field>
        <Field label={c("Tahun monitoring sejak proyek dimulai", "Monitoring year since project start")}><input required type="number" min="1" max="100" className="form-control" value={leakageYear} onChange={(e) => setLeakageYear(e.target.value)} /></Field>
        <Field label={c("Kehilangan stok karbon lahan baru (t C/ha)", "New-land carbon stock loss (t C/ha)")}><input required type="number" min="0" step="any" className="form-control" value={leakageStockLoss} onChange={(e) => setLeakageStockLoss(e.target.value)} /></Field>
        <Field label={c("Emisi mitigasi kumulatif (tCO2e)", "Cumulative mitigation emissions (tCO2e)")}><input type="number" min="0" step="any" className="form-control" value={leakageMitigationEmissions} onChange={(e) => setLeakageMitigationEmissions(e.target.value)} /></Field>
      </div>
      <label className="form-check mb-3"><input className="form-check-input" type="checkbox" checked={crossCommodity} onChange={(e) => setCrossCommodity(e.target.checked)} /> <span className="form-check-label">{c("Perhitungan lintas komoditas (memerlukan bukti tren dan faktor)", "Cross-commodity accounting (requires trend and factor evidence)")}</span></label>
      <Field label={c("Input komoditas (JSON)", "Commodity inputs (JSON)")} hint={c("Isi historical_project_production minimal tiga tahun atau satu rotasi penuh; sertakan yield, increased_supply_pct, new_land_pct, dan referensi bukti. Area mitigasi opsional.", "Provide at least three years or one full crop rotation in historical_project_production; include yield, increased_supply_pct, new_land_pct, and evidence. Mitigation area data are optional.")}><textarea required rows={8} className="form-control font-monospace" value={leakageCommodityJson} onChange={(e) => setLeakageCommodityJson(e.target.value)} /></Field>
      <EvidenceField value={evidence} onChange={setEvidence} />
      <button className="btn btn-success" disabled={busy || noWrite || !references(evidence).length}>{c("Hitung dan simpan leakage", "Calculate and save leakage")}</button>
    </form> : null}
    {workflow === "uncertainty" ? <form className="integrity-editor" onSubmit={(e) => void submit(e, () => save("uncertainty", `budget-${periodStart}`, `Uncertainty budget · ${periodStart}`, {
      central_net_tco2e: Number(central), confidence_level_pct: 90,
      components: UNCERTAINTY_SOURCES.map(([source]) => {
        const residuals = uncertaintyResiduals[source].trim() ? uncertaintyResiduals[source].trim().split(/[\s,;]+/).map(Number) : [];
        if (residuals.some((value) => !Number.isFinite(value))) throw new Error(c(`Residual ${source} harus berupa angka.`, `${source} residuals must be numeric.`));
        return residuals.length >= 2
          ? { source, observations_tco2e: residuals, observation_ids: uncertaintyObservationIds[source].trim() ? uncertaintyObservationIds[source].trim().split(/[\s,;]+/) : [], evidence: ev }
          : { source, standard_uncertainty_tco2e: Number(uncertainties[source] || 0), evidence: ev };
      }),
      correlations: UNCERTAINTY_PAIRS.filter(([a, b]) => correlations[`${a}:${b}`] !== undefined && correlations[`${a}:${b}`] !== "").map(([source_a, source_b]) => ({
        source_a, source_b, correlation: Number(correlations[`${source_a}:${source_b}`]), evidence: ev,
      })),
      correlation_note: "Observed dependencies are entered as pairwise correlation; missing pairs remain zero by explicit assumption.", evidence: ev,
    }))}>
      <h3>{c("Anggaran ketidakpastian hasil karbon", "Carbon result uncertainty budget")}</h3>
      <p className="integrity-note">{c("Masukkan SE tervalidasi atau residual validasi bertanda, satu angka per baris. Simulasi mempropagasikan korelasi antarsumber yang didukung bukti; pasangan tanpa korelasi terukur diasumsikan nol.", "Enter validated SEs or signed validation residuals, one number per line. Simulation propagates evidence-backed correlations; pairs without measured correlation are assumed zero.")}</p>
      {typeof latestNet === "number" && <div className="alert alert-light d-flex flex-wrap align-items-center gap-2"><span>{c("Hasil bersih terakhir dari kalkulator VM0047:", "Latest net result from the VM0047 calculator:")} <strong>{latestNet.toLocaleString()} tCO2e</strong></span><button type="button" className="btn btn-outline-success btn-sm" onClick={() => setCentral(String(latestNet))}>{c("Gunakan sebagai nilai pusat", "Use as central value")}</button></div>}
      <div className="integrity-form-grid">
        <Field label={c("Hasil bersih pusat (tCO2e)", "Central net result (tCO2e)")}><input required type="number" step="any" className="form-control" value={central} onChange={(e) => setCentral(e.target.value)} /></Field>
        {UNCERTAINTY_SOURCES.map(([key, id, en]) => <div className="integrity-methodology-item" key={key}><Field label={`${c(id, en)} · ${c("SE tCO2e (jika tidak memakai residual)", "SE tCO2e (unless using residuals)")}`}><input type="number" min="0" step="any" className="form-control" value={uncertainties[key]} onChange={(e) => setUncertainties((old) => ({ ...old, [key]: e.target.value }))} /></Field><Field label={c("Residual validasi (opsional, satu angka per baris)", "Validation residuals (optional, one value per line)")}><textarea rows={2} className="form-control font-monospace" value={uncertaintyResiduals[key]} onChange={(e) => setUncertaintyResiduals((old) => ({ ...old, [key]: e.target.value }))} /></Field><Field label={c("ID observasi sejajar (opsional, satu per baris)", "Aligned observation IDs (optional, one per line)")}><textarea rows={1} className="form-control font-monospace" value={uncertaintyObservationIds[key]} onChange={(e) => setUncertaintyObservationIds((old) => ({ ...old, [key]: e.target.value }))} /></Field></div>)}
      </div>
      <h4 className="h6 mt-3">{c("Korelasi antarsumber (opsional)", "Cross-source correlations (optional)")}</h4>
      <div className="integrity-form-grid">{UNCERTAINTY_PAIRS.map(([a, b]) => <Field key={`${a}:${b}`} label={`${a} ↔ ${b}`}><input type="number" min="-1" max="1" step="0.01" className="form-control" value={correlations[`${a}:${b}`] || ""} onChange={(e) => setCorrelations((old) => ({ ...old, [`${a}:${b}`]: e.target.value }))} placeholder={c("0 jika independen", "0 if independent")} /></Field>)}</div>
      <EvidenceField value={evidence} onChange={setEvidence} />
      <button className="btn btn-success" disabled={busy || noWrite}>{c("Propagasikan dan simpan draft", "Propagate and save draft")}</button>
    </form> : null}

    {workflow === "blue" ? <form className="integrity-editor" onSubmit={(e) => void submit(e, () => {
      const ordered = [...bluePeriods].sort((a, b) => Number(a.year) - Number(b.year));
      const periods = ordered.map((period) => ({
        year: Number(period.year), habitat, habitat_area_ha: Number(period.area),
        biomass_mg_c_ha: Number(period.biomass), sediment_soc_mg_c_ha: Number(period.soc),
        habitat_area_se_ha: period.areaSe === "" ? null : Number(period.areaSe),
        biomass_se_mg_c_ha: period.biomassSe === "" ? null : Number(period.biomassSe),
        sediment_soc_se_mg_c_ha: period.socSe === "" ? null : Number(period.socSe),
        biomass_soc_correlation: Number(period.poolCorrelation),
        erosion_area_ha: Number(period.erosion), submergence_area_ha: Number(period.submergence),
        ch4_emissions_tco2e_yr: period.ch4 === "" ? null : Number(period.ch4),
        n2o_emissions_tco2e_yr: period.n2o === "" ? null : Number(period.n2o),
        relative_sea_level_rise_mm_yr: period.seaLevel === "" ? null : Number(period.seaLevel),
        baseline_habitat_area_ha: period.baseArea === "" ? null : Number(period.baseArea),
        baseline_biomass_mg_c_ha: period.baseBiomass === "" ? null : Number(period.baseBiomass),
        baseline_sediment_soc_mg_c_ha: period.baseSoc === "" ? null : Number(period.baseSoc),
        baseline_ch4_emissions_tco2e_yr: period.baseCh4 === "" ? null : Number(period.baseCh4),
        baseline_n2o_emissions_tco2e_yr: period.baseN2o === "" ? null : Number(period.baseN2o),
        erosion_driver: period.erosionDriver, erosion_area_basis: period.erosionBasis,
        eroded_soil_carbon_t_c_ha: period.erodedCarbon === "" ? null : Number(period.erodedCarbon),
        eroded_carbon_oxidized_pct: period.oxidizedPct === "" ? null : Number(period.oxidizedPct),
        sea_level_risk_buffer_contribution_tco2e: period.slrBuffer === "" ? null : Number(period.slrBuffer),
        source: period.source, evidence: ev,
      }));
      return save("blue_carbon", `blue-${ordered[0].year}-${ordered[ordered.length - 1].year}`, `${habitat} monitoring · ${ordered[0].year}-${ordered[ordered.length - 1].year}`, {
        periods, uncertainty_pct: Number(blueUncertainty), temporal_correlation: Number(blueTemporalCorrelation), evidence: ev,
      });
    })}>
      <h3>{c("Pemantauan blue carbon dari waktu ke waktu", "Blue carbon monitoring over time")}</h3>
      <p className="integrity-note">{c("Isi data baseline pada semua periode atau kosongkan seluruh kolom baseline. Untuk erosi, pilih penyebab; erosi non-kenaikan muka laut memerlukan karbon tanah tererosi dan fraksi oksidasi, sedangkan risiko kenaikan muka laut dilaporkan lewat kontribusi buffer NPRT. Hasil ini tetap skrining, bukan kalkulator lengkap VM0033/VMD0051.", "Enter baseline data for every period or leave all baseline fields blank. Select an erosion driver; non-sea-level erosion requires eroded-soil carbon and oxidation fraction, while sea-level-rise risk is reported through the NPRT buffer contribution. This remains a screening tool, not the complete VM0033/VMD0051 calculator.")}</p>
      <Field label={c("Jenis habitat", "Habitat type")}><select className="form-select" value={habitat} onChange={(e) => setHabitat(e.target.value)}><option value="mangrove">{c("Mangrove", "Mangrove")}</option><option value="tidal_marsh">{c("Rawa pasang surut", "Tidal marsh")}</option><option value="seagrass">{c("Lamun", "Seagrass")}</option></select></Field>
      {bluePeriods.map((period, index) => <article className="integrity-methodology-item" key={`blue-period-${index}`}>
        <div className="integrity-form-grid">
          <Field label={c("Tahun", "Year")}><input required type="number" min="1900" max="2100" className="form-control" value={period.year} onChange={(e) => setBluePeriods((old) => old.map((item, i) => i === index ? { ...item, year: e.target.value } : item))} /></Field>
          <Field label={c("Luas habitat (ha)", "Habitat area (ha)")}><input required type="number" min="0" step="any" className="form-control" value={period.area} onChange={(e) => setBluePeriods((old) => old.map((item, i) => i === index ? { ...item, area: e.target.value } : item))} /></Field>
          <Field label={c("Biomassa (Mg C/ha)", "Biomass (Mg C/ha)")}><input required type="number" min="0" step="any" className="form-control" value={period.biomass} onChange={(e) => setBluePeriods((old) => old.map((item, i) => i === index ? { ...item, biomass: e.target.value } : item))} /></Field>
          <Field label={c("SOC sedimen (Mg C/ha)", "Sediment SOC (Mg C/ha)")}><input required type="number" min="0" step="any" className="form-control" value={period.soc} onChange={(e) => setBluePeriods((old) => old.map((item, i) => i === index ? { ...item, soc: e.target.value } : item))} /></Field>
          <Field label={c("SE luas habitat (ha, opsional)", "Habitat-area SE (ha, optional)")}><input type="number" min="0" step="any" className="form-control" value={period.areaSe} onChange={(e) => setBluePeriods((old) => old.map((item, i) => i === index ? { ...item, areaSe: e.target.value } : item))} /></Field>
          <Field label={c("SE biomassa (Mg C/ha, opsional)", "Biomass SE (Mg C/ha, optional)")}><input type="number" min="0" step="any" className="form-control" value={period.biomassSe} onChange={(e) => setBluePeriods((old) => old.map((item, i) => i === index ? { ...item, biomassSe: e.target.value } : item))} /></Field>
          <Field label={c("SE SOC sedimen (Mg C/ha, opsional)", "Sediment SOC SE (Mg C/ha, optional)")}><input type="number" min="0" step="any" className="form-control" value={period.socSe} onChange={(e) => setBluePeriods((old) => old.map((item, i) => i === index ? { ...item, socSe: e.target.value } : item))} /></Field>
          <Field label={c("Korelasi SE biomassa/SOC", "Biomass/SOC SE correlation")}><input type="number" min="-1" max="1" step="any" className="form-control" value={period.poolCorrelation} onChange={(e) => setBluePeriods((old) => old.map((item, i) => i === index ? { ...item, poolCorrelation: e.target.value } : item))} /></Field>
          <Field label={c("Area erosi (ha)", "Eroded area (ha)")}><input required type="number" min="0" step="any" className="form-control" value={period.erosion} onChange={(e) => setBluePeriods((old) => old.map((item, i) => i === index ? { ...item, erosion: e.target.value } : item))} /></Field>
          <Field label={c("Area terendam/submergence (ha)", "Submerged area (ha)")}><input required type="number" min="0" step="any" className="form-control" value={period.submergence} onChange={(e) => setBluePeriods((old) => old.map((item, i) => i === index ? { ...item, submergence: e.target.value } : item))} /></Field>
          <Field label={c("Emisi CH4 (tCO2e/tahun)", "CH4 emissions (tCO2e/year)")}><input type="number" min="0" step="any" className="form-control" value={period.ch4} onChange={(e) => setBluePeriods((old) => old.map((item, i) => i === index ? { ...item, ch4: e.target.value } : item))} /></Field>
          <Field label={c("Emisi N2O (tCO2e/tahun)", "N2O emissions (tCO2e/year)")}><input type="number" min="0" step="any" className="form-control" value={period.n2o} onChange={(e) => setBluePeriods((old) => old.map((item, i) => i === index ? { ...item, n2o: e.target.value } : item))} /></Field>
          <Field label={c("Muka laut relatif (mm/tahun)", "Relative sea level (mm/year)")}><input type="number" step="any" className="form-control" value={period.seaLevel} onChange={(e) => setBluePeriods((old) => old.map((item, i) => i === index ? { ...item, seaLevel: e.target.value } : item))} /></Field>
          <Field label={c("Luas baseline (ha)", "Baseline area (ha)")}><input type="number" min="0" step="any" className="form-control" value={period.baseArea} onChange={(e) => setBluePeriods((old) => old.map((item, i) => i === index ? { ...item, baseArea: e.target.value } : item))} /></Field>
          <Field label={c("Biomassa baseline (Mg C/ha)", "Baseline biomass (Mg C/ha)")}><input type="number" min="0" step="any" className="form-control" value={period.baseBiomass} onChange={(e) => setBluePeriods((old) => old.map((item, i) => i === index ? { ...item, baseBiomass: e.target.value } : item))} /></Field>
        <Field label={c("SOC baseline (Mg C/ha)", "Baseline SOC (Mg C/ha)")}><input type="number" min="0" step="any" className="form-control" value={period.baseSoc} onChange={(e) => setBluePeriods((old) => old.map((item, i) => i === index ? { ...item, baseSoc: e.target.value } : item))} /></Field>
          <Field label={c("CH4 baseline (tCO2e/tahun)", "Baseline CH4 (tCO2e/year)")}><input type="number" min="0" step="any" className="form-control" value={period.baseCh4} onChange={(e) => setBluePeriods((old) => old.map((item, i) => i === index ? { ...item, baseCh4: e.target.value } : item))} /></Field>
          <Field label={c("N2O baseline (tCO2e/tahun)", "Baseline N2O (tCO2e/year)")}><input type="number" min="0" step="any" className="form-control" value={period.baseN2o} onChange={(e) => setBluePeriods((old) => old.map((item, i) => i === index ? { ...item, baseN2o: e.target.value } : item))} /></Field>
          <Field label={c("Penyebab erosi", "Erosion driver")}><select className="form-select" value={period.erosionDriver} onChange={(e) => setBluePeriods((old) => old.map((item, i) => i === index ? { ...item, erosionDriver: e.target.value } : item))}><option value="unknown">{c("Belum diketahui", "Unknown")}</option><option value="other">{c("Selain kenaikan muka laut", "Other than sea-level rise")}</option><option value="sea_level_rise">{c("Kenaikan muka laut", "Sea-level rise")}</option></select></Field>
          <Field label={c("Basis area erosi", "Erosion area basis")}><select className="form-select" value={period.erosionBasis} onChange={(e) => setBluePeriods((old) => old.map((item, i) => i === index ? { ...item, erosionBasis: e.target.value } : item))}><option value="period">{c("Area baru pada interval ini", "New area in this interval")}</option><option value="cumulative">{c("Area kumulatif sejak awal", "Cumulative area to date")}</option></select></Field>
          <Field label={c("Karbon tanah tererosi (t C/ha)", "Eroded soil carbon (t C/ha)")}><input type="number" min="0" step="any" className="form-control" value={period.erodedCarbon} onChange={(e) => setBluePeriods((old) => old.map((item, i) => i === index ? { ...item, erodedCarbon: e.target.value } : item))} /></Field>
          <Field label={c("Karbon teroksidasi (%)", "Oxidized carbon (%)")}><input type="number" min="0" max="100" step="any" className="form-control" value={period.oxidizedPct} onChange={(e) => setBluePeriods((old) => old.map((item, i) => i === index ? { ...item, oxidizedPct: e.target.value } : item))} /></Field>
          <Field label={c("Kontribusi buffer NPRT (tCO2e)", "NPRT buffer contribution (tCO2e)")}><input type="number" min="0" step="any" className="form-control" value={period.slrBuffer} onChange={(e) => setBluePeriods((old) => old.map((item, i) => i === index ? { ...item, slrBuffer: e.target.value } : item))} /></Field>
          <Field label={c("Sumber data", "Data source")}><input required className="form-control" value={period.source} onChange={(e) => setBluePeriods((old) => old.map((item, i) => i === index ? { ...item, source: e.target.value } : item))} /></Field>
        </div>
        {bluePeriods.length > 2 && <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setBluePeriods((old) => old.filter((_, i) => i !== index))}>{c("Hapus periode", "Remove period")}</button>}
      </article>)}
      <button type="button" className="btn btn-outline-success btn-sm mb-3" onClick={() => setBluePeriods((old) => [...old, { ...old[old.length - 1], year: String(Number(old[old.length - 1].year) + 1) }])}>{c("Tambah periode", "Add period")}</button>
      <div className="integrity-form-grid"><Field label={c("Ketidakpastian inventaris (%)", "Inventory uncertainty (%)")}><input type="number" min="0" max="100" step="any" className="form-control" value={blueUncertainty} onChange={(e) => setBlueUncertainty(e.target.value)} /></Field><Field label={c("Korelasi antarperiode", "Correlation between periods")}><input type="number" min="-1" max="1" step="any" className="form-control" value={blueTemporalCorrelation} onChange={(e) => setBlueTemporalCorrelation(e.target.value)} /></Field></div>
      <EvidenceField value={evidence} onChange={setEvidence} />
      <button className="btn btn-success" disabled={busy || noWrite}>{c("Hitung perubahan inventaris", "Calculate inventory change")}</button>
    </form> : null}

    {workflow === "sampling" ? <form className="integrity-editor" onSubmit={(e) => void submit(e, () => save("sampling_plan", "current", "Field sampling plan", {
      target_precision_pct: Number(precision), confidence_level_pct: Number(confidence), revisit_interval_months: Number(revisit), seed: 20261124,
      plot_area_m2: Number(plotArea), monitoring_period_id: monitoringPeriodId || null,
      strata: strata.map((stratum, index) => ({ name: stratum.name || `Stratum ${index + 1}`, area_ha: Number(stratum.area), expected_cv_pct: Number(stratum.cv), geometry: stratum.geometry.trim() ? jsonValue(stratum.geometry, `GeoJSON ${index + 1}`) : null })), pools: samplingPools, evidence: ev,
    }))}>
      <h3>{c("Perencanaan sampel lapangan", "Field sampling plan")}</h3>
      <p className="integrity-note">{c("Jumlah plot dihitung dari CV yang diperkirakan, tingkat keyakinan, dan presisi sasaran. Koordinat acak memerlukan poligon strata GeoJSON.", "Plot count uses expected CV, confidence level and target precision. Random coordinates require a stratum GeoJSON polygon.")}</p>
      {strata.map((stratum, index) => <article className="integrity-methodology-item" key={`stratum-${index}`}>
        <div className="integrity-form-grid">
          <Field label={c("Nama strata", "Stratum name")}><input required className="form-control" value={stratum.name} onChange={(e) => setStrata((old) => old.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} /></Field>
          <Field label={c("Luas strata (ha)", "Stratum area (ha)")}><input required type="number" min="0.001" step="any" className="form-control" value={stratum.area} onChange={(e) => setStrata((old) => old.map((item, i) => i === index ? { ...item, area: e.target.value } : item))} /></Field>
          <Field label={c("CV yang diperkirakan (%)", "Expected CV (%)")}><input required type="number" min="0.01" step="any" className="form-control" value={stratum.cv} onChange={(e) => setStrata((old) => old.map((item, i) => i === index ? { ...item, cv: e.target.value } : item))} /></Field>
          <Field label={c("Batas GeoJSON (opsional)", "GeoJSON boundary (optional)")}><textarea rows={3} className="form-control font-monospace" value={stratum.geometry} onChange={(e) => setStrata((old) => old.map((item, i) => i === index ? { ...item, geometry: e.target.value } : item))} placeholder={'{"type":"Polygon","coordinates":[...]}'}/></Field>
        </div>
        {strata.length > 1 && <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setStrata((old) => old.filter((_, i) => i !== index))}>{c("Hapus strata", "Remove stratum")}</button>}
      </article>)}
      <button type="button" className="btn btn-outline-success btn-sm mb-3" onClick={() => setStrata((old) => [...old, { name: `Stratum ${old.length + 1}`, area: "10", cv: "40", geometry: "" }])}>{c("Tambah strata", "Add stratum")}</button>
      <div className="integrity-form-grid">
        <Field label={c("Presisi sasaran (%)", "Target precision (%)")}><input type="number" min="0.01" max="50" step="any" className="form-control" value={precision} onChange={(e) => setPrecision(e.target.value)} /></Field>
        <Field label={c("Tingkat keyakinan (%)", "Confidence level (%)")}><input type="number" min="50.01" max="99.99" step="any" className="form-control" value={confidence} onChange={(e) => setConfidence(e.target.value)} /></Field>
        <Field label={c("Kunjungan ulang (bulan)", "Revisit interval (months)")}><input type="number" min="3" max="120" className="form-control" value={revisit} onChange={(e) => setRevisit(e.target.value)} /></Field>
        <Field label={c("Luas rencana plot (m²)", "Planned plot area (m²)")} hint={c("Ditandai asumsi hingga luas plot diukur di lapangan.", "Marked as assumed until plot area is measured in the field.")}><input type="number" min="1" max="10000" step="any" className="form-control" value={plotArea} onChange={(e) => setPlotArea(e.target.value)} /></Field>
      </div>
      <Field label={c("Periode monitoring (opsional)", "Monitoring period (optional)")}><select className="form-select" value={monitoringPeriodId} onChange={(e) => setMonitoringPeriodId(e.target.value)}><option value="">{c("Tidak ditautkan", "Not linked")}</option>{props.periods.map((period) => <option key={period.id} value={period.id}>{period.name} · {period.start_date} – {period.end_date}</option>)}</select></Field>
      <div className="integrity-pool-options">{POOLS.map((item) => <label className="form-check form-check-inline" key={item}><input className="form-check-input" type="checkbox" checked={samplingPools.includes(item)} onChange={(e) => setSamplingPools((old) => e.target.checked ? [...old, item] : old.filter((value) => value !== item))} /><span className="form-check-label">{item}</span></label>)}</div>
      <EvidenceField value={evidence} onChange={setEvidence} />
      <button className="btn btn-success" disabled={busy || noWrite || !samplingPools.length}>{c("Buat rencana sampel", "Create sampling plan")}</button>
    </form> : null}

    {workflow === "registry" ? <>
      <section className="integrity-editor">
        <h3>{c("Konektor API resmi (read-only)", "Official API connector (read-only)")}</h3>
        <p className="integrity-note">{c("Konektor hanya aktif setelah administrator menyiapkan akses API dan allowlist host resmi di server. Sinkronisasi membaca data eksternal dan menyimpan draft rekonsiliasi; tidak mengubah ledger registry.", "The connector is enabled only after an administrator configures official API access and a server-side host allowlist. Sync reads external data and saves a reconciliation draft; it does not modify the registry ledger.")}</p>
        {registryConnectorError && <p role="alert" className="text-danger">{registryConnectorError}</p>}
        {registryConnector && <p className={registryConnector.configured ? "text-success" : "text-muted"}>{registryConnector.configured ? c("API siap", "API ready") : c("Akses API resmi belum dikonfigurasi", "Official API access is not configured")}</p>}
        {registryConnector?.configured && <form className="integrity-form-grid" onSubmit={(e) => void submit(e, async () => {
          if (!registryExternalId.trim()) throw new Error(c("Masukkan ID proyek registry.", "Enter a registry project ID."));
          await syncOfficialRegistry(props.projectId, officialRegistry, registryExternalId.trim(), `live-${Date.now()}`);
          await props.onChanged();
        })}>
          <Field label={c("Penyedia registry", "Registry provider")}><select className="form-select" value={officialRegistry} onChange={(e) => setOfficialRegistry(e.target.value)}><option disabled={registryConnector.provider !== "verra_gateway"} value="Verra Registry">Verra Registry</option><option disabled={registryConnector.provider !== "unfccc_article_6_4"} value="UNFCCC Article 6.4 Registry">UNFCCC Article 6.4 Registry</option></select></Field>
          <Field label={c("ID proyek registry", "Registry project ID")}><input required className="form-control" value={registryExternalId} onChange={(e) => setRegistryExternalId(e.target.value)} /></Field>
          <button className="btn btn-success align-self-end" disabled={busy || noWrite}>{c("Sinkronkan status resmi", "Sync official status")}</button>
        </form>}
      </section>
      <form className="integrity-editor" onSubmit={(e) => void submit(e, async () => {
      if (!registryFile) throw new Error(c("Pilih file CSV registry terlebih dahulu.", "Select a registry CSV file first."));
      const key = `import-${Date.now()}`;
      await importRegistryCsv(props.projectId, registryFile, registry, key, registryUrl);
      await props.onChanged();
      setRegistryFile(null);
    })}>
      <h3>{c("Impor dan cocokkan data registry", "Import and reconcile registry data")}</h3>
      <p className="integrity-note">{c("Impor CSV untuk membandingkan proyek, vintage, serial, event, tanggal, jumlah, akun, dan ID transaksi dengan ledger internal. Impor tidak mengubah ledger.", "Import a CSV to compare project, vintage, serial, event, date, quantity, account and transaction ID with the internal ledger. Imports do not change the ledger.")}</p>
      <div className="alert alert-light"><code>external_project_id,vintage,serial,event_type,event_date,quantity,account,transaction_id</code><br />{c("Nilai event: issuance, transfer, use, retirement, cancellation.", "Event values: issuance, transfer, use, retirement, cancellation.")}</div>
      <div className="integrity-form-grid">
        <Field label={c("Nama registry", "Registry name")}><input required className="form-control" value={registry} onChange={(e) => setRegistry(e.target.value)} /></Field>
        <Field label={c("URL sumber resmi (opsional)", "Official source URL (optional)")}><input type="url" className="form-control" value={registryUrl} onChange={(e) => setRegistryUrl(e.target.value)} /></Field>
        <Field label={c("File CSV", "CSV file")}><input required type="file" accept=".csv,text/csv" className="form-control" onChange={(e) => setRegistryFile(e.target.files?.[0] || null)} /></Field>
      </div>
      <button className="btn btn-success" disabled={busy || noWrite || !registryFile}>{c("Impor dan rekonsiliasi", "Import and reconcile")}</button>
      </form>
    </> : null}

    {workflow === "safeguards" ? <div className="integrity-feature-grid">
      <form className="integrity-editor" onSubmit={(e) => void submit(e, () => {
        const key = `${indicator}-${safeguardPeriod}`;
        return save("safeguard_metric", key, `Safeguard · ${indicator} · ${safeguardPeriod}`, {
          period: safeguardPeriod, indicator, value: Number(indicatorValue), unit: indicatorUnit,
          target: indicatorTarget ? Number(indicatorTarget) : null, methodology: indicatorMethod,
          evidence: ev, owner: indicatorOwner, field_capture_ids: indicatorCaptureIds,
        });
      })}>
        <h3>{c("Indikator safeguards", "Safeguard indicators")}</h3>
        <div className="integrity-form-grid">
          <Field label={c("Periode", "Period")}><input required className="form-control" value={safeguardPeriod} onChange={(e) => setSafeguardPeriod(e.target.value)} /></Field>
          <Field label={c("Indikator", "Indicator")}><select className="form-select" value={indicator} onChange={(e) => setIndicator(e.target.value)}><option value="fpic_sessions">{c("Sesi FPIC/PADIATAPA", "FPIC sessions")}</option><option value="households_consulted">{c("Rumah tangga yang dikonsultasikan", "Households consulted")}</option><option value="grievances_resolved">{c("Pengaduan yang diselesaikan", "Grievances resolved")}</option><option value="women_benefit_share_pct">{c("Porsi manfaat untuk perempuan (%)", "Women benefit share (%)")}</option><option value="local_jobs">{c("Lapangan kerja lokal", "Local jobs")}</option><option value="biodiversity_species">{c("Spesies biodiversitas", "Biodiversity species")}</option><option value="habitat_condition">{c("Kondisi habitat", "Habitat condition")}</option></select></Field>
          <Field label={c("Nilai", "Value")}><input type="number" min="0" step="any" className="form-control" value={indicatorValue} onChange={(e) => setIndicatorValue(e.target.value)} /></Field>
          <Field label={c("Satuan", "Unit")}><input required className="form-control" value={indicatorUnit} onChange={(e) => setIndicatorUnit(e.target.value)} /></Field>
          <Field label={c("Target", "Target")}><input type="number" min="0" step="any" className="form-control" value={indicatorTarget} onChange={(e) => setIndicatorTarget(e.target.value)} /></Field>
          <Field label={c("Penanggung jawab", "Owner")}><input className="form-control" value={indicatorOwner} onChange={(e) => setIndicatorOwner(e.target.value)} /></Field>
        </div>
        <Field label={c("Metode pengukuran dan catatan", "Measurement method and notes")}><textarea rows={2} className="form-control" value={indicatorMethod} onChange={(e) => setIndicatorMethod(e.target.value)} /></Field>
        <Field label={c("Catatan lapangan pendukung", "Supporting field observations")} hint={c("Pilih catatan GPS bertanggal untuk mengajukan indikator ke review.", "Select dated GPS observations before submitting the indicator for review.")}><select multiple className="form-select" value={indicatorCaptureIds} onChange={(e) => setIndicatorCaptureIds(Array.from(e.target.selectedOptions, (option) => option.value))}>{fieldCaptures.map((capture) => <option key={capture.capture_id} value={capture.capture_id}>{capture.plot_code} · {new Date(capture.observed_at).toLocaleDateString()} · {capture.qa_flags.length ? c("Perlu QA", "QA needed") : c("QA siap", "QA ready")}</option>)}</select>{fieldCaptureError && <small className="text-danger">{fieldCaptureError}</small>}</Field>
        <EvidenceField value={references(evidenceByWorkflow.safeguards).join("\n")} onChange={(value) => setEvidenceByWorkflow((old) => ({ ...old, safeguards: value }))} />
        <button className="btn btn-success" disabled={busy || noWrite || !references(evidenceByWorkflow.safeguards).length}>{c("Simpan indikator", "Save indicator")}</button>
      </form>
      <form className="integrity-editor" onSubmit={(e) => void submit(e, () => save("community_benefit", `${safeguardPeriod}-${group.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48) || "group"}`, `Community benefit · ${group || safeguardPeriod}`, {
        period: safeguardPeriod, community_or_group: group, benefit_type: benefitType, value: Number(benefitValue), currency_or_unit: benefitUnit,
        status: benefitStatus, consent_reference: consentReference, evidence: references(benefitEvidence), reviewer_note: reviewerNote, field_capture_ids: benefitCaptureIds,
        delivery_reference: deliveryReference, recipient_acknowledged: recipientAcknowledged, beneficiary_count: Number(beneficiaryCount),
      }))}>
        <h3>{c("Pembagian manfaat masyarakat", "Community benefit sharing")}</h3>
        <div className="integrity-form-grid">
          <Field label={c("Komunitas / kelompok penerima", "Community / recipient group")}><input required className="form-control" value={group} onChange={(e) => setGroup(e.target.value)} /></Field>
          <Field label={c("Jenis manfaat", "Benefit type")}><select className="form-select" value={benefitType} onChange={(e) => setBenefitType(e.target.value)}><option value="cash">{c("Tunai", "Cash")}</option><option value="in_kind">{c("Barang/jasa", "In kind")}</option><option value="services">{c("Layanan", "Services")}</option><option value="jobs">{c("Pekerjaan", "Jobs")}</option><option value="revenue_share">{c("Bagi hasil", "Revenue share")}</option></select></Field>
          <Field label={c("Nilai", "Value")}><input type="number" min="0" step="any" className="form-control" value={benefitValue} onChange={(e) => setBenefitValue(e.target.value)} /></Field>
          <Field label={c("Mata uang / satuan", "Currency / unit")}><input required className="form-control" value={benefitUnit} onChange={(e) => setBenefitUnit(e.target.value)} /></Field>
          <Field label={c("Status tindak lanjut", "Follow-up status")}><select className="form-select" value={benefitStatus} onChange={(e) => setBenefitStatus(e.target.value)}><option value="planned">{c("Direncanakan", "Planned")}</option><option value="approved">{c("Disetujui", "Approved")}</option><option value="disbursed">{c("Disalurkan", "Disbursed")}</option></select></Field>
          <Field label={c("Referensi persetujuan", "Consent reference")}><input className="form-control" value={consentReference} onChange={(e) => setConsentReference(e.target.value)} /></Field>
          <Field label={c("Jumlah penerima manfaat", "Number of beneficiaries")}><input type="number" min="0" step="1" className="form-control" value={beneficiaryCount} onChange={(e) => setBeneficiaryCount(e.target.value)} /></Field>
          {benefitStatus === "disbursed" && <Field label={c("Referensi bukti penyaluran", "Delivery evidence reference")}><input required className="form-control" value={deliveryReference} onChange={(e) => setDeliveryReference(e.target.value)} /></Field>}
        </div>
        {benefitStatus === "disbursed" && <label className="form-check mb-3"><input className="form-check-input" type="checkbox" checked={recipientAcknowledged} onChange={(e) => setRecipientAcknowledged(e.target.checked)} /><span className="form-check-label">{c("Penerima mengonfirmasi telah menerima manfaat", "Recipient confirms benefit was received")}</span></label>}
        <Field label={c("Catatan lapangan pendukung", "Supporting field observations")} hint={c("Pilih catatan GPS bertanggal. Status terverifikasi hanya diberikan setelah reviewer independen menerima bukti.", "Select dated GPS observations. Verified status is only granted after independent review accepts the evidence.")}><select multiple className="form-select" value={benefitCaptureIds} onChange={(e) => setBenefitCaptureIds(Array.from(e.target.selectedOptions, (option) => option.value))}>{fieldCaptures.map((capture) => <option key={capture.capture_id} value={capture.capture_id}>{capture.plot_code} · {new Date(capture.observed_at).toLocaleDateString()} · {capture.qa_flags.length ? c("Perlu QA", "QA needed") : c("QA siap", "QA ready")}</option>)}</select>{fieldCaptureError && <small className="text-danger">{fieldCaptureError}</small>}</Field>
        <Field label={c("Catatan reviewer", "Reviewer note")}><textarea rows={2} className="form-control" value={reviewerNote} onChange={(e) => setReviewerNote(e.target.value)} /></Field>
        <EvidenceField value={benefitEvidence} onChange={setBenefitEvidence} />
        <button className="btn btn-success" disabled={busy || noWrite || !group.trim() || !references(benefitEvidence).length}>{c("Simpan catatan manfaat", "Save benefit record")}</button>
      </form>
    </div> : null}

    {notice && <p role="status" className="text-success mt-3">{notice}</p>}
    {error && <p role="alert" className="text-danger mt-3">{error}</p>}
    <h3 className="integrity-subheading">{c("Riwayat fitur MRV karbon", "Carbon MRV feature history")}</h3>
    <RecordList {...props} records={records} />
  </div>;
}

export function AutomaticImageProvenance({ projectId }: { projectId: string }) {
  const c = useCopy();
  const [items, setItems] = useState<AutomaticImageSnapshot[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    getAutomaticImageSnapshots(projectId)
      .then((value) => { if (active) setItems(value.items); })
      .catch((cause: unknown) => { if (active) setError(errorMessage(cause)); });
    return () => { active = false; };
  }, [projectId]);
  return <section className="integrity-editor">
    <h3>{c("Metadata citra otomatis dari snapshot", "Automatic image metadata from snapshots")}</h3>
    <p className="integrity-note">{c("Untuk analisis Sentinel-2 baru, manifest menyimpan ID scene, waktu, tutupan awan, tile, baseline pemrosesan, sudut matahari, serta akurasi retrieval AOT bila tersedia. Produk SR L2A sudah terkoreksi atmosfer; SaveGeo mencatat bahwa pita AOT tersedia, tetapi belum menerapkan koreksi atau penolakan berbasis aerosol. Snapshot lama hanya menampilkan metadata yang tersimpan saat itu.", "For new Sentinel-2 analyses, the manifest records scene ID, time, cloud cover, tile, processing baseline, solar angles, and AOT retrieval accuracy where available. The L2A SR product is atmospherically corrected; SaveGeo records that the AOT band is available but does not yet apply aerosol-based correction or exclusion. Older snapshots show only metadata retained at the time.")}</p>
    {error && <p role="alert" className="text-danger">{error}</p>}
    {!items.length && !error && <p className="integrity-empty">{c("Belum ada snapshot analisis citra untuk proyek ini.", "No satellite analysis snapshots are available for this project yet.")}</p>}
    {items.map((item) => <article className="integrity-record mb-2" key={item.id}>
      <div className="integrity-record-head"><h4>{item.kind} · {new Date(item.created_at).toLocaleString()}</h4><span className="small text-muted">{item.snapshot_hash.slice(0, 12)}</span></div>
      <dl className="integrity-auto-metadata">{Object.entries(item.metadata).map(([key, value]) => <div key={key}><dt>{key.replace(/_/g, " ")}</dt><dd>{typeof value === "object" && value !== null ? <pre className="small mb-0">{JSON.stringify(value, null, 2)}</pre> : String(value)}</dd></div>)}</dl>
      {item.quality_warnings.length > 0 && <p className="text-warning mb-1">{c("Perlu ditinjau", "Needs review")}: {item.quality_warnings.join(", ")}</p>}
      <small className="text-muted">{item.attestation === "provider_collection_metadata_captured_during_analysis_and_retained_in_immutable_snapshot" ? c("Manifest dikumpulkan dari koleksi provider saat analisis dan terikat pada snapshot; tidak menjadi validasi carbon stock.", "Manifest was captured from the provider collection during analysis and bound to the snapshot; it does not validate the carbon stock estimate.") : c("Hanya ekstraksi dari snapshot; belum diverifikasi langsung ke provider.", "Extracted from snapshot only; not re-verified with the provider.")}</small>
    </article>)}
  </section>;
}

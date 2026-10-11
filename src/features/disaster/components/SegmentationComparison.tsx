import InfoTip from "@/components/ui/InfoTip";
import { useI18nStore } from "@/hooks/useI18nStore";

export interface SegmentationResult {
  model_id: string; model_version: string; method: string;
  result_semantics?: "land_cover" | "change_indicator" | "water_extent" | string;
  damage_model?: boolean;
  validation_status?: string;
  limitations?: string[];
  review_reasons?: string[];
  aoi: GeoJSON.Polygon | GeoJSON.MultiPolygon; resolution_m: number; crs: string;
  pre_tile_url: string; post_tile_url: string; change_tile_url: string;
  confidence_tile_url?: string | null;
  pre: {date: string; scene_count: number; algorithm_versions?: string[]; qa_versions?: string[]}; post: {date: string; scene_count: number; algorithm_versions?: string[]; qa_versions?: string[]};
  aoi_area_ha: number; valid_area_ha: number; no_data_area_ha: number;
  changed_area_ha: number; unchanged_area_ha: number; coverage_note: string;
  classes: Array<{class_id: number; label: string; color: string; pre_area_ha: number; post_area_ha: number;
    change_area_ha: number; pre_percentage: number; post_percentage: number; pre_pixel_count: number; post_pixel_count: number;
    pre_confidence: number | null; post_confidence: number | null;
    gained_area_ha?: number; lost_area_ha?: number; unchanged_area_ha?: number}>;
  transitions: Array<{pre_class_id: number; post_class_id: number; area_ha: number; label: string; color: string}>;
}

const number = (value: number) => value.toLocaleString("id-ID", {maximumFractionDigits: 2});
/** Metadata for the shared satellite viewer; this component creates no map. */
export function SegmentationSummary({result, tileError = false}: {result: SegmentationResult; tileError?: boolean}) {
  const { language } = useI18nStore();
  const indonesian = language === "id";

  const interpretationLimits = result.limitations?.length ? result.limitations : [
    indonesian ? "Kelas tutupan lahan tidak merepresentasikan kerusakan bencana." : "Land-cover classes do not represent disaster damage.",
    indonesian ? "Perubahan kelas perlu diperiksa dengan citra referensi dan validasi." : "Class changes need reference imagery and validation.",
  ];
  return <section className="segmentation-comparison" aria-label={indonesian ? "Metadata segmentasi" : "Segmentation metadata"}>
    <header className="segmentation-comparison__header">
      <strong>{indonesian ? "Segmentasi pre/post" : "Pre/post segmentation"}</strong>
      <span className="segmentation-comparison__model">{result.model_id} · v{result.model_version}</span>
      <InfoTip label={indonesian ? "Detail metode dan model" : "Method and model details"} content={<>
        <strong>{result.model_id} · v{result.model_version}</strong>
        <p className="mb-1">{result.method}</p>
        <span>{indonesian ? "Versi inferensi" : "Inference version"}: {result.pre.algorithm_versions?.join(", ") || "—"} · {indonesian ? "versi masking" : "masking version"}: {result.pre.qa_versions?.join(", ") || "—"}</span>
      </>} />
    </header>

    {result.damage_model === false && <div className="segmentation-comparison__notice" role="status">
      <i className="bi bi-info-circle" aria-hidden="true" />
      <span>{indonesian ? "Proksi tutupan lahan · bukan klasifikasi kerusakan" : "Land-cover proxy · not damage classification"}</span>
      <InfoTip label={indonesian ? "Batas interpretasi model" : "Model interpretation limits"} content={<>
        <strong>{indonesian ? "Proksi tutupan lahan" : "Land-cover proxy"}</strong>
        <p>{indonesian ? "Model ini tidak dilatih untuk mengidentifikasi kerusakan bencana. Perubahan pre/post hanya menunjukkan perubahan kelas tutupan lahan; jangan menafsirkannya langsung sebagai area terbakar, longsor, tsunami, atau kerusakan bangunan." : "This model was not trained to identify disaster damage. Pre/post changes only show land-cover class changes; do not interpret them directly as burned areas, landslides, tsunamis, or building damage."}</p>
        <ul className="mb-0 ps-3">{interpretationLimits.map(item => <li key={item}>{item}</li>)}</ul>
      </>} />
    </div>}

    {result.review_reasons?.length ? <div className="segmentation-comparison__notice segmentation-comparison__notice--warning" role="status">
      <i className="bi bi-exclamation-triangle" aria-hidden="true" />
      <span>{indonesian ? "Catatan interpretasi" : "Interpretation notes"}</span>
      <InfoTip label={indonesian ? "Detail catatan interpretasi" : "Interpretation note details"} content={<ul className="mb-0 ps-3">{result.review_reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>} />
    </div> : null}

    <div className="segmentation-comparison__meta" aria-label={indonesian ? "Metadata perbandingan" : "Comparison metadata"}>
      <span><i className="bi bi-calendar3" aria-hidden="true" /> {result.pre.date} → {result.post.date}</span>
      <span><i className="bi bi-images" aria-hidden="true" /> {result.pre.scene_count} → {result.post.scene_count} {indonesian ? "scene" : "scenes"}</span>
      <span><i className="bi bi-rulers" aria-hidden="true" /> {result.resolution_m} m</span>
      <InfoTip label={indonesian ? "Detail cakupan dan CRS" : "Coverage and CRS details"} content={<>
        <div><strong>CRS</strong>: {result.crs}</div>
        <p className="my-1">{result.coverage_note}</p>
        <div>{indonesian ? "Luas AOI" : "AOI area"}: {number(result.aoi_area_ha)} ha · {indonesian ? "Valid" : "Valid"}: {number(result.valid_area_ha)} ha</div>
        <div>{indonesian ? "Tanpa data" : "No data"}: {number(result.no_data_area_ha)} ha · {indonesian ? "Berubah" : "Changed"}: {number(result.changed_area_ha)} ha · {indonesian ? "Tetap" : "Unchanged"}: {number(result.unchanged_area_ha)} ha</div>
      </>} />
    </div>

    {(!result.pre_tile_url || !result.post_tile_url || !result.classes.length) && <div role="alert" className="alert alert-warning py-2">
      {indonesian ? "Hasil segmentasi belum lengkap. Layer yang tersedia tetap dapat ditampilkan." : "Segmentation results are incomplete. Available layers can still be displayed."}
    </div>}

    {tileError && <div role="alert" className="segmentation-comparison__error">
      <i className="bi bi-exclamation-circle" aria-hidden="true" />
      <span>{indonesian ? "Tile segmentasi gagal dimuat" : "Segmentation tiles failed to load"}</span>
      <InfoTip label={indonesian ? "Detail kegagalan tile" : "Tile loading error details"} content={indonesian ? "URL tile mungkin kedaluwarsa. Jalankan ulang analisis untuk memperbarui hasil." : "The tile URL may have expired. Run the analysis again to refresh the result."} />
    </div>}

  </section>;
}

export function SegmentationStatistics({result}: {result: SegmentationResult}) {
  const { language } = useI18nStore();
  const indonesian = language === "id";
  const transitions = result.transitions.filter(item => item.pre_class_id !== item.post_class_id);
  return <section aria-label={indonesian ? "Statistik segmentasi" : "Segmentation statistics"}>
    <div className="disaster-comparison-totals" aria-label={indonesian ? "Ringkasan luas segmentasi" : "Segmentation area summary"}>
      {[
        [indonesian ? "Valid" : "Valid", result.valid_area_ha],
        [indonesian ? "Berubah" : "Changed", result.changed_area_ha],
        [indonesian ? "Tetap" : "Unchanged", result.unchanged_area_ha],
        [indonesian ? "Tanpa data" : "No data", result.no_data_area_ha],
      ].map(([label, area]) => <div key={String(label)}><span>{label}</span><strong>{number(Number(area))} ha</strong></div>)}
    </div>
    {result.changed_area_ha === 0 && <p className="small text-muted mb-2">{indonesian ? "Tidak ada perubahan kelas pada piksel valid bersama." : "No class changes were found in shared valid pixels."}</p>}
    <details className="segmentation-comparison__details">
      <summary>{indonesian ? "Lihat statistik kelas dan transisi" : "View class and transition statistics"}<span>{result.classes.length} {indonesian ? "kelas" : "classes"}</span></summary>
      <div className="table-responsive"><table className="table table-sm" aria-label={indonesian ? "Statistik kelas segmentasi" : "Segmentation class statistics"}>
        <thead><tr><th>{indonesian ? "Kelas" : "Class"}</th><th>Pre ha / %</th><th>Post ha / %</th><th>{indonesian ? "Selisih ha" : "Change ha"}</th><th>{indonesian ? "Piksel pre / post" : "Pre / post pixels"}</th><th>{indonesian ? "Probabilitas pre / post" : "Pre / post probability"}</th></tr></thead>
        <tbody>{result.classes.map(c => <tr key={c.class_id}>
          <td><span style={{background: c.color, display: "inline-block", width: 12, height: 12, marginRight: 5}} />{c.label}</td>
          <td>{number(c.pre_area_ha)} / {number(c.pre_percentage)}%</td><td>{number(c.post_area_ha)} / {number(c.post_percentage)}%</td><td>{number(c.change_area_ha)}</td>
          <td>{c.pre_pixel_count} / {c.post_pixel_count}</td><td>{c.pre_confidence == null ? "—" : number(c.pre_confidence)} / {c.post_confidence == null ? "—" : number(c.post_confidence)}</td>
        </tr>)}</tbody>
      </table></div>
      <>
        <div className="table-responsive"><table className="table table-sm"><thead><tr><th>{indonesian ? "Kelas" : "Class"}</th><th>{indonesian ? "Bertambah ha" : "Gained ha"}</th><th>{indonesian ? "Berkurang ha" : "Lost ha"}</th><th>{indonesian ? "Tetap ha" : "Unchanged ha"}</th></tr></thead><tbody>
          {result.classes.map(c => <tr key={c.class_id}><td>{c.label}</td><td>{c.gained_area_ha == null ? "—" : number(c.gained_area_ha)}</td><td>{c.lost_area_ha == null ? "—" : number(c.lost_area_ha)}</td><td>{c.unchanged_area_ha == null ? "—" : number(c.unchanged_area_ha)}</td></tr>)}
        </tbody></table></div>
        {transitions.length > 0 && <ul className="segmentation-comparison__transitions">{transitions.map(item => <li key={`${item.pre_class_id}-${item.post_class_id}`}>{item.label}: {number(item.area_ha)} ha</li>)}</ul>}
      </>
    </details>

    {result.model_id.startsWith("dynamic_world") && <div className="segmentation-comparison__attribution">
      <i className="bi bi-database" aria-hidden="true" />
      <span>Dynamic World</span>
      <InfoTip label={indonesian ? "Detail sumber dataset" : "Dataset source details"} content={indonesian ? "Dataset ini diproduksi untuk Dynamic World Project oleh Google bersama National Geographic Society dan World Resources Institute. Data Copernicus Sentinel telah dimodifikasi." : "This dataset is produced for the Dynamic World Project by Google with the National Geographic Society and World Resources Institute. Copernicus Sentinel data are modified."} />
      <a href="https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_DYNAMICWORLD_V1" target="_blank" rel="noreferrer">{indonesian ? "Sumber" : "Source"}</a>
    </div>}
  </section>;
}

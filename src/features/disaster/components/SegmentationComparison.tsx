import InfoTip from "@/components/ui/InfoTip";
import { useI18nStore } from "@/hooks/useI18nStore";
import { useState } from "react";

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
    <details className="segmentation-comparison__details segmentation-comparison__details--metadata">
      <summary>
        <span className="segmentation-comparison__summary-icon"><i className="bi bi-info-circle" aria-hidden="true" /></span>
        <span className="segmentation-comparison__summary-copy">
          <strong>{indonesian ? "Informasi segmentasi" : "Segmentation details"}</strong>
          <small>{result.pre.date} → {result.post.date} · {result.pre.scene_count} → {result.post.scene_count} {indonesian ? "scene" : "scenes"} · {result.resolution_m} m</small>
        </span>
        <i className="bi bi-chevron-down segmentation-comparison__summary-chevron" aria-hidden="true" />
      </summary>
      <div className="segmentation-comparison__metadata-content">
    <header className="segmentation-comparison__header">
      <strong>{indonesian ? "Segmentasi pre/post" : "Pre/post segmentation"}</strong>
      <span className="segmentation-comparison__model">{result.model_id} · v{result.model_version}</span>
      <InfoTip label={indonesian ? "Detail metode dan model" : "Method and model details"} content={<>
        <strong>{result.model_id} · v{result.model_version}</strong>
        <p className="mb-1">{result.method}</p>
        <span>{indonesian ? "Versi inferensi" : "Inference version"}: {result.pre.algorithm_versions?.join(", ") || "—"} · {indonesian ? "versi masking" : "masking version"}: {result.pre.qa_versions?.join(", ") || "—"}</span>
      </>} />
    </header>

    {(result.damage_model === false || result.review_reasons?.length) ? <div className="segmentation-comparison__notices">
      {result.damage_model === false && <div className="segmentation-comparison__notice" role="status">
        <i className="bi bi-info-circle" aria-hidden="true" />
        <span>{indonesian ? "Proksi tutupan lahan" : "Land-cover proxy"}</span>
        <InfoTip label={indonesian ? "Batas interpretasi model" : "Model interpretation limits"} content={<>
          <strong>{indonesian ? "Proksi tutupan lahan · bukan klasifikasi kerusakan" : "Land-cover proxy · not damage classification"}</strong>
          <p>{indonesian ? "Model ini tidak dilatih untuk mengidentifikasi kerusakan bencana. Perubahan pre/post hanya menunjukkan perubahan kelas tutupan lahan; jangan menafsirkannya langsung sebagai area terbakar, longsor, tsunami, atau kerusakan bangunan." : "This model was not trained to identify disaster damage. Pre/post changes only show land-cover class changes; do not interpret them directly as burned areas, landslides, tsunamis, or building damage."}</p>
          <ul className="mb-0 ps-3">{interpretationLimits.map(item => <li key={item}>{item}</li>)}</ul>
        </>} />
      </div>}

      {result.review_reasons?.length ? <div className="segmentation-comparison__notice segmentation-comparison__notice--warning" role="status">
        <i className="bi bi-exclamation-triangle" aria-hidden="true" />
        <span>{indonesian ? "Catatan interpretasi" : "Interpretation notes"}</span>
        <InfoTip label={indonesian ? "Detail catatan interpretasi" : "Interpretation note details"} content={<ul className="mb-0 ps-3">{result.review_reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>} />
      </div> : null}
    </div> : null}

    <div className="segmentation-comparison__meta" aria-label={indonesian ? "Metadata perbandingan" : "Comparison metadata"}>
      <span>
        <i className="bi bi-calendar3" aria-hidden="true" /> {result.pre.date} → {result.post.date}
        <InfoTip label={indonesian ? "Cara membaca tanggal citra" : "About imagery dates"} content={indonesian
          ? "Pilihan scene menampilkan citra referensi. Segmentasi dan perubahan menggunakan tanggal hasil analisis yang tercantum di atas."
          : "Scene selections show reference imagery. Segmentation and change use the analysis dates shown above."} />
      </span>
      <span><i className="bi bi-images" aria-hidden="true" /> {result.pre.scene_count} → {result.post.scene_count} {indonesian ? "scene" : "scenes"}</span>
      <span><i className="bi bi-rulers" aria-hidden="true" /> {result.resolution_m} m</span>
      <InfoTip label={indonesian ? "Detail cakupan dan CRS" : "Coverage and CRS details"} content={<>
        <div><strong>CRS</strong>: {result.crs}</div>
        <p className="my-1">{result.coverage_note}</p>
        <div>{indonesian ? "Luas AOI" : "AOI area"}: {number(result.aoi_area_ha)} ha · {indonesian ? "Valid" : "Valid"}: {number(result.valid_area_ha)} ha</div>
        <div>{indonesian ? "Tanpa data" : "No data"}: {number(result.no_data_area_ha)} ha · {indonesian ? "Berubah" : "Changed"}: {number(result.changed_area_ha)} ha · {indonesian ? "Tetap" : "Unchanged"}: {number(result.unchanged_area_ha)} ha</div>
      </>} />
    </div>
      </div>
    </details>

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
  const transitions = result.transitions
    .filter(item => item.pre_class_id !== item.post_class_id)
    .sort((left, right) => right.area_ha - left.area_ha);
  const [view, setView] = useState<"composition" | "change" | "transitions">("composition");
  const maxClassChange = Math.max(1, ...result.classes.flatMap(item => [item.gained_area_ha ?? 0, item.lost_area_ha ?? 0]));

  const views = [
    { id: "composition" as const, icon: "bi-bar-chart-line", label: indonesian ? "Komposisi kelas" : "Class composition" },
    { id: "change" as const, icon: "bi-arrow-left-right", label: indonesian ? "Bertambah & berkurang" : "Gains & losses" },
    { id: "transitions" as const, icon: "bi-shuffle", label: indonesian ? "Transisi utama" : "Top transitions" },
  ];

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
      <summary>
        <span className="segmentation-comparison__summary-icon"><i className="bi bi-bar-chart-fill" aria-hidden="true" /></span>
        <span className="segmentation-comparison__summary-copy">
          <strong>{indonesian ? "Statistik kelas & transisi" : "Class & transition statistics"}</strong>
          <small>{indonesian ? "Bandingkan tutupan lahan sebelum dan sesudah" : "Compare land cover before and after"}</small>
        </span>
        <span className="segmentation-comparison__class-count">{result.classes.length} {indonesian ? "kelas" : "classes"}</span>
        <i className="bi bi-chevron-down segmentation-comparison__summary-chevron" aria-hidden="true" />
      </summary>

      <div className="segmentation-stats">
        <div className="segmentation-stats__tabs" role="group" aria-label={indonesian ? "Tampilan statistik" : "Statistics views"}>
          {views.map(item => <button
            key={item.id}
            type="button"
            id={`segmentation-stats-tab-${item.id}`}
            aria-pressed={view === item.id}
            aria-controls={`segmentation-stats-panel-${item.id}`}
            className={view === item.id ? "is-active" : ""}
            onClick={() => setView(item.id)}
          ><i className={`bi ${item.icon}`} aria-hidden="true" />{item.label}</button>)}
        </div>

        {view === "composition" && <div
          id="segmentation-stats-panel-composition"
          className="segmentation-stats__panel"
          aria-labelledby="segmentation-stats-tab-composition"
        >
          <div className="segmentation-stats__legend"><span><i className="segmentation-stats__legend-dot segmentation-stats__legend-dot--pre" />{indonesian ? "Sebelum" : "Before"}</span><span><i className="segmentation-stats__legend-dot segmentation-stats__legend-dot--post" />{indonesian ? "Sesudah" : "After"}</span><span className="segmentation-stats__legend-hint">{indonesian ? "Panjang bar menunjukkan persentase area valid" : "Bar length represents the share of valid area"}</span></div>
          <div className="segmentation-stats__composition">
            {result.classes.map(item => <article className="segmentation-stats__class-row" key={item.class_id}>
              <div className="segmentation-stats__class-name"><i style={{ backgroundColor: item.color }} /><span>{item.label}</span></div>
              <div className="segmentation-stats__bars">
                <div className="segmentation-stats__bar-row"><span>{indonesian ? "Pra" : "Pre"}</span><div className="segmentation-stats__track"><i style={{ width: `${Math.max(0, Math.min(100, item.pre_percentage))}%`, backgroundColor: item.color }} /></div><strong>{number(item.pre_area_ha)} ha <small>({number(item.pre_percentage)}%)</small></strong></div>
                <div className="segmentation-stats__bar-row"><span>{indonesian ? "Pasca" : "Post"}</span><div className="segmentation-stats__track"><i style={{ width: `${Math.max(0, Math.min(100, item.post_percentage))}%`, backgroundColor: item.color }} /></div><strong>{number(item.post_area_ha)} ha <small>({number(item.post_percentage)}%)</small></strong></div>
              </div>
              <span className={`segmentation-stats__delta ${item.change_area_ha > 0 ? "is-positive" : item.change_area_ha < 0 ? "is-negative" : ""}`}>
                <i className={`bi ${item.change_area_ha > 0 ? "bi-arrow-up-right" : item.change_area_ha < 0 ? "bi-arrow-down-right" : "bi-dash"}`} aria-hidden="true" />{number(item.change_area_ha)} ha
              </span>
              <details className="segmentation-stats__technical">
                <summary aria-label={`${indonesian ? "Detail teknis" : "Technical details"}: ${item.label}`}><i className="bi bi-info-circle" aria-hidden="true" /></summary>
                <div>{indonesian ? "Piksel pra / pasca" : "Pre / post pixels"}: {number(item.pre_pixel_count)} / {number(item.post_pixel_count)}</div>
                <div>{indonesian ? "Probabilitas pra / pasca" : "Pre / post probability"}: {item.pre_confidence == null ? "—" : number(item.pre_confidence)} / {item.post_confidence == null ? "—" : number(item.post_confidence)}</div>
              </details>
            </article>)}
          </div>
        </div>}

        {view === "change" && <div
          id="segmentation-stats-panel-change"
          className="segmentation-stats__panel"
          aria-labelledby="segmentation-stats-tab-change"
        >
          <div className="segmentation-stats__change-legend"><span><i className="is-loss" />{indonesian ? "Berkurang" : "Lost"}</span><span><i className="is-gain" />{indonesian ? "Bertambah" : "Gained"}</span><span className="segmentation-stats__legend-hint">{indonesian ? "Skala bar sebanding antar kelas" : "Bar scale is comparable across classes"}</span></div>
          <div className="segmentation-stats__change-list">
            {result.classes.map(item => {
              const gained = item.gained_area_ha ?? 0;
              const lost = item.lost_area_ha ?? 0;
              return <article className="segmentation-stats__change-row" key={item.class_id}>
                <div className="segmentation-stats__class-name"><i style={{ backgroundColor: item.color }} /><span>{item.label}</span></div>
                <strong className="segmentation-stats__change-value is-loss">{item.lost_area_ha == null ? "—" : `${number(lost)} ha`}</strong>
                <div className="segmentation-stats__diverging" aria-label={`${indonesian ? "Berkurang" : "Lost"} ${number(lost)} ha, ${indonesian ? "bertambah" : "gained"} ${number(gained)} ha`}>
                  <i className="segmentation-stats__diverging-loss" style={{ width: `${Math.max(0, Math.min(100, lost / maxClassChange * 100))}%` }} />
                  <b />
                  <i className="segmentation-stats__diverging-gain" style={{ width: `${Math.max(0, Math.min(100, gained / maxClassChange * 100))}%` }} />
                </div>
                <strong className="segmentation-stats__change-value is-gain">{item.gained_area_ha == null ? "—" : `${number(gained)} ha`}</strong>
                <span className="segmentation-stats__stable"><i className="bi bi-check2" aria-hidden="true" />{indonesian ? "Tetap" : "Stable"} <strong>{item.unchanged_area_ha == null ? "—" : `${number(item.unchanged_area_ha)} ha`}</strong></span>
              </article>;
            })}
          </div>
        </div>}

        {view === "transitions" && <div
          id="segmentation-stats-panel-transitions"
          className="segmentation-stats__panel"
          aria-labelledby="segmentation-stats-tab-transitions"
        >
          {transitions.length ? <div className="segmentation-stats__transition-list">
            {transitions.map((item, index) => <article className="segmentation-stats__transition" key={`${item.pre_class_id}-${item.post_class_id}`}>
              <span className="segmentation-stats__transition-rank">{index + 1}</span>
              <span className="segmentation-stats__transition-name"><i style={{ backgroundColor: item.color }} />{item.label}:{" "}</span>
              <div className="segmentation-stats__track"><i style={{ width: `${Math.max(0, Math.min(100, item.area_ha / Math.max(1, transitions[0].area_ha) * 100))}%`, backgroundColor: item.color }} /></div>
              <strong>{number(item.area_ha)} ha</strong>
            </article>)}
          </div> : <div className="segmentation-stats__empty"><i className="bi bi-check2-circle" aria-hidden="true" />{indonesian ? "Tidak ditemukan transisi antar kelas." : "No between-class transitions found."}</div>}
        </div>}
      </div>
    </details>

    {result.model_id.startsWith("dynamic_world") && <div className="segmentation-comparison__attribution">
      <i className="bi bi-database" aria-hidden="true" />
      <span>Dynamic World</span>
      <InfoTip label={indonesian ? "Detail sumber dataset" : "Dataset source details"} content={indonesian ? "Dataset ini diproduksi untuk Dynamic World Project oleh Google bersama National Geographic Society dan World Resources Institute. Data Copernicus Sentinel telah dimodifikasi." : "This dataset is produced for the Dynamic World Project by Google with the National Geographic Society and World Resources Institute. Copernicus Sentinel data are modified."} />
      <a href="https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_DYNAMICWORLD_V1" target="_blank" rel="noreferrer">{indonesian ? "Sumber" : "Source"}</a>
    </div>}
  </section>;
}

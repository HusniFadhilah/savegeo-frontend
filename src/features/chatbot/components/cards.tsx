import { actionLabel } from "../utils/actionLabel";
import { zoomToFeature, highlightPolygon } from "../mapActions";
import type { ChatAction, QuickAction, ResultCard, ResultSource } from "../types";

/* ── Warnings block ────────────────────────────────────────────── */
export function WarningsBlock({ warnings }: { warnings: string[] }) {
  return (
    <div className="sgc-warnings">
      <div className="sgc-warning-title">
        <i className="bi bi-exclamation-triangle" /> Catatan Penting
      </div>
      {warnings.map((w, i) => (
        <p key={i} className="sgc-warning-item">
          {w}
        </p>
      ))}
    </div>
  );
}

/* ── Confirmation card (needs_confirmation actions) ───────────────── */
export function ConfirmActionCard({
  actions,
  status,
  runningStepIndex,
  onRun,
  onCancel,
}: {
  actions: ChatAction[];
  status: "pending" | "running" | "done";
  runningStepIndex?: number;
  onRun: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="sgc-plan-card">
      <div className="sgc-plan-header">
        <span className="sgc-plan-badge">Menunggu Konfirmasi</span>
      </div>
      <ol className="sgc-plan-steps">
        {actions.map((a, i) => (
          <li key={i} style={status === "running" && runningStepIndex != null && i <= runningStepIndex ? { opacity: 0.5 } : undefined}>
            {actionLabel(a)}
          </li>
        ))}
      </ol>
      <div className="sgc-plan-footer">
        {status === "pending" && (
          <>
            <button type="button" className="sgc-exec-btn" onClick={onRun}>
              <i className="bi bi-play-circle" /> Jalankan
            </button>
            <button type="button" className="sgc-cancel-btn" onClick={onCancel}>
              Batalkan
            </button>
          </>
        )}
        {status === "running" && (
          <div className="sgc-status-running">
            <i className="bi bi-arrow-repeat sgc-spin me-1" /> Menjalankan tindakan...
          </div>
        )}
        {status === "done" && (
          <span style={{ color: "#1e6b3c", fontSize: 13 }}>
            <i className="bi bi-check-circle me-1" /> Selesai
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Action-history card (rendered when reopening a saved session) ─── */
export function ActionHistoryCard({ actions, timestamp }: { actions: ChatAction[]; timestamp?: string }) {
  let ts = "";
  if (timestamp) {
    try {
      ts = new Date(timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    } catch {
      ts = "";
    }
  }
  return (
    <div className="sgc-action-history-card">
      <div className="sgc-action-history-header">
        <span className="sgc-action-history-badge">
          <i className="bi bi-list-check" /> Langkah Dijalankan
        </span>
        {ts && <span className="sgc-action-history-time">{ts}</span>}
      </div>
      <ol className="sgc-action-history-list">
        {actions.map((a, i) => (
          <li key={i}>
            <span className="sgc-action-history-item">{actionLabel(a)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ── Choice card (offer_choices action) ───────────────────────────── */
export function ChoiceCard({
  question,
  choices,
  selectedIndex,
  onSelect,
}: {
  question?: string;
  choices: QuickAction[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="sgc-message sgc-assistant">
      <div className="sgc-choice-card">
        {question && <div className="sgc-choice-question">{question}</div>}
        <div className="sgc-choice-row">
          {choices.map((c, i) => (
            <button
              key={i}
              type="button"
              className={`sgc-choice-btn${selectedIndex === i ? " selected" : ""}`}
              disabled={selectedIndex !== null}
              onClick={() => onSelect(i)}
            >
              {c.label || c.msg}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Guide step card ──────────────────────────────────────────────── */
export function GuideStepCard({
  step,
  total,
  title,
  body,
}: {
  step: number;
  total: number;
  title: string;
  body: string;
}) {
  const pct = Math.round((step / total) * 100);
  return (
    <div className="sgc-guide-step">
      <div className="sgc-guide-header">
        <span className="sgc-guide-badge">
          Langkah {step} / {total}
        </span>
        <span className="sgc-guide-title">{title}</span>
      </div>
      <div className="sgc-guide-progress">
        <div className="sgc-guide-bar" style={{ width: `${pct}%` }} />
      </div>
      <div className="sgc-guide-body">{body}</div>
    </div>
  );
}

/* ── GeoJSON AOI offer card (from a file upload) ──────────────────── */
export function AoiOfferCard({
  fileName,
  name,
  sizeLabel,
  resolved,
  onSet,
  onSend,
}: {
  fileName: string;
  name: string;
  sizeLabel: string;
  resolved: boolean;
  onSet: () => void;
  onSend: () => void;
}) {
  return (
    <div className="sgc-aoi-offer">
      <div className="sgc-aoi-offer-icon">
        <i className="bi bi-pin-map" />
      </div>
      <div className="sgc-aoi-offer-body">
        <div className="sgc-aoi-offer-title">GeoJSON AOI terdeteksi{name ? `: ${name}` : ""}</div>
        <div className="sgc-aoi-offer-name">
          {fileName} &bull; {sizeLabel}
        </div>
      </div>
      {!resolved && (
        <div className="sgc-aoi-offer-actions">
          <button type="button" className="sgc-aoi-btn-set" onClick={onSet}>
            📍 Jadikan AOI
          </button>
          <button type="button" className="sgc-aoi-btn-send" onClick={onSend}>
            💬 Kirim ke AI
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Retry chip (after a failed / cancelled request) ──────────────── */
export function RetryChip({ cancelNote, onRetry }: { cancelNote?: string; onRetry: () => void }) {
  return (
    <div className="sgc-action-row">
      {cancelNote && (
        <span style={{ fontSize: 12, color: "#6b7280", marginRight: 6 }}>{cancelNote}</span>
      )}
      <button type="button" className="sgc-chip sgc-chip-warn" onClick={onRetry}>
        <i className="bi bi-arrow-clockwise" /> Coba Lagi
      </button>
    </div>
  );
}

/* ── Boundary-download card (download_boundary_geojson action) ─────── */
export function BoundaryDownloadCard({
  name,
  downloadUrl,
  filename,
}: {
  name: string;
  downloadUrl: string;
  filename: string;
}) {
  return (
    <div className="sgc-message sgc-assistant">
      <div className="sgc-bubble">
        Batas wilayah <strong>{name}</strong> sudah diset sebagai AOI.{" "}
        <a href={downloadUrl} download={filename} className="sgc-download-link">
          <i className="bi bi-download me-1" />
          Unduh GeoJSON
        </a>
      </div>
    </div>
  );
}

/* ── SaveGeo Assistant result cards (spec section 14) ────────────────
 * Rendered from `resultCard` LogEntry items - one per entry in a geoai-mode
 * response's `cards[]`. Every card carries its `source` for provenance
 * (spec section 10 - "never invent numbers"), shown as a small footer note.
 */

function SourceFootnote({ source }: { source?: ResultSource }) {
  if (!source?.source) return null;
  const bits = [source.dataset, source.period].filter(Boolean).join(" · ");
  return (
    <div className="sgc-card-source">
      <i className="bi bi-check2-circle" /> {source.source}
      {bits ? ` (${bits})` : ""}
    </div>
  );
}

export function MetricResultCard({ card }: { card: Extract<ResultCard, { type: "metric" }> }) {
  return (
    <div className="sgc-result-card sgc-metric-card">
      <div className="sgc-result-card-title">{card.title}</div>
      <div className="sgc-metric-row">
        {card.metrics.map((m, i) => (
          <div key={i} className="sgc-metric-item">
            <div className="sgc-metric-value">
              {m.value}
              {m.unit ? <span className="sgc-metric-unit"> {m.unit}</span> : null}
            </div>
            <div className="sgc-metric-label">{m.label}</div>
          </div>
        ))}
      </div>
      <SourceFootnote source={card.source} />
    </div>
  );
}

export function HotspotResultCard({
  card,
  onDetails,
}: {
  card: Extract<ResultCard, { type: "hotspot" }>;
  onDetails: (message: string) => void;
}) {
  return (
    <div className="sgc-result-card sgc-hotspot-card">
      <div className="sgc-result-card-title">{card.title}</div>
      <div className="sgc-metric-row">
        <div className="sgc-metric-item">
          <div className="sgc-metric-value">{card.area_ha.toLocaleString("id-ID")} ha</div>
          <div className="sgc-metric-label">Area</div>
        </div>
        <div className="sgc-metric-item">
          <div className="sgc-metric-value">{card.metric_value}</div>
          <div className="sgc-metric-label">{card.metric_label}</div>
        </div>
        {card.period && (
          <div className="sgc-metric-item">
            <div className="sgc-metric-value">{card.period}</div>
            <div className="sgc-metric-label">Periode</div>
          </div>
        )}
      </div>
      <div className="sgc-action-row">
        <button type="button" className="sgc-chip" onClick={() => zoomToFeature(card.geometry)}>
          <i className="bi bi-zoom-in" /> Zoom
        </button>
        <button
          type="button"
          className="sgc-chip"
          onClick={() => highlightPolygon(card.geometry, { label: card.title })}
        >
          <i className="bi bi-pin-map" /> Highlight
        </button>
        <button
          type="button"
          className="sgc-chip"
          onClick={() => onDetails(`Detail untuk ${card.title} (id ${card.id})`)}
        >
          <i className="bi bi-info-circle" /> Detail
        </button>
      </div>
      <SourceFootnote source={card.source} />
    </div>
  );
}

export function ComparisonResultCard({ card }: { card: Extract<ResultCard, { type: "comparison" }> }) {
  return (
    <div className="sgc-result-card sgc-comparison-card">
      <div className="sgc-result-card-title">{card.title}</div>
      <div className="sgc-comparison-row">
        <div className="sgc-comparison-col">
          <div className="sgc-comparison-col-label">Sebelum</div>
          <pre className="sgc-comparison-pre">{JSON.stringify(card.before, null, 1)}</pre>
        </div>
        <div className="sgc-comparison-col">
          <div className="sgc-comparison-col-label">Sesudah</div>
          <pre className="sgc-comparison-pre">{JSON.stringify(card.after, null, 1)}</pre>
        </div>
      </div>
      <SourceFootnote source={card.source} />
    </div>
  );
}

export function WarningResultCard({ card }: { card: Extract<ResultCard, { type: "warning" }> }) {
  return (
    <div className="sgc-warnings">
      <div className="sgc-warning-title">
        <i className="bi bi-exclamation-triangle" /> Catatan
      </div>
      <p className="sgc-warning-item">{card.message}</p>
    </div>
  );
}

export function SuggestedActionResultCard({
  card,
  onSelect,
}: {
  card: Extract<ResultCard, { type: "suggested_action" }>;
  onSelect: (message: string) => void;
}) {
  return (
    <button type="button" className="sgc-chip sgc-suggested-action-chip" onClick={() => onSelect(card.message)}>
      {card.label}
    </button>
  );
}

/** Dispatches a ResultCard union member to its component. */
export function ResultCardView({ card, onSend }: { card: ResultCard; onSend: (message: string) => void }) {
  switch (card.type) {
    case "metric":
      return <MetricResultCard card={card} />;
    case "hotspot":
      return <HotspotResultCard card={card} onDetails={onSend} />;
    case "comparison":
      return <ComparisonResultCard card={card} />;
    case "warning":
      return <WarningResultCard card={card} />;
    case "suggested_action":
      return <SuggestedActionResultCard card={card} onSelect={onSend} />;
    default:
      return null;
  }
}

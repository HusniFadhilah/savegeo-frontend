import { useState } from "react";
import { bilingualCopy, useBilingualCopy } from "@/hooks/useBilingualCopy";
import { useI18nStore } from "@/hooks/useI18nStore";
import type { ChatSession } from "@/types/api";

interface Props {
  open: boolean;
  sessions: ChatSession[];
  error?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
  search: string;
  onSearchChange: (q: string) => void;
  activeSessionId: number | null;
  onSelect: (id: number) => void;
  onRename: (id: number, title: string) => void;
  onDelete: (id: number) => void;
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return bilingualCopy("Baru saja", "Just now");
  if (diff < 3600) {
    const n = Math.floor(diff / 60);
    return bilingualCopy(`${n} menit lalu`, `${n} minute${n === 1 ? "" : "s"} ago`);
  }
  if (diff < 86400) {
    const n = Math.floor(diff / 3600);
    return bilingualCopy(`${n} jam lalu`, `${n} hour${n === 1 ? "" : "s"} ago`);
  }
  if (diff < 604800) {
    const n = Math.floor(diff / 86400);
    return bilingualCopy(`${n} hari lalu`, `${n} day${n === 1 ? "" : "s"} ago`);
  }
  const language = useI18nStore.getState().language;
  return d.toLocaleDateString(language === "id" ? "id-ID" : "en-US", { day: "numeric", month: "short", year: "numeric" });
}

function SessionItem({
  session,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  session: ChatSession;
  active: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const c = useBilingualCopy();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.title);

  function commit() {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed && trimmed !== session.title) onRename(trimmed);
    else setDraft(session.title);
  }

  return (
    <div className={`sgc-session-item${active ? " active" : ""}`} onClick={editing ? undefined : onSelect}>
      <div className="sgc-session-info">
        {editing ? (
          <input
            className="sgc-session-rename-input"
            value={draft}
            maxLength={120}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setDraft(session.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <>
            <div className="sgc-session-title">{session.title}</div>
            <div className="sgc-session-meta">
              {relativeTime(session.updated_at)} &bull; {session.message_count} {c("pesan", "messages")}
            </div>
          </>
        )}
      </div>
      <button
        type="button"
        className="sgc-session-rename"
        title={c("Ganti nama", "Rename")}
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
      >
        <i className="bi bi-pencil" />
      </button>
      <button
        type="button"
        className="sgc-session-del"
        title={c("Hapus", "Delete")}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <i className="bi bi-trash" />
      </button>
    </div>
  );
}

export default function SessionSidebar({
  open,
  sessions,
  error,
  onRetry,
  retryLabel = "Retry",
  search,
  onSearchChange,
  activeSessionId,
  onSelect,
  onRename,
  onDelete,
}: Props) {
  const c = useBilingualCopy();
  const localizedRetryLabel = retryLabel === "Retry" ? c("Coba lagi", "Retry") : retryLabel;
  const filtered = search
    ? sessions.filter((s) => s.title.toLowerCase().includes(search.toLowerCase()))
    : sessions;

  return (
    <div id="sgc-session-panel" style={{ display: open ? "flex" : "none" }}>
      <div id="sgc-session-search-wrap">
        <i className="bi bi-search sgc-session-search-icon" />
        <input
          id="sgc-session-search"
          type="text"
          placeholder={c("Cari percakapan...", "Search conversations...")}
          autoComplete="off"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div id="sgc-session-list">
        {error && <div className="sgc-session-empty" role="alert">{error}{onRetry && <button type="button" onClick={onRetry}>{localizedRetryLabel}</button>}</div>}
        {!error && sessions.length === 0 && <div className="sgc-session-empty">{c("Belum ada percakapan tersimpan.", "No saved conversations yet.")}</div>}
        {sessions.length > 0 && filtered.length === 0 && (
          <div className="sgc-session-empty">{c("Tidak ada percakapan yang cocok.", "No matching conversations.")}</div>
        )}
        {filtered.map((s) => (
          <SessionItem
            key={s.id}
            session={s}
            active={s.id === activeSessionId}
            onSelect={() => onSelect(s.id)}
            onRename={(title) => onRename(s.id, title)}
            onDelete={() => onDelete(s.id)}
          />
        ))}
      </div>
    </div>
  );
}

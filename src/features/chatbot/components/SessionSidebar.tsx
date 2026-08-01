import { useState } from "react";
import type { ChatSession } from "@/types/api";

interface Props {
  open: boolean;
  sessions: ChatSession[];
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
  if (diff < 60) return "Baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
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
              {relativeTime(session.updated_at)} &bull; {session.message_count} pesan
            </div>
          </>
        )}
      </div>
      <button
        type="button"
        className="sgc-session-rename"
        title="Ganti nama"
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
        title="Hapus"
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
  search,
  onSearchChange,
  activeSessionId,
  onSelect,
  onRename,
  onDelete,
}: Props) {
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
          placeholder="Cari percakapan..."
          autoComplete="off"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div id="sgc-session-list">
        {sessions.length === 0 && <div className="sgc-session-empty">Belum ada percakapan tersimpan.</div>}
        {sessions.length > 0 && filtered.length === 0 && (
          <div className="sgc-session-empty">Tidak ada percakapan yang cocok.</div>
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

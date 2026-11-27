import type { ReactNode } from "react";
import { useBilingualCopy } from "@/hooks/useBilingualCopy";

interface BulkTableToolbarProps {
  selectedCount: number;
  onClear: () => void;
  children: ReactNode;
}

/** Shared toolbar shown whenever one or more rows are selected for a bulk action. */
export default function BulkTableToolbar({ selectedCount, onClear, children }: BulkTableToolbarProps) {
  const c = useBilingualCopy();
  if (selectedCount === 0) return null;
  return (
    <div className="admin-bulk-toolbar" role="toolbar" aria-label={c("Aksi massal", "Bulk actions")}>
      <strong>{selectedCount} {c("dipilih", "selected")}</strong>
      <div className="admin-bulk-toolbar-actions">{children}</div>
      <button type="button" className="btn-sm" onClick={onClear}>{c("Batalkan pilihan", "Clear selection")}</button>
    </div>
  );
}

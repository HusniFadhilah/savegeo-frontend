import type { ReactNode } from "react";

interface BulkTableToolbarProps {
  selectedCount: number;
  onClear: () => void;
  children: ReactNode;
}

/** Shared toolbar shown whenever one or more rows are selected for a bulk action. */
export default function BulkTableToolbar({ selectedCount, onClear, children }: BulkTableToolbarProps) {
  if (selectedCount === 0) return null;
  return (
    <div className="admin-bulk-toolbar" role="toolbar" aria-label="Aksi massal">
      <strong>{selectedCount} dipilih</strong>
      <div className="admin-bulk-toolbar-actions">{children}</div>
      <button type="button" className="btn-sm" onClick={onClear}>Batalkan pilihan</button>
    </div>
  );
}

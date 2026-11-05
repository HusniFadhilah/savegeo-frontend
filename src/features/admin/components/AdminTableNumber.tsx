interface AdminTableNumberCellProps {
  /** Zero-based row index within the current page. */
  index: number;
  /** Zero-based page number. */
  page?: number;
  pageSize?: number;
}

export function AdminTableNumberHeader() {
  return <th scope="col" className="admin-table-number">No.</th>;
}

export function AdminTableNumberCell({ index, page = 0, pageSize = 0 }: AdminTableNumberCellProps) {
  return <td className="admin-table-number">{page * pageSize + index + 1}</td>;
}

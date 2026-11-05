import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminUsers from "./AdminUsers";

const { tableState, notify } = vi.hoisted(() => ({
  tableState: {
    rows: [] as Array<{ id: number; username: string; full_name: string; email: null; role: string; is_active: boolean; created_at: null; last_login: null }>,
    loading: false,
    error: null as string | null,
    page: 0,
    pageCount: 3,
    pageSize: 10,
    recordsTotal: 22,
    recordsFiltered: 22,
    search: "",
    setSearch: vi.fn(),
    nextPage: vi.fn(),
    prevPage: vi.fn(),
  },
  notify: vi.fn(),
}));

vi.mock("@/hooks/useServerTable", () => ({ useServerTable: () => tableState }));
vi.mock("../AdminContext", () => ({ useAdmin: () => ({ notify }) }));
vi.mock("../api", () => ({
  createAdminUser: vi.fn(),
  deleteAdminUser: vi.fn(),
  getCurrentAdminUser: vi.fn().mockResolvedValue({ id: 99, role: null }),
  listRoles: vi.fn().mockResolvedValue({ roles: [] }),
  updateAdminUser: vi.fn(),
}));
vi.mock("@/hooks/useI18nStore", () => ({ useI18nStore: () => ({ language: "id", t: (key: string) => key }) }));
vi.mock("@/auth/access", () => ({ hasAdminPermission: () => false }));
vi.mock("@/hooks/useAuthStore", () => ({ useAuthStore: { setState: vi.fn() } }));
vi.mock("@/components/ui/TablePagination", () => ({ default: () => null }));

const user = (id: number) => ({
  id, username: `user${id}`, full_name: `User ${id}`, email: null, role: "admin",
  is_active: true, created_at: null, last_login: null,
});

function view() {
  return <MemoryRouter><AdminUsers /></MemoryRouter>;
}

describe("admin user table numbering", () => {
  beforeEach(() => {
    tableState.rows = [user(1), user(2)];
    tableState.loading = false;
    tableState.error = null;
    tableState.page = 0;
  });

  it("places numbers after selection and continues them on later pages", async () => {
    const { rerender } = render(view());
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Pilih user1" })).toBeEnabled());
    const header = screen.getByRole("columnheader", { name: "No." }) as HTMLTableCellElement;
    expect(header.cellIndex).toBe(1);
    expect(within(screen.getByRole("row", { name: /User 1/ })).getAllByRole("cell")[1]).toHaveTextContent("1");

    tableState.page = 1;
    tableState.rows = [user(11), user(12)];
    rerender(view());
    expect(within(screen.getByRole("row", { name: /User 11/ })).getAllByRole("cell")[1]).toHaveTextContent("11");
    expect(within(screen.getByRole("row", { name: /User 12/ })).getAllByRole("cell")[1]).toHaveTextContent("12");

    tableState.page = 0;
    tableState.rows = [user(12)];
    rerender(view());
    expect(within(screen.getByRole("row", { name: /User 12/ })).getAllByRole("cell")[1]).toHaveTextContent("1");
  });

  it("spans all eight columns for loading and empty states", () => {
    tableState.loading = true;
    const { rerender } = render(view());
    expect(screen.getByText("admin.loading")).toHaveAttribute("colspan", "8");
    tableState.loading = false;
    tableState.rows = [];
    rerender(view());
    expect(screen.getByText("admin.users.empty")).toHaveAttribute("colspan", "8");
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useI18nStore } from "@/hooks/useI18nStore";
import OrganizationsPage from "./OrganizationsPage";
import * as api from "./api";

vi.mock("@/components/layout/DashboardShell", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("./api", () => ({ listOrganizations: vi.fn(), listOrganizationMembers: vi.fn(), listInvitations: vi.fn(), createOrganization: vi.fn(), inviteMember: vi.fn(), acceptInvitation: vi.fn(), changeOrganizationMember: vi.fn(), revokeInvitation: vi.fn() }));
const org: api.Organization = { id: "org1", name: "UNDIP", role: "owner", revision: 1, personal: false };
beforeEach(() => {
  vi.resetAllMocks();
  useI18nStore.getState().setLanguage("id");
  vi.mocked(api.listOrganizations).mockResolvedValue([org]);
  vi.mocked(api.listOrganizationMembers).mockResolvedValue([{ id: "m1", principal_type: "admin", principal_id: 1, username: "owner", full_name: "Workspace Owner", role: "owner", is_active: true }]);
  vi.mocked(api.listInvitations).mockResolvedValue([]);
});
afterEach(cleanup);

it("renders member names and shows an invitation token only for delivery", async () => {
  vi.mocked(api.inviteMember).mockResolvedValue({ token: "private-delivery-token", invitation: { id: "i1", email: "bob@example.test", role: "member", expires_at: "2026-11-16T00:00:00Z", accepted_at: null, revoked_at: null } });
  render(<MemoryRouter><OrganizationsPage /></MemoryRouter>);
  expect(await screen.findByText("Workspace Owner")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "bob@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Undang" }));
  await waitFor(() => expect(api.inviteMember).toHaveBeenCalledWith("org1", "bob@example.test", "member"));
  expect(await screen.findByDisplayValue("private-delivery-token")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Sembunyikan" }));
  expect(screen.queryByDisplayValue("private-delivery-token")).not.toBeInTheDocument();
  expect(localStorage.getItem("private-delivery-token")).toBeNull();
});

it("refreshes membership before loading management-only data after self-demotion", async () => {
  render(<MemoryRouter><OrganizationsPage /></MemoryRouter>);
  await screen.findByText("Workspace Owner");
  vi.mocked(api.listOrganizations).mockResolvedValue([{ ...org, role: "member" }]);
  vi.mocked(api.changeOrganizationMember).mockResolvedValue(undefined);
  fireEvent.change(screen.getByLabelText("Peran owner"), { target: { value: "member" } });
  expect(await screen.findByText(/Anda anggota organisasi ini/)).toBeInTheDocument();
  expect(api.listOrganizationMembers).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "Undang" })).not.toBeInTheDocument();
});

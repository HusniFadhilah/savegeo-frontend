import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ProfilePage from "./ProfilePage";
import AdminProfile from "@/features/admin/components/AdminProfile";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";
import { useI18nStore } from "@/hooks/useI18nStore";
import { userAuthService } from "@/services/userAuthService";
import { updateAdminName, updateAdminProfile } from "@/features/admin/api";

vi.mock("@/hooks/useAuthStore", async () => {
  const { create } = await import("zustand");
  return { useAuthStore: create(() => ({ user: null, isAuthenticated: false })) };
});
vi.mock("@/hooks/useUserAuthStore", async () => {
  const { create } = await import("zustand");
  return { useUserAuthStore: create(() => ({ user: null, isAuthenticated: false })) };
});
vi.mock("@/services/userAuthService", () => ({ userAuthService: { updateProfile: vi.fn() } }));
vi.mock("@/features/admin/api", () => ({ updateAdminName: vi.fn(), updateAdminProfile: vi.fn() }));
vi.mock("@/features/admin/AdminContext", () => ({ useAdmin: () => ({ notify: vi.fn() }) }));
vi.mock("@/features/admin/components/PasswordChange", () => ({ default: () => null }));
vi.mock("@/components/layout/DashboardShell", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));

const member = { id: 4, username: "siti", email: "siti@example.test", full_name: "Siti", is_active: true, created_at: null, last_login: null };
beforeEach(() => {
  vi.clearAllMocks();
  useI18nStore.getState().setLanguage("id");
  useAuthStore.setState({ user: null, isAuthenticated: false });
  useUserAuthStore.setState({ user: member, isAuthenticated: true });
});
afterEach(cleanup);

describe("editable full names", () => {
  it("saves a member name and updates the session display without changing username", async () => {
    vi.mocked(userAuthService.updateProfile).mockResolvedValue({ message: "ok", user: { ...member, full_name: "Siti Nur Aini" } });
    render(<ProfilePage />);
    fireEvent.change(screen.getByLabelText("Nama lengkap"), { target: { value: "Siti Nur Aini" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan perubahan" }));
    await waitFor(() => expect(useUserAuthStore.getState().user?.full_name).toBe("Siti Nur Aini"));
    expect(userAuthService.updateProfile).toHaveBeenCalledWith("Siti Nur Aini");
    expect(screen.getByLabelText("Nama pengguna")).toHaveValue("siti");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("allows a viewer account to change its own display name", async () => {
    useAuthStore.setState({ user: { ...member, role: "viewer" }, isAuthenticated: true });
    vi.mocked(updateAdminName).mockResolvedValue({ message: "ok", user: { ...member, role: "viewer", full_name: "Siti Viewer" } });
    render(<ProfilePage />);
    fireEvent.change(screen.getByLabelText("Nama lengkap"), { target: { value: "Siti Viewer" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan perubahan" }));
    await waitFor(() => expect(useAuthStore.getState().user?.full_name).toBe("Siti Viewer"));
    expect(userAuthService.updateProfile).not.toHaveBeenCalled();
  });

  it("includes the full name when saving an admin profile", async () => {
    useAuthStore.setState({ user: member, isAuthenticated: true });
    vi.mocked(updateAdminProfile).mockResolvedValue({ message: "ok", user: { ...member, full_name: "Siti Admin" } });
    render(<MemoryRouter><AdminProfile /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Nama lengkap"), { target: { value: "  Siti Admin  " } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan perubahan" }));
    await waitFor(() => expect(updateAdminProfile).toHaveBeenCalledWith({ username: "siti", email: member.email, full_name: "Siti Admin" }));
    expect(useAuthStore.getState().user?.full_name).toBe("Siti Admin");
  });
});

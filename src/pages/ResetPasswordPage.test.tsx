import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ResetPasswordPage from "./ResetPasswordPage";
import { userAuthService } from "@/services/userAuthService";
import { authService } from "@/services/authService";
import { ApiError } from "@/services/apiClient";
import { useI18nStore } from "@/hooks/useI18nStore";
vi.mock("@/components/auth/LoginIllustration", () => ({ default: () => null }));
vi.mock("@/services/userAuthService", () => ({ userAuthService: { resetPassword: vi.fn() }, handleUserUnauthorized: vi.fn() }));
vi.mock("@/services/authService", () => ({ authService: { resetPassword: vi.fn() }, clearAuthToken: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); useI18nStore.getState().setLanguage("id"); });
afterEach(cleanup);
function open(kind: string) {
  render(<MemoryRouter initialEntries={[`/reset-password#token=dummy-test&${kind}`]}><ResetPasswordPage /></MemoryRouter>);
  const inputs = screen.getAllByDisplayValue("");
  fireEvent.change(inputs[0], { target: { value: "a-test-password" } });
  fireEvent.change(inputs[1], { target: { value: "a-test-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Simpan Kata Sandi Baru" }));
}
it("sends an admin reset only to the admin endpoint", async () => {
  vi.mocked(authService.resetPassword).mockResolvedValue({ message: "Password diperbarui" });
  open("kind=admin");
  await screen.findByText("Password diperbarui");
  expect(authService.resetPassword).toHaveBeenCalledOnce();
  expect(userAuthService.resetPassword).not.toHaveBeenCalled();
});
it("preserves a user reset failure without retrying as admin", async () => {
  vi.mocked(userAuthService.resetPassword).mockRejectedValue(new ApiError("Token kedaluwarsa", 401));
  open("kind=user");
  await screen.findByText("Token kedaluwarsa");
  expect(authService.resetPassword).not.toHaveBeenCalled();
});
it("requires an explicit supported account kind", async () => {
  open("kind=other");
  await waitFor(() => expect(screen.getByText(/Minta tautan/)).toBeInTheDocument());
  expect(userAuthService.resetPassword).not.toHaveBeenCalled();
  expect(authService.resetPassword).not.toHaveBeenCalled();
});

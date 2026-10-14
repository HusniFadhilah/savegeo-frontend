// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import ResetPasswordPage from "./ResetPasswordPage";
import { userAuthService } from "@/services/userAuthService";

vi.mock("@/components/auth/LoginIllustration", () => ({ default: () => null }));
vi.mock("@/services/userAuthService", () => ({ userAuthService: { resetPassword: vi.fn() } }));
vi.mock("@/services/authService", () => ({ authService: { resetPassword: vi.fn() } }));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="address">{location.pathname + location.search + location.hash}</output>;
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("reset link token privacy", () => {
  it.each(["#token=private-reset-token", "?token=private-reset-token"])(
    "scrubs %s from the address while preserving it for the reset request",
    async (suffix) => {
      vi.mocked(userAuthService.resetPassword).mockResolvedValue({ message: "Password updated" });
      const { container } = render(
        <MemoryRouter initialEntries={[`/reset-password${suffix}`]}>
          <ResetPasswordPage /><LocationProbe />
        </MemoryRouter>,
      );
      await waitFor(() => expect(screen.getByTestId("address").textContent).toBe("/reset-password"));
      const inputs = container.querySelectorAll('input[type="password"]');
      fireEvent.change(inputs[0], { target: { value: "new-password-123" } });
      fireEvent.change(inputs[1], { target: { value: "new-password-123" } });
      fireEvent.submit(container.querySelector("form")!);
      await waitFor(() => expect(userAuthService.resetPassword).toHaveBeenCalledWith("private-reset-token", "new-password-123"));
      await screen.findByText("Password updated");
      expect(screen.getByTestId("address").textContent).not.toContain("token");
    },
  );
});

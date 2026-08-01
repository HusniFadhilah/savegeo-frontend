import { createContext, useContext } from "react";

export type ToastType = "s" | "e" | "i";

export interface AdminContextValue {
  /** Ephemeral top-right notification, mirrors legacy admin-scripts.js's toast(). */
  notify: (message: string, type?: ToastType) => void;
  /** Re-checks GET /api/health and updates the topbar Earth Engine badge. */
  refreshHealth: () => void;
  eeInitialized: boolean | null;
}

export const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminDashboard");
  return ctx;
}

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiClient } from "@/services/apiClient";
import RegisterUserPage from "@/pages/RegisterUserPage";

export default function RegistrationRoute() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void apiClient.get<{ registration_enabled: boolean }>("/auth/config", { signal: controller.signal })
      .then((config) => { if (!controller.signal.aborted) setEnabled(config.registration_enabled === true); })
      .catch(() => { if (!controller.signal.aborted) setEnabled(false); });
    return () => controller.abort();
  }, []);
  if (enabled === null) return <div role="status" aria-busy="true" className="p-4"><span className="spinner-border" aria-hidden="true" /></div>;
  return enabled ? <RegisterUserPage /> : <Navigate to="/login" replace />;
}

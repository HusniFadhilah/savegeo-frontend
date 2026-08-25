import { useAuthStore } from "@/hooks/useAuthStore";
import LoginPage from "@/pages/LoginPage";
import AdminDashboard from "@/features/admin/AdminDashboard";
import { DEFAULT_ADMIN_SECTION } from "@/routes/adminSectionRoutes";
import type { AdminSection } from "@/features/admin/types";

export default function AdminPage({ section = DEFAULT_ADMIN_SECTION }: { section?: AdminSection }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <AdminDashboard section={section} />;
}

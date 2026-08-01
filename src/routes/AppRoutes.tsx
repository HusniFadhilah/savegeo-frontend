import { Routes, Route } from "react-router-dom";
import DashboardPage from "@/pages/DashboardPage";
import AdminPage from "@/pages/AdminPage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<DashboardPage />} />
    </Routes>
  );
}

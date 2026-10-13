import AppRoutes from "@/routes/AppRoutes";
import LoadingOverlay from "@/components/layout/LoadingOverlay";
import ChatWidget from "@/features/chatbot/ChatWidget";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";
import { useLocation } from "react-router-dom";

export default function App() {
  const location = useLocation();
  const isAdminAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isUserAuthenticated = useUserAuthStore((state) => state.isAuthenticated);
  const adminId = useAuthStore((state) => state.user?.id);
  const userId = useUserAuthStore((state) => state.user?.id);
  const chatPrincipal = `${isAdminAuthenticated ? adminId : ""}:${isUserAuthenticated ? userId : ""}`;

  return (
    <>
      <AppRoutes />
      <LoadingOverlay />
      {location.pathname !== "/" && (isAdminAuthenticated || isUserAuthenticated) && <ChatWidget key={chatPrincipal} />}
    </>
  );
}

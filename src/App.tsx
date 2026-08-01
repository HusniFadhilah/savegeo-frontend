import AppRoutes from "@/routes/AppRoutes";
import LoadingOverlay from "@/components/layout/LoadingOverlay";
import ChatWidget from "@/features/chatbot/ChatWidget";

export default function App() {
  return (
    <>
      <AppRoutes />
      <LoadingOverlay />
      <ChatWidget />
    </>
  );
}

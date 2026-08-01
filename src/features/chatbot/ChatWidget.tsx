import "./chatbot.css";
import ChatToggleButton from "./components/ChatToggleButton";
import ChatHeader from "./components/ChatHeader";
import SessionSidebar from "./components/SessionSidebar";
import MessageList from "./components/MessageList";
import QuickActionChips from "./components/QuickActionChips";
import ChatInputArea from "./components/ChatInputArea";
import { useChatSession } from "./hooks/useChatSession";

/**
 * Floating SaveGeo Assistant chat widget - React port of
 * frontend-nextjs2/public/savegeo-chatbot.js. Mounted once, globally, in
 * App.tsx. All state/behavior lives in useChatSession(); this component is
 * pure composition/layout.
 */
export default function ChatWidget() {
  const chat = useChatSession();

  return (
    <>
      <ChatToggleButton onClick={chat.toggle} hasUnread={chat.hasUnread} />
      <div id="sgc-panel" className={chat.isOpen ? "sgc-open" : undefined}>
        <ChatHeader
          status={chat.status}
          onHistoryClick={chat.toggleSessionPanel}
          onNewChatClick={chat.newChat}
          onCloseClick={chat.close}
        />
        <SessionSidebar
          open={chat.sessionPanelOpen}
          sessions={chat.sessions}
          search={chat.sessionSearch}
          onSearchChange={chat.setSessionSearch}
          activeSessionId={chat.sessionId}
          onSelect={chat.openSession}
          onRename={chat.renameSession}
          onDelete={chat.deleteSession}
        />
        <MessageList
          log={chat.log}
          onCancelLoading={chat.cancelLoading}
          onRetryLoading={chat.retryLoadingNow}
          onRetryChip={chat.retryFromChip}
          onRunConfirm={chat.runConfirmCard}
          onCancelConfirm={chat.cancelConfirmCard}
          onSelectChoice={chat.selectChoice}
          onResolveAoiOffer={chat.resolveAoiOffer}
        />
        <QuickActionChips actions={chat.quickActions} onSelect={(msg) => chat.sendMessage(msg, { prefill: true })} />
        <ChatInputArea
          pendingImage={chat.pendingImage}
          pendingFile={chat.pendingFile}
          onClearImage={chat.clearPendingImage}
          onClearFile={chat.clearPendingFile}
          onCameraClick={chat.handleCameraClick}
          cameraBusy={chat.cameraBusy}
          onFileSelected={chat.handleFileSelected}
          fileAccept={chat.fileInputAccept}
          onSend={(text) => chat.sendMessage(text)}
        />
      </div>
    </>
  );
}

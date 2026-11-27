import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useBilingualCopy } from "@/hooks/useBilingualCopy";
import type { PendingFileAttachment } from "../types";

interface Props {
  pendingImage: string | null;
  pendingFile: PendingFileAttachment | null;
  onClearImage: () => void;
  onClearFile: () => void;
  onCameraClick: () => void;
  cameraBusy: boolean;
  onFileSelected: (file: File) => void;
  fileAccept: string;
  onSend: (text: string) => void;
}

export default function ChatInputArea({
  pendingImage,
  pendingFile,
  onClearImage,
  onClearFile,
  onCameraClick,
  cameraBusy,
  onFileSelected,
  fileAccept,
  onSend,
}: Props) {
  const c = useBilingualCopy();
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const placeholder = pendingImage
    ? c("Tambahkan pertanyaan tentang gambar ini...", "Ask a question about this image...")
    : pendingFile
      ? c("Tambahkan pertanyaan tentang file ini...", "Ask a question about this file...")
      : c("Tanyakan sesuatu atau minta analisis...", "Ask a question or request an analysis...");

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  function handleSendClick() {
    const value = text.trim();
    if (!value && !pendingImage && !pendingFile) return;
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    onSend(value);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (file) onFileSelected(file);
  }

  return (
    <>
      {pendingImage && (
        <div id="sgc-img-preview-bar">
          <div className="sgc-img-preview-inner">
            <img src={`data:image/png;base64,${pendingImage}`} className="sgc-img-thumb" alt={c("Pratinjau gambar", "Image preview")} />
            <div className="sgc-img-preview-label">
              <i className="bi bi-map me-1" />
              {c("Gambar siap dikirim", "Image ready to send")}
            </div>
            <button type="button" className="sgc-img-clear" title={c("Hapus gambar", "Remove image")} onClick={onClearImage}>
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </div>
      )}
      {pendingFile && (
        <div id="sgc-file-preview-bar">
          <div className="sgc-file-preview-inner">
            <i className={`bi ${pendingFile.icon} sgc-file-icon`} />
            <div className="sgc-file-meta">
              <span className="sgc-file-name">{pendingFile.name}</span>
              <span className="sgc-file-size">{pendingFile.size_label}</span>
            </div>
            <button type="button" className="sgc-img-clear" title={c("Hapus lampiran", "Remove attachment")} onClick={onClearFile}>
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </div>
      )}
      <div id="sgc-input-area">
        <button type="button" id="sgc-camera" title={c("Ambil tangkapan layar peta", "Take a map screenshot")} disabled={cameraBusy} onClick={onCameraClick}>
          <i className={`bi ${cameraBusy ? "bi-arrow-repeat sgc-spin" : "bi-camera"}`} />
        </button>
        <button
          type="button"
          id="sgc-attach"
          title={c("Lampirkan file (gambar, PDF, CSV, TXT)", "Attach a file (image, PDF, CSV, TXT)")}
          onClick={() => fileInputRef.current?.click()}
        >
          <i className="bi bi-paperclip" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          id="sgc-file-input"
          accept={fileAccept}
          style={{ display: "none" }}
          onChange={handleFileInputChange}
        />
        <textarea
          ref={textareaRef}
          id="sgc-input"
          placeholder={placeholder}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            autoResize();
          }}
          onKeyDown={handleKeyDown}
        />
        <button type="button" id="sgc-send" title={c("Kirim", "Send")} onClick={handleSendClick}>
          <i className="bi bi-send" />
        </button>
      </div>
    </>
  );
}

import { useState, type FormEvent } from "react";
import { downloadWorkspace, uploadDocument } from "./api";
import { Field } from "./shared";
import { errorMessage, number, useCopy } from "./helpers";
import type { IntegrityDocument } from "./types";

export default function DocumentsPanel({
  projectId,
  documents,
  canWrite,
  onChanged,
}: {
  projectId: string;
  documents: IntegrityDocument[];
  canWrite: boolean;
  onChanged: () => Promise<void>;
}) {
  const c = useCopy();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await uploadDocument(projectId, file);
      await onChanged();
      setNotice(
        c(
          "Dokumen tersimpan. Salin rujukannya ke kolom bukti.",
          "Document saved. Copy its reference into an evidence field.",
        ),
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function download(document: IntegrityDocument) {
    setBusy(true);
    setError("");
    try {
      await downloadWorkspace(projectId, document);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="integrity-note">
        {c(
          "Dokumen hanya dapat diakses anggota proyek dengan izin telaah. Gunakan rujukan document:ID untuk menautkan bukti ke penilaian. Simpan dokumen pribadi pelapor secara terpisah dari ringkasan pengaduan.",
          "Documents are accessible only to project members with review access. Use document:ID to link evidence to assessments. Keep complainants' personal records separate from grievance summaries.",
        )}
      </p>
      {canWrite ? (
        <form className="integrity-editor" onSubmit={(event) => void upload(event)}>
          <Field
            label={c("Unggah dokumen bukti", "Upload evidence document")}
            hint="PDF, DOCX, XLSX, TXT, CSV, PNG, JPEG · ≤ 5 MB · 50 MB/project"
          >
            <input
              type="file"
              required
              accept=".pdf,.docx,.xlsx,.txt,.csv,.png,.jpg,.jpeg"
              className="form-control"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </Field>
          <button className="btn btn-success" disabled={busy} type="submit">
            {c("Unggah dokumen", "Upload document")}
          </button>
        </form>
      ) : null}
      {notice ? (
        <p role="status" className="alert alert-success">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      ) : null}
      <div className="integrity-document-list">
        {documents.length ? (
          documents.map((document) => (
            <article className="integrity-record" key={document.id}>
              <div className="integrity-record-head">
                <h3>
                  <i className="bi bi-file-earmark-text" aria-hidden="true" /> {document.filename}
                </h3>
                <button
                  type="button"
                  className="btn btn-outline-success btn-sm"
                  disabled={busy}
                  onClick={() => void download(document)}
                >
                  {c("Unduh", "Download")}
                </button>
              </div>
              <p className="integrity-note">
                {number(document.size_bytes / 1024)} KB ·{" "}
                {new Date(document.created_at).toLocaleString()}
              </p>
              <Field label={c("Rujukan bukti", "Evidence reference")}>
                <input
                  readOnly
                  className="form-control"
                  value={`document:${document.id}`}
                  onFocus={(e) => e.target.select()}
                />
              </Field>
              <details>
                <summary>SHA-256</summary>
                <code className="integrity-hash">{document.sha256}</code>
              </details>
            </article>
          ))
        ) : (
          <p className="integrity-empty">
            {c("Belum ada dokumen bukti.", "No evidence documents yet.")}
          </p>
        )}
      </div>
    </>
  );
}

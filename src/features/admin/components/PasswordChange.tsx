import { useState } from "react";
import { changePassword } from "../api";
import { useAdmin } from "../AdminContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Fully controlled — the "Ganti password" trigger button lives in the
 * caller (AdminUsers' table row), the form renders wherever the caller
 * places this component (below the table, matching legacy #pw-form). */
export default function PasswordChange({ open, onOpenChange }: Props) {
  const { notify } = useAdmin();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setOldPw("");
    setNewPw("");
    setConfirmPw("");
    setError(null);
  };

  const handleSave = async () => {
    if (!oldPw || !newPw) {
      setError("Semua field wajib diisi");
      return;
    }
    if (newPw.length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }
    if (newPw !== confirmPw) {
      setError("Password baru tidak cocok");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await changePassword(oldPw, newPw);
      notify("Password berhasil diubah", "s");
      reset();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal ganti password";
      setError(msg);
      notify(msg, "e");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`collapse-form ${open ? "open" : ""}`} style={{ marginTop: "0.5rem" }}>
        <div style={{ maxWidth: 320 }}>
          <div className="form-field">
            <label className="form-label">Password lama</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Password baru (min. 8 karakter)</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Konfirmasi password baru</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
            />
          </div>
          {error && <div className="alert alert-danger py-1 px-2 small">{error}</div>}
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="btn-sm primary" disabled={saving} onClick={handleSave}>
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
            <button
              type="button"
              className="btn-sm"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Batal
            </button>
          </div>
        </div>
      </div>
  );
}

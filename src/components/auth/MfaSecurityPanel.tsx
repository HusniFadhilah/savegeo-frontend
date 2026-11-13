import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useI18nStore } from "@/hooks/useI18nStore";
import { authService } from "@/services/authService";

export default function MfaSecurityPanel() {
  const user = useAuthStore((state) => state.user);
  const en = useI18nStore((state) => state.language === "en");
  const tr = (id: string, english: string) => (en ? english : id);
  const navigate = useNavigate();
  const [mode, setMode] = useState<"step-up" | "recovery" | "reset">("step-up");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "step-up") {
        await authService.stepUpMfa(code.trim());
        setMessage(
          tr(
            "Verifikasi berhasil. Tindakan sensitif tersedia selama lima menit.",
            "Verified. Sensitive operations are available for five minutes.",
          ),
        );
      } else if (mode === "recovery") {
        const result = await authService.regenerateMfaRecovery(password, code.trim());
        setCodes(result.recovery_codes);
      } else {
        await authService.resetMfa(password, code.trim());
        useAuthStore.setState({
          user: null,
          isAuthenticated: false,
          mfaChallenge: null,
          recoveryCodes: [],
          error: null,
        });
        navigate("/admin/login", { replace: true });
      }
      setPassword("");
      setCode("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : tr("Verifikasi gagal.", "Verification failed."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card mt-3">
      <div className="card-header-custom">
        <span>
          <i className="bi bi-shield-check me-2" aria-hidden="true" />
          {tr("Verifikasi dua langkah", "Two-step verification")}
        </span>
      </div>
      <div className="card-body-custom">
        {!user?.mfa_enabled ? (
          <p className="text-body-secondary mb-0">
            {tr(
              "MFA belum terdaftar. Akun dengan kebijakan MFA wajib akan diminta mendaftarkan authenticator saat login berikutnya.",
              "MFA is not enrolled. Accounts covered by mandatory MFA will enroll an authenticator at their next login.",
            )}
          </p>
        ) : codes.length > 0 ? (
          <>
            <p>
              {tr(
                "Kode baru ditampilkan sekali dan menggantikan seluruh kode lama. Simpan secara privat.",
                "New codes are shown once and replace all previous codes. Store them privately.",
              )}
            </p>
            <div className="row g-2 mb-3">
              {codes.map((item) => (
                <div key={item} className="col-sm-6">
                  <code className="d-block border rounded p-2 text-body">{item}</code>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-success" onClick={() => setCodes([])}>
              {tr("Sudah saya simpan", "I have saved them")}
            </button>
          </>
        ) : (
          <form onSubmit={(event) => void submit(event)}>
            <label htmlFor="mfa-security-action" className="form-label">
              {tr("Tindakan", "Action")}
            </label>
            <select
              id="mfa-security-action"
              className="form-select mb-3"
              value={mode}
              disabled={busy}
              onChange={(event) => {
                setMode(event.target.value as typeof mode);
                setPassword("");
                setCode("");
                setError("");
                setMessage("");
              }}
            >
              <option value="step-up">
                {tr("Verifikasi ulang tindakan sensitif", "Verify for sensitive operations")}
              </option>
              <option value="recovery">
                {tr("Buat ulang kode pemulihan", "Regenerate recovery codes")}
              </option>
              <option value="reset">
                {tr(
                  "Ganti authenticator dan cabut seluruh sesi",
                  "Reset authenticator and revoke all sessions",
                )}
              </option>
            </select>
            {mode === "reset" && (
              <p className="small text-body-secondary">
                {tr(
                  "Setelah reset, seluruh sesi dihentikan. Masuk kembali dan daftarkan authenticator baru bila diwajibkan kebijakan akun.",
                  "Reset ends every session. Sign in again and enroll a new authenticator if your account policy requires it.",
                )}
              </p>
            )}
            {mode !== "step-up" && (
              <div className="mb-3">
                <label htmlFor="mfa-security-password" className="form-label">
                  Password
                </label>
                <input
                  id="mfa-security-password"
                  className="form-control"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            )}
            <label htmlFor="mfa-security-code" className="form-label">
              {tr(
                "Kode authenticator atau pemulihan yang belum dipakai",
                "Unused authenticator or recovery code",
              )}
            </label>
            <input
              id="mfa-security-code"
              className="form-control mb-3"
              required
              autoComplete="one-time-code"
              maxLength={64}
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            {error && (
              <div className="alert alert-danger" role="alert">
                {error}
              </div>
            )}
            {message && (
              <div className="alert alert-success" role="status">
                {message}
              </div>
            )}
            <button
              type="submit"
              className={`btn ${mode === "reset" ? "btn-outline-danger" : "btn-success"}`}
              disabled={busy}
            >
              {busy ? tr("Memproses…", "Processing…") : tr("Lanjutkan", "Continue")}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

import { useBilingualCopy } from "@/hooks/useBilingualCopy";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/hooks/useAuthStore";
import LoginIllustration from "@/components/auth/LoginIllustration";
import MfaLoginPanel from "@/components/auth/MfaLoginPanel";
import { ApiError } from "@/services/apiClient";
import { authService } from "@/services/authService";

export default function LoginPage() {
  const c = useBilingualCopy();
  const { login, isLoading, error, mfaChallenge, recoveryCodes } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await login(username, password);
    if (useAuthStore.getState().mfaChallenge) setPassword("");
  };

  const handleForgotSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setResetMessage(null);
    setResetError(null);
    if (!resetIdentifier.trim()) {
      setResetError(c("Masukkan email atau nama pengguna admin.", "Enter the admin email or username."));
      return;
    }
    setResetLoading(true);
    try {
      const res = await authService.forgotPassword(resetIdentifier.trim());
      setResetMessage(res.message);
    } catch (err) {
      setResetError(err instanceof ApiError ? err.message : c("Gagal mengirim email untuk mengatur ulang kata sandi.", "Could not send the password reset email."));
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-illust-side">
        <div className="login-illust-content">
          <LoginIllustration
            ariaLabel={c("Ilustrasi bumi untuk pemantauan karbon berbasis satelit", "Earth illustration for satellite-based carbon monitoring")}
            cards={[
              { kicker: "NDVI", note: "vegetasi stabil" },
              { kicker: c("Karbon", "Carbon"), note: c("tren meningkat", "rising trend") },
              { kicker: "AOI", note: c("area aktif", "active area") },
            ]}
          />
          <h2>SAVEGEO</h2>
          <p>{c("Pemantauan stok karbon berbasis citra satelit dan pembelajaran mesin.", "Satellite imagery and machine learning for carbon stock monitoring.")}</p>
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-card">
          <div className="text-center mb-4">
            <Link to="/">
              <img src="/logo.jpg" alt="SAVEGEO" height={56} className="mb-2 rounded" />
            </Link>
            <h5 className="mb-0">{c("Admin SAVEGEO", "SAVEGEO Admin")}</h5>
            <small className="text-muted">{c("Masuk untuk mengelola sistem", "Sign in to manage the system")}</small>
          </div>
          {mfaChallenge || recoveryCodes.length > 0 ? <MfaLoginPanel /> : forgotMode ? (
            <form onSubmit={handleForgotSubmit}>
              <div className="reset-password-callout mb-3">
                <i className="bi bi-shield-lock" />
                <div>
                  <strong>{c("Atur ulang akses admin", "Reset admin access")}</strong>
                  <span>{c("Tautan pengaturan ulang akan dikirim ke email admin yang terdaftar.", "A reset link will be sent to the registered admin email.")}</span>
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label small">{c("Email atau nama pengguna", "Email or username")}</label>
                <input
                  type="text"
                  className="form-control"
                  value={resetIdentifier}
                  onChange={(e) => setResetIdentifier(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              {resetError && <div className="alert alert-danger py-2 px-2 small">{resetError}</div>}
              {resetMessage && <div className="alert alert-success py-2 px-2 small">{resetMessage}</div>}
              <button type="submit" className="btn btn-primary w-100" disabled={resetLoading}>
                {resetLoading ? c("Mengirim...", "Sending...") : c("Kirim Tautan Pengaturan Ulang", "Send Reset Link")}
              </button>
              <div className="text-center mt-3 small">
                <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => setForgotMode(false)}>
                  {c("Kembali ke halaman masuk", "Back to sign in")}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label small">{c("Nama pengguna", "Username")}</label>
                <input
                  type="text"
                  className="form-control"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label small">{c("Kata sandi", "Password")}</label>
                <div className="position-relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="form-control pe-5"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="btn bg-white border-0 p-0 position-absolute top-50 end-0 translate-middle-y me-3 text-secondary"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? c("Sembunyikan kata sandi", "Hide password") : c("Tampilkan kata sandi", "Show password")}
                  >
                    <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} />
                  </button>
                </div>
              </div>
              {error && <div className="alert alert-danger py-2 px-2 small">{error}</div>}
              <button type="submit" className="btn btn-primary w-100" disabled={isLoading}>
                {isLoading ? c("Memproses...", "Signing in...") : c("Masuk", "Sign in")}
              </button>
              <div className="text-center mt-3 small">
                <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => setForgotMode(true)}>
                  {c("Lupa kata sandi?", "Forgot password?")}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

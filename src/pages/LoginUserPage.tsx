import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";
import LoginIllustration from "@/components/auth/LoginIllustration";
import { ApiError } from "@/services/apiClient";
import { userAuthService } from "@/services/userAuthService";

interface Props {
  /** AppRoutes.tsx only adds the 2 list/dashboard routes (no separate
   * `/register` route per the file boundary), so switching to the register
   * form is a local view toggle inside the same gate, not navigation - the
   * gate wrapper passes this in; omit it to render as a standalone page with
   * no toggle link. */
  onSwitchToRegister?: () => void;
}

/**
 * Visual twin of `pages/LoginPage.tsx` (admin), for the public-facing
 * Disaster Intelligence Dashboard login. Kept as its own component/route
 * (not a shared `<LoginForm audience="user">`) so admin and user auth stay
 * fully decoupled per the redesign contract doc.
 */
export default function LoginUserPage({ onSwitchToRegister }: Props) {
  const { login, isLoading, error } = useUserAuthStore();
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
  };

  const handleForgotSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setResetMessage(null);
    setResetError(null);
    if (!resetIdentifier.trim()) {
      setResetError("Masukkan email atau username akun.");
      return;
    }
    setResetLoading(true);
    try {
      const res = await userAuthService.forgotPassword(resetIdentifier.trim());
      setResetMessage(res.message);
    } catch (err) {
      setResetError(err instanceof ApiError ? err.message : "Gagal mengirim email reset password.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-illust-side">
        <div className="login-illust-content">
          <LoginIllustration
            ariaLabel="Visual bumi realistis untuk pemantauan dampak bencana satelit"
            cards={[
              { kicker: "Banjir", note: "area terdampak" },
              { kicker: "Longsor", note: "titik rawan" },
              { kicker: "Dampak", note: "wilayah terpantau" },
            ]}
          />
          <h2>SAVEGEO</h2>
          <p>Dashboard Intelijen Bencana &mdash; pemantauan dampak bencana berbasis citra satelit.</p>
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-card">
          <div className="text-center mb-4">
            <Link to="/">
              <img src="/logo.jpg" alt="SAVEGEO" height={56} className="mb-2 rounded" />
            </Link>
            <h5 className="mb-0">Pemetaan Bencana</h5>
            <small className="text-muted">Masuk untuk melihat dashboard intelijen bencana</small>
          </div>
          {forgotMode ? (
            <form onSubmit={handleForgotSubmit}>
              <div className="reset-password-callout mb-3">
                <i className="bi bi-envelope-check" />
                <div>
                  <strong>Kirim link reset</strong>
                  <span>Link aman akan dikirim ke email yang terdaftar pada akun Anda.</span>
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label small">Email atau username</label>
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
                {resetLoading ? "Mengirim..." : "Kirim Link Reset"}
              </button>
              <div className="text-center mt-3 small">
                <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => setForgotMode(false)}>
                  Kembali ke login
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label small">Username</label>
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
                <label className="form-label small">Password</label>
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
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} />
                  </button>
                </div>
              </div>
              {error && <div className="alert alert-danger py-2 px-2 small">{error}</div>}
              <button type="submit" className="btn btn-primary w-100 mt-2" disabled={isLoading}>
                {isLoading ? "Memproses..." : "Login"}
              </button>
              <div className="d-flex justify-content-center gap-2 mt-3 small">
                <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => setForgotMode(true)}>
                  Lupa password?
                </button>
                {onSwitchToRegister && (
                  <>
                    <span className="text-muted">·</span>
                    {/* <button type="button" className="btn btn-link p-0 align-baseline" onClick={onSwitchToRegister}>
                      Daftar
                    </button> */}
                  </>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

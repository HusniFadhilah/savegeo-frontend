import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";

interface Props {
  /** See `LoginUserPage.tsx`'s matching prop doc - local view toggle, not a route. */
  onSwitchToLogin?: () => void;
}

/**
 * Visual twin of `pages/LoginPage.tsx` (admin), registration variant for the
 * new public `users` table. `POST /auth/register` per the redesign contract
 * doc requires `password` min 8 chars (backend returns 400 otherwise) -
 * mirrored here as a client-side hint only, the backend remains the source
 * of truth for validation.
 */
export default function RegisterUserPage({ onSwitchToLogin }: Props) {
  const { register, isLoading, error } = useUserAuthStore();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (password.length < 8) {
      setLocalError("Password minimal 8 karakter.");
      return;
    }
    await register(username, email, password);
  };

  return (
    <div className="login-page">
      <div className="login-illust-side">
        <div className="login-illust-content">
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
            <h5 className="mb-0">Daftar Akun</h5>
            <small className="text-muted">Buat akun untuk mengakses dashboard intelijen bencana</small>
          </div>
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
              <label className="form-label small">Email</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
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
                  autoComplete="new-password"
                  minLength={8}
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
              <small className="text-muted">Minimal 8 karakter.</small>
            </div>
            {(localError || error) && <div className="alert alert-danger py-2 px-2 small">{localError || error}</div>}
            <button type="submit" className="btn btn-primary w-100" disabled={isLoading}>
              {isLoading ? "Memproses..." : "Daftar"}
            </button>
            {onSwitchToLogin && (
              <div className="text-center mt-3 small">
                Sudah punya akun?{" "}
                <button type="button" className="btn btn-link p-0 align-baseline" onClick={onSwitchToLogin}>
                  Login
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

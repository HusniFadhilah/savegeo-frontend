import { useBilingualCopy } from "@/hooks/useBilingualCopy";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import LoginIllustration from "@/components/auth/LoginIllustration";
import { ApiError } from "@/services/apiClient";
import { authService } from "@/services/authService";
import { userAuthService } from "@/services/userAuthService";

export default function ResetPasswordPage() {
  const c = useBilingualCopy();
  const location = useLocation();
  const navigate = useNavigate();
  const [kind] = useState(() => {
    const value = new URLSearchParams(location.hash.slice(1)).get("kind")
      ?? new URLSearchParams(location.search).get("kind");
    return value === "admin" || value === "user" ? value : null;
  });
  const [token, setToken] = useState(() =>
    new URLSearchParams(location.hash.slice(1)).get("token") ||
    new URLSearchParams(location.search).get("token") || "",
  );
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const fragment = new URLSearchParams(location.hash.slice(1));
    if (!query.has("token") && !fragment.has("token")) return;
    query.delete("token");
    fragment.delete("token");
    navigate({
      pathname: location.pathname,
      search: query.size ? `?${query}` : "",
      hash: fragment.size ? `#${fragment}` : "",
    }, { replace: true });
  }, [location.pathname, location.search, location.hash, navigate]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (!token || !kind) {
      setError(c("Tautan pengaturan ulang tidak valid. Minta tautan pemulihan yang baru.", "This password reset link is invalid. Request a new recovery link."));
      return;
    }
    if (password.length < 8) {
      setError(c("Kata sandi baru minimal 8 karakter.", "The new password must be at least 8 characters."));
      return;
    }
    if (password !== confirm) {
      setError(c("Konfirmasi kata sandi belum cocok.", "The password confirmation does not match."));
      return;
    }

    setLoading(true);
    try {
      const res = kind === "admin"
        ? await authService.resetPassword(token, password)
        : await userAuthService.resetPassword(token, password);
      setMessage(res.message);
      setToken("");
      setPassword("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : c("Gagal memperbarui kata sandi.", "Could not update the password."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-illust-side">
        <div className="login-illust-content">
          <LoginIllustration
            ariaLabel={c("Ilustrasi keamanan akun SAVEGEO", "SAVEGEO account security illustration")}
            cards={[
              { kicker: c("Token", "Token"), note: c("30 menit", "30 minutes") },
              { kicker: c("Akun", "Account"), note: c("terverifikasi", "verified") },
              { kicker: c("Akses", "Access"), note: c("dipulihkan", "restored") },
            ]}
          />
          <h2>SAVEGEO</h2>
          <p>{c("Buat kata sandi baru untuk melanjutkan pemantauan geospasial dengan aman.", "Set a new password to continue using geospatial monitoring securely.")}</p>
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-card">
          <div className="text-center mb-4">
            <Link to="/">
              <img src="/logo.jpg" alt="SAVEGEO" height={56} className="mb-2 rounded" />
            </Link>
            <h5 className="mb-0">{c("Atur Ulang Kata Sandi", "Reset Password")}</h5>
            <small className="text-muted">{c("Masukkan kata sandi baru untuk akun Anda", "Enter a new password for your account")}</small>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label small">{c("Kata sandi baru", "New password")}</label>
              <div className="position-relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-control pe-5"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
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
            <div className="mb-3">
              <label className="form-label small">{c("Konfirmasi kata sandi", "Confirm password")}</label>
              <input
                type={showPassword ? "text" : "password"}
                className="form-control"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            {error && <div className="alert alert-danger py-2 px-2 small">{error}</div>}
            {message && <div className="alert alert-success py-2 px-2 small">{message}</div>}
            <button type="submit" className="btn btn-primary w-100" disabled={loading}>
              {loading ? c("Menyimpan...", "Saving...") : c("Simpan Kata Sandi Baru", "Save New Password")}
            </button>
            <div className="text-center mt-3 small">
              <Link to="/login">{c("Kembali ke halaman masuk", "Back to sign in")}</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

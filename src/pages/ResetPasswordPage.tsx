import { useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import LoginIllustration from "@/components/auth/LoginIllustration";
import { ApiError } from "@/services/apiClient";
import { authService } from "@/services/authService";
import { userAuthService } from "@/services/userAuthService";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") || "", [params]);
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
    if (!token) {
      setError("Link reset password tidak valid atau token tidak ditemukan.");
      return;
    }
    if (password.length < 8) {
      setError("Password baru minimal 8 karakter.");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi password belum sama.");
      return;
    }

    setLoading(true);
    try {
      let res: { message: string };
      try {
        res = await userAuthService.resetPassword(token, password);
      } catch (userErr) {
        if (!(userErr instanceof ApiError) || userErr.status !== 401) throw userErr;
        res = await authService.resetPassword(token, password);
      }
      setMessage(res.message);
      setPassword("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memperbarui password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-illust-side">
        <div className="login-illust-content">
          <LoginIllustration
            ariaLabel="Visual keamanan akun SAVEGEO"
            cards={[
              { kicker: "Token", note: "30 menit" },
              { kicker: "Akun", note: "terverifikasi" },
              { kicker: "Akses", note: "dipulihkan" },
            ]}
          />
          <h2>SAVEGEO</h2>
          <p>Buat password baru untuk melanjutkan pemantauan geospasial dengan aman.</p>
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-card">
          <div className="text-center mb-4">
            <Link to="/">
              <img src="/logo.jpg" alt="SAVEGEO" height={56} className="mb-2 rounded" />
            </Link>
            <h5 className="mb-0">Reset Password</h5>
            <small className="text-muted">Masukkan password baru untuk akun Anda</small>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label small">Password baru</label>
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
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} />
                </button>
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label small">Konfirmasi password</label>
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
              {loading ? "Menyimpan..." : "Simpan Password Baru"}
            </button>
            <div className="text-center mt-3 small">
              <Link to="/pemetaan-bencana">Kembali ke login</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

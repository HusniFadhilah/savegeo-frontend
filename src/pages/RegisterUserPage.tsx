import { useBilingualCopy } from "@/hooks/useBilingualCopy";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";
import LoginIllustration from "@/components/auth/LoginIllustration";
import { useI18nStore } from "@/hooks/useI18nStore";

/**
 * Registration page for the public SaveGeo users table. This page has its own
 * URL so the login and registration flows remain shareable and bookmarkable.
 */
export default function RegisterUserPage() {
  const c = useBilingualCopy();
  const t = useI18nStore((state) => state.t);
  const [fullName, setFullName] = useState("");
  const { register, isLoading, error } = useUserAuthStore();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (password.length < 8) {
      setLocalError(c("Kata sandi minimal 8 karakter.", "Password must be at least 8 characters."));
      return;
    }
    if (await register(username, email, password, fullName)) navigate("/carbon-estimation", { replace: true });
  };

  return (
    <div className="login-page">
      <div className="login-illust-side">
        <div className="login-illust-content">
          <LoginIllustration
            ariaLabel={c("Ilustrasi bumi untuk analitik geospasial SaveGeo", "Earth illustration for SaveGeo geospatial analytics")}
            cards={[
              { kicker: c("Vegetasi", "Vegetation"), note: c("area terpantau", "monitored area") },
              { kicker: c("Karbon", "Carbon"), note: c("stok terukur", "measured stock") },
              { kicker: c("Tutupan lahan", "Land cover"), note: c("perubahan terdeteksi", "detected change") },
            ]}
          />
          <h2>SAVEGEO</h2>
          <p>{c("Platform analitik geospasial untuk memahami wilayah, memantau perubahan, dan mendukung keputusan berbasis data.", "Geospatial analytics to understand places, monitor change, and support data-informed decisions.")}</p>
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-card">
          <div className="text-center mb-4">
            <Link to="/">
              <img src="/logo.jpg" alt="SAVEGEO" height={56} className="mb-2 rounded" />
            </Link>
            <h5 className="mb-0">{c("Buat Akun SaveGeo", "Create a SaveGeo Account")}</h5>
            <small className="text-muted">{c("Buat akun untuk mengakses seluruh fitur analitik SaveGeo", "Create an account to access all SaveGeo analytics features")}</small>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label small" htmlFor="register-full-name">{t("account.fullName")}</label>
              <input id="register-full-name" className="form-control" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" maxLength={160} />
            </div>
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
              <label className="form-label small">{c("Email", "Email")}</label>
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
              <label className="form-label small">{c("Kata sandi", "Password")}</label>
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
                  aria-label={showPassword ? c("Sembunyikan kata sandi", "Hide password") : c("Tampilkan kata sandi", "Show password")}
                >
                  <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} />
                </button>
              </div>
              <small className="text-muted">{c("Minimal 8 karakter.", "At least 8 characters.")}</small>
            </div>
            {(localError || error) && <div className="alert alert-danger py-2 px-2 small">{localError || error}</div>}
            <button type="submit" className="btn btn-primary w-100" disabled={isLoading}>
              {isLoading ? "Memproses..." : "Daftar"}
            </button>
            <div className="text-center mt-3 small">
              {c("Sudah punya akun?", "Already have an account?")}{" "}
              <Link to="/login" className="btn btn-link p-0 align-baseline">
                {c("Masuk", "Sign in")}
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

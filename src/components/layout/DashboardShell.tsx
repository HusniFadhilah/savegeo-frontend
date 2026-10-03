import { useEffect, type ReactNode } from "react";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import { useUiStore } from "@/hooks/useUiStore";
import { useI18nStore } from "@/hooks/useI18nStore";

const UNDIP_LOGO_URL = "https://upload.wikimedia.org/wikipedia/id/2/20/Logo_Universitas_Diponegoro.png";
const LEN_LOGO_URL = "https://upload.wikimedia.org/wikipedia/id/8/88/Logo_Len_Industri_Baru.png";

/** Shared application chrome for feature routes that are not module tabs. */
export default function DashboardShell({ children }: { children: ReactNode }) {
  const setActiveModule = useUiStore((state) => state.setActiveModule);
  const t = useI18nStore((state) => state.t);

  useEffect(() => {
    setActiveModule("disaster");
  }, [setActiveModule]);

  return (
    <>
      <Navbar />
      <div className="app-container">
        <Sidebar />
        <div className="content-wrapper content-wrapper-disaster-route">
          <main className="dashboard-main dashboard-main-disaster-route">{children}</main>
          <footer className="app-footer">
            <div className="app-footer-brand">
              <div className="app-footer-logos" aria-label={t("footer.partners")}>
                <img src={UNDIP_LOGO_URL} alt="Universitas Diponegoro" />
                <img src={LEN_LOGO_URL} alt="PT LEN Industri" />
              </div>
              <div>
                <strong>SaveGeo</strong>
                <span>{t("footer.tagline")}</span>
              </div>
            </div>
            <p className="app-footer-copy">
              {t("footer.copyright", { year: new Date().getFullYear() })}
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}

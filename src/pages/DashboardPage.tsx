import { MapActivityContext } from "@/components/map/MapActivityContext";
import { useEffect, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import CarbonModule from "@/features/carbon/CarbonModule";
import LcChangeModule from "@/features/lc-change/LcChangeModule";
import ImageryModule from "@/features/imagery/ImageryModule";
import DisasterModule from "@/features/disaster/DisasterModule";
import CropMonitoringModule from "@/features/crop-monitoring/CropMonitoringModule";
import GuideModule from "@/components/modules/GuideModule";
import AboutModule from "@/components/modules/AboutModule";
import { useUiStore, type DashboardModule } from "@/hooks/useUiStore";
import { useConfigStore } from "@/hooks/useConfigStore";
import { useI18nStore } from "@/hooks/useI18nStore";
import { DEFAULT_DASHBOARD_MODULE, getDashboardModuleSeo } from "@/routes/dashboardModuleRoutes";

const UNDIP_LOGO_URL = "https://upload.wikimedia.org/wikipedia/id/2/20/Logo_Universitas_Diponegoro.png";
const LEN_LOGO_URL = "https://upload.wikimedia.org/wikipedia/id/8/88/Logo_Len_Industri_Baru.png";

const MODULES: Record<DashboardModule, React.ComponentType> = {
  carbon: CarbonModule,
  "lc-change": LcChangeModule,
  imagery: ImageryModule,
  disaster: DisasterModule,
  "crop-monitoring": CropMonitoringModule,
  guide: GuideModule,
  about: AboutModule,
};

/**
 * Once a module has been opened, it stays mounted forever (just hidden via
 * CSS) instead of being unmounted when the user switches away - so drawn
 * AOIs, run analysis results, selected tabs, etc. survive navigating to
 * another sidebar item and back. Previously this rendered only
 * `MODULES[activeModule]`, which fully tore down a module's React tree (and
 * all its local useState) the instant the user left it, then mounted a
 * brand-new instance on return - matching the legacy app's `.module-
 * container`/`.active` CSS (MapView's invalidateSize logic already assumed
 * this "hidden but alive" pattern), just not what the render logic did.
 *
 * Modules only join this set the first time they're actually opened, not
 * all 6 on initial load - each one's own data fetches (dataset/model
 * catalogs, etc.) only fire once the user visits it.
 */
export default function DashboardPage({ module = DEFAULT_DASHBOARD_MODULE }: { module?: DashboardModule }) {
  const activeModule = useUiStore((s) => s.activeModule);
  const setActiveModule = useUiStore((s) => s.setActiveModule);
  const loadConfig = useConfigStore((s) => s.load);
  const t = useI18nStore((s) => s.t);
  const [mountedModules, setMountedModules] = useState<DashboardModule[]>([module]);
  const visibleModule = activeModule === module ? activeModule : module;

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    setActiveModule(module);
  }, [module, setActiveModule]);

  useEffect(() => {
    const seo = getDashboardModuleSeo(module);
    document.title = seo.title;

    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = seo.description;
  }, [module]);

  useEffect(() => {
    setMountedModules((prev) => (prev.includes(visibleModule) ? prev : [...prev, visibleModule]));
  }, [visibleModule]);

  return (
    <>
      <Navbar />
      <div className="app-container">
        <Sidebar />
        <div className={`content-wrapper ${module === "carbon" ? "content-wrapper-carbon" : ""}`}>
          <main className="dashboard-main p-3">
            {mountedModules.map((key) => {
              const Component = MODULES[key];
              return (
                <div key={key} className={`module-container ${visibleModule === key ? "active" : ""}`}>
                  <MapActivityContext.Provider value={visibleModule === key}><Component /></MapActivityContext.Provider>
                </div>
              );
            })}
          </main>
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

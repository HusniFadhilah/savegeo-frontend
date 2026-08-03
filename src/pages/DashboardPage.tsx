import { useEffect, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import CarbonModule from "@/features/carbon/CarbonModule";
import LcChangeModule from "@/features/lc-change/LcChangeModule";
import DisasterModule from "@/features/disaster/DisasterModule";
import GuideModule from "@/components/modules/GuideModule";
import AboutModule from "@/components/modules/AboutModule";
import DetailsModule from "@/components/modules/DetailsModule";
import { useUiStore, type DashboardModule } from "@/hooks/useUiStore";
import { useConfigStore } from "@/hooks/useConfigStore";

const MODULES: Record<DashboardModule, React.ComponentType> = {
  carbon: CarbonModule,
  "lc-change": LcChangeModule,
  disaster: DisasterModule,
  guide: GuideModule,
  about: AboutModule,
  details: DetailsModule,
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
export default function DashboardPage() {
  const activeModule = useUiStore((s) => s.activeModule);
  const loadConfig = useConfigStore((s) => s.load);
  const [mountedModules, setMountedModules] = useState<DashboardModule[]>([activeModule]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    setMountedModules((prev) => (prev.includes(activeModule) ? prev : [...prev, activeModule]));
  }, [activeModule]);

  return (
    <>
      <Navbar />
      <div className="app-container">
        <Sidebar />
        <main className="flex-grow-1 p-3">
          {mountedModules.map((key) => {
            const Component = MODULES[key];
            return (
              <div key={key} className={`module-container ${activeModule === key ? "active" : ""}`}>
                <Component />
              </div>
            );
          })}
        </main>
      </div>
    </>
  );
}

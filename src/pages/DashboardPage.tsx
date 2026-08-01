import { useEffect } from "react";
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

export default function DashboardPage() {
  const activeModule = useUiStore((s) => s.activeModule);
  const loadConfig = useConfigStore((s) => s.load);
  const ActiveComponent = MODULES[activeModule];

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return (
    <>
      <Navbar />
      <div className="app-container">
        <Sidebar />
        <main className="flex-grow-1 p-3">
          <div className="module-container active">
            <ActiveComponent />
          </div>
        </main>
      </div>
    </>
  );
}

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import { pluginRegistry, type PluginCapability } from "@/workflow/plugins";
import { useBilingualCopy } from "@/hooks/useBilingualCopy";

const capabilityLabels: Record<PluginCapability, [string, string]> = {
  "raster-tool": ["Alat raster", "Raster tools"],
  "imagery-provider": ["Penyedia citra", "Imagery providers"],
  "workflow-node": ["Node workflow", "Workflow nodes"],
  "map-layer": ["Layer peta", "Map layers"],
  widget: ["Widget", "Widgets"],
  exporter: ["Ekspor", "Exporters"],
};

export default function PluginManagerPage() {
  const c = useBilingualCopy();
  const [plugins, setPlugins] = useState(pluginRegistry.list());
  const [search, setSearch] = useState("");
  const [capability, setCapability] = useState<PluginCapability | "all">("all");

  const capabilityOptions = useMemo(
    () => [...new Set(plugins.flatMap((plugin) => plugin.capabilities))].sort(),
    [plugins],
  );
  const filteredPlugins = useMemo(() => {
    const query = search.trim().toLowerCase();
    return plugins.filter((plugin) => {
      const matchesSearch = !query || [plugin.name, plugin.description, plugin.author, ...plugin.capabilities].some((value) => value?.toLowerCase().includes(query));
      const matchesCapability = capability === "all" || plugin.capabilities.includes(capability);
      return matchesSearch && matchesCapability;
    });
  }, [capability, plugins, search]);
  const enabledCount = plugins.filter((plugin) => plugin.enabled).length;
  const permissionCount = new Set(plugins.flatMap((plugin) => plugin.permissions ?? [])).size;

  const togglePlugin = (id: string, enabled: boolean) => {
    pluginRegistry.toggle(id, enabled);
    setPlugins(pluginRegistry.list());
  };

  return <div className="workflow-page">
    <Navbar />
    <main className="plugin-page">
      <section className="plugin-hero">
        <div className="plugin-hero-copy">
          <Link to="/workflow" className="plugin-back-link"><i className="bi bi-arrow-left" /> {c("Pembuat workflow", "Workflow builder")}</Link>
          <div className="plugin-eyebrow"><i className="bi bi-stars" /> {c("Ekosistem SaveGeo", "SaveGeo ecosystem")}</div>
          <h1><span className="plugin-title-icon"><i className="bi bi-puzzle-fill" /></span> {c("Pengelola plugin", "Plugin manager")}</h1>
          <p>{c("Kelola kapabilitas yang memperluas workflow, citra, layer, widget, dan ekspor SaveGeo.", "Manage capabilities that extend SaveGeo workflows, imagery, map layers, widgets, and exports.")}</p>
        </div>
        <div className="plugin-hero-aside">
          <span className="plugin-api-badge"><i className="bi bi-braces" /> API v1</span>
          <span className="plugin-registry-status"><i className="bi bi-check-circle-fill" /> {c("Registry siap", "Registry ready")}</span>
        </div>
      </section>

      <section className="plugin-stats" aria-label={c("Ringkasan plugin", "Plugin overview")}>
        <div className="plugin-stat"><span className="plugin-stat-icon is-green"><i className="bi bi-grid-3x3-gap" /></span><div><strong>{plugins.length}</strong><small>{c("Plugin terpasang", "Installed plugins")}</small></div></div>
        <div className="plugin-stat"><span className="plugin-stat-icon is-blue"><i className="bi bi-toggle-on" /></span><div><strong>{enabledCount}</strong><small>{c("Sedang aktif", "Active now")}</small></div></div>
        <div className="plugin-stat"><span className="plugin-stat-icon is-purple"><i className="bi bi-diagram-3" /></span><div><strong>{capabilityOptions.length}</strong><small>{c("Kapabilitas", "Capabilities")}</small></div></div>
        <div className="plugin-stat"><span className="plugin-stat-icon is-amber"><i className="bi bi-shield-check" /></span><div><strong>{permissionCount}</strong><small>{c("Jenis izin", "Permission types")}</small></div></div>
      </section>

      <section className="plugin-toolbar" aria-label={c("Filter plugin", "Plugin filters")}>
        <div className="plugin-toolbar-copy"><strong>{c("Ekstensi tersedia", "Available extensions")}</strong><span>{c(`${filteredPlugins.length} dari ${plugins.length} ditampilkan`, `${filteredPlugins.length} of ${plugins.length} shown`)}</span></div>
        <div className="plugin-toolbar-controls">
          <label className="plugin-search"><i className="bi bi-search" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={c("Cari plugin", "Search plugins")} aria-label={c("Cari plugin", "Search plugins")} /></label>
          <select className="plugin-filter" value={capability} onChange={(event) => setCapability(event.target.value as PluginCapability | "all")} aria-label={c("Filter berdasarkan kapabilitas", "Filter by capability")}>
            <option value="all">{c("Semua kapabilitas", "All capabilities")}</option>
            {capabilityOptions.map((item) => <option value={item} key={item}>{c(capabilityLabels[item][0], capabilityLabels[item][1])}</option>)}
          </select>
        </div>
      </section>

      {filteredPlugins.length > 0 ? <div className="plugin-grid">
        {filteredPlugins.map((plugin) => <article className={`plugin-card ${plugin.enabled ? "is-enabled" : "is-disabled"}`} key={plugin.id}>
          <div className="plugin-card-head">
            <span className="plugin-icon"><i className="bi bi-puzzle-fill" /></span>
          <span className={`plugin-status-label ${plugin.enabled ? "is-active" : "is-inactive"}`}><span className="status-dot" />{plugin.enabled ? c("Aktif", "Active") : c("Dinonaktifkan", "Disabled")}</span>
          </div>
          <div className="plugin-card-kicker">{plugin.id}</div>
          <h2>{plugin.name}</h2>
          <p>{plugin.description || c("Deskripsi belum tersedia.", "No description provided.")}</p>
          <div className="plugin-meta"><span><i className="bi bi-box me-1" /> v{plugin.version}</span><span><i className="bi bi-person me-1" /> {plugin.author || c("Komunitas", "Community")}</span></div>
          <div className="plugin-capabilities">{plugin.capabilities.map((item) => <span key={item}>{c(capabilityLabels[item][0], capabilityLabels[item][1])}</span>)}</div>
          <div className="plugin-permissions"><small><i className="bi bi-key me-1" /> {c("Izin", "Permissions")}</small><div>{plugin.permissions?.length ? plugin.permissions.join(" · ") : c("Tidak meminta izin tambahan", "No elevated permissions")}</div></div>
          <div className="plugin-card-footer"><span className="plugin-entry"><i className="bi bi-file-earmark-code me-1" /> {plugin.entry}</span><button type="button" className={`btn btn-sm ${plugin.enabled ? "btn-outline-danger" : "btn-outline-success"}`} onClick={() => togglePlugin(plugin.id, !plugin.enabled)}>{plugin.enabled ? c("Nonaktifkan", "Disable") : c("Aktifkan", "Enable")}</button></div>
          {plugin.lastError && <div className="text-danger small mt-2"><i className="bi bi-exclamation-triangle me-1" />{plugin.lastError}</div>}
        </article>)}
      </div> : <div className="plugin-empty"><i className="bi bi-search" /><strong>{c("Plugin tidak ditemukan", "No plugins found")}</strong><span>{c("Coba kata pencarian atau filter kapabilitas yang berbeda.", "Try a different search term or capability filter.")}</span></div>}

      <div className="plugin-security-note"><span className="plugin-security-icon"><i className="bi bi-shield-lock" /></span><div><strong>{c("Keamanan plugin", "Plugin security")}</strong><p>{c("Plugin tidak pernah menerima token sesi secara langsung. Akses jaringan, penyimpanan, file lokal, dan backend harus diberikan sebagai kapabilitas eksplisit; entri jarak jauh harus berasal dari registry tepercaya.", "Plugins never receive session tokens directly. Network, storage, local-file, and backend access are explicit capabilities; remote entries must come from a trusted registry.")}</p></div></div>
    </main>
  </div>;
}

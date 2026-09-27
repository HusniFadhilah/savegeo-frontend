import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import { pluginRegistry, type PluginCapability } from "@/workflow/plugins";

const capabilityLabels: Record<PluginCapability, string> = {
  "raster-tool": "Raster tools",
  "imagery-provider": "Imagery",
  "workflow-node": "Workflow nodes",
  "map-layer": "Map layers",
  widget: "Widgets",
  exporter: "Exporters",
};

export default function PluginManagerPage() {
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
          <Link to="/workflow" className="plugin-back-link"><i className="bi bi-arrow-left" /> Workflow builder</Link>
          <div className="plugin-eyebrow"><i className="bi bi-stars" /> SaveGeo ecosystem</div>
          <h1><span className="plugin-title-icon"><i className="bi bi-puzzle-fill" /></span> Plugin manager</h1>
          <p>Kelola kapabilitas yang memperluas workflow, imagery, layer, widget, dan ekspor SaveGeo.</p>
        </div>
        <div className="plugin-hero-aside">
          <span className="plugin-api-badge"><i className="bi bi-braces" /> API v1</span>
          <span className="plugin-registry-status"><i className="bi bi-check-circle-fill" /> Registry ready</span>
        </div>
      </section>

      <section className="plugin-stats" aria-label="Plugin overview">
        <div className="plugin-stat"><span className="plugin-stat-icon is-green"><i className="bi bi-grid-3x3-gap" /></span><div><strong>{plugins.length}</strong><small>Installed plugins</small></div></div>
        <div className="plugin-stat"><span className="plugin-stat-icon is-blue"><i className="bi bi-toggle-on" /></span><div><strong>{enabledCount}</strong><small>Active now</small></div></div>
        <div className="plugin-stat"><span className="plugin-stat-icon is-purple"><i className="bi bi-diagram-3" /></span><div><strong>{capabilityOptions.length}</strong><small>Capabilities</small></div></div>
        <div className="plugin-stat"><span className="plugin-stat-icon is-amber"><i className="bi bi-shield-check" /></span><div><strong>{permissionCount}</strong><small>Permission types</small></div></div>
      </section>

      <section className="plugin-toolbar" aria-label="Plugin filters">
        <div className="plugin-toolbar-copy"><strong>Available extensions</strong><span>{filteredPlugins.length} of {plugins.length} shown</span></div>
        <div className="plugin-toolbar-controls">
          <label className="plugin-search"><i className="bi bi-search" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search plugins" aria-label="Search plugins" /></label>
          <select className="plugin-filter" value={capability} onChange={(event) => setCapability(event.target.value as PluginCapability | "all")} aria-label="Filter by capability">
            <option value="all">All capabilities</option>
            {capabilityOptions.map((item) => <option value={item} key={item}>{capabilityLabels[item]}</option>)}
          </select>
        </div>
      </section>

      {filteredPlugins.length > 0 ? <div className="plugin-grid">
        {filteredPlugins.map((plugin) => <article className={`plugin-card ${plugin.enabled ? "is-enabled" : "is-disabled"}`} key={plugin.id}>
          <div className="plugin-card-head">
            <span className="plugin-icon"><i className="bi bi-puzzle-fill" /></span>
            <span className={`plugin-status-label ${plugin.enabled ? "is-active" : "is-inactive"}`}><span className="status-dot" />{plugin.enabled ? "Active" : "Disabled"}</span>
          </div>
          <div className="plugin-card-kicker">{plugin.id}</div>
          <h2>{plugin.name}</h2>
          <p>{plugin.description || "No description provided."}</p>
          <div className="plugin-meta"><span><i className="bi bi-box me-1" /> v{plugin.version}</span><span><i className="bi bi-person me-1" /> {plugin.author || "Community"}</span></div>
          <div className="plugin-capabilities">{plugin.capabilities.map((item) => <span key={item}>{capabilityLabels[item]}</span>)}</div>
          <div className="plugin-permissions"><small><i className="bi bi-key me-1" /> Permissions</small><div>{plugin.permissions?.length ? plugin.permissions.join(" · ") : "No elevated permissions"}</div></div>
          <div className="plugin-card-footer"><span className="plugin-entry"><i className="bi bi-file-earmark-code me-1" /> {plugin.entry}</span><button type="button" className={`btn btn-sm ${plugin.enabled ? "btn-outline-danger" : "btn-outline-success"}`} onClick={() => togglePlugin(plugin.id, !plugin.enabled)}>{plugin.enabled ? "Disable" : "Enable"}</button></div>
          {plugin.lastError && <div className="text-danger small mt-2"><i className="bi bi-exclamation-triangle me-1" />{plugin.lastError}</div>}
        </article>)}
      </div> : <div className="plugin-empty"><i className="bi bi-search" /><strong>No plugins found</strong><span>Try a different search term or capability filter.</span></div>}

      <div className="plugin-security-note"><span className="plugin-security-icon"><i className="bi bi-shield-lock" /></span><div><strong>Plugin security</strong><p>Plugins never receive session tokens directly. Network, storage, local-files, and backend access are explicit capabilities and remote entries must come from a trusted registry.</p></div></div>
    </main>
  </div>;
}

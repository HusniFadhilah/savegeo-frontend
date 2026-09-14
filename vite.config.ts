import { defineConfig } from "vitest/config";
import { viteStaticCopy } from "vite-plugin-static-copy";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  define: { CESIUM_BASE_URL: JSON.stringify("/cesium/") },
  plugins: [react(), viteStaticCopy({ targets: ["Workers", "ThirdParty", "Assets", "Widgets"].map(dir => ({ src: `node_modules/cesium/Build/Cesium/${dir}`, dest: "cesium", rename: { stripBase: 4 } })) })],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5501,
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});

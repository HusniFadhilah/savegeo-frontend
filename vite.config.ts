import { defineConfig } from "vitest/config";
import { viteStaticCopy } from "vite-plugin-static-copy";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Keep the app root and VITE_ env files anchored to this frontend package,
  // even when Vite is launched from the repository's parent directory.
  root: fileURLToPath(new URL(".", import.meta.url)),
  envDir: fileURLToPath(new URL(".", import.meta.url)),
  define: { CESIUM_BASE_URL: JSON.stringify("/cesium/") },
  optimizeDeps: {
    // Globe3DView is lazy-loaded; pre-bundle Cesium before the first globe click
    // so Vite doesn't invalidate optimized dependency URLs mid-session.
    include: ["cesium"],
  },
  plugins: [react(), viteStaticCopy({ targets: ["Workers", "ThirdParty", "Assets", "Widgets"].map(dir => ({ src: `node_modules/cesium/Build/Cesium/${dir}`, dest: "cesium", rename: { stripBase: 4 } })) })],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5501,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8086",
        changeOrigin: true,
      },
      "/disaster-thumbnails": {
        target: "http://127.0.0.1:8086",
        changeOrigin: true,
      },
    },
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

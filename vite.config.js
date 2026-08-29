/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

// One id per build. The running app carries this baked in (see __BUILD_ID__
// below); a slim /version.json carrying the same value is written into the
// build output and served in dev, so a long-lived PWA window can notice it has
// gone stale and reload itself. See src/hooks/useAppUpdate.js.
const BUILD_ID = process.env.BUILD_ID || new Date().toISOString();

function versionManifest() {
  const body = JSON.stringify({ buildId: BUILD_ID }) + "\n";
  const serveVersion = (req, res, next) => {
    if ((req.url || "").split("?")[0] !== "/version.json") return next();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(body);
  };
  let outDir = "dist";
  return {
    name: "bibliome-version-manifest",
    configResolved(cfg) {
      outDir = cfg.build.outDir;
    },
    configureServer(server) {
      // Without this the dev-mode watcher's fetch would 404 every poll.
      server.middlewares.use(serveVersion);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveVersion);
    },
    closeBundle() {
      writeFileSync(resolve(outDir, "version.json"), body);
    },
  };
}

export default defineConfig({
  plugins: [react(), versionManifest()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    css: false,
  },
});

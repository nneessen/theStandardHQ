import { defineConfig, loadEnv, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

// Type for release notes
interface ReleaseNote {
  id: string;
  type: "feat" | "fix" | "improve";
  text: string;
}

// Plugin to generate version.json for cache busting detection
function versionPlugin(): Plugin {
  return {
    name: "version-plugin",
    closeBundle() {
      // Read manual release notes from release-notes.json
      const releaseNotesPath = path.resolve(__dirname, "release-notes.json");
      let notes: ReleaseNote[] = [];

      try {
        const content = fs.readFileSync(releaseNotesPath, "utf-8");
        const data = JSON.parse(content);
        notes = data.notes || [];
      } catch {
        notes = [];
      }

      const version = {
        v: Date.now().toString(),
        buildTime: new Date().toISOString(),
        notes,
      };

      fs.writeFileSync(
        path.resolve(__dirname, "build/version.json"),
        JSON.stringify(version),
      );
      console.log("Generated version.json:", version.v);
      if (notes.length > 0) {
        console.log(
          "Included release notes:",
          notes.map((n) => n.text),
        );
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load all env vars (including .env.local) into a local object.
  // The empty prefix "" loads ALL vars, not just VITE_-prefixed ones.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), versionPlugin()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 3000,
      open: true,
      proxy: {
        "/api/pdf-extract": {
          target: "https://pdf-extractor-web-production.up.railway.app",
          changeOrigin: true,
          rewrite: (p) => p.replace("/api/pdf-extract", "/api/extract"),
        },
        "/api/paddle-ocr": {
          target: env.PADDLEOCR_SERVICE_URL || "http://localhost:8000",
          changeOrigin: true,
          rewrite: (p) => p.replace("/api/paddle-ocr", "/api/extract"),
          configure: (proxy) => {
            // Inject API key server-side so it never appears in browser DevTools
            proxy.on("proxyReq", (proxyReq) => {
              const key = env.PADDLEOCR_API_KEY;
              if (key) proxyReq.setHeader("X-API-Key", key);
            });
          },
        },
      },
    },
    build: {
      outDir: "build",
      sourcemap: true,
    },
    define: {
      // Replace process.env for browser compatibility
      global: "globalThis",
    },
  };
});

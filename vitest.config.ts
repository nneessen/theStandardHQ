// /home/nneessen/projects/commissionTracker/vitest.config.ts
import { defineConfig } from "vitest/config";
import { resolve } from "path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
    globals: true,
    css: true,
    // Vitest runs ONLY the Node/React tests under src/. Edge-function and worker
    // suites (supabase/functions/**, services/jarvis-voice-worker/**, tests/**)
    // are Deno tests — they import `jsr:@std/assert` etc. which Node/Vitest
    // cannot load — and are run separately via `deno test`, not here.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});

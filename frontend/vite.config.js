import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Fully offline Vite config for the Netra32 frontend.
// /api requests are proxied to the local eagle-delta backend so the
// browser only ever needs to know about a single origin during dev.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4032",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});

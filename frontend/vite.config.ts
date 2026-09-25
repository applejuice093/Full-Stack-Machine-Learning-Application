import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/datasets": "http://localhost:4000",
      "/dataset": "http://localhost:8000",
      "/train": "http://localhost:4000",
      "/predict": "http://localhost:4000",
      "/visualize": "http://localhost:4000",
    },
  },
});

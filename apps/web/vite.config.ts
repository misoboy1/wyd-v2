import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // 공용 패키지는 소스를 직접 번들(빌드 산출물 불필요)
      "@wyd/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:3000", changeOrigin: false },
      "/uploads": { target: "http://127.0.0.1:3000" },
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: { output: { manualChunks: { react: ["react", "react-dom", "react-router"], query: ["@tanstack/react-query", "@tanstack/react-virtual"] } } },
  },
});

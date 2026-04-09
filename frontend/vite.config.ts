//vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Backend xử lý mọi thứ: REST proxy, ASEAN WS relay, indexsnaps, charts, time
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy REST API + Socket.IO sang backend
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});

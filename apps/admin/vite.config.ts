import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The dashboard talks to the Worker API same-origin. In dev, the proxy
// forwards API paths to `wrangler dev`, so the browser never sees a second
// origin (and CORS never comes into play — same trick in production, where
// the Worker itself serves this build under /admin).
const WORKER_DEV = "http://localhost:8787";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/auth": WORKER_DEV,
      "/admin": WORKER_DEV,
      "/photos": WORKER_DEV,
    },
  },
});

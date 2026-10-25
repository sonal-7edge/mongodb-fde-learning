import { defineConfig } from "vite";

// The backend (its Docker container, or `make dev` in backend/) that API calls are forwarded to.
// Override: BACKEND_URL=http://other-host:3004 npm run dev
const backend = process.env.BACKEND_URL ?? "http://localhost:3004";

export default defineConfig({
  server: {
    // Listen on all interfaces so the port can be forwarded (SSH -L, VS Code Ports, etc.).
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    // If you open the UI through a forwarding hostname (e.g. *.devtunnels.ms), list it here:
    // UI_ALLOWED_HOSTS=my-host.example.com npm run dev
    allowedHosts: process.env.UI_ALLOWED_HOSTS?.split(",") ?? [],
    // The browser only talks to Vite (one port to forward); Vite forwards these paths to the backend.
    // Same origin for the browser means no CORS setup is needed on the API.
    proxy: {
      "/api": backend,
      "/auth": backend,
      "/health": backend,
    },
  },
});

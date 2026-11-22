import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const developmentServerPort = Number(process.env.OPENC_SERVER_PORT ?? "4317");
const backendUrl = `http://127.0.0.1:${developmentServerPort}`;

export default defineConfig({
  root: "src/web",
  plugins: [react(), tailwindcss()],
  build: { outDir: "../../dist/web", emptyOutDir: true },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "^/api/": backendUrl,
      "^/ws(\\?|$)": { target: backendUrl, ws: true },
    },
  },
});

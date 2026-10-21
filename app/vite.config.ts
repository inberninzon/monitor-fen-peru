import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base relativa para que el sitio funcione en GitHub Pages bajo cualquier ruta
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: { output: { manualChunks: { mapa: ["maplibre-gl", "topojson-client"], graficos: ["echarts"] } } },
  },
});

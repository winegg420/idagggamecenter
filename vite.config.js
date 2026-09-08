import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Satıcı kodunu ayır: uygulama her deploy'da değişse de bu parçalar
        // tarayıcı önbelleğinde kalır; ilk açılışta indirilen paket küçülür.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-router")) return "router";
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("scheduler")
          ) {
            return "react";
          }
          if (
            id.includes("@supabase") ||
            id.includes("postgrest") ||
            id.includes("realtime-js") ||
            id.includes("gotrue") ||
            id.includes("storage-js") ||
            id.includes("functions-js")
          ) {
            return "supabase";
          }
          // Geri kalan satıcı kodu Rollup'un kendi bölmesinde kalır: lazy
          // yüklenen oyunların ağır bağımlılıkları (three.js gibi) ilk
          // açılış paketine sızmasın.
          return undefined;
        },
      },
    },
  },
});

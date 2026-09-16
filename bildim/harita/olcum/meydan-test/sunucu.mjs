// AŞAMA 2B meydan entegrasyon sınaması — vite geliştirme sunucusu; Supabase istemcisi ve oturum sahtelerine yönlendirilir.
//   node bildim/harita/olcum/meydan-test/sunucu.mjs [port=5175] [--uretim]
//   --uretim: üretim derlemesi + önizleme (ölçüm için; README sabiti)
import path from "path";
import { fileURLToPath } from "url";
import { createServer, build, preview } from "vite";
import react from "@vitejs/plugin-react";

const BURASI = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(BURASI, "../../../..");
const port = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 5175);
const uretim = process.argv.includes("--uretim");
const sahteler = {
  name: "meydan-test-sahteleri",
  enforce: "pre",
  resolveId(kaynak, ithalEden) {
    if (!ithalEden) return null;
    const tam = path.resolve(path.dirname(ithalEden), kaynak).replace(/\\/g, "/");
    if (tam.endsWith("/src/lib/supabase.js")) return path.join(BURASI, "sahteSupabase.js");
    if (tam.endsWith("/src/context/AuthContext.jsx")) return path.join(BURASI, "sahteAuth.jsx");
    return null;
  },
};
const ayar = {
  root: KOK, configFile: false, logLevel: "warn", appType: "mpa", plugins: [sahteler, react()],
  server: { port, strictPort: true }, preview: { port, strictPort: true },
  build: { outDir: path.join(KOK, ".tmp/olcum/meydan-test"), emptyOutDir: true, rollupOptions: { input: path.join(BURASI, "index.html") } },
};
try {
  if (uretim) { await build(ayar); await preview(ayar); }
  else { const s = await createServer(ayar); await s.listen(); }
  console.log(`[meydan-test] http://localhost:${port}/bildim/harita/olcum/meydan-test/index.html?harita=taksim&otomasyon=1`);
} catch (e) { console.error("[meydan-test] başarısız:", e); process.exit(1); }

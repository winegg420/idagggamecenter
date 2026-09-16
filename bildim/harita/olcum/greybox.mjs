// AŞAMA 2A greybox ölçümü — üretim derlemesi + önizleme sunucusu (README sabiti: dev modunda ÖLÇÜLMEZ).
//   node bildim/harita/olcum/greybox.mjs [port=4210]
//   → http://localhost:4210/bildim/harita/olcum/greybox.html?otomasyon=1
import path from "path";
import { fileURLToPath } from "url";
import { build, preview } from "vite";

const BURASI = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(BURASI, "../../..");
const port = Number(process.argv[2] ?? 4210);
const outDir = path.join(KOK, ".tmp/olcum/greybox");
const ayar = { root: KOK, configFile: false, logLevel: "warn", base: "/", build: { outDir, emptyOutDir: true, rollupOptions: { input: path.join(BURASI, "greybox.html") } }, preview: { port, strictPort: true } };
try {
  await build(ayar);
  const s = await preview(ayar);
  console.log(`[greybox] http://localhost:${port}/bildim/harita/olcum/greybox.html?otomasyon=1  (Ctrl+C ile kapat)`);
  s.printUrls?.();
} catch (e) {
  console.error("[greybox] başarısız:", e);
  process.exit(1);
}

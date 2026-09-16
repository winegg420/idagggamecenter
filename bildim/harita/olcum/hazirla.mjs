// ============================================================
// KARE SÜRESİ ÖLÇÜM DÜZENEĞİ — bir commit'i çıkarır, üretim derlemesi yapar, yerel sunucuda açar.
//
//   node bildim/harita/olcum/hazirla.mjs <commit> <ad> <port>
//   örn. node bildim/harita/olcum/hazirla.mjs 02511f8 1c 4201
//        node bildim/harita/olcum/hazirla.mjs HEAD    1e 4202
//
// Çalışma dizinine DOKUNMAZ: `git archive` ile yalnız test sahnesi + varlıklar `.tmp/olcum/<ad>`'a çıkarılır.
// Bağımlılıklar depo kökündeki node_modules'ten çözülür → iki commit arasında package.json değiştiyse
// bu düzenek geçersizdir (README "Sınırlar").
// ============================================================
import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const BURASI = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(BURASI, "../../..");
const [commit, ad, port] = process.argv.slice(2);
if (!commit || !ad || !port) { console.error("kullanım: node bildim/harita/olcum/hazirla.mjs <commit> <ad> <port>"); process.exit(1); }

const hedef = path.join(KOK, ".tmp/olcum", ad);
try {
  const sha = execSync(`git rev-parse --short ${commit}`, { cwd: KOK }).toString().trim();
  fs.rmSync(hedef, { recursive: true, force: true });
  fs.mkdirSync(hedef, { recursive: true });
  execSync(`git archive ${sha} bildim/harita/deneme public/meydan/deneme | tar -x -C "${hedef.replace(/\\/g, "/")}"`, { cwd: KOK, stdio: "inherit", shell: "bash" });
  fs.copyFileSync(path.join(BURASI, "index.html"), path.join(hedef, "index.html"));
  const env = { ...process.env, OLCUM_KOK: hedef };
  const config = path.join(BURASI, "vite.olcum.config.mjs");
  console.log(`[olcum] ${ad} = ${sha} → üretim derlemesi`);
  execSync(`npx vite build --config "${config}"`, { cwd: KOK, env, stdio: "inherit" });
  console.log(`[olcum] ${ad} → http://localhost:${port}/index.html?otomasyon=1  (Ctrl+C ile kapat)`);
  spawn(`npx vite preview --config "${config}" --port ${Number(port)} --strictPort`, { cwd: KOK, env, stdio: "inherit", shell: true });
} catch (e) {
  console.error("[olcum] hazırlık başarısız:", e.message);
  process.exit(1);
}

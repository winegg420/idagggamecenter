// ============================================================
// VARLIK MUAYENESİ — çalıştırıcı (Aşama 1E). TEK KOMUT:
//
//   npm run muayene                      # 12 varlığın hepsi
//   npm run muayene -- prop_lamba bina_dukkan   # yalnız seçilenler
//
// Sıra: (1) mekanik testler (Node, GLB geometrisi)  (2) vite geliştirme sunucusu + headless Chrome
// (3) her varlık için 6 ortografik + 3 yakın + 1 beauty PNG  (4) kontakt sayfası  (5) özet JSON.
// Çıktı: bildim/harita/muayene/cikti/<varlik>/  — ham PNG'ler git dışı, kontakt + adaylar.json commit edilir.
// Headless tarayıcı: playwright-core (devDependency) + makinede kurulu Chrome (`channel: "chrome"`); tarayıcı indirmez.
// ============================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "vite";
import { chromium } from "playwright-core";

const BURASI = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(BURASI, "../../..");
const CIKTI = path.join(BURASI, "cikti");
const TUM = ["karakter_insan", "karakter_kaplan", "karakter_robot", "bina_dukkan", "zemin_deneme", "bordur", "prop_agac_govde", "prop_agac_tac", "prop_bank", "prop_lamba", "prop_saksi", "prop_kedi"];
const secilen = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const VARLIKLAR = secilen.length ? secilen : TUM;
const ustveriOku = (ad) => JSON.parse(fs.readFileSync(path.join(BURASI, "ustveri", ad + ".json"), "utf8"));
const dosyaAdi = (i, ad) => `${String(i + 1).padStart(2, "0")}-${ad.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase()}.png`;

let sunucu = null, tarayici = null;
try {
  fs.mkdirSync(CIKTI, { recursive: true });
  sunucu = await createServer({ root: KOK, configFile: false, logLevel: "error", appType: "mpa", server: { port: 5190, strictPort: false } });
  await sunucu.listen();
  const adres = `http://localhost:${sunucu.config.server.port}/bildim/harita/muayene/muayene.html`;
  tarayici = await chromium.launch({ channel: "chrome", headless: true, args: ["--ignore-gpu-blocklist", "--enable-webgl"] });
  const sayfa = await tarayici.newPage({ viewport: { width: 700, height: 700 }, deviceScaleFactor: 1 });
  const konsolHatalari = [];
  sayfa.on("console", (m) => { if (m.type() === "error") konsolHatalari.push(m.text()); });
  sayfa.on("pageerror", (e) => konsolHatalari.push(String(e)));
  await sayfa.goto(adres);
  await sayfa.waitForFunction(() => window.muayene?.hazir, null, { timeout: 60000 });

  const ozet = { tarih: new Date().toISOString(), varliklar: {}, konsolHatalari };
  for (const ad of VARLIKLAR) {
    const u = ustveriOku(ad);
    const klasor = path.join(CIKTI, ad);
    fs.mkdirSync(klasor, { recursive: true });
    for (const f of fs.readdirSync(klasor)) if (f.endsWith(".png")) fs.rmSync(path.join(klasor, f));
    const bilgi = await sayfa.evaluate((x) => window.muayene.hazirla(x), u);
    const dosyalar = [];
    for (let i = 0; i < bilgi.gorunumler.length; i++) {
      const url = await sayfa.evaluate((n) => window.muayene.ciz(n), i);
      const dosya = dosyaAdi(i, bilgi.gorunumler[i]);
      fs.writeFileSync(path.join(klasor, dosya), Buffer.from(url.split(",")[1], "base64"));
      dosyalar.push(dosya);
    }
    ozet.varliklar[ad] = { ucgen: bilgi.ucgen, malzeme: bilgi.malzeme, gorunumler: bilgi.gorunumler, dosyalar };
    ozet.gpu = bilgi.gpu;
    console.log(`[muayene] ${ad}: ${dosyalar.length} görünüm · ${bilgi.ucgen} üçgen · ${bilgi.malzeme} malzeme`);
  }
  fs.writeFileSync(path.join(CIKTI, "ozet.json"), JSON.stringify(ozet, null, 1));
  console.log(`[muayene] WebGL: ${ozet.gpu}`);
  console.log(`[muayene] konsol hatası: ${konsolHatalari.length}${konsolHatalari.length ? "\n  " + konsolHatalari.slice(0, 5).join("\n  ") : ""}`);
} catch (e) {
  console.error("[muayene] başarısız:", e);
  process.exitCode = 1;
} finally {
  await tarayici?.close().catch(() => {});
  await sunucu?.close().catch(() => {});
}

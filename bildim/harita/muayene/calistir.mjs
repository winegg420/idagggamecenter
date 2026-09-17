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
import { varlikTestEt } from "./testler.mjs";
import { kodKozmetikTestEt, takiliTestEt } from "./testlerKozmetik.mjs";
import { uretilenleriHazirla, KOD_KOZMETIKLERI, takiliListe } from "./takili.mjs";

const BURASI = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(BURASI, "../../..");
const CIKTI = path.join(BURASI, "cikti");
// Paket 21 §A: oyunda görünen hiçbir geometri muayene dışında kalmaz — kodla çizilen kozmetikler de listede.
const KOD_KOZMETIK = Object.keys(KOD_KOZMETIKLERI).map((k) => "kozmetik_" + k);
const TUM = ["karakter_insan", "karakter_kaplan", "karakter_robot", "bina_dukkan", "zemin_deneme", "bordur", "prop_agac_govde", "prop_agac_tac", "prop_bank", "prop_lamba", "prop_saksi", "prop_kedi", ...KOD_KOZMETIK];
const ESIK = JSON.parse(fs.readFileSync(path.join(BURASI, "ustveri/_esikler.json"), "utf8"));
// §E.1: tür × kozmetik takılı pozlar tek aile üstverisinden (ustveri/takili.json) türetilir.
const TAKILI = takiliListe();
const TAKILI_AD = TAKILI.map((t) => t.ad);
const TUM_HEPSI = [...TUM, ...TAKILI_AD];
const secilen = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const VARLIKLAR = secilen.length ? secilen.filter((a) => !a.endsWith(".json")) : TUM_HEPSI;
const ustveriOku = (ad) => {
  const t = TAKILI.find((x) => x.ad === ad);
  if (t) return { ...JSON.parse(fs.readFileSync(path.join(BURASI, "ustveri/takili.json"), "utf8")), glb: ad, tur: t.tur, koz: t.koz };
  return JSON.parse(fs.readFileSync(path.join(BURASI, "ustveri", ad + ".json"), "utf8"));
};
const dosyaAdi = (i, ad) => `${String(i + 1).padStart(2, "0")}-${ad.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase()}.png`;

let sunucu = null, tarayici = null;
try {
  fs.mkdirSync(CIKTI, { recursive: true });
  // Kodla çizilen kozmetikler (§A) ve takılı pozlar (§E.1) her koşuda yeniden üretilir — bayat GLB muayene edilmez.
  await uretilenleriHazirla();
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
    // (1) mekanik testler — Node, GLB geometrisi. Aday + susturulan listesi commit edilir (adaylar.json)
    const dosya = path.join(KOK, u.klasor ? u.klasor.replace(/^\//, "") : "public/meydan/deneme", u.glb + ".glb");   // 1H: aday GLB'leri kendi klasöründe
    const test = u.tip === "kozmetik_kod" ? await kodKozmetikTestEt(dosya, u, ESIK)
      : u.tip === "takili" ? await takiliTestEt(dosya, u, ESIK)
      : await varlikTestEt(dosya, u);
    fs.writeFileSync(path.join(klasor, "adaylar.json"), JSON.stringify(test, null, 1));
    const bilgi = await sayfa.evaluate((x) => window.muayene.hazirla(x), u);
    const dosyalar = [];
    for (let i = 0; i < bilgi.gorunumler.length; i++) {
      const url = await sayfa.evaluate((n) => window.muayene.ciz(n), i);
      const dosya = dosyaAdi(i, bilgi.gorunumler[i]);
      fs.writeFileSync(path.join(klasor, dosya), Buffer.from(url.split(",")[1], "base64"));
      dosyalar.push(dosya);
    }
    // (4) kontakt sayfası — varlık başına TEK dosya (commit edilen)
    const jpeg = await sayfa.evaluate((b) => window.muayene.kontakt(b), { varlik: ad, ucgen: bilgi.ucgen, malzeme: bilgi.malzeme, adaylar: test.adaylar, susturulanSayisi: test.susturulan.length, tarih: new Date().toLocaleDateString("tr-TR") });
    fs.writeFileSync(path.join(klasor, "kontakt.jpg"), Buffer.from(jpeg.split(",")[1], "base64"));
    const sayac = (liste) => liste.reduce((m, a) => ((m[a.test] = (m[a.test] ?? 0) + 1), m), {});
    ozet.varliklar[ad] = { ucgen: bilgi.ucgen, malzeme: bilgi.malzeme, gorunumler: bilgi.gorunumler, dosyalar, aday: sayac(test.adaylar), susturulan: sayac(test.susturulan) };
    ozet.gpu = bilgi.gpu;
    console.log(`[muayene] ${ad}: ${dosyalar.length} görünüm · ${bilgi.ucgen} üçgen · ${bilgi.malzeme} malzeme · ${test.adaylar.length} aday · ${test.susturulan.length} susturulan`);
  }
  // §E.2: portre kadrajı testi — kart portresi oyunun kendi koduyla çizilir, kozmetiğin GÖRÜNEN alanı ve taşması ölçülür.
  // Seçimli koşuda atlanır (tam koşunun testi), `--portre` ile zorlanır.
  if (!secilen.length || process.argv.includes("--portre")) {
    const pSayfa = await tarayici.newPage({ viewport: { width: 400, height: 400 }, deviceScaleFactor: 1 });
    const pHata = [];
    pSayfa.on("pageerror", (e) => pHata.push(String(e)));
    try {
      await pSayfa.goto(`http://localhost:${sunucu.config.server.port}/bildim/harita/muayene/portre.html`);
      await pSayfa.waitForFunction(() => window.portreHazir, null, { timeout: 90000 });
      const liste = TAKILI.filter((t) => t.koz !== "kuyruk").map((t) => ({ tur: t.tur, koz: t.koz }));
      const olcum = await pSayfa.evaluate((l) => window.portreOlc(l), liste);
      const klasor = path.join(CIKTI, "portre_kadraj");
      fs.mkdirSync(klasor, { recursive: true });
      const adaylar = [];
      for (const s of olcum) {
        fs.writeFileSync(path.join(klasor, `${s.tur}_${s.koz}.png`), Buffer.from(s.resim.split(",")[1], "base64"));
        delete s.resim;
        if (s.tasma_orani > ESIK.portre_tasma_orani) adaylar.push({ ...s, test: "portre_kadraj", sebep: `kadraj dışına taşıyor (%${Math.round(s.tasma_orani * 100)})` });
        else if (s.alan_orani < ESIK.portre_asgari_oran) adaylar.push({ ...s, test: "portre_kadraj", sebep: `kartta seçilemiyor: görünen alan %${(s.alan_orani * 100).toFixed(1)} < %${ESIK.portre_asgari_oran * 100}` });
      }
      fs.writeFileSync(path.join(klasor, "portre_kadraj.json"), JSON.stringify({ esik: { portre_asgari_oran: ESIK.portre_asgari_oran, portre_tasma_orani: ESIK.portre_tasma_orani }, olcum, adaylar }, null, 1));
      ozet.portre_kadraj = { olculen: olcum.length, aday: adaylar.length, adaylar };
      console.log(`[muayene] portre kadrajı: ${olcum.length} kart ölçüldü · ${adaylar.length} aday${adaylar.map((a) => `\n  ${a.tur}/${a.koz}: ${a.sebep}`).join("")}`);
    } catch (e) {
      console.error("[muayene] portre kadrajı başarısız:", e);
      process.exitCode = 1;
    } finally {
      if (pHata.length) console.error("[muayene] portre sayfa hatası:", pHata.slice(0, 3).join(" | "));
      await pSayfa.close().catch(() => {});
    }
  }

  // 1H: npm run muayene -- --karsilastir <sayfa.json …>  → cikti/<sayfa>.jpg (gövde karşılaştırma sayfaları)
  for (const s of process.argv.includes("--karsilastir") ? secilen.filter((a) => a.endsWith(".json")) : []) {
    const tanim = JSON.parse(fs.readFileSync(path.resolve(KOK, s), "utf8"));
    for (const k of tanim.sutunlar) if (k.ustveriAd) k.ustveri = ustveriOku(k.ustveriAd);
    const jpeg = await sayfa.evaluate((t) => window.muayene.karsilastir(t), tanim);
    const hedef = path.join(CIKTI, path.basename(s, ".json") + ".jpg");
    fs.writeFileSync(hedef, Buffer.from(jpeg.split(",")[1], "base64"));
    console.log(`[muayene] karşılaştırma sayfası: ${path.relative(KOK, hedef)}`);
  }
  if (VARLIKLAR.length) fs.writeFileSync(path.join(CIKTI, secilen.length ? "ozet_secim.json" : "ozet.json"), JSON.stringify(ozet, null, 1));   // 1H: seçimli koşu tam özeti ezmez
  console.log(`[muayene] WebGL: ${ozet.gpu}`);
  console.log(`[muayene] konsol hatası: ${konsolHatalari.length}${konsolHatalari.length ? "\n  " + konsolHatalari.slice(0, 5).join("\n  ") : ""}`);
} catch (e) {
  console.error("[muayene] başarısız:", e);
  process.exitCode = 1;
} finally {
  await tarayici?.close().catch(() => {});
  await sunucu?.close().catch(() => {});
}

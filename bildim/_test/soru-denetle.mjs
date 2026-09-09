// Soru partisi denetleyici + uygulayıcı.
//
// Kullanım:
//   node bildim/_test/soru-denetle.mjs <parti.json>          -> yalnız rapor
//   node bildim/_test/soru-denetle.mjs <parti.json> uygula    -> geçenleri ekler
//
// Parti biçimi: [{ soru, secenekler:[4], dogru: 0..3, kategori }]
//
// Süzgeçler (PROGRESS'teki kalite hattının kodlanmış hâli):
//  1  Biçim: 4 benzersiz şık, soru işaretiyle bitiş, şık uzunluğu <= 40
//  2  Doğru şık indeksi geçerli, şıklar boş değil
//  3  Parti içi birebir tekrar
//  4  Canlı havuzla birebir tekrar (normalize metin)
//  5  Canlı havuzla ANLAM örtüşmesi: aynı cevap + >=3 ortak anahtar kelime
//  6  Parti içi anlam örtüşmesi (aynı partide aynı bilgiyi iki kez sorma)
//  7  Zamana bağlı / yoruma açık kalıp yasağı ("günümüzde", "en iyi"...)
//  8  AŞIRI BASİT kalıp yasağı (ilkokul seviyesi)
//  9  Şıkların hepsi aynı uzunlukta/biçimde olmasın diye tek kelimelik
//     cevaplarda uyarı (engel değil)
// 10  Doğru şık dağılımı: parti içinde 0/1/2/3 dengeli mi (rapor)

import fs from "node:fs";
import pg from "pg";

const NORM = (s) =>
  String(s).toLowerCase()
    .replace(/[ıİ]/g, "i").replace(/[şŞ]/g, "s").replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u").replace(/[öÖ]/g, "o").replace(/[çÇ]/g, "c")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const DOLGU = new Set(["hangi", "nedir", "kimdir", "kac", "ne", "bir", "olarak", "icin",
  "hangisidir", "neresidir", "en", "ile", "da", "de", "bu", "su", "o", "ve", "veya",
  "adi", "adiyla", "gore", "yaklasik", "vardir", "olur", "yapilir", "denir", "gelir",
  "hangisi", "kim", "nerede", "neyi", "neye", "neyle", "nasil", "kimin", "eseridir"]);

const KELIME = (s) => new Set(NORM(s).split(" ").filter((w) => w.length > 2 && !DOLGU.has(w)));

// 7 — zamana bağlı / yoruma açık
const YASAK_KALIP = [
  /günümüzde|şu anda|şu an|bugün itibar|güncel olarak/i,
  /\ben iyi\b|\ben ünlü\b|\ben sevilen\b|\ben popüler\b|\ben başarılı\b/i,
  /nüfusu kaçtır|kaç kişidir|fiyatı ne kadar/i,
  /son (şampiyon|kazanan|kupa)/i,
  /kaç takipçi|kaç abone/i,
];

// 8 — aşırı basit kalıplar
const BASIT_KALIP = [
  /kaç (gün|mevsim|parmak|ayak|bacak|göz|kanat|tekerlek|kol) (var|vardır)/i,
  /haftada kaç|yılda kaç ay|günde kaç saat/i,
  /hangi renk oluşur|ne renktir|renkleri karıştır/i,
  /(fransa|italya|japonya|ingiltere|rusya|ispanya|almanya|yunanistan|türkiye|abd|çin)['’]?n?[ıi]n başkenti/i,
  /suyun (formülü|kaynama sıcaklığı)|kaç derecede kaynar/i,
  /kaç mevsim|kaç kıta|kaç okyanus/i,
  /trafik ışığında (kırmızı|yeşil)/i,
  /en büyük gezegen|dünyanın uydusu/i,
  /kaç duyu organı|kanı pompalayan/i,
  /\b(1\+1|2\+2)\b|yarısı kaçtır/i,
];

const dosya = process.argv[2];
const uygula = process.argv[3] === "uygula";
if (!dosya) { console.error("kullanım: node soru-denetle.mjs <parti.json> [uygula]"); process.exit(1); }

const parti = JSON.parse(fs.readFileSync(dosya, "utf8"));

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const c = new pg.Client({
  connectionString: `postgresql://postgres.zfpnxzybcpkxsotwdsey:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false }, statement_timeout: 300000,
});
await c.connect();

// Canlı havuz (pasifler dahil: pasiflenmiş bir soruyu yeniden eklemeyelim)
const { rows: mevcut } = await c.query(
  "select soru, kategori, (secenekler->>dogru_cevap) as cevap from public.questions"
);
const mevcutNorm = new Set(mevcut.map((m) => NORM(m.soru)));
const cevapDizin = new Map();
for (const m of mevcut) {
  const k = NORM(m.cevap ?? "");
  if (!k) continue;
  if (!cevapDizin.has(k)) cevapDizin.set(k, []);
  cevapDizin.get(k).push(KELIME(m.soru));
}

const gecen = [];
const red = [];
const partiNorm = new Set();
const partiCevap = new Map();

for (const q of parti) {
  const hata = [];
  const sik = q.secenekler;

  if (!q.soru || !Array.isArray(sik) || sik.length !== 4) hata.push("4 şık yok");
  else {
    if (new Set(sik.map((s) => NORM(s))).size !== 4) hata.push("şıklar benzersiz değil");
    if (sik.some((s) => !String(s).trim())) hata.push("boş şık");
    const uzun = sik.find((s) => String(s).length > 40);
    if (uzun) hata.push(`şık 40 karakteri aşıyor: "${uzun}"`);
  }
  if (!/\?$/.test(String(q.soru).trim())) hata.push("soru işaretiyle bitmiyor");
  if (!(q.dogru >= 0 && q.dogru <= 3)) hata.push("doğru şık indeksi geçersiz");
  if (String(q.soru).length > 120) hata.push("soru çok uzun (>120)");

  for (const k of YASAK_KALIP) if (k.test(q.soru)) hata.push("zamana bağlı/yoruma açık kalıp");
  for (const k of BASIT_KALIP) if (k.test(q.soru)) hata.push("aşırı basit kalıp");

  const n = NORM(q.soru);
  if (partiNorm.has(n)) hata.push("parti içinde tekrar");
  if (mevcutNorm.has(n)) hata.push("havuzda birebir var");

  // Anlam örtüşmesi
  if (hata.length === 0) {
    const cev = NORM(sik[q.dogru]);
    const kel = KELIME(q.soru);
    const kars = [...(cevapDizin.get(cev) ?? []), ...(partiCevap.get(cev) ?? [])];
    for (const k of kars) {
      const ortak = [...kel].filter((w) => k.has(w)).length;
      const kucuk = Math.min(kel.size, k.size);
      if (ortak >= 3 || (kucuk > 0 && ortak / kucuk >= 0.7 && ortak >= 2)) {
        hata.push("aynı bilgi zaten soruluyor (anlam örtüşmesi)");
        break;
      }
    }
    if (hata.length === 0) {
      if (!partiCevap.has(cev)) partiCevap.set(cev, []);
      partiCevap.get(cev).push(kel);
    }
  }

  if (hata.length) red.push({ soru: q.soru, hata });
  else { gecen.push(q); partiNorm.add(n); }
}

// 10 — doğru şık dağılımı
const dagilim = [0, 0, 0, 0];
for (const q of gecen) dagilim[q.dogru]++;

console.log(`parti: ${parti.length} soru`);
console.log(`GEÇEN: ${gecen.length}   RED: ${red.length}`);
console.log(`doğru şık dağılımı (0/1/2/3): ${dagilim.join(" / ")}`);
const kat = {};
for (const q of gecen) kat[q.kategori] = (kat[q.kategori] ?? 0) + 1;
console.log("kategori:", kat);
if (red.length) {
  console.log("\nreddedilenler:");
  for (const r of red.slice(0, 40)) console.log(` - ${r.soru}\n     ${r.hata.join(" | ")}`);
  if (red.length > 40) console.log(` ... (+${red.length - 40})`);
}

if (uygula && gecen.length) {
  const degerler = gecen.map((q) => [q.soru, JSON.stringify(q.secenekler), q.dogru, q.kategori]);
  const metin = degerler
    .map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}::jsonb, $${i * 4 + 3}, $${i * 4 + 4})`)
    .join(",");
  await c.query(
    `insert into public.questions (soru, secenekler, dogru_cevap, kategori)
     values ${metin} on conflict (soru) do nothing`,
    degerler.flat()
  );
  const son = await c.query(
    "select kategori, count(*) as aktif from public.questions where aktif group by 1 order by 2"
  );
  console.log("\nUYGULANDI. güncel havuz:");
  console.table(son.rows);
}
await c.end();

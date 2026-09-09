// Soru havuzu temizliği:
//  1) AŞIRI BASİT sorular (elle incelenip onaylanan liste) pasife alınır.
//  2) Aynı bilgiyi farklı kelimelerle soran KOPYA sorular teke indirilir.
// Hiçbir soru silinmez; `aktif = false` yapılır (geri alınabilir).
import fs from "node:fs";
import pg from "pg";

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

const { rows } = await c.query(
  "select id, soru, kategori, (secenekler->>dogru_cevap) as cevap, created_at from public.questions where aktif"
);

const norm = (s) =>
  s.toLowerCase()
    .replace(/[ıİ]/g, "i").replace(/[şŞ]/g, "s").replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u").replace(/[öÖ]/g, "o").replace(/[çÇ]/g, "c")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// Anlam taşımayan kelimeler örtüşme sayımına girmesin
const DOLGU = new Set(["hangi", "nedir", "kimdir", "kac", "ne", "bir", "olarak", "icin",
  "hangisidir", "neresidir", "en", "ile", "da", "de", "bu", "su", "o", "ve", "veya",
  "adi", "adiyla", "gore", "yaklasik", "vardir", "olur", "yapilir", "denir", "gelir"]);

const kelimeler = (s) => new Set(norm(s).split(" ").filter((w) => w.length > 2 && !DOLGU.has(w)));

// --- 1) Kopya kümeleri ---
const cevapla = new Map();
for (const q of rows) {
  const k = norm(q.cevap ?? "");
  if (!k) continue;
  if (!cevapla.has(k)) cevapla.set(k, []);
  cevapla.get(k).push({ ...q, kel: kelimeler(q.soru) });
}

const pasif = new Map(); // id -> sebep
for (const [, grup] of cevapla) {
  if (grup.length < 2) continue;
  const kullanildi = new Set();
  for (let i = 0; i < grup.length; i++) {
    if (kullanildi.has(grup[i].id)) continue;
    const kume = [grup[i]];
    for (let j = i + 1; j < grup.length; j++) {
      if (kullanildi.has(grup[j].id)) continue;
      const ortak = [...grup[i].kel].filter((w) => grup[j].kel.has(w)).length;
      const kucuk = Math.min(grup[i].kel.size, grup[j].kel.size);
      if (ortak >= 3 || (kucuk > 0 && ortak / kucuk >= 0.7 && ortak >= 2)) kume.push(grup[j]);
    }
    if (kume.length < 2) continue;
    // En AYRINTILI soruyu tut (uzun metin = daha bağlamlı), gerisini pasifle
    kume.sort((a, b) => b.soru.length - a.soru.length);
    for (const q of kume.slice(1)) { pasif.set(q.id, "kopya"); kullanildi.add(q.id); }
    kullanildi.add(kume[0].id);
  }
}

// --- 2) Aşırı basit liste (elle incelendi) ---
const BASIT = JSON.parse(fs.readFileSync("bildim/_test/asiri-basit-liste.json", "utf8"));
const basitKume = new Set(BASIT.map(norm));
for (const q of rows) if (basitKume.has(norm(q.soru))) pasif.set(q.id, "asiri_basit");

console.log("kopya olarak pasiflenecek:", [...pasif.values()].filter((v) => v === "kopya").length);
console.log("aşırı basit olarak pasiflenecek:", [...pasif.values()].filter((v) => v === "asiri_basit").length);
console.log("toplam:", pasif.size);

if (process.argv[2] === "uygula") {
  const idler = [...pasif.keys()];
  await c.query("update public.questions set aktif = false where id = any($1::uuid[])", [idler]);
  const son = await c.query("select count(*) filter (where aktif) as aktif from public.questions");
  console.log("UYGULANDI. kalan aktif soru:", son.rows[0].aktif);
} else {
  // Yalnız rapor: hangi sorular gidiyor
  const ornek = rows.filter((q) => pasif.has(q.id)).slice(0, 25);
  console.log("\nörnek:");
  for (const q of ornek) console.log(` [${pasif.get(q.id)}] ${q.soru}`);
}
await c.end();

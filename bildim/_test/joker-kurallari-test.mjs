// Bildim! — sunucu kurallarını kanıtlayan başsız test koşucusu.
//
// Kullanım:
//   node bildim/_test/joker-kurallari-test.mjs
//
// .env.local içindeki SUPABASE_DB_PASSWORD ile canlı veritabanına bağlanır,
// 052/053/054 migration'larını (henüz uygulanmadıysa) ve testi TEK bir
// transaction içinde çalıştırır, sonunda ROLLBACK yapar — canlı veri değişmez.
//
// `pg` paketi kurulu değilse: npm i --no-save pg
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const buDosya = fileURLToPath(import.meta.url);
const kok = path.resolve(path.dirname(buDosya), "..", "..");

function envOku(dosya) {
  try {
    const metin = fs.readFileSync(path.join(kok, dosya), "utf8");
    const cikti = {};
    for (const satir of metin.split(/\r?\n/)) {
      const e = satir.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (e) cikti[e[1]] = e[2].replace(/^["']|["']$/g, "");
    }
    return cikti;
  } catch {
    return {};
  }
}

const env = { ...envOku(".env"), ...envOku(".env.local"), ...process.env };
const sifre = env.SUPABASE_DB_PASSWORD;
if (!sifre) {
  console.error(
    "SUPABASE_DB_PASSWORD bulunamadı (.env.local). Test canlı DB'ye bağlanamıyor."
  );
  process.exit(1);
}

const PROJE = "zfpnxzybcpkxsotwdsey";
const BAGLANTI =
  `postgresql://postgres.${PROJE}:${encodeURIComponent(sifre)}` +
  `@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`;

let pg;
try {
  pg = (await import("pg")).default;
} catch {
  console.error("`pg` paketi yok. Kur: npm i --no-save pg");
  process.exit(1);
}

// Migration'lar zaten uygulanmışsa tekrar çalıştırmak zararsız
// (hepsi create-or-replace / if not exists).
const MIGRATIONLAR = [
  // Önkoşullar (henüz canlıya uygulanmadıysa): gorunen_ad, genel_kultur, kuyruk
  "supabase/migrations/20260612000047_takma_ad_gizlilik.sql",
  "supabase/migrations/20260612000048_genel_kultur_kategori.sql",
  "supabase/migrations/20260612000052_joker_ekonomisi.sql",
  "supabase/migrations/20260612000053_seri_rovans_ustalik.sql",
  "supabase/migrations/20260612000054_hizli_mod.sql",
  "supabase/migrations/20260612000055_seri_hatirlatma.sql",
];

const parcalar = ["begin;"];
for (const m of MIGRATIONLAR) parcalar.push(fs.readFileSync(path.join(kok, m), "utf8"));
parcalar.push(fs.readFileSync(path.join(kok, "bildim/_test/joker-kurallari-test.sql"), "utf8"));
parcalar.push("rollback;");

const istemci = new pg.Client({
  connectionString: BAGLANTI,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 300000,
});

let cikisKodu = 0;
try {
  await istemci.connect();
  const sonuclar = await istemci.query(parcalar.join("\n"));
  const diziler = Array.isArray(sonuclar) ? sonuclar : [sonuclar];

  // Son iki SELECT: ayrıntı tablosu ve özet
  const tablolar = diziler.filter((s) => s.rows && s.rows.length);
  const ayrinti = tablolar[tablolar.length - 2];
  const ozet = tablolar[tablolar.length - 1];

  if (ayrinti) {
    console.log("\n=== SUNUCU KURALI TESTLERİ ===");
    for (const s of ayrinti.rows) {
      const im = s.durum === "GEÇTİ" ? "✓" : "✗";
      console.log(`${im} ${String(s.sira).padStart(2)} ${s.ad}`);
      if (s.durum !== "GEÇTİ") console.log(`     dönen: ${s.gercek}`);
    }
  }
  if (ozet) {
    const o = ozet.rows[0];
    console.log(`\nGeçen: ${o.gecen} / ${o.toplam}   Kalan: ${o.kalan}`);
    if (Number(o.kalan) > 0) cikisKodu = 1;
  }
  console.log("(Tüm değişiklikler ROLLBACK edildi — canlı veri değişmedi.)");
} catch (e) {
  console.error("HATA:", e.message);
  if (e.hint) console.error("ipucu:", e.hint);
  cikisKodu = 1;
} finally {
  await istemci.end().catch(() => {});
}
process.exitCode = cikisKodu;

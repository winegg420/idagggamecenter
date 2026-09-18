// Bildim! — sunucu kurallarını kanıtlayan başsız test koşucusu.
//
// Kullanım:
//   node bildim/_test/joker-kurallari-test.mjs
//
// .env.local içindeki SUPABASE_DB_PASSWORD ile canlı veritabanına bağlanır,
// 052/053/054 migration'larını (henüz uygulanmadıysa) ve testi TEK bir
// transaction içinde çalıştırır, sonunda ROLLBACK yapar — canlı veri değişmez.
//
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

// Paket 26: `pg` paketi bu depoya kurulmaz (yeni npm paketi yasak). Protokolün
// gereken kadarı araclar/pg-mini.mjs içinde; test artık onunla bağlanıyor.
const { PgIstemci, baglantiDizgisi } = await import("../../araclar/pg-mini.mjs");

// Bağlantı kaynağı tek yerden: SUPABASE_DB_URL (CI) ya da .env.local (yerel).
// Eskiden yalnız .env.local aranıyor ve bulunamayınca test KIRILIYORDU; CI'da
// .env.local olmadığı için bütün iş kırmızı dönüyordu (18 Eyl 2026'da ölçüldü).
// Artık bağlantı yoksa test ATLANIR: sırrı olmayan bir ortamda `npm test` yeşil
// kalır ve atlandığını söyler.
const BAGLANTI = process.env.SUPABASE_DB_URL || (await baglantiDizgisi());
if (!BAGLANTI) {
  console.log(
    "ATLANDI: veritabanı bağlantısı yok (SUPABASE_DB_URL ya da .env.local gerekli)."
  );
  process.exit(0);
}
// envOku yalnız yerel kullanım için duruyor (başka ayar okunmak istenirse).
void envOku;

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

// Paket 26: yukarıdaki migration'lar canlıya Haziran'da uygulandı ve o gün bugün
// fonksiyonların dönüş tipleri değişti; eskisini yeniden çalıştırmak
// "cannot change return type of existing function" ile patlıyordu — yani bu test
// bir süredir hiç koşmuyordu (`pg` paketi eksik olduğu için de fark edilmemişti).
// Artık canlı şema ne ise onun üzerinde koşuyor; migration tekrarı kaldırıldı.
const parcalar = ["begin;"];
parcalar.push(fs.readFileSync(path.join(kok, "bildim/_test/joker-kurallari-test.sql"), "utf8"));
parcalar.push("rollback;");

const istemci = new PgIstemci(BAGLANTI);

let cikisKodu = 0;
try {
  await istemci.baglan();
  const diziler = (await istemci.sorguCoklu(parcalar.join("\n"))).map((rows) => ({ rows }));

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
  await istemci.kapat();
}
process.exitCode = cikisKodu;

/**
 * BİLDİM (Quizador) — mevcut havuzda ŞIK UZUNLUĞU DENGELEME
 *
 * SORUN (canlı havuzda ölçüldü, tahmin değil):
 *   Doğru şık ortalama 17,8 karakter, yanlış şıklar 10,0 karakter. Sonuç:
 *   "soruyu hiç okumadan en uzun şıkkı seç" stratejisi %68,1 başarıyla
 *   oynuyordu (4 şıkta rastlantı ~%25). Aynı dönemde gerçek oyuncular %59,9
 *   doğru yapıyordu — yani oyun bilgiyle değil şık uzunluğuna bakarak
 *   kazanılıyordu.
 *
 * ÇÖZÜM: yalnız ŞIKLAR yeniden yazılır. Soru metni ve doğru cevabın ANLAMI
 * korunur; hiçbir soru silinmez, hiçbir sorunun cevabı değişmez.
 *
 * Çeviriyi (ceviri.mjs) model yapar; bu betik de aynı şekilde yalnız İŞ
 * AKIŞINI yürütür:
 *
 *   node bildim/_test/sik-dengele.mjs durum            → ölçüm tablosu
 *   node bildim/_test/sik-dengele.mjs parti [n]        → dengelenecek n soru
 *   node bildim/_test/sik-dengele.mjs yaz <dosya.json> → doğrulayıp uygular
 *   node bildim/_test/sik-dengele.mjs ornek [n]        → uygulanmış örnekler
 *
 * YENİDEN BAŞLATILABİLİR: imleç dosyası YOK. Sıradaki parti doğrudan
 * "denge kapısını geçemeyen sorular" sorgusuyla bulunur; uygulanan soru
 * kapıyı geçtiği için bir daha partide çıkmaz.
 *
 * GERİ DÖNÜŞ: değiştirilen her sorunun ESKİ HÂLİ, yazmadan önce
 * bildim/veri/sik-dengeleme-yedek.jsonl dosyasına eklenir (id + eski
 * secenekler + eski dogru_cevap). Dosya versiyon kontrolündedir; proje
 * veritabanının otomatik yedeği olmadığı için (bkz. YEDEKLEME.md) tek geri
 * dönüş yolu budur.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const KOK = process.cwd();
const PARTI_BOYU = 20;
const YEDEK = path.join(KOK, "bildim", "veri", "sik-dengeleme-yedek.jsonl");

// Kapı eşikleri kalite.ts ile AYNI olmalı; oradaki notta eşiklerin hangi
// ölçümle seçildiği yazıyor. Burada tekrarlanıyor çünkü bu betik Node'da
// çalışır ve Deno tarafındaki kalite.ts'i import edemez.
const DENGE_ORANI = 1.4;
const DENGE_MUAF_FARK = 3;

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(KOK, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const c = new pg.Client({
  connectionString: `postgresql://postgres.zfpnxzybcpkxsotwdsey:${encodeURIComponent(
    env.SUPABASE_DB_PASSWORD
  )}@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 300000,
});

const siklar = (r) =>
  (Array.isArray(r.secenekler) ? r.secenekler : JSON.parse(r.secenekler)).map((s) => String(s));

/** Doğru şık / yanlış şıkların ortalaması. */
function oran(sec, dogru) {
  const uz = sec.map((s) => s.trim().length);
  const dig = uz.filter((_, i) => i !== dogru);
  const ort = dig.reduce((a, b) => a + b, 0) / dig.length;
  return ort === 0 ? Infinity : uz[dogru] / ort;
}

/** Doğru şık, yanlışların ortalamasından kaç karakter uzun. */
function fark(sec, dogru) {
  const uz = sec.map((s) => s.trim().length);
  const dig = uz.filter((_, i) => i !== dogru);
  return uz[dogru] - dig.reduce((a, b) => a + b, 0) / dig.length;
}

/** kalite.ts:uzunlukEleVeriyorMu ile aynı kural. */
const eleVeriyor = (sec, dogru) =>
  oran(sec, dogru) > DENGE_ORANI && fark(sec, dogru) > DENGE_MUAF_FARK;

/** "En uzun şıkkı seç" stratejisinin beklenen başarısı (eşitlikte bölüşür). */
function stratejiBasari(kayitlar) {
  if (kayitlar.length === 0) return "0.0";
  let t = 0;
  for (const r of kayitlar) {
    const uz = siklar(r).map((s) => s.trim().length);
    const mx = Math.max(...uz);
    const kac = uz.filter((x) => x === mx).length;
    if (uz[r.dogru_cevap] === mx) t += 1 / kac;
  }
  return ((100 * t) / kayitlar.length).toFixed(1);
}

const NORM = (s) =>
  String(s)
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Anlam korundu mu: eski ve yeni doğru şık en az bir anlamlı kelimeyi paylaşmalı. */
function anlamKorundu(eskiDogru, yeniDogru) {
  const a = new Set(NORM(eskiDogru).split(" ").filter((w) => w.length >= 3));
  const b = new Set(NORM(yeniDogru).split(" ").filter((w) => w.length >= 3));
  if (a.size === 0 || b.size === 0) {
    // Çok kısa cevaplar ("1", "pH") — birebir aynı kalmalı.
    return NORM(eskiDogru) === NORM(yeniDogru);
  }
  for (const w of a) if (b.has(w)) return true;
  return false;
}

async function tumSorular(kapsam) {
  const k = kapsam ? "and kapsam = $1" : "";
  const r = await c.query(
    `select id, kapsam, kategori, soru, secenekler, dogru_cevap
       from public.questions where aktif ${k}`,
    kapsam ? [kapsam] : []
  );
  return r.rows;
}

async function durum() {
  const hepsi = await tumSorular(null);
  const satir = [];
  for (const kapsam of ["global", "yerel"]) {
    const grup = hepsi.filter((r) => r.kapsam === kapsam);
    const bozuk = grup.filter((r) => eleVeriyor(siklar(r), r.dogru_cevap));
    const saglam = grup.filter((r) => !eleVeriyor(siklar(r), r.dogru_cevap));
    satir.push({
      kapsam,
      toplam: grup.length,
      dengesiz: bozuk.length,
      kalan_yuzde: `${((100 * bozuk.length) / grup.length).toFixed(1)}%`,
      strateji_simdi: `${stratejiBasari(grup)}%`,
      strateji_hedef: `${stratejiBasari(saglam)}%`,
    });
  }
  console.table(satir);
  console.log("strateji = 'soruyu okumadan en uzun şıkkı seç' başarısı (rastlantı ~%25)");
  const yedek = fs.existsSync(YEDEK)
    ? fs.readFileSync(YEDEK, "utf8").split("\n").filter(Boolean).length
    : 0;
  console.log(`yedeklenmiş (dengelenmiş) soru: ${yedek}`);
}

async function parti(adet) {
  const hepsi = await tumSorular(null);
  const bozuk = hepsi
    .filter((r) => eleVeriyor(siklar(r), r.dogru_cevap))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .slice(0, adet);

  console.log(
    JSON.stringify(
      bozuk.map((r) => ({
        id: r.id,
        kategori: r.kategori,
        soru: r.soru,
        secenekler: siklar(r),
        dogru_cevap: r.dogru_cevap,
        // Rapor için: şu anki uzunluklar
        _uzunluk: siklar(r).map((s) => s.trim().length),
      })),
      null,
      1
    )
  );
  console.error(`\n${bozuk.length} soru yazdırıldı.`);
}

async function yaz(dosya) {
  const gelen = JSON.parse(fs.readFileSync(dosya, "utf8"));
  if (!Array.isArray(gelen)) throw new Error("Dosya bir dizi olmalı");

  const idler = gelen.map((g) => g.id);
  const mevcut = await c.query(
    `select id, soru, secenekler, dogru_cevap from public.questions where id = any($1::uuid[])`,
    [idler]
  );
  const harita = new Map(mevcut.rows.map((r) => [r.id, r]));

  const gecen = [];
  const elenen = [];

  for (const g of gelen) {
    const eski = harita.get(g.id);
    const hata = (s) => elenen.push({ id: g.id, soru: (g.soru ?? "").slice(0, 45), sebep: s });

    if (!eski) { hata("havuzda yok"); continue; }
    const yeniSec = (g.secenekler ?? []).map((s) => String(s ?? "").trim());
    const eskiSec = siklar(eski);

    if (yeniSec.length !== eskiSec.length) { hata(`şık sayısı ${eskiSec.length} olmalı`); continue; }
    if (yeniSec.some((s) => !s)) { hata("boş şık"); continue; }
    if (new Set(yeniSec.map(NORM)).size !== yeniSec.length) { hata("şıklar birbirinin aynısı"); continue; }
    if (!Number.isInteger(g.dogru_cevap) || g.dogru_cevap < 0 || g.dogru_cevap >= yeniSec.length) {
      hata("dogru_cevap aralık dışı"); continue;
    }
    // Soru metni DEĞİŞMEMELİ: bu iş yalnız şıkları düzeltir.
    if (NORM(g.soru ?? eski.soru) !== NORM(eski.soru)) { hata("soru metni değişmiş"); continue; }
    // Doğru cevabın anlamı korunmalı.
    if (!anlamKorundu(eskiSec[eski.dogru_cevap], yeniSec[g.dogru_cevap])) {
      hata("doğru cevabın anlamı değişmiş"); continue;
    }
    // Cevap soru metninde geçmesin (yeniden yazarken sızabilir).
    const cev = NORM(yeniSec[g.dogru_cevap]).replace(/ /g, "");
    if (cev.length >= 4 && NORM(eski.soru).replace(/ /g, "").includes(cev)) {
      hata("cevap sorunun içinde geçiyor"); continue;
    }
    // ASIL KAPI: yeni hâli uzunlukla ele vermemeli.
    if (eleVeriyor(yeniSec, g.dogru_cevap)) {
      hata(`hâlâ dengesiz (oran ${oran(yeniSec, g.dogru_cevap).toFixed(2)})`); continue;
    }

    gecen.push({ id: g.id, yeniSec, yeniDogru: g.dogru_cevap, eski });
  }

  if (gecen.length === 0) {
    console.table(elenen);
    console.log("Yazılacak soru yok.");
    return;
  }

  // ÖNCE YEDEK, sonra yazma. Sıra önemli: yazma yarıda kalırsa bile eski
  // hâl diskte durur.
  fs.mkdirSync(path.dirname(YEDEK), { recursive: true });
  fs.appendFileSync(
    YEDEK,
    gecen
      .map((g) =>
        JSON.stringify({
          id: g.id,
          tarih: new Date().toISOString(),
          eski_secenekler: siklar(g.eski),
          eski_dogru_cevap: g.eski.dogru_cevap,
          yeni_secenekler: g.yeniSec,
          yeni_dogru_cevap: g.yeniDogru,
        })
      )
      .join("\n") + "\n",
    "utf8"
  );

  await c.query("begin");
  try {
    for (const g of gecen) {
      await c.query(
        `update public.questions set secenekler = $2::jsonb, dogru_cevap = $3 where id = $1`,
        [g.id, JSON.stringify(g.yeniSec), g.yeniDogru]
      );
    }
    await c.query("commit");
  } catch (e) {
    await c.query("rollback");
    throw e;
  }

  console.log(`yazıldı: ${gecen.length}, elenen: ${elenen.length}`);
  if (elenen.length) console.table(elenen);
}

async function ornek(n) {
  if (!fs.existsSync(YEDEK)) { console.log("Henüz dengelenmiş soru yok."); return; }
  const satirlar = fs.readFileSync(YEDEK, "utf8").split("\n").filter(Boolean).slice(-n);
  for (const s of satirlar) {
    const y = JSON.parse(s);
    const r = await c.query("select soru from public.questions where id = $1", [y.id]);
    console.log(`\n${r.rows[0]?.soru ?? y.id}`);
    console.log(
      "  ESKİ: " +
        y.eski_secenekler.map((x, i) => (i === y.eski_dogru_cevap ? "*" : " ") + x).join(" | ")
    );
    console.log(
      "  YENİ: " +
        y.yeni_secenekler.map((x, i) => (i === y.yeni_dogru_cevap ? "*" : " ") + x).join(" | ")
    );
  }
}

const komut = process.argv[2];
await c.connect();
try {
  if (komut === "durum") await durum();
  else if (komut === "parti") await parti(Number(process.argv[3]) || PARTI_BOYU);
  else if (komut === "yaz") await yaz(process.argv[3]);
  else if (komut === "ornek") await ornek(Number(process.argv[3]) || 5);
  else {
    console.error("kullanım: durum | parti [n] | yaz <dosya.json> | ornek [n]");
    process.exitCode = 1;
  }
} finally {
  await c.end();
}

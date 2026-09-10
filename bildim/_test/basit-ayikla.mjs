/**
 * BİLDİM — "aşırı basit" (ilkokul düzeyi) soruların ayıklanması
 *
 * NEDEN ELLE: kalıp/regex denendi ve güvenilmez çıktı. Geniş sinyaller
 * ("ne işe yarar?", kısa soru + kısa şık) 686 aday üretti ve içinde
 * "Frekans birimi nedir?", "Fotosentez hangi organelde gerçekleşir?" gibi
 * tamamen meşru sorular vardı. Dar kalıplar ise 15 adayda kaldı ve onlarda
 * da yanlış eşleşme oldu ("And Dağları kaç ülkeden geçer" içindeki "arı").
 * Bu yüzden karar okunarak veriliyor; betik yalnız iş akışını yürütür.
 *
 *   node bildim/_test/basit-ayikla.mjs parti [n] [atla]  → okunacak sorular
 *   node bildim/_test/basit-ayikla.mjs ele <dosya>       → id listesini pasife çeker
 *   node bildim/_test/basit-ayikla.mjs durum             → sayım
 *   node bildim/_test/basit-ayikla.mjs geri              → yedekten geri açar
 *
 * SİLME YOK: sorular `aktif = false` yapılır, satır durur. Her eleme
 * bildim/veri/basit-ayiklama-yedek.jsonl'e yazılır, `geri` ile açılabilir.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const KOK = process.cwd();
const YEDEK = path.join(KOK, "bildim", "veri", "basit-ayiklama-yedek.jsonl");

const env = Object.fromEntries(
  fs.readFileSync(path.join(KOK, ".env.local"), "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));

const c = new pg.Client({
  connectionString: `postgresql://postgres.zfpnxzybcpkxsotwdsey:${encodeURIComponent(
    env.SUPABASE_DB_PASSWORD)}@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false }, statement_timeout: 300000,
});

const siklar = (r) =>
  (Array.isArray(r.secenekler) ? r.secenekler : JSON.parse(r.secenekler)).map(String);

/** Okunacak parti: id ön eki + soru + doğru cevap. Şıklar gerekmiyor. */
async function parti(adet, atla) {
  const r = await c.query(
    `select id, soru, secenekler, dogru_cevap
       from public.questions where aktif
      order by id offset $2 limit $1`, [adet, atla]);
  for (const row of r.rows) {
    console.log(`${row.id.slice(0, 8)}\t${row.soru}\t${siklar(row)[row.dogru_cevap]}`);
  }
  console.error(`\n${r.rows.length} soru (atlanan: ${atla})`);
}

/** Dosyadaki id öneklerini pasife çeker. Satır: <id8> [<tab> not] */
async function ele(dosya) {
  const satirlar = fs.readFileSync(dosya, "utf8").split("\n")
    .map((s) => s.trim()).filter(Boolean).filter((s) => !s.startsWith("#"));
  const onekler = satirlar.map((s) => s.split("\t")[0]);
  if (onekler.length === 0) { console.log("liste boş"); return; }

  const r = await c.query(
    `select id, soru, secenekler, dogru_cevap, kategori, kapsam
       from public.questions
      where left(id::text, 8) = any($1::text[]) and aktif`, [onekler]);

  const say = new Map();
  for (const row of r.rows) {
    const k = row.id.slice(0, 8);
    say.set(k, (say.get(k) ?? 0) + 1);
  }
  const belirsiz = [...say.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  if (belirsiz.length) throw new Error(`id öneki benzersiz değil: ${belirsiz.join(", ")}`);

  const bulunan = new Set(r.rows.map((x) => x.id.slice(0, 8)));
  const eksik = onekler.filter((o) => !bulunan.has(o));

  // ÖNCE yedek, sonra yazma: yazma yarıda kalsa bile eski hâl diskte kalır.
  fs.mkdirSync(path.dirname(YEDEK), { recursive: true });
  fs.appendFileSync(YEDEK, r.rows.map((row) => JSON.stringify({
    id: row.id, tarih: new Date().toISOString(), kapsam: row.kapsam,
    kategori: row.kategori, soru: row.soru,
    secenekler: siklar(row), dogru_cevap: row.dogru_cevap,
  })).join("\n") + "\n", "utf8");

  await c.query("begin");
  try {
    await c.query(`update public.questions set aktif = false where id = any($1::uuid[])`,
      [r.rows.map((x) => x.id)]);
    await c.query("commit");
  } catch (e) { await c.query("rollback"); throw e; }

  console.log(`pasife çekildi: ${r.rows.length}`);
  if (eksik.length) console.log(`bulunamadı/zaten pasif: ${eksik.length} -> ${eksik.join(", ")}`);
}

async function durum() {
  const r = await c.query(
    `select kapsam, aktif, count(*)::int adet from public.questions group by 1,2 order by 1,2`);
  console.table(r.rows);
  const y = fs.existsSync(YEDEK)
    ? fs.readFileSync(YEDEK, "utf8").split("\n").filter(Boolean).length : 0;
  console.log(`bu iş kapsamında elenen: ${y}`);
}

/** Yedekteki tüm soruları yeniden aktif eder (geri alma). */
async function geri() {
  if (!fs.existsSync(YEDEK)) { console.log("yedek yok"); return; }
  const idler = fs.readFileSync(YEDEK, "utf8").split("\n").filter(Boolean)
    .map((s) => JSON.parse(s).id);
  const r = await c.query(
    `update public.questions set aktif = true where id = any($1::uuid[])`, [idler]);
  console.log(`yeniden aktif: ${r.rowCount}`);
}

const komut = process.argv[2];
await c.connect();
try {
  if (komut === "parti") await parti(Number(process.argv[3]) || 500, Number(process.argv[4]) || 0);
  else if (komut === "ele") await ele(process.argv[3]);
  else if (komut === "durum") await durum();
  else if (komut === "geri") await geri();
  else { console.error("kullanım: parti [n] [atla] | ele <dosya> | durum | geri"); process.exitCode = 1; }
} finally { await c.end(); }

/**
 * BİLDİM (Quizador) — FAZ 2: soru ayıklama hattı (global / yerel)
 *
 * Ayıklamayı model (Claude) yapar; bu betik yalnız İŞ AKIŞINI yürütür:
 *
 *   node bildim/_test/ayiklama.mjs parti          → sıradaki 200 soruyu yazdırır
 *   node bildim/_test/ayiklama.mjs yaz g=1,2,5 b=17,40   → kararları işler
 *   node bildim/_test/ayiklama.mjs durum          → nerede kalındığını gösterir
 *   node bildim/_test/ayiklama.mjs rapor          → kategori × kapsam tablosu
 *   node bildim/_test/ayiklama.mjs ornek [n]      → global havuzdan rastgele örnek
 *
 * YENİDEN BAŞLATILABİLİR: sorular id sırasına göre işlenir, imleç
 * `bildim/veri/ayiklama-durum.json` içinde tutulur, kararlar her partide
 * hemen hem JSONL'e hem veritabanına yazılır. Yeni oturum `durum` ile
 * kaldığı yeri bulur.
 *
 * Karar biçimi (yaz komutunun argümanları):
 *   g=<sıra no listesi>  → global (evrensel, çevrilebilir)
 *   b=<sıra no listesi>  → yerel kalır, ÇEVİRİYLE BOZULUR (harf/kafiye/kelime oyunu)
 *   listede olmayan her soru → yerel kalır (varsayılan)
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const KOK = process.cwd();
const VERI = path.join(KOK, "bildim", "veri");
const DURUM = path.join(VERI, "ayiklama-durum.json");
const KARAR = path.join(VERI, "soru-ayiklama.jsonl");
const PARTI_BOYU = 200;

fs.mkdirSync(VERI, { recursive: true });

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
  statement_timeout: 180000,
});

function durumOku() {
  try {
    return JSON.parse(fs.readFileSync(DURUM, "utf8"));
  } catch {
    return { imlec: "00000000-0000-0000-0000-000000000000", parti: 0 };
  }
}
function durumYaz(d) {
  fs.writeFileSync(DURUM, JSON.stringify(d, null, 2) + "\n");
}

/** Sıradaki partiyi (imleçten sonraki 200 soru) getirir. */
async function partiGetir() {
  const d = durumOku();
  const r = await c.query(
    `select id, kategori, soru, secenekler, dogru_cevap
       from public.questions
      where id > $1
      order by id
      limit $2`,
    [d.imlec, PARTI_BOYU]
  );
  return { durum: d, sorular: r.rows };
}

const komut = process.argv[2] || "durum";

await c.connect();
try {
  // ------------------------------------------------------------- PARTİ
  if (komut === "parti") {
    const { durum, sorular } = await partiGetir();
    if (!sorular.length) {
      console.log("BİTTİ — ayıklanacak soru kalmadı.");
    } else {
      console.log(`# PARTİ ${durum.parti + 1} — ${sorular.length} soru`);
      sorular.forEach((s, i) => {
        console.log(`${i + 1}|${s.kategori}|${s.soru}|${s.secenekler.join(" / ")}`);
      });
      console.log(`# son_id=${sorular[sorular.length - 1].id}`);
    }
  }

  // --------------------------------------------------------------- YAZ
  else if (komut === "yaz") {
    const argvler = process.argv.slice(3);
    if (!argvler.length) throw new Error("Karar argümanı gerekli (g=... / b=...)");
    const { durum, sorular } = await partiGetir();
    if (!sorular.length) throw new Error("İşlenecek parti yok");

    const kararlar = new Map();
    for (const arg of argvler) {
      const m = /^([gb])=(.*)$/.exec(arg.trim());
      if (!m) throw new Error(`Geçersiz argüman: ${arg}`);
      for (const parca of m[2].split(",")) {
        const t = parca.trim();
        if (!t) continue;
        const i = Number(t);
        if (!Number.isInteger(i) || i < 1 || i > sorular.length)
          throw new Error(`Geçersiz sıra no: ${t} (1..${sorular.length})`);
        if (kararlar.has(i)) throw new Error(`Sıra no iki kez verildi: ${i}`);
        kararlar.set(i, m[1]);
      }
    }

    const globalIds = [];
    const bozukIds = [];
    const satirlar = [];
    sorular.forEach((s, i) => {
      const kod = kararlar.get(i + 1);
      if (kod === "g") {
        globalIds.push(s.id);
        satirlar.push(JSON.stringify({ id: s.id, kapsam: "global" }));
      } else if (kod === "b") {
        bozukIds.push(s.id);
        satirlar.push(JSON.stringify({ id: s.id, kapsam: "yerel", neden: "ceviri_bozar" }));
      }
    });

    await c.query("begin");
    try {
      if (globalIds.length) {
        await c.query(
          `update public.questions set kapsam='global', ulke=null where id = any($1::uuid[])`,
          [globalIds]
        );
      }
      // 'b' işaretliler zaten yerel/TR; kararı yalnız JSONL'de saklıyoruz.
      await c.query("commit");
    } catch (e) {
      await c.query("rollback");
      throw e;
    }

    // Karar dosyası ve imleç: veritabanı yazımından SONRA, hemen.
    if (satirlar.length) fs.appendFileSync(KARAR, satirlar.join("\n") + "\n");
    durumYaz({
      imlec: sorular[sorular.length - 1].id,
      parti: durum.parti + 1,
      son_islem: new Date().toISOString(),
    });

    console.log(
      `PARTİ ${durum.parti + 1} işlendi: ${sorular.length} soru → ` +
        `${globalIds.length} global, ${bozukIds.length} çeviri-bozar, ` +
        `${sorular.length - globalIds.length - bozukIds.length} yerel`
    );
  }

  // ------------------------------------------------------------- DURUM
  else if (komut === "durum") {
    const d = durumOku();
    const r = await c.query(
      `select count(*)::int toplam, count(*) filter (where id > $1)::int kalan
         from public.questions`,
      [d.imlec]
    );
    const g = await c.query(
      `select kapsam, count(*)::int n from public.questions group by 1 order by 1`
    );
    console.log(
      `parti=${d.parti}  imlec=${d.imlec}\n` +
        `toplam=${r.rows[0].toplam}  islenen=${r.rows[0].toplam - r.rows[0].kalan}  ` +
        `kalan=${r.rows[0].kalan}  (~${Math.ceil(r.rows[0].kalan / PARTI_BOYU)} parti)`
    );
    console.table(g.rows);
  }

  // ------------------------------------------------------------- RAPOR
  else if (komut === "rapor") {
    const r = await c.query(
      `select kategori,
              count(*) filter (where kapsam='global')::int global,
              count(*) filter (where kapsam='yerel')::int yerel,
              count(*)::int toplam
         from public.questions group by 1 order by 1`
    );
    console.table(r.rows);
    const t = await c.query(
      `select count(*) filter (where kapsam='global')::int global,
              count(*) filter (where kapsam='yerel')::int yerel,
              count(*)::int toplam,
              count(*) filter (where kapsam='global' and aktif)::int global_aktif
         from public.questions`
    );
    console.table(t.rows);
  }

  // ------------------------------------------------------------ ÖRNEK
  else if (komut === "ornek") {
    const n = Number(process.argv[3] || 30);
    const r = await c.query(
      `select kategori, soru, secenekler, dogru_cevap
         from public.questions where kapsam='global' order by random() limit $1`,
      [n]
    );
    r.rows.forEach((s, i) => {
      console.log(
        `${String(i + 1).padStart(2)}. [${s.kategori}] ${s.soru}\n` +
          `    ${s.secenekler.map((x, j) => (j === s.dogru_cevap ? `*${x}*` : x)).join(" / ")}`
      );
    });
  } else {
    throw new Error(`Bilinmeyen komut: ${komut}`);
  }
} finally {
  await c.end();
}

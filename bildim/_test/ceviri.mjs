/**
 * BİLDİM (Quizador) — FAZ 3: global soru havuzunun çevirisi
 *
 * Çeviriyi model (Claude) yapar; bu betik yalnız İŞ AKIŞINI yürütür:
 *
 *   node bildim/_test/ceviri.mjs parti en              → çevrilmemiş 20 soruyu yazdırır
 *   node bildim/_test/ceviri.mjs yaz en <dosya.json>   → partiyi doğrulayıp yazar
 *   node bildim/_test/ceviri.mjs durum                 → dil × çevrilmiş sayısı
 *   node bildim/_test/ceviri.mjs ornek en [n]          → n örnek çeviri (kaynakla yan yana)
 *
 * YENİDEN BAŞLATILABİLİR: imleç dosyası YOK — sıradaki parti doğrudan
 * veritabanından "bu dile çevirisi olmayan global sorular" sorgusuyla bulunur.
 * Her parti hemen yazılır; yarım kalan iş tekrar sorguda görünür.
 *
 * DOĞRULAMA (yazmadan önce, soru soru):
 *   - seçenek sayısı kaynakla aynı
 *   - hiçbir alan boş değil
 *   - seçenekler birbirinden farklı
 *   - soru metni kaynakla birebir aynı değil (çevrilmemiş satır yakalanır)
 * Bir soru doğrulamayı geçemezse YALNIZ o soru atlanır, diğerleri yazılır.
 * Sıra korunumu ayrıca veritabanındaki qt_dogrula() tetikleyicisiyle güvencede.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const KOK = process.cwd();
const PARTI_BOYU = 20;
const DILLER = ["en", "de", "es", "pt", "fr", "it", "ru"];

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

function dilKontrol(d) {
  if (!DILLER.includes(d)) throw new Error(`Geçersiz dil: ${d} (${DILLER.join(", ")})`);
  return d;
}

/** Bu dile henüz çevrilmemiş, aktif global sorulardan sıradaki parti. */
async function partiGetir(dil, adet = PARTI_BOYU) {
  const r = await c.query(
    `select q.id, q.kategori, q.soru, q.secenekler, q.dogru_cevap
       from public.questions q
      where q.kapsam = 'global' and q.aktif
        and not exists (select 1 from public.question_translations t
                         where t.question_id = q.id and t.dil = $1)
      order by q.id
      limit $2`,
    [dil, adet]
  );
  return r.rows;
}

const komut = process.argv[2] || "durum";

await c.connect();
try {
  // ------------------------------------------------------------- PARTİ
  if (komut === "parti") {
    const dil = dilKontrol(process.argv[3]);
    const sorular = await partiGetir(dil, Number(process.argv[4] || PARTI_BOYU));
    if (!sorular.length) {
      console.log(`BİTTİ — '${dil}' dilinde çevrilmemiş global soru kalmadı.`);
    } else {
      console.log(`# PARTİ (${dil}) — ${sorular.length} soru`);
      for (const s of sorular) {
        console.log(`${s.id}|${s.kategori}|${s.soru}|${s.secenekler.join("|")}`);
      }
    }
  }

  // --------------------------------------------------------------- YAZ
  else if (komut === "yaz") {
    const dil = dilKontrol(process.argv[3]);
    const dosya = process.argv[4];
    if (!dosya) throw new Error("Parti dosyası gerekli: yaz <dil> <dosya.json>");
    const veri = JSON.parse(fs.readFileSync(dosya, "utf8"));
    if (!Array.isArray(veri) || !veri.length) throw new Error("Parti dosyası boş");

    const idler = veri.map((v) => v.id);
    const kaynak = new Map(
      (
        await c.query(
          `select id, soru, secenekler from public.questions where id = any($1::uuid[])`,
          [idler]
        )
      ).rows.map((r) => [r.id, r])
    );

    const yazilacak = [];
    const atlanan = [];
    for (const v of veri) {
      const k = kaynak.get(v.id);
      const hata = (m) => atlanan.push({ id: v.id, hata: m });
      if (!k) { hata("kaynak soru bulunamadı"); continue; }
      if (typeof v.soru !== "string" || !v.soru.trim()) { hata("soru boş"); continue; }
      if (!Array.isArray(v.secenekler)) { hata("secenekler dizi değil"); continue; }
      if (v.secenekler.length !== k.secenekler.length) {
        hata(`seçenek sayısı ${v.secenekler.length} ≠ kaynak ${k.secenekler.length}`);
        continue;
      }
      if (v.secenekler.some((x) => typeof x !== "string" || !x.trim())) { hata("boş seçenek"); continue; }
      const kucuk = v.secenekler.map((x) => x.trim().toLocaleLowerCase());
      if (new Set(kucuk).size !== kucuk.length) { hata("seçenekler birbirinin aynı"); continue; }
      if (v.soru.trim() === k.soru.trim()) { hata("soru çevrilmemiş (kaynakla aynı)"); continue; }
      yazilacak.push({ id: v.id, soru: v.soru.trim(), secenekler: v.secenekler.map((x) => x.trim()) });
    }

    let yazilan = 0;
    if (yazilacak.length) {
      await c.query("begin");
      try {
        for (const y of yazilacak) {
          // Tek tek: bir soru tetikleyiciye takılırsa yalnız o atlanır.
          try {
            await c.query("savepoint s");
            await c.query(
              `insert into public.question_translations(question_id, dil, soru, secenekler)
               values ($1, $2, $3, $4::jsonb)
               on conflict (question_id, dil) do update
                 set soru = excluded.soru, secenekler = excluded.secenekler`,
              [y.id, dil, y.soru, JSON.stringify(y.secenekler)]
            );
            await c.query("release savepoint s");
            yazilan++;
          } catch (e) {
            await c.query("rollback to savepoint s");
            atlanan.push({ id: y.id, hata: `db: ${e.message}` });
          }
        }
        await c.query("commit");
      } catch (e) {
        await c.query("rollback");
        throw e;
      }
    }

    const kalan = (
      await c.query(
        `select count(*)::int n from public.questions q
          where q.kapsam='global' and q.aktif
            and not exists (select 1 from public.question_translations t
                             where t.question_id=q.id and t.dil=$1)`,
        [dil]
      )
    ).rows[0].n;

    console.log(`[${dil}] yazılan=${yazilan}  atlanan=${atlanan.length}  kalan=${kalan}`);
    for (const a of atlanan) console.log(`  ATLANDI ${a.id}: ${a.hata}`);
  }

  // ------------------------------------------------------------- DURUM
  else if (komut === "durum") {
    const hedef = (
      await c.query(
        `select count(*)::int n from public.questions where kapsam='global' and aktif`
      )
    ).rows[0].n;
    const r = await c.query(
      `select dil, count(*)::int cevrilen from public.question_translations group by 1 order by 1`
    );
    const harita = new Map(r.rows.map((x) => [x.dil, x.cevrilen]));
    console.log(`hedef (aktif global soru): ${hedef}`);
    console.table(
      DILLER.map((d) => ({
        dil: d,
        cevrilen: harita.get(d) || 0,
        kalan: hedef - (harita.get(d) || 0),
        yuzde: (((harita.get(d) || 0) / hedef) * 100).toFixed(1) + "%",
      }))
    );
  }

  // ------------------------------------------------------------ ÖRNEK
  else if (komut === "ornek") {
    const dil = dilKontrol(process.argv[3]);
    const n = Number(process.argv[4] || 5);
    const r = await c.query(
      `select q.soru k_soru, q.secenekler k_sec, q.dogru_cevap, t.soru c_soru, t.secenekler c_sec
         from public.question_translations t
         join public.questions q on q.id = t.question_id
        where t.dil = $1
        order by random() limit $2`,
      [dil, n]
    );
    r.rows.forEach((s, i) => {
      console.log(
        `${i + 1}. TR: ${s.k_soru}\n   ${s.k_sec
          .map((x, j) => (j === s.dogru_cevap ? `*${x}*` : x))
          .join(" / ")}\n` +
          `   ${dil.toUpperCase()}: ${s.c_soru}\n   ${s.c_sec
            .map((x, j) => (j === s.dogru_cevap ? `*${x}*` : x))
            .join(" / ")}`
      );
    });
  } else {
    throw new Error(`Bilinmeyen komut: ${komut}`);
  }
} finally {
  await c.end();
}

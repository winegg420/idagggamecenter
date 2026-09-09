/**
 * BİLDİM — "Hatalarım" çalışma modu doğrulama testi (FAZ 3)
 *
 * Gerçek veritabanında geçici bir test kullanıcısı açar, auth.uid()'i JWT
 * iddiasıyla taklit eder ve şunları kanıtlar:
 *  1. Yanlış bilinen soru bankaya girer.
 *  2. Üst üste 2 doğru → soru bankadan çıkar (ogrenildi_at dolar).
 *  3. Araya 1 yanlış girerse seri sıfırlanır, soru bankada KALIR.
 *  4. Bankası boş kullanıcıda tur yine başlar, sorular normal havuzdan gelir.
 *  5. Çalışma turu profiles.puan / puan_hafta / seri_gun DEĞİŞTİRMEZ.
 *  6. Kategori ustalığı (kategori_dogru) artar.
 *
 * Kullanım: node bildim/_test/hatalarim-test.mjs
 * Test kullanıcısı sonunda silinir (cascade).
 */
import fs from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const c = new pg.Client({
  connectionString: `postgresql://postgres.zfpnxzybcpkxsotwdsey:${encodeURIComponent(
    env.SUPABASE_DB_PASSWORD
  )}@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 120000,
});

const sonuclar = [];
function kayit(ad, gecti, detay) {
  sonuclar.push({ test: ad, sonuc: gecti ? "GEÇTİ" : "KALDI", detay });
  console.log(`${gecti ? "  OK  " : " HATA "} ${ad}${detay ? " — " + detay : ""}`);
}

// auth.uid() taklidi: PostgREST'in yaptığı gibi JWT iddiası yerleştirilir.
async function kimlik(uid) {
  await c.query(`select set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify({ sub: uid, role: "authenticated" }),
  ]);
  await c.query(`select set_config('role', 'authenticated', false)`);
}
async function kimlikBirak() {
  await c.query(`select set_config('request.jwt.claims', '', false)`);
  await c.query(`reset role`);
}

// Tanı sorguları (doğru cevapları okumak gibi) sahip rolüyle çalışmalı;
// `authenticated` rolünün questions tablosuna doğrudan erişimi yok.
async function yonetici(sql, params, uidGeri) {
  await kimlikBirak();
  try {
    return await c.query(sql, params);
  } finally {
    if (uidGeri) await kimlik(uidGeri);
  }
}

await c.connect();

let uid = null;
try {
  // ---------- Test kullanıcısı ----------
  const u = await c.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
       email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'hatalarim-test-' || floor(random()*1e9)::text || '@ornek.test',
       '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
     returning id`
  );
  uid = u.rows[0].id;
  await c.query(
    `insert into public.profiles (id, username, puan, puan_hafta)
     values ($1::uuid, 'hatalarim_test_' || substr($1::text,1,8), 0, 0)
     on conflict (id) do nothing`,
    [uid]
  );
  console.log("test kullanıcısı:", uid, "\n");

  // Test için 5 soru seç (aynı kategoriden ki ustalık ölçülebilsin)
  const sorular = (
    await c.query(
      `select id, kategori, dogru_cevap from public.questions
        where aktif and kategori = 'bilim' order by random() limit 5`
    )
  ).rows;
  if (sorular.length < 5) throw new Error("Test için yeterli soru yok");

  // ---------- 1) Yanlışlar bankaya girer ----------
  await kimlik(uid);
  for (const s of sorular) {
    await c.query(`select public.yanlis_kaydet($1)`, [s.id]);
  }
  const banka1 = await c.query(
    `select count(*)::int n from public.yanlis_sorular where user_id=$1 and ogrenildi_at is null`,
    [uid]
  );
  kayit("1. 5 yanlış soru bankaya girdi", banka1.rows[0].n === 5, `bankada ${banka1.rows[0].n} soru`);

  // ---------- Ölçüm: öncesi ----------
  await kimlikBirak();
  const once = (
    await c.query(
      `select puan, puan_hafta, coalesce(seri_gun,0) seri_gun from public.profiles where id=$1`,
      [uid]
    )
  ).rows[0];
  const ustOnce = (
    await c.query(
      `select coalesce(sum(dogru_sayisi),0)::int n from public.kategori_dogru where user_id=$1`,
      [uid]
    )
  ).rows[0].n;

  // ---------- 2) Tur başlat: sorular bankadan gelmeli ----------
  await kimlik(uid);
  const t1 = (
    await c.query(`select * from public.calisma_baslat(null, 5)`)
  ).rows[0];
  kayit(
    "2. Çalışma turu bankadan doldu",
    t1.bankadan === 5 && t1.havuzdan === 0,
    `bankadan ${t1.bankadan}, havuzdan ${t1.havuzdan}`
  );

  // Oturumdaki soruların doğru cevaplarını al (sunucu tarafı — istemci bilmez)
  const oturumSorulari = (
    await yonetici(
      `select q.id, q.dogru_cevap
         from public.calisma_oturumlari o,
              unnest(o.soru_ids) with ordinality as u(qid, sira)
         join public.questions q on q.id = u.qid
        where o.id = $1 order by u.sira`,
      [t1.oturum_id], uid
    )
  ).rows;

  // Tur 1: hepsini DOĞRU bil → her soru dogru_serisi=1, hiçbiri öğrenilmemeli
  for (let i = 0; i < oturumSorulari.length; i++) {
    await c.query(`select * from public.calisma_cevap($1, $2, $3::smallint)`, [
      t1.oturum_id,
      i,
      oturumSorulari[i].dogru_cevap,
    ]);
  }
  const b1 = (
    await c.query(`select * from public.calisma_bitir($1)`, [t1.oturum_id])
  ).rows[0];
  kayit(
    "3. İlk doğruda öğrenilmedi (1/2)",
    b1.ogrenilen === 0 && b1.bankada_kalan === 5,
    `öğrenilen ${b1.ogrenilen}, bankada ${b1.bankada_kalan}`
  );

  // ---------- 3) İkinci tur: 4 soruyu doğru, 1 soruyu YANLIŞ bil ----------
  const t2 = (await c.query(`select * from public.calisma_baslat(null, 5)`)).rows[0];
  const os2 = (
    await yonetici(
      `select q.id, q.dogru_cevap
         from public.calisma_oturumlari o,
              unnest(o.soru_ids) with ordinality as u(qid, sira)
         join public.questions q on q.id = u.qid
        where o.id = $1 order by u.sira`,
      [t2.oturum_id], uid
    )
  ).rows;

  const yanlisYapilan = os2[os2.length - 1].id; // son soruyu bilerek yanlış bil
  for (let i = 0; i < os2.length; i++) {
    const sonMu = i === os2.length - 1;
    const cevap = sonMu ? (os2[i].dogru_cevap + 1) % 4 : os2[i].dogru_cevap;
    await c.query(`select * from public.calisma_cevap($1, $2, $3::smallint)`, [
      t2.oturum_id,
      i,
      cevap,
    ]);
  }
  const b2 = (await c.query(`select * from public.calisma_bitir($1)`, [t2.oturum_id])).rows[0];
  kayit(
    "4. İkinci doğruda öğrenildi (4 soru bankadan çıktı)",
    b2.ogrenilen === 4 && b2.bankada_kalan === 1,
    `öğrenilen ${b2.ogrenilen}, bankada kalan ${b2.bankada_kalan}`
  );

  const y = (
    await yonetici(
      `select dogru_serisi, ogrenildi_at, yanlis_sayisi from public.yanlis_sorular
        where user_id=$1 and question_id=$2`,
      [uid, yanlisYapilan], uid
    )
  ).rows[0];
  kayit(
    "5. Araya yanlış girince seri sıfırlandı, soru bankada kaldı",
    y.dogru_serisi === 0 && y.ogrenildi_at === null,
    `seri=${y.dogru_serisi}, ogrenildi_at=${y.ogrenildi_at}, yanlis=${y.yanlis_sayisi}`
  );

  // ---------- 4) Puan/seri değişmedi mi? ----------
  await kimlikBirak();
  const sonra = (
    await c.query(
      `select puan, puan_hafta, coalesce(seri_gun,0) seri_gun from public.profiles where id=$1`,
      [uid]
    )
  ).rows[0];
  kayit(
    "6. profiles.puan / puan_hafta / seri_gun DEĞİŞMEDİ",
    once.puan === sonra.puan &&
      once.puan_hafta === sonra.puan_hafta &&
      once.seri_gun === sonra.seri_gun,
    `puan ${once.puan}→${sonra.puan}, hafta ${once.puan_hafta}→${sonra.puan_hafta}, seri ${once.seri_gun}→${sonra.seri_gun}`
  );

  // ---------- 5) Kategori ustalığı arttı mı? ----------
  const ustSonra = (
    await c.query(
      `select coalesce(sum(dogru_sayisi),0)::int n from public.kategori_dogru where user_id=$1`,
      [uid]
    )
  ).rows[0].n;
  kayit(
    "7. Kategori ustalığı arttı",
    ustSonra > ustOnce,
    `${ustOnce} → ${ustSonra} doğru (9 doğru cevap verildi)`
  );

  // ---------- 6) Boş bankalı kullanıcıda tur başlar mı? ----------
  const u2 = await c.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
       email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'hatalarim-bos-' || floor(random()*1e9)::text || '@ornek.test',
       '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
     returning id`
  );
  const uid2 = u2.rows[0].id;
  await c.query(
    `insert into public.profiles (id, username) values ($1::uuid, 'hatalarim_bos_' || substr($1::text,1,8))
     on conflict (id) do nothing`,
    [uid2]
  );
  await kimlik(uid2);
  const t3 = (await c.query(`select * from public.calisma_baslat('tarih', 10)`)).rows[0];
  kayit(
    "8. Boş bankada tur başladı, sorular havuzdan geldi",
    t3.soru_sayisi === 10 && t3.bankadan === 0 && t3.havuzdan === 10,
    `toplam ${t3.soru_sayisi}, bankadan ${t3.bankadan}, havuzdan ${t3.havuzdan}`
  );

  // Havuzdan gelen soruyu yanlış bil → bankaya girmeli
  const os3 = (
    await yonetici(
      `select q.id, q.dogru_cevap from public.calisma_oturumlari o,
              unnest(o.soru_ids) with ordinality as u(qid, sira)
         join public.questions q on q.id = u.qid
        where o.id = $1 order by u.sira limit 1`,
      [t3.oturum_id], uid2
    )
  ).rows[0];
  await c.query(`select * from public.calisma_cevap($1, 0, $2::smallint)`, [
    t3.oturum_id,
    (os3.dogru_cevap + 1) % 4,
  ]);
  const bankaYeni = (
    await yonetici(
      `select count(*)::int n from public.yanlis_sorular where user_id=$1 and question_id=$2`,
      [uid2, os3.id]
    )
  ).rows[0].n;
  kayit(
    "9. Havuzdan gelen soru yanlış bilinince bankaya eklendi",
    bankaYeni === 1,
    `banka satırı: ${bankaYeni}`
  );

  // ---------- 7) yanlis_bankam özeti ----------
  await kimlik(uid);
  const ozet = (await c.query(`select * from public.yanlis_bankam()`)).rows;
  kayit(
    "10. yanlis_bankam özeti tutarlı",
    ozet.length > 0 && ozet[0].toplam === 5 && ozet[0].ogrenilen === 4 && ozet[0].bekleyen === 1,
    `toplam ${ozet[0]?.toplam}, öğrenilen ${ozet[0]?.ogrenilen}, bekleyen ${ozet[0]?.bekleyen}`
  );

  await kimlikBirak();
  // Temizlik
  await c.query(`delete from auth.users where id = any($1::uuid[])`, [[uid, uid2]]);
  uid = null;

  console.log("\n=== SONUÇ TABLOSU ===");
  console.table(sonuclar);
  const kalan = sonuclar.filter((s) => s.sonuc === "KALDI").length;
  console.log(kalan === 0 ? "\nTÜM TESTLER GEÇTİ." : `\n${kalan} TEST KALDI.`);
  process.exitCode = kalan === 0 ? 0 : 1;
} catch (e) {
  console.error("TEST HATASI:", e.message);
  try {
    await kimlikBirak();
    if (uid) await c.query(`delete from auth.users where id = $1`, [uid]);
  } catch {
    /* temizlik başarısızsa sessiz geç */
  }
  process.exitCode = 1;
} finally {
  await c.end();
}

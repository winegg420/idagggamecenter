/**
 * BİLDİM — mac_iptal() adalet kuralı testi
 *
 * Üç senaryoyu uçtan uca çalıştırır ve puan değişimlerini ölçer:
 *   1. Bot maçı iptali              -> sade iptal, puan değişmez
 *   2. Başlamamış gerçek oyuncu maçı -> sade iptal, iki tarafa da ceza yok
 *   3. Başlamış gerçek oyuncu maçı   -> hükmen mağlubiyet: iptal eden kaybeder
 *
 * Geçici kullanıcılar açar, testi yapar, sonunda hepsini siler.
 * Çalıştır: node bildim/_test/mac-iptal-test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const KOK = process.cwd();
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
  statement_timeout: 120000,
});

const uidler = [];
const sonuclar = [];

/** İstediğimiz kullanıcı kimliğine bürün (RLS + auth.uid()) */
async function kimlik(uid) {
  await c.query(`select set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify({ sub: uid, role: "authenticated" }),
  ]);
  await c.query(`select set_config('role', 'authenticated', false)`);
}
async function yonetici() {
  await c.query(`select set_config('role', 'postgres', false)`);
  await c.query(`select set_config('request.jwt.claims', '', false)`);
}

async function kullaniciAc(ad) {
  const r = await c.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
       email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', $1, '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
     returning id`,
    [`iptaltest_${ad}_${Date.now()}@ornek.test`]
  );
  const uid = r.rows[0].id;
  uidler.push(uid);
  // gorunen_ad üretilmiş bir kolon (takma_ad + takma_ad_secildi'den türer)
  await c.query(
    `insert into public.profiles (id, username, takma_ad, takma_ad_secildi, ulke, sehir, puan, puan_hafta)
     values ($1, $2, $2, true, 'TR', 'Adana', 100, 100)
     on conflict (id) do update set takma_ad = excluded.takma_ad,
       takma_ad_secildi = true, puan = 100, puan_hafta = 100`,
    [uid, ad]
  );
  return uid;
}

async function puanlar(...ids) {
  const r = await c.query(
    `select id, gorunen_ad, puan, puan_hafta, seri from public.profiles where id = any($1::uuid[])`,
    [ids]
  );
  return Object.fromEntries(r.rows.map((x) => [x.id, x]));
}

/** İki oyuncu arasında aktif bir maç kur (soru_ids gerçek sorulardan) */
async function macKur(p1, p2, durum = "aktif") {
  const s = await c.query(
    `select array_agg(id) ids from (select id from public.questions where aktif limit 20) t`
  );
  const r = await c.query(
    `insert into public.matches (oyuncu1, oyuncu2, durum, soru_ids, kategori,
       oyuncu1_soru, oyuncu2_soru, oyuncu1_skor, oyuncu2_skor)
     values ($1, $2, $3, $4, null, 0, 0, 0, 0)
     returning id`,
    [p1, p2, durum, s.rows[0].ids]
  );
  return r.rows[0].id;
}

function yaz(ad, gecti, detay) {
  sonuclar.push({ senaryo: ad, sonuc: gecti ? "GEÇTİ" : "KALDI", detay });
  console.log(`  ${gecti ? "OK  " : "HATA"} ${ad} — ${detay}`);
}

await c.connect();
try {
  await yonetici();

  // ---------------------------------------------------------- 1) BOT MAÇI
  {
    const ben = await kullaniciAc("IptalBen1");
    const bot = (
      await c.query(`select id from public.profiles where is_bot limit 1`)
    ).rows[0].id;
    const macId = await macKur(ben, bot, "aktif");
    // Bir cevap ver ki "başlamış" olsun — bota karşı yine de ceza olmamalı
    await c.query(
      `insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
       values ($1, $2, 0, 0, true) on conflict do nothing`,
      [macId, ben]
    );
    const once = await puanlar(ben);
    await kimlik(ben);
    const r = await c.query(`select * from public.mac_iptal($1)`, [macId]);
    await yonetici();
    const sonra = await puanlar(ben);
    const m = (await c.query(`select durum, kazanan from public.matches where id=$1`, [macId])).rows[0];
    yaz(
      "1) Bot maçı iptali",
      r.rows[0].sonuc === "iptal" &&
        m.durum === "iptal" &&
        m.kazanan === null &&
        once[ben].puan === sonra[ben].puan,
      `sonuc=${r.rows[0].sonuc} durum=${m.durum} kazanan=${m.kazanan} puan ${once[ben].puan}->${sonra[ben].puan}`
    );
  }

  // ------------------------------------------- 2) BAŞLAMAMIŞ GERÇEK MAÇ
  {
    const ben = await kullaniciAc("IptalBen2");
    const rakip = await kullaniciAc("IptalRakip2");
    const macId = await macKur(ben, rakip, "aktif"); // hiç cevap yok
    const once = await puanlar(ben, rakip);
    await kimlik(ben);
    const r = await c.query(`select * from public.mac_iptal($1)`, [macId]);
    await yonetici();
    const sonra = await puanlar(ben, rakip);
    const m = (await c.query(`select durum, kazanan from public.matches where id=$1`, [macId])).rows[0];
    yaz(
      "2) Başlamamış gerçek oyuncu maçı iptali",
      r.rows[0].sonuc === "iptal" &&
        m.durum === "iptal" &&
        m.kazanan === null &&
        once[ben].puan === sonra[ben].puan &&
        once[rakip].puan === sonra[rakip].puan,
      `sonuc=${r.rows[0].sonuc} durum=${m.durum} | iptal eden ${once[ben].puan}->${sonra[ben].puan}, rakip ${once[rakip].puan}->${sonra[rakip].puan}`
    );
  }

  // --------------------------------------------- 3) BAŞLAMIŞ GERÇEK MAÇ
  {
    const ben = await kullaniciAc("IptalBen3");
    const rakip = await kullaniciAc("IptalRakip3");
    const macId = await macKur(ben, rakip, "aktif");
    // En az bir cevap verilmiş olsun
    await c.query(
      `insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
       values ($1, $2, 0, 0, true) on conflict do nothing`,
      [macId, ben]
    );
    await c.query(`update public.matches set oyuncu1_soru = 1, oyuncu1_skor = 18 where id=$1`, [macId]);
    const once = await puanlar(ben, rakip);
    await kimlik(ben);
    const r = await c.query(`select * from public.mac_iptal($1)`, [macId]);
    await yonetici();
    const sonra = await puanlar(ben, rakip);
    const m = (await c.query(`select durum, kazanan from public.matches where id=$1`, [macId])).rows[0];
    const bildirim = (
      await c.query(`select count(*)::int n from public.bildirimler where user_id=$1`, [rakip])
    ).rows[0].n;
    yaz(
      "3) Başlamış gerçek oyuncu maçı iptali (hükmen)",
      r.rows[0].sonuc === "hukmen" &&
        m.durum === "bitti" &&
        m.kazanan === rakip &&
        sonra[rakip].puan > once[rakip].puan,
      `sonuc=${r.rows[0].sonuc} durum=${m.durum} kazanan=RAKIP | iptal eden ${once[ben].puan}->${sonra[ben].puan}, rakip ${once[rakip].puan}->${sonra[rakip].puan} (+${sonra[rakip].puan - once[rakip].puan}), rakibe bildirim=${bildirim}`
    );
  }

  // ------------------------------------------------- 4) EK GÜVENLİK KONTROLÜ
  {
    const ben = await kullaniciAc("IptalBen4");
    const rakip = await kullaniciAc("IptalRakip4");
    const yabanci = await kullaniciAc("IptalYabanci");
    const macId = await macKur(ben, rakip, "aktif");
    let yabanciHata = null;
    await kimlik(yabanci);
    try {
      await c.query(`select * from public.mac_iptal($1)`, [macId]);
    } catch (e) {
      yabanciHata = e.message;
    }
    await yonetici();
    yaz(
      "4) Maçta olmayan biri iptal edemez",
      Boolean(yabanciHata),
      yabanciHata ?? "HATA VERMEDI — açık var"
    );

    // Aynı maçı iptal edip tekrar iptal etmeyi dene
    await kimlik(ben);
    await c.query(`select * from public.mac_iptal($1)`, [macId]);
    let ikinciHata = null;
    try {
      await c.query(`select * from public.mac_iptal($1)`, [macId]);
    } catch (e) {
      ikinciHata = e.message;
    }
    await yonetici();
    yaz("5) Kapanmış maç tekrar iptal edilemez", Boolean(ikinciHata), ikinciHata ?? "HATA VERMEDI");
  }
} finally {
  await yonetici();
  // Temizlik: açılan test kullanıcıları (maçlar/cevaplar cascade ile gider)
  for (const uid of uidler) {
    try {
      await c.query(`delete from public.matches where oyuncu1=$1 or oyuncu2=$1`, [uid]);
      await c.query(`delete from public.bildirimler where user_id=$1`, [uid]);
      await c.query(`delete from public.profiles where id=$1`, [uid]);
      await c.query(`delete from auth.users where id=$1`, [uid]);
    } catch (e) {
      console.error("temizlik:", uid, e.message);
    }
  }
  console.log("\n=== ÖZET ===");
  console.table(sonuclar);
  const kaldi = sonuclar.filter((s) => s.sonuc === "KALDI").length;
  console.log(kaldi === 0 ? "TÜM SENARYOLAR GEÇTİ" : `${kaldi} SENARYO KALDI`);
  await c.end();
  process.exitCode = kaldi === 0 ? 0 : 1;
}

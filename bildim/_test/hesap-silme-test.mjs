// Hesap silme uçtan uca testi.
// Çalıştır: node bildim/_test/hesap-silme-test.mjs
//
// ASLA gerçek bir kullanıcı hesabıyla çalışmaz: kendi tek kullanımlık test
// hesabını yaratır, veri üretir, siler ve ne kaldığını sayar.
// Her şey bir transaction içinde döner ve SONUNDA ROLLBACK edilir —
// canlı veri hiçbir koşulda değişmez.

import fs from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const c = new pg.Client({
  connectionString: `postgresql://postgres.zfpnxzybcpkxsotwdsey:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const gibi = (uid) =>
  c.query("select set_config('request.jwt.claims', json_build_object('sub',$1::text)::text, true)", [uid]);

/** Kullanıcıya ait satırları tablo tablo sayar. */
async function sayim(uid) {
  const sorgular = {
    "auth.users": "select count(*) n from auth.users where id=$1",
    profiles: "select count(*) n from public.profiles where id=$1",
    matches: "select count(*) n from public.matches where oyuncu1=$1 or oyuncu2=$1",
    match_answers: "select count(*) n from public.match_answers where user_id=$1",
    bildirimler: "select count(*) n from public.bildirimler where user_id=$1",
    friendships: "select count(*) n from public.friendships where requester=$1 or addressee=$1",
    yanlis_sorular: "select count(*) n from public.yanlis_sorular where user_id=$1",
    joker_kullanimlari: "select count(*) n from public.joker_kullanimlari where user_id=$1",
    gorulen_sorular: "select count(*) n from public.gorulen_sorular where user_id=$1",
    push_subscriptions: "select count(*) n from public.push_subscriptions where user_id=$1",
    quest_progress: "select count(*) n from public.quest_progress where user_id=$1",
    rpc_sayac: "select count(*) n from public.rpc_sayac where user_id=$1",
    "matches.kazanan": "select count(*) n from public.matches where kazanan=$1",
  };
  const cikti = {};
  for (const [ad, q] of Object.entries(sorgular)) {
    try {
      cikti[ad] = Number((await c.query(q, [uid])).rows[0].n);
    } catch {
      cikti[ad] = "(tablo yok)";
    }
  }
  return cikti;
}

let uid = null;
let bitti = false;
try {
  await c.query("begin");

  // ---------- 1) Tek kullanımlık test hesabı ----------
  const u = await c.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
       email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'silme-test-' || floor(random()*1e9)::text || '@ornek.test',
       '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
     returning id`,
  );
  uid = u.rows[0].id;
  await c.query(
    `insert into public.profiles (id, username, takma_ad, puan, puan_hafta, toplam_mac, sehir, ulke)
     values ($1::uuid, 'silme_test_' || substr($1::text,1,8),
             'silme_test_' || substr($1::text,1,8), 120, 40, 3, 'Balıkesir', 'TR')
     on conflict (id) do update set puan = 120`,
    [uid],
  );
  console.log("Test hesabi olusturuldu:", uid);

  // ---------- 2) Veri uret ----------
  const bot = (await c.query("select id from public.profiles where is_bot limit 1")).rows[0].id;
  const sorular = (await c.query(
    "select array_agg(id) a from (select id from public.questions where aktif limit 20) s",
  )).rows[0].a;

  // Kullanicinin KAZANDIGI bitmis bir mac (kazanan sutunu kritik)
  const mac = (await c.query(
    `insert into public.matches (oyuncu1, oyuncu2, durum, soru_ids, aktif_soru, soru_baslangic,
        oyuncu1_skor, oyuncu2_skor, kazanan, bitis, kategori, oyuncu1_soru, oyuncu2_soru)
     values ($1,$2,'bitti',$3,20,now(),200,100,$1,now(),'genel_kultur',20,20) returning id`,
    [uid, bot, sorular],
  )).rows[0].id;
  await c.query(
    `insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
     values ($1,$2,0,1,true)`, [mac, uid]);
  await c.query(
    `insert into public.joker_kullanimlari (user_id, mac_tur, mac_id, soru_index, tur, ucretsiz)
     values ($1,'1v1',$2,0,'elli',true)`, [uid, mac]);
  await c.query(
    `insert into public.bildirimler (user_id, tip, metin) values ($1,'seri','test bildirimi')`, [uid]);
  await c.query(
    `insert into public.friendships (requester, addressee, durum) values ($1,$2,'bekliyor')`, [uid, bot]);
  await c.query(
    `insert into public.yanlis_sorular (user_id, question_id, yanlis_sayisi, dogru_serisi)
     values ($1,$2,1,0)`, [uid, sorular[0]]);
  await c.query(
    `insert into public.gorulen_sorular (user_id, question_id) values ($1,$2)
     on conflict do nothing`, [uid, sorular[1]]);
  await c.query(
    `insert into public.rpc_sayac (user_id, uc_adi, sayi) values ($1,'submit_match_answer',5)
     on conflict do nothing`, [uid]);

  const once = await sayim(uid);
  console.log("\n--- SILME ONCESI ---");
  console.table(once);

  // ---------- 3) Silmeyi dene ----------
  await gibi(uid);
  let sonuc = null;
  let hata = null;
  try {
    sonuc = (await c.query("select public.hesabimi_sil() as s")).rows[0].s;
  } catch (e) {
    hata = e.message;
  }
  console.log(`\nhesabimi_sil() -> donen: ${sonuc ?? "(hata)"} | hata: ${hata ?? "yok"}`);

  // Hata olduysa transaction bozulur; sayim yapabilmek icin savepoint gerekir.
  if (hata) {
    console.log("\nSONUC: SILME BASARISIZ. Kullanici hesabini silemiyor.");
  } else {
    const sonra = await sayim(uid);
    console.log("\n--- SILME SONRASI ---");
    console.table(sonra);
    const artakalan = Object.entries(sonra).filter(([, v]) => typeof v === "number" && v > 0);
    console.log(
      artakalan.length === 0
        ? "\nSONUC: TEMIZ - artakalan satir yok."
        : `\nSONUC: ARTAKALAN VAR -> ${JSON.stringify(Object.fromEntries(artakalan))}`,
    );
  }
  bitti = true;
} catch (e) {
  console.error("TEST HATASI:", e.message);
} finally {
  // Canli veri ASLA degismez.
  try { await c.query("rollback"); } catch { /* zaten bozuk */ }
  console.log("\n(rollback yapildi - canli veri degismedi)");
  await c.end();
  process.exit(bitti ? 0 : 1);
}

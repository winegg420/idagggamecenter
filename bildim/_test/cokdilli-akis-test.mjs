/**
 * BİLDİM (Quizador) — çok dilli dönüşüm uçtan uca akış testi
 *
 * Gerçek veritabanında geçici kullanıcılar açar ve BEŞ akışın da
 * çalıştığını kanıtlar: 1v1 maç, grup maçı, hızlı maç (çok kişili),
 * hızlı mod (tek kişilik), turnuva ve çalışma (Hatalarım) modu.
 *
 * Ayrıca her akışta çekilen soruların kapsam (global/yerel) ve dil
 * dağılımını raporlar — çok dilli havuz kurallarının kanıtı budur.
 *
 * Kullanım:
 *   node bildim/_test/cokdilli-akis-test.mjs                 # iki TR oyuncu
 *   node bildim/_test/cokdilli-akis-test.mjs TR:tr DE:de     # karışık ülke
 *   node bildim/_test/cokdilli-akis-test.mjs TR:tr TR:tr TR:tr TR:tr TR:tr
 *
 * Test kullanıcıları sonunda silinir (cascade).
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

// ---- oyuncu tanımları: "ULKE:dil" ------------------------------------------
const tanim = (process.argv.slice(2).length ? process.argv.slice(2) : ["TR:tr", "TR:tr"]).map(
  (s) => {
    const [ulke, dil] = s.split(":");
    return { ulke: ulke && ulke !== "-" ? ulke : null, dil: dil || "tr" };
  }
);

const sonuclar = [];
function kayit(ad, gecti, detay) {
  sonuclar.push({ test: ad, sonuc: gecti ? "GEÇTİ" : "KALDI", detay: detay || "" });
  console.log(`${gecti ? "  OK  " : " HATA "} ${ad}${detay ? " — " + detay : ""}`);
}

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
async function yonetici(sql, params) {
  await kimlikBirak();
  return c.query(sql, params);
}

/** Bir id listesinin kapsam/ülke/çeviri dağılımını çıkarır. */
async function havuzDagilimi(ids, dil) {
  if (!ids || !ids.length) return { toplam: 0, global: 0, yerel: 0, ceviri: 0 };
  const r = await yonetici(
    `select
       count(*)::int toplam,
       count(*) filter (where q.kapsam = 'global')::int genel,
       count(*) filter (where q.kapsam = 'yerel')::int yerel,
       count(*) filter (where exists (
         select 1 from public.question_translations t
         where t.question_id = q.id and t.dil = $2
       ))::int ceviri
     from public.questions q where q.id = any($1::uuid[])`,
    [ids, dil]
  );
  const x = r.rows[0];
  return { toplam: x.toplam, global: x.genel, yerel: x.yerel, ceviri: x.ceviri };
}

async function kullaniciAc(i, ulke, dil) {
  const u = await c.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
       email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'cokdilli-test-' || floor(random()*1e9)::text || '@ornek.test',
       '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
     returning id`
  );
  const uid = u.rows[0].id;
  // auth.users tetikleyicisi profili kendisi açabilir; ikisini de karşıla.
  await c.query(
    `insert into public.profiles (id, username, ulke, dil, hile_yetkisi)
     values ($1::uuid, 'cokdilli_test_' || $2::text || '_' || substr($1::text, 1, 6), $3, $4, true)
     on conflict (id) do update
       set ulke = excluded.ulke, dil = excluded.dil, hile_yetkisi = true`,
    [uid, i, ulke, dil]
  );
  return uid;
}

await c.connect();
const uidler = [];
try {
  // ---------- kullanıcılar + karşılıklı arkadaşlık ----------
  for (let i = 0; i < tanim.length; i++) {
    uidler.push(await kullaniciAc(i, tanim[i].ulke, tanim[i].dil));
  }
  for (let i = 0; i < uidler.length; i++) {
    for (let j = i + 1; j < uidler.length; j++) {
      await c.query(
        `insert into public.friendships (requester, addressee, durum)
         values ($1, $2, 'arkadas') on conflict do nothing`,
        [uidler[i], uidler[j]]
      );
    }
  }
  console.log(
    "test oyuncuları: " +
      tanim.map((t, i) => `${t.ulke || "—"}/${t.dil}=${uidler[i].slice(0, 8)}`).join("  ") +
      "\n"
  );

  const A = uidler[0];
  const B = uidler[1] || uidler[0];

  // ================================================================ 1v1 MAÇ
  {
    await kimlik(A);
    const m = await c.query(`select public.create_challenge($1, null) id`, [B]);
    const macId = m.rows[0].id;
    await kimlik(B);
    await c.query(`select public.respond_challenge($1, true)`, [macId]);

    const ids = (await yonetici(`select soru_ids from public.matches where id = $1`, [macId]))
      .rows[0].soru_ids;
    const dag = await havuzDagilimi(ids, tanim[0].dil);

    // İlk 10 soru: her iki oyuncu da kendi dilinde görebiliyor mu?
    const gorulen = {};
    for (const [ad, uid] of [
      ["A", A],
      ["B", B],
    ]) {
      await kimlik(uid);
      const metinler = [];
      for (let i = 0; i < 10; i++) {
        const q = await c.query(`select * from public.get_match_question($1)`, [macId]);
        if (!q.rows.length) throw new Error(`${ad}: soru gelmedi (index ${i})`);
        const s = q.rows[0];
        if (!s.soru || !s.soru.trim()) throw new Error(`${ad}: BOŞ soru metni (index ${i})`);
        if (!s.secenekler || s.secenekler.length !== 4)
          throw new Error(`${ad}: şık sayısı 4 değil (index ${i})`);
        metinler.push(s.soru);
        await c.query(`select public.submit_match_answer($1, $2::smallint)`, [macId, i % 4]);
      }
      gorulen[ad] = metinler;
    }
    kayit(
      "1v1 maç akışı (10'ar soru, iki oyuncu)",
      gorulen.A.length === 10 && gorulen.B.length === 10,
      `havuz: ${dag.toplam} soru, global=${dag.global}, yerel=${dag.yerel}, ` +
        `'${tanim[0].dil}' çevirisi olan=${dag.ceviri}`
    );
    if (uidler.length > 1 && tanim[0].dil !== tanim[1].dil) {
      const farkli = gorulen.A.some((t, i) => t !== gorulen.B[i]);
      kayit(
        "1v1: oyuncular soruyu KENDİ dilinde gördü",
        farkli,
        farkli ? `A[0]="${gorulen.A[0]}" | B[0]="${gorulen.B[0]}"` : "metinler aynı çıktı"
      );
    }
    console.log(`      örnek soru (A): ${gorulen.A[0]}`);
    if (uidler.length > 1) console.log(`      örnek soru (B): ${gorulen.B[0]}`);
  }

  // ============================================================== GRUP MAÇI
  if (uidler.length >= 3) {
    await kimlik(A);
    const g = await c.query(`select public.create_group_challenge($1::uuid[], null) id`, [
      uidler.slice(1, 3),
    ]);
    const gid = g.rows[0].id;
    for (const u of uidler.slice(1, 3)) {
      await kimlik(u);
      await c.query(`select public.respond_group_challenge($1, true)`, [gid]);
    }
    const gm = await yonetici(`select durum, soru_ids from public.group_matches where id = $1`, [
      gid,
    ]);
    const dag = await havuzDagilimi(gm.rows[0].soru_ids, tanim[0].dil);
    await kimlik(A);
    const q = await c.query(`select * from public.get_group_match_question($1)`, [gid]);
    kayit(
      "Grup maçı akışı",
      gm.rows[0].durum === "aktif" && q.rows.length === 1 && !!q.rows[0].soru,
      `${dag.toplam} soru, global=${dag.global}, yerel=${dag.yerel} | "${q.rows[0]?.soru}"`
    );
  } else {
    console.log("  ATLA  Grup maçı — en az 3 oyuncu gerekli");
  }

  // ============================================================= HIZLI MAÇ
  if (uidler.length === 5) {
    await kimlik(A);
    const h = await c.query(`select public.create_hizli_mac($1::uuid[], null) id`, [
      uidler.slice(1),
    ]);
    const hid = h.rows[0].id;
    for (const u of uidler.slice(1)) {
      await kimlik(u);
      await c.query(`select public.respond_hizli_davet($1, true)`, [hid]);
    }
    const hm = await yonetici(`select durum, soru_ids from public.hizli_maclar where id = $1`, [
      hid,
    ]);
    const dag = await havuzDagilimi(hm.rows[0].soru_ids, tanim[0].dil);
    await kimlik(A);
    const q = await c.query(`select * from public.get_hizli_soru($1)`, [hid]);
    kayit(
      "Hızlı maç (çok kişili) akışı",
      hm.rows[0].durum === "aktif" && q.rows.length === 1 && !!q.rows[0].soru,
      `${dag.toplam} soru, global=${dag.global}, yerel=${dag.yerel} | "${q.rows[0]?.soru}"`
    );
  } else {
    console.log("  ATLA  Hızlı maç — tam 5 oyuncu gerekli (testi 5 oyuncuyla çalıştır)");
  }

  // ============================================================== HIZLI MOD
  {
    await kimlik(A);
    const o = await c.query(`select * from public.hizli_mod_baslat(null)`);
    const oid = o.rows[0].oturum_id;
    const ids = (
      await yonetici(`select soru_ids from public.hizli_mod_oturumlar where id = $1`, [oid])
    ).rows[0].soru_ids;
    const dag = await havuzDagilimi(ids, tanim[0].dil);
    await kimlik(A);
    const q = await c.query(`select * from public.hizli_mod_soru($1)`, [oid]);
    kayit(
      "Hızlı mod (tek kişilik) akışı",
      q.rows.length === 1 && !!q.rows[0].soru,
      `${dag.toplam} soru, global=${dag.global}, yerel=${dag.yerel} | "${q.rows[0]?.soru}"`
    );
  }

  // ================================================================ TURNUVA
  {
    const t = await yonetici(
      `insert into public.tournaments (tarih, seans, durum)
       values ((now() at time zone 'Europe/Istanbul')::date + 3650, 'sabah', 'lobi')
       returning id`
    );
    const tid = t.rows[0].id;
    for (const u of uidler) {
      await yonetici(
        `insert into public.tournament_players (tournament_id, user_id) values ($1, $2)
         on conflict do nothing`,
        [tid, u]
      );
    }
    await yonetici(
      `update public.tournaments
          set durum = 'aktif',
              soru_ids = public.soru_sec(
                null, 30,
                (select array_agg(user_id) from public.tournament_players where tournament_id = $1)
              ),
              aktif_soru = 0, baslangic = now(), soru_baslangic = now()
        where id = $1`,
      [tid]
    );
    const ids = (await yonetici(`select soru_ids from public.tournaments where id = $1`, [tid]))
      .rows[0].soru_ids;
    const dag = await havuzDagilimi(ids, tanim[0].dil);
    await kimlik(A);
    const q = await c.query(`select * from public.get_tournament_question($1)`, [tid]);
    kayit(
      "Turnuva akışı",
      q.rows.length === 1 && !!q.rows[0].soru,
      `${dag.toplam} soru, global=${dag.global}, yerel=${dag.yerel} | "${q.rows[0]?.soru}"`
    );
    await yonetici(`delete from public.tournaments where id = $1`, [tid]);
  }

  // ================================================== ÇALIŞMA (HATALARIM)
  {
    await kimlik(A);
    const o = await c.query(`select * from public.calisma_baslat(null, 10)`);
    const oid = o.rows[0].oturum_id;
    const ids = (
      await yonetici(`select soru_ids from public.calisma_oturumlari where id = $1`, [oid])
    ).rows[0].soru_ids;
    const dag = await havuzDagilimi(ids, tanim[0].dil);
    await kimlik(A);
    const q = await c.query(`select * from public.calisma_soru($1)`, [oid]);
    kayit(
      "Çalışma (Hatalarım) akışı",
      q.rows.length === 1 && !!q.rows[0].soru,
      `${dag.toplam} soru, global=${dag.global}, yerel=${dag.yerel} | "${q.rows[0]?.soru}"`
    );
  }
} catch (e) {
  kayit("BEKLENMEYEN HATA", false, e.message);
} finally {
  await kimlikBirak();
  for (const u of uidler) {
    try {
      await c.query(`delete from auth.users where id = $1`, [u]);
    } catch {}
  }
  await c.end();
}

console.log("\n=== ÖZET ===");
console.table(sonuclar);
const kalan = sonuclar.filter((s) => s.sonuc === "KALDI").length;
console.log(kalan === 0 ? "TÜM AKIŞLAR ÇALIŞIYOR" : `${kalan} akış BOZUK`);
process.exit(kalan === 0 ? 0 : 1);

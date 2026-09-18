// Grup maçı eşleştirme kuyruğu — `grup_ara` / `grup_aramadan_cik` / `grup_kur_kuyruktan`.
//
// NE KORUYOR (Paket 24 C'de yazıldı):
//  1. Kuyruk dolunca maç KURULUR ve kuyruk boşalır. Kırılırsa oyuncular
//     sonsuza kadar bekler ya da aynı oyuncu iki maça birden girer.
//  2. Yeterli gerçek oyuncu yoksa gizli botlarla tamamlanır — ve AYNI BOT
//     iki kez seçilmez.
//  3. Devam eden grup maçı olan oyuncu kuyruğa girmez, maçına döner.
//  4. GRUP MAÇI ÖDÜLSÜZDÜR: coin ve lig puanı vermez, yalnız rozet.
//     Bu, "arkadaşlarla oyna" modunun ekonomiye dokunmaması içindir.

import test from 'node:test';
import assert from 'node:assert/strict';
import { islem, oyuncuKur, olarak, baglantiVarMi, alintila as a } from './yardim.mjs';

const atla = !(await baglantiVarMi());
const sec = { skip: atla ? 'veritabanı bağlantısı yok (SUPABASE_DB_URL / .env.local)' : false };

test('kuyruğa girilir ve kuyruktan çıkılır', sec, async () => {
  await islem(async (c) => {
    const o = await oyuncuKur(c, 'kuy1');
    await olarak(c, o);
    await c.sorgu(`select public.grup_ara(null)`);
    assert.equal(
      await c.tek(`select count(*) from public.grup_kuyrugu where user_id = ${a(o)}`),
      '1',
      'kuyruğa girmiş olmalı'
    );
    await c.sorgu(`select public.grup_aramadan_cik()`);
    assert.equal(
      await c.tek(`select count(*) from public.grup_kuyrugu where user_id = ${a(o)}`),
      '0',
      'kuyruktan çıkmış olmalı'
    );
  });
});

test('devam eden grup maçı olan oyuncu kuyrukta beklemez, maçına döner', sec, async () => {
  await islem(async (c) => {
    const o = await oyuncuKur(c, 'kuy2');
    const g = await c.tek(
      `insert into public.group_matches (kurucu, durum, oyuncu_sayisi) values (${a(o)}, 'aktif', 3) returning id`
    );
    await c.sorgu(
      `insert into public.group_match_players (group_match_id, user_id, davet_durumu)
       values (${a(g)}, ${a(o)}, 'kabul')`
    );
    await olarak(c, o);
    const donen = await c.tek(`select public.grup_ara(null)`);
    assert.equal(donen, g, 'devam eden maçın kimliği dönmeli');
    assert.equal(
      await c.tek(`select count(*) from public.grup_kuyrugu where user_id = ${a(o)}`),
      '0',
      'kuyrukta kalmamalı'
    );
  });
});

test('kuyruktan kurulan maç hedef kişi sayısına ulaşır ve aynı oyuncu iki kez girmez', sec, async () => {
  await islem(async (c) => {
    const hedef = Number(await c.tek(`select greatest(3, least(5, public.ayar_sayi('grup_hedef_kisi', 3)))`));
    const oyuncular = [];
    for (let i = 0; i < hedef; i++) oyuncular.push(await oyuncuKur(c, `grup${i}`));

    const g = await c.tek(
      `select public.grup_kur_kuyruktan(array[${oyuncular.map(a).join(',')}]::uuid[], null)`
    );
    assert.ok(g, 'maç kurulmalı');

    const mac = (await c.sorgu(`select durum, basladi, soru_ids from public.group_matches where id = ${a(g)}`))[0];
    assert.equal(mac.durum, 'aktif', 'kuyruktan kurulan maç aktif başlar');
    assert.equal(mac.basladi, 'f', 'lobi akışı devralsın diye basladi=false');
    assert.ok(mac.soru_ids && mac.soru_ids !== '{}', 'sorular seçilmiş olmalı');

    const katilim = await c.sorgu(
      `select user_id, count(*) n from public.group_match_players
        where group_match_id = ${a(g)} group by user_id`
    );
    assert.equal(katilim.length, hedef, `maçta ${hedef} oyuncu olmalı`);
    assert.ok(katilim.every((k) => k.n === '1'), 'hiçbir oyuncu iki kez eklenmemeli');

    for (const o of oyuncular) {
      assert.equal(
        await c.tek(`select count(*) from public.grup_kuyrugu where user_id = ${a(o)}`),
        '0',
        'maça giren oyuncu kuyrukta kalmamalı'
      );
    }
  });
});

test('grup maçı coin ve lig puanı vermez', sec, async () => {
  await islem(async (c) => {
    // Kural kodda `trg_grup_bitti` ile duruyor: yalnız maç sayacı artar.
    const govde = await c.tek(
      `select pg_get_functiondef(p.oid)
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'trg_grup_bitti'`
    );
    assert.ok(govde, 'trg_grup_bitti bulunmalı');
    assert.ok(!/coin_ekle|coin_mac_odulu/.test(govde), 'grup maçı bitişi coin vermemeli');
    assert.ok(!/puan_hafta\s*=|puan\s*=\s*puan\s*\+/.test(govde), 'grup maçı bitişi lig puanı vermemeli');
    assert.ok(!/gunluk_seri_bonusu/.test(govde), 'grup maçı bitişi seri bonusu vermemeli');
  });
});

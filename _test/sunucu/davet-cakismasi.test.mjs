// Davet çakışma kuralı — `davet_cakismasi` / `davet_siniri_kontrol` / `davet_kabul_kontrol`.
//
// NE KORUYOR: iki oyuncu arasındaki davet trafiğinin iki sınırı.
//   1. Aynı rakibe en çok `davet_bekleyen_sinir` (2) bekleyen davet. Kırılırsa
//      bir oyuncu diğerini davet yağmuruna tutabilir.
//   2. Aynı rakiple DEVAM EDEN bir oyun varken yeni davet KABUL edilemez.
//      Kırılırsa aynı çift aynı anda iki maçta olur; ödül ve seri sayaçları bozulur.
// Sayım bütün modları kapsar (1v1 · grup · hızlı · düello) — biri unutulursa
// oyuncu modu değiştirerek sınırı deler.

import test from 'node:test';
import assert from 'node:assert/strict';
import { islem, oyuncuKur, olarak, baglantiVarMi, hataVerir, alintila as a } from './yardim.mjs';

const atla = !(await baglantiVarMi());
const sec = { skip: atla ? 'veritabanı bağlantısı yok (SUPABASE_DB_URL / .env.local)' : false };

async function cakisma(c, ben, rakip) {
  return JSON.parse(await c.tek(`select public.davet_cakismasi(${a(ben)}, ${a(rakip)})::text`));
}

test('bekleyen davet sayılır, sınıra gelince yeni davet reddedilir', sec, async () => {
  await islem(async (c) => {
    const [x, y] = [await oyuncuKur(c, 'dav1'), await oyuncuKur(c, 'dav2')];
    const sinir = Number(await c.tek(`select public.ayar_sayi('davet_bekleyen_sinir', 2)`));
    await olarak(c, x);

    assert.equal((await cakisma(c, x, y)).bekleyen, 0, 'başlangıçta bekleyen davet yok');
    await c.sorgu(`select public.davet_siniri_kontrol(${a(y)})`); // sorun çıkarmamalı

    for (let i = 0; i < sinir; i++) {
      await c.sorgu(
        `insert into public.matches (oyuncu1, oyuncu2, durum) values (${a(x)}, ${a(y)}, 'bekliyor')`
      );
    }
    assert.equal((await cakisma(c, x, y)).bekleyen, sinir);

    const hata = await hataVerir(c, `select public.davet_siniri_kontrol(${a(y)})`);
    assert.match(hata, /bekleyen davetin var/i);
  });
});

test('aynı rakiple aktif oyun varken davet kabul edilemez', sec, async () => {
  await islem(async (c) => {
    const [x, y] = [await oyuncuKur(c, 'akt1'), await oyuncuKur(c, 'akt2')];
    await olarak(c, x);
    await c.sorgu(`select public.davet_kabul_kontrol(${a(y)})`); // aktif oyun yokken serbest

    await c.sorgu(`insert into public.matches (oyuncu1, oyuncu2, durum) values (${a(x)}, ${a(y)}, 'aktif')`);
    assert.equal((await cakisma(c, x, y)).aktif, true);

    const hata = await hataVerir(c, `select public.davet_kabul_kontrol(${a(y)})`);
    assert.match(hata, /devam eden bir oyunun var/i);
  });
});

test('çakışma sayımı düello ve grup maçını da kapsar', sec, async () => {
  await islem(async (c) => {
    const [x, y] = [await oyuncuKur(c, 'kaps1'), await oyuncuKur(c, 'kaps2')];

    // Düello: aktif düello da "devam eden oyun" sayılmalı.
    const d = await c.tek(`select public.duello_olustur(${a(x)}, ${a(y)}, true, null)`);
    assert.ok(d, 'düello kurulmalı');
    assert.equal((await cakisma(c, x, y)).aktif, true, 'aktif düello çakışma sayılmalı');
    await c.sorgu(`update public.duellolar set durum = 'bitti', bitis = now() where id = ${a(d)}`);
    assert.equal((await cakisma(c, x, y)).aktif, false, 'biten düello çakışma sayılmamalı');

    // Grup maçı: ikisi de aynı grupta ve grup aktifse çakışma.
    const g = await c.tek(`insert into public.group_matches (kurucu, durum, oyuncu_sayisi) values (${a(x)}, 'aktif', 3) returning id`);
    for (const u of [x, y]) {
      await c.sorgu(
        `insert into public.group_match_players (group_match_id, user_id, davet_durumu)
         values (${a(g)}, ${a(u)}, 'kabul')`
      );
    }
    assert.equal((await cakisma(c, x, y)).aktif, true, 'aktif grup maçı çakışma sayılmalı');
  });
});

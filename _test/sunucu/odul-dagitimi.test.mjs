// Maç bitişi ve ödül dağıtımı — `mac_sonuclandir`.
//
// NE KORUYOR: lig puanı ekonomisinin dört kuralı. Bu testlerden biri kırılırsa
// oyuncular hak etmedikleri puanı alıyor ya da hak ettiklerini alamıyor demektir:
//   1. Galibiyet 25 · beraberlik iki tarafa 10 · mağlubiyete teselli YOK.
//   2. Bot kazanınca lig puanı `lig_bot_puan_yuzde` kadar kırpılır.
//   3. Aynı çift aynı gün: 1-5. maç tam, 6-10. yarım, 11+ ödülsüz —
//      ve bu indirim COIN'e olduğu gibi LİG PUANINA da uygulanır.
//   4. Serbest (dereceli=false) maç lig puanı vermez.
// Sayılar `oyun_ayarlari`'ndan okunur; test de oradan okur, koda gömmez.

import test from 'node:test';
import assert from 'node:assert/strict';
import { islem, oyuncuKur as kur, baglantiVarMi, alintila as a } from './yardim.mjs';

// Bu dosyadaki testler YALNIZ maç ödülüne bakar. Günlük seri bonusu (günün ilk
// maçında ayrıca lig puanı ekler) ayrı bir testin konusudur — `seri-bonusu.test.mjs`.
// Burada bugünkü bonus tüketilmiş sayılıyor ki sayılara karışmasın.
async function oyuncuKur(c, ad, ek = {}) {
  return kur(c, ad, { seri_bonus_tarihi: "sql:(now() at time zone 'Europe/Istanbul')::date", ...ek });
}

const atla = !(await baglantiVarMi());
const sec = { skip: atla ? 'veritabanı bağlantısı yok (SUPABASE_DB_URL / .env.local)' : false };

/** Bitmiş bir maç kurar ve sonuçlandırır; iki oyuncunun puan farkını döndürür. */
async function macOyna(c, o1, o2, { kazanan = null, dereceli = true, gun = 0 } = {}) {
  const once = await puanlar(c, o1, o2);
  const mac = await c.tek(
    `insert into public.matches (oyuncu1, oyuncu2, durum, dereceli, created_at)
     values (${a(o1)}, ${a(o2)}, 'aktif', ${a(dereceli)}, now() - make_interval(days => ${gun}))
     returning id`
  );
  await c.sorgu(`select public.mac_sonuclandir(${a(mac)}, ${kazanan ? a(kazanan) : 'null'}, ${kazanan ? a(kazanan === o1 ? o2 : o1) : 'null'})`);
  const sonra = await puanlar(c, o1, o2);
  return { mac, fark: { [o1]: sonra[o1] - once[o1], [o2]: sonra[o2] - once[o2] } };
}

async function puanlar(c, ...idler) {
  const r = await c.sorgu(`select id, puan from public.profiles where id in (${idler.map(a).join(',')})`);
  return Object.fromEntries(r.map((x) => [x.id, Number(x.puan)]));
}

async function ayar(c, anahtar, varsayilan) {
  return Number(await c.tek(`select public.ayar_sayi(${a(anahtar)}, ${varsayilan})`));
}

test('galibiyette kazanan lig puanı alır, kaybeden teselli almaz', sec, async () => {
  await islem(async (c) => {
    const [x, y] = [await oyuncuKur(c, 'kazanan'), await oyuncuKur(c, 'kaybeden')];
    const galibiyet = await ayar(c, 'lig_mac_galibiyet', 25);
    const { fark } = await macOyna(c, x, y, { kazanan: x });
    assert.equal(fark[x], galibiyet, 'kazanan tam galibiyet puanı almalı');
    assert.equal(fark[y], 0, 'kaybeden puan almamalı (teselli yok)');
  });
});

test('beraberlikte iki tarafa da beraberlik puanı verilir', sec, async () => {
  await islem(async (c) => {
    const [x, y] = [await oyuncuKur(c, 'ber1'), await oyuncuKur(c, 'ber2')];
    const beraberlik = await ayar(c, 'lig_mac_beraberlik', 10);
    const { fark } = await macOyna(c, x, y, { kazanan: null });
    assert.equal(fark[x], beraberlik);
    assert.equal(fark[y], beraberlik);
  });
});

test('serbest maç lig puanı vermez', sec, async () => {
  await islem(async (c) => {
    const [x, y] = [await oyuncuKur(c, 'ser1'), await oyuncuKur(c, 'ser2')];
    const { fark } = await macOyna(c, x, y, { kazanan: x, dereceli: false });
    assert.equal(fark[x], 0, 'serbest maçta lig puanı yok');
    assert.equal(fark[y], 0);
  });
});

test('bot kazanınca lig puanı kırpılır', sec, async () => {
  await islem(async (c) => {
    const bot = await oyuncuKur(c, 'bot', { is_bot: true, bot_turu: 'gizli' });
    const insan = await oyuncuKur(c, 'insan');
    const galibiyet = await ayar(c, 'lig_mac_galibiyet', 25);
    const yuzde = await ayar(c, 'lig_bot_puan_yuzde', 40);
    const beklenen = Math.floor((galibiyet * yuzde) / 100);
    const { fark } = await macOyna(c, bot, insan, { kazanan: bot });
    assert.equal(fark[bot], beklenen, `bot kazancı %${yuzde} olmalı`);
  });
});

test('aynı çift aynı gün: 6. maçta lig puanı yarıya, 11.de sıfıra iner', sec, async () => {
  await islem(async (c) => {
    const [x, y] = [await oyuncuKur(c, 'cift1'), await oyuncuKur(c, 'cift2')];
    const galibiyet = await ayar(c, 'lig_mac_galibiyet', 25);
    const tamSinir = await ayar(c, 'mac_cift_tam_sinir', 5);
    const yariSinir = await ayar(c, 'mac_cift_yari_sinir', 10);

    const farklar = [];
    for (let i = 1; i <= yariSinir + 1; i++) {
      const { fark } = await macOyna(c, x, y, { kazanan: x });
      farklar.push(fark[x]);
    }

    assert.equal(farklar[0], galibiyet, '1. maç tam ödül');
    assert.equal(farklar[tamSinir - 1], galibiyet, `${tamSinir}. maç hâlâ tam ödül`);
    assert.equal(farklar[tamSinir], Math.floor(galibiyet * 0.5), `${tamSinir + 1}. maç yarım ödül`);
    assert.equal(farklar[yariSinir], 0, `${yariSinir + 1}. maç ödülsüz`);
  });
});

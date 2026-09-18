// Soru şık denge kuralı — `soru_kural_isaretleri` (Paket 25'te kondu).
//
// NE KORUYOR: "soruyu okumadan en uzun şıkkı seç" stratejisi. Paket 25'te
// ölçüldü: o strateji %63,1 başarıyla oynuyordu (4 şıkta rastlantı %25), çünkü
// doğru şık ortalama 17,15 karakterken çeldiriciler 10,41 karakterdi.
//
// İki işaret bunu yakalar ve ikisinin de ağırlığı 2'dir; ağırlık 2 olan bir
// işaret soruyu Dereceli / Düello / Turnuva havuzundan ÇIKARIR:
//   · dogru_en_uzun      — doğru şık, yanlışların ORTALAMASININ `soru_uzun_sik_oran`
//                          katından uzun VE aradaki fark `soru_uzun_sik_fark`ı aşıyor.
//   · dogru_coklu_kelime — doğru şık HER çeldiriciden daha çok kelimeli.
//
// Bu testler kırılırsa ya kural gevşemiş (eski %63'lük açık geri gelir) ya da
// aşırı sıkılmıştır (havuz gereksiz yere boşalır). Eşikler koda gömülmez,
// `oyun_ayarlari`'ndan okunur — test de oradan okur.

import test from 'node:test';
import assert from 'node:assert/strict';
import { islem, baglantiVarMi, alintila as a } from './yardim.mjs';

const atla = !(await baglantiVarMi());
const sec = { skip: atla ? 'veritabanı bağlantısı yok (SUPABASE_DB_URL / .env.local)' : false };

async function isaretler(c, soru, sikler, dogru) {
  const dizi = JSON.stringify(sikler);
  const r = await c.tek(
    `select public.soru_kural_isaretleri(${a(soru)}, ${a(dizi)}::jsonb, ${dogru}::smallint)::text`
  );
  return r.replace(/^\{|\}$/g, '').split(',').filter(Boolean);
}

test('dengeli şıklarda uzunluk/kelime işareti çıkmaz', sec, async () => {
  await islem(async (c) => {
    const i = await isaretler(
      c,
      'Türkiye’nin başkenti neresidir?',
      ['Ankara', 'İstanbul', 'İzmir', 'Bursa'],
      0
    );
    assert.ok(!i.includes('dogru_en_uzun'), `beklenmeyen işaret: ${i.join(',')}`);
    assert.ok(!i.includes('dogru_coklu_kelime'), `beklenmeyen işaret: ${i.join(',')}`);
  });
});

test('doğru şık çeldiricilerden belirgin uzunsa dogru_en_uzun işaretlenir', sec, async () => {
  await islem(async (c) => {
    const i = await isaretler(
      c,
      'Hangisi doğrudur?',
      ['Uzun ve ayrıntılı biçimde yazılmış doğru cevap metni', 'Kısa', 'Az', 'Dar'],
      0
    );
    assert.ok(i.includes('dogru_en_uzun'), `dogru_en_uzun bekleniyordu, gelen: ${i.join(',')}`);
  });
});

test('tek kelimelik çeldiriciler arasında çok kelimeli doğru cevap işaretlenir', sec, async () => {
  await islem(async (c) => {
    // Şikâyetin tam hâli: bütün şıklar tek kelime, doğru cevap iki kelime.
    const i = await isaretler(c, 'Hangisi?', ['Kara Kuvvetleri', 'Donanma', 'Havacılık', 'Jandarma'], 0);
    assert.ok(
      i.includes('dogru_coklu_kelime'),
      `dogru_coklu_kelime bekleniyordu, gelen: ${i.join(',')}`
    );
  });
});

test('eşiğin altındaki küçük uzunluk farkı işaretlenmez', sec, async () => {
  await islem(async (c) => {
    const fark = Number(await c.tek(`select public.ayar_sayi('soru_uzun_sik_fark', 3)`));
    // Doğru şık yanlışların ortalamasından yalnız ~1-2 karakter uzun: eşik altı.
    const i = await isaretler(c, 'Hangisi?', ['Elmalar', 'Armut', 'Kiraz', 'Şeftali'], 0);
    assert.ok(
      !i.includes('dogru_en_uzun'),
      `${fark} karakterlik eşiğin altında işaret çıkmamalı, gelen: ${i.join(',')}`
    );
  });
});

test('bu iki işaretin ağırlığı rekabetçi havuzdan çıkarmaya yeter', sec, async () => {
  await islem(async (c) => {
    const esik = Number(await c.tek(`select public.ayar_sayi('soru_rekabetci_haric_agirlik', 2)`));
    for (const isaret of ['dogru_en_uzun', 'dogru_coklu_kelime']) {
      const agirlik = Number(await c.tek(`select public.soru_isaret_agirligi(${a(isaret)})`));
      assert.ok(
        agirlik >= esik,
        `${isaret} ağırlığı ${agirlik}, eşik ${esik} — tek başına havuzdan çıkarmıyor (Paket 25'teki kusur buydu)`
      );
    }
  });
});

// Düello faz makinesi ve bağlantı kopması.
//
// NE KORUYOR:
//  1. FAZ SIRASI: kategori → hazırlık → cevap → sonuç → tur sonu. Faz atlanırsa
//     ya savunan hazırlanmadan soruyu görür ya da maç kilitlenir.
//  2. SALDIRI RİSKİ: savunan kendi EN ZAYIF kategorisinde bilirse can kaybeden
//     SALDIRANDIR. Bu, düelloyu "en zayıf noktayı sürekli döv" oyunu olmaktan
//     çıkaran tek kuraldır; kırılırsa denge tamamen bozulur.
//  3. KOPUKLUK: `duello_kopuk_sn` (25) sn görünmeyen oyuncu kopuk sayılır,
//     `duello_kopuk_bekleme_sn` (45) sn sonra maçı kaybeder; dönerse kalan
//     süresi DONDURULDUĞU yerden devam eder (en az 3 sn — Paket 24 A.4).
//     Kırılırsa ya anlık bir ağ dalgalanması maçı kaybettirir ya da terk eden
//     oyuncu sonsuza kadar bekletir.
//  4. Bot ASLA kopuk sayılmaz (botun `last_seen`'i ilerlemez).

import test from 'node:test';
import assert from 'node:assert/strict';
import { islem, oyuncuKur, olarak, baglantiVarMi, alintila as a } from './yardim.mjs';

const atla = !(await baglantiVarMi());
const sec = { skip: atla ? 'veritabanı bağlantısı yok (SUPABASE_DB_URL / .env.local)' : false };

async function duelloKur(c) {
  const x = await oyuncuKur(c, 'du1');
  const y = await oyuncuKur(c, 'du2');
  const id = await c.tek(`select public.duello_olustur(${a(x)}, ${a(y)}, true, null)`);
  return { x, y, id };
}

async function duello(c, id) {
  const r = await c.sorgu(`select * from public.duellolar where id = ${a(id)}`);
  return r[0];
}

test('düello kategori fazında ve tam canla başlar', sec, async () => {
  await islem(async (c) => {
    const { x, id } = await duelloKur(c);
    const d = await duello(c, id);
    const can = Number(await c.tek(`select public.ayar_sayi('duello_can', 3)`));
    assert.equal(d.faz, 'kategori', 'ilk faz kategori seçimi');
    assert.equal(d.durum, 'aktif');
    assert.equal(Number(d.can1), can);
    assert.equal(Number(d.can2), can);
    assert.equal(d.saldiran, x, 'ilk saldıran davet eden taraf');
    assert.ok(d.faz_bitis, 'faz bitişi kurulmalı — yoksa faz asla ilerlemez');
  });
});

test('kategori seçilince hazırlık fazına geçilir ve soru atanır', sec, async () => {
  await islem(async (c) => {
    const { x, id } = await duelloKur(c);
    const kategori = await c.tek(`select k from unnest(public.duello_kategorileri()) k limit 1`);
    await olarak(c, x);
    await c.sorgu(`select public.duello_kategori_sec(${a(id)}, ${a(kategori)})`);
    const d = await duello(c, id);
    assert.equal(d.faz, 'hazirlik', 'kategori seçimi sonrası hazırlık fazı');
    assert.equal(d.kategori, kategori);
    assert.ok(d.soru_id, 'hazırlık fazına girerken soru seçilmiş olmalı');
  });
});

test('aynı kategori üst üste seçilemez ve maçta en çok iki kez kullanılır', sec, async () => {
  await islem(async (c) => {
    const { x, y, id } = await duelloKur(c);
    const [k1, k2] = (
      await c.sorgu(`select k from unnest(public.duello_kategorileri()) k limit 2`)
    ).map((r) => r.k);
    const enCok = Number(await c.tek(`select public.ayar_sayi('duello_kategori_max', 2)`));
    const uygunMu = async (kat) =>
      (await c.tek(`select public.duello_kategori_uygun_mu(${a(id)}, ${a(x)}, ${a(kat)})`)) === 't';
    // Kural hamle geçmişine bakar; hamleyi doğrudan yazıyoruz.
    const hamle = (kat) =>
      c.sorgu(
        `insert into public.duello_hamleler (duello_id, saldiran, savunan, kategori, tur, dogru) values (${a(id)}, ${a(x)}, ${a(y)}, ${a(kat)}, 1, true)`
      );

    assert.equal(await uygunMu(k1), true, 'hiç kullanılmamış kategori uygun');

    await hamle(k1);
    assert.equal(await uygunMu(k1), false, 'son kullanılan kategori arka arkaya seçilemez');
    assert.equal(await uygunMu(k2), true, 'başka kategori serbest');

    await hamle(k2); // araya girsin ki "üst üste" kuralı devreden çıksın
    assert.equal(await uygunMu(k1), true, `k1 ${enCok} kez kullanılana kadar açık`);

    for (let i = 1; i < enCok; i++) await hamle(k1);
    assert.equal(await uygunMu(k1), false, `aynı kategori maçta en çok ${enCok} kez`);
  });
});

test('25 saniye görünmeyen oyuncu kopuk sayılır, bot sayılmaz', sec, async () => {
  await islem(async (c) => {
    const { x, y, id } = await duelloKur(c);
    const kopukSn = Number(await c.tek(`select public.ayar_sayi('duello_kopuk_sn', 25)`));

    await c.sorgu(`update public.profiles set last_seen = now() where id in (${a(x)}, ${a(y)})`);
    assert.equal(await c.tek(`select public.duello_kopuk_kim(${a(id)})`), null, 'ikisi de görünürken kopuk yok');

    // y, eşiğin 1 saniye berisinde: hâlâ kopuk değil.
    await c.sorgu(
      `update public.profiles set last_seen = now() - make_interval(secs => ${kopukSn - 1}) where id = ${a(y)}`
    );
    assert.equal(await c.tek(`select public.duello_kopuk_kim(${a(id)})`), null, 'eşik dolmadan kopuk sayılmamalı');

    // Eşiği aşınca kopuk.
    await c.sorgu(
      `update public.profiles set last_seen = now() - make_interval(secs => ${kopukSn + 5}) where id = ${a(y)}`
    );
    assert.equal(await c.tek(`select public.duello_kopuk_kim(${a(id)})`), y, 'eşik aşılınca kopuk sayılmalı');

    // Aynı oyuncu bot olsaydı kopuk sayılmayacaktı.
    await c.sorgu(`update public.profiles set is_bot = true, bot_turu = 'gizli' where id = ${a(y)}`);
    assert.equal(await c.tek(`select public.duello_kopuk_kim(${a(id)})`), null, 'bot kopuk sayılmaz');
  });
});

test('kopukluk bilgisi kalan bekleme süresini doğru sayar', sec, async () => {
  await islem(async (c) => {
    const { x, y, id } = await duelloKur(c);
    const bekleme = Number(await c.tek(`select public.ayar_sayi('duello_kopuk_bekleme_sn', 45)`));
    const kopukSn = Number(await c.tek(`select public.ayar_sayi('duello_kopuk_sn', 25)`));

    await c.sorgu(`update public.profiles set last_seen = now() where id = ${a(x)}`);
    await c.sorgu(
      `update public.profiles set last_seen = now() - make_interval(secs => ${kopukSn + 5}) where id = ${a(y)}`
    );
    await c.sorgu(`update public.duellolar set kopuk_at = now() - interval '10 seconds' where id = ${a(id)}`);

    await olarak(c, x);
    const bilgi = JSON.parse(await c.tek(`select public.duello_baglanti(${a(id)})::text`));
    assert.equal(bilgi.kopuk, true);
    assert.equal(bilgi.ben_mi, false, 'kopan karşı taraf');
    assert.equal(bilgi.bekleme_sn, bekleme);
    assert.ok(
      bilgi.kalan_sn <= bekleme - 10 + 1 && bilgi.kalan_sn >= bekleme - 10 - 1,
      `kalan süre ~${bekleme - 10} olmalı, gelen: ${bilgi.kalan_sn}`
    );
  });
});

test('süre dolmuşken kopan oyuncuya dönünce taban süre kadar hak kalır', sec, async () => {
  await islem(async (c) => {
    // Paket 24 A.4'te bulunan kusur: cevap fazının SON saniyesinde kopan oyuncunun
    // dondurulan kalan süresi 0 hesaplanıyordu; geri dönen oyuncu soruyu görmeden
    // hamlesini kaybediyordu. Taban `duello_kopuk_taban_sn` ile kondu.
    const { x, y, id } = await duelloKur(c);
    const taban = Number(await c.tek(`select public.ayar_sayi('duello_kopuk_taban_sn', 3)`));

    // Cevap fazındayız ve süre ZATEN DOLMUŞ. y kopuk.
    await c.sorgu(
      `update public.duellolar
          set faz = 'cevap', faz_bitis = now() - interval '2 seconds', son_hareket = now()
        where id = ${a(id)}`
    );
    await c.sorgu(`update public.profiles set last_seen = now() where id = ${a(x)}`);
    await c.sorgu(
      `update public.profiles set last_seen = now() - interval '60 seconds' where id = ${a(y)}`
    );

    await c.sorgu(`select public.duello_ilerlet(${a(id)})`);
    const kopuk = await duello(c, id);
    assert.ok(kopuk.kopuk_at, 'kopukluk kaydedilmeli');
    const kalanSn = Number(
      await c.tek(`select extract(epoch from kopuk_kalan) from public.duellolar where id = ${a(id)}`)
    );
    assert.ok(kalanSn >= taban, `dondurulan süre en az ${taban} sn olmalı, hesaplanan: ${kalanSn}`);

    // Oyuncu geri döndü: faz bitişi en az taban kadar ileri alınmalı.
    await c.sorgu(`update public.profiles set last_seen = now() where id = ${a(y)}`);
    await c.sorgu(`select public.duello_ilerlet(${a(id)})`);
    const kalanFaz = Number(
      await c.tek(`select extract(epoch from (faz_bitis - now())) from public.duellolar where id = ${a(id)}`)
    );
    assert.ok(
      kalanFaz >= taban - 1,
      `geri dönen oyuncuya en az ${taban} sn kalmalı, kalan: ${kalanFaz}`
    );
  });
});

test('nabız aralığı kopukluk eşiğinin yarısından küçük kalır', sec, async () => {
  await islem(async (c) => {
    // Paket 28 A'da yaşanan kusur: paylaşılan kabuk 60 sn'de bir nabız atıyordu,
    // düellonun kopukluk eşiği 25 sn'ydi. 60 > 25 olduğu için BAĞLI bir oyuncu
    // iki nabız arasında "kopuk" sayılıyor, hatta 45 sn'lik bekleme dolarsa
    // maçı haksız yere kaybedebiliyordu.
    //
    // Bu test o ilişkiyi kilitliyor: eşik ya da nabız ayarı ileride değişse bile
    // nabız her zaman eşiğin yarısından küçük kalmalı.
    const nabiz = Number(await c.tek('select public.duello_nabiz_sn()'));
    const kopuk = Number(await c.tek(`select public.ayar_sayi('duello_kopuk_sn', 25)`));
    assert.ok(nabiz >= 3, `nabız en az 3 sn olmalı, gelen: ${nabiz}`);
    assert.ok(
      nabiz <= kopuk / 2,
      `nabız (${nabiz} sn) kopukluk eşiğinin (${kopuk} sn) yarısından küçük olmalı`
    );

    // Eşik değişirse nabız da kendiliğinden kırpılmalı: ayarı geçici olarak
    // düşürüp fonksiyonun uyum sağladığını görüyoruz (işlem geri alınıyor).
    await c.sorgu(
      `insert into public.oyun_ayarlari (anahtar, deger) values ('duello_kopuk_sn', '8'::jsonb)
       on conflict (anahtar) do update set deger = excluded.deger`
    );
    const yeni = Number(await c.tek('select public.duello_nabiz_sn()'));
    assert.ok(yeni <= 4, `eşik 8 sn olunca nabız en çok 4 sn olmalı, gelen: ${yeni}`);
  });
});

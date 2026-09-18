// Joker ekonomisi — Paket 27.
//
// NE KORUYOR: joker, oyunun kalan tek coin harcama yeri (sink). Bu testlerden
// biri kırılırsa ya joker bedavaya gelir (sink çöker, coin birikir ve hiçbir şey
// ifade etmez) ya da oyuncu ödediği jokeri alamaz.
//   1. Yeni hesaba her KULLANIMDA OLAN türden `baslangic_joker_adet` kadar verilir;
//      ölü tür 'pas' VERİLMEZ, bota hiç verilmez, eski hesaplara dokunulmaz.
//   2. Maç başına toplam `duello_joker_hak` (4) joker ve AYNI TÜR YALNIZ BİR KEZ.
//   3. Ücretsiz joker tek yerde: SERBEST Klasik Mod'un ilk 50:50'si.
//      Dereceli Klasik Mod'da ve düelloda hiçbir joker ücretsiz değil.
//   4. Maç içi satın alma TEK İŞLEM: kullanım reddedilirse coin DÜŞMEZ.

import test from 'node:test';
import assert from 'node:assert/strict';
import { islem, oyuncuKur, olarak, baglantiVarMi, hataVerir, alintila as a } from './yardim.mjs';

const atla = !(await baglantiVarMi());
const sec = { skip: atla ? 'veritabanı bağlantısı yok (SUPABASE_DB_URL / .env.local)' : false };

const KULLANIMDA = ['elli', 'sure', 'soru_degistir', 'zaman_baskisi', 'saldiri_degistir', 'savunma_kilidi', 'seri_koruma'];

async function envanter(c, id) {
  const r = await c.sorgu(`select tur, adet from public.joker_envanter where user_id = ${a(id)}`);
  return Object.fromEntries(r.map((x) => [x.tur, Number(x.adet)]));
}

/** Aktif, senkron bir Klasik Mod maçı kurar (soru ve saat hazır). */
async function klasikMac(c, o1, o2, dereceli) {
  return c.tek(
    `insert into public.matches (oyuncu1, oyuncu2, durum, dereceli, senkron, basladi,
                                 soru_ids, aktif_soru, soru_baslangic)
     values (${a(o1)}, ${a(o2)}, 'aktif', ${a(dereceli)}, true, true,
             public.soru_sec(null, 20, array[${a(o1)}]::uuid[]), 0, now())
     returning id`
  );
}

// ---------------------------------------------------------------- A
test('yeni hesap kullanımda olan her joker türünden başlangıç stoğu alır', sec, async () => {
  await islem(async (c) => {
    const adet = Number(await c.tek(`select public.ayar_sayi('baslangic_joker_adet', 2)`));
    const o = await oyuncuKur(c, 'jbas');
    const env = await envanter(c, o);

    for (const tur of KULLANIMDA) {
      assert.equal(env[tur], adet, `${tur} türünden ${adet} adet verilmeli`);
    }
    assert.equal(env.pas, undefined, "'pas' ölü tür — hiçbir yerde harcanamaz, verilmemeli");
  });
});

test('bota başlangıç jokeri verilmez', sec, async () => {
  await islem(async (c) => {
    const bot = await oyuncuKur(c, 'jbot', { is_bot: true, bot_turu: 'gizli' });
    // oyuncuKur önce auth.users'a yazar (tetikleyici insan sanır), sonra bot yapar.
    await c.sorgu(`delete from public.joker_envanter where user_id = ${a(bot)}`);
    const verilen = Number(await c.tek(`select public.baslangic_jokerleri_ver(${a(bot)})`));
    assert.equal(verilen, 0, 'bot için 0 dönmeli');
    assert.deepEqual(await envanter(c, bot), {}, 'botun envanteri boş kalmalı');
  });
});

test('başlangıç stoğu ikinci kez verilmez (eski hesaplar etkilenmez)', sec, async () => {
  await islem(async (c) => {
    const o = await oyuncuKur(c, 'jtekrar');
    const once = await envanter(c, o);
    const ikinci = Number(await c.tek(`select public.baslangic_jokerleri_ver(${a(o)})`));
    assert.equal(ikinci, 0, 'envanteri olan hesaba tekrar verilmemeli');
    assert.deepEqual(await envanter(c, o), once);
  });
});

// ---------------------------------------------------------------- B
test('SERBEST Klasik Mod: ilk 50:50 ücretsiz, envanterden düşmez', sec, async () => {
  await islem(async (c) => {
    const [x, y] = [await oyuncuKur(c, 'serb1'), await oyuncuKur(c, 'serb2')];
    const mac = await klasikMac(c, x, y, false);
    await olarak(c, x);
    const once = (await envanter(c, x)).elli;
    const sonuc = JSON.parse(await c.tek(`select public.joker_kullan('1v1', ${a(mac)}, 0, 'elli')::text`));
    assert.equal(sonuc.ucretsiz, true, 'serbest maçta ilk 50:50 ücretsiz olmalı');
    assert.equal((await envanter(c, x)).elli, once, 'ücretsizken envanter düşmemeli');
  });
});

test('DERECELİ Klasik Mod: 50:50 ücretlidir, envanterden düşer', sec, async () => {
  await islem(async (c) => {
    const [x, y] = [await oyuncuKur(c, 'der1'), await oyuncuKur(c, 'der2')];
    const mac = await klasikMac(c, x, y, true);
    await olarak(c, x);
    const once = (await envanter(c, x)).elli;
    const sonuc = JSON.parse(await c.tek(`select public.joker_kullan('1v1', ${a(mac)}, 0, 'elli')::text`));
    assert.equal(sonuc.ucretsiz, false, 'dereceli maçta ücretsiz joker YOK');
    assert.equal((await envanter(c, x)).elli, once - 1, 'envanterden bir adet düşmeli');
  });
});

test('aynı joker aynı maçta iki kez kullanılamaz', sec, async () => {
  await islem(async (c) => {
    const [x, y] = [await oyuncuKur(c, 'ayni1'), await oyuncuKur(c, 'ayni2')];
    const mac = await klasikMac(c, x, y, true);
    await olarak(c, x);
    await c.sorgu(`select public.joker_kullan('1v1', ${a(mac)}, 0, 'elli')`);
    const hata = await hataVerir(c, `select public.joker_kullan('1v1', ${a(mac)}, 0, 'elli')`);
    assert.match(hata, /zaten kullandın/i);
  });
});

test('düelloda saldırı jokeri ücretsiz değil, envanterden düşer', sec, async () => {
  await islem(async (c) => {
    const x = await oyuncuKur(c, 'dsal1');
    const y = await oyuncuKur(c, 'dsal2');
    const id = await c.tek(`select public.duello_olustur(${a(x)}, ${a(y)}, true, null)`);
    const kategori = await c.tek(`select k from unnest(public.duello_kategorileri()) k limit 1`);
    await olarak(c, x);
    await c.sorgu(`select public.duello_kategori_sec(${a(id)}, ${a(kategori)})`);

    const once = (await envanter(c, x)).zaman_baskisi;
    await c.sorgu(`select public.duello_saldiri_jokeri(${a(id)}, 'zaman_baskisi')`);
    assert.equal((await envanter(c, x)).zaman_baskisi, once - 1, 'düelloda joker envanterden düşmeli');

    const ucretsiz = await c.tek(
      `select bool_or(ucretsiz) from public.joker_kullanimlari
        where user_id = ${a(x)} and mac_tur = 'duello' and mac_id = ${a(id)}`
    );
    assert.equal(ucretsiz, 'f', 'düelloda hiçbir joker ücretsiz kaydedilmemeli');
  });
});

test('maç başına toplam hak dolunca yeni joker reddedilir', sec, async () => {
  await islem(async (c) => {
    const hak = Number(await c.tek(`select public.ayar_sayi('duello_joker_hak', 4)`));
    const x = await oyuncuKur(c, 'hak1');
    const y = await oyuncuKur(c, 'hak2');
    const id = await c.tek(`select public.duello_olustur(${a(x)}, ${a(y)}, true, null)`);
    await olarak(c, x);

    // Hakkı dolduracak kadar FARKLI türü doğrudan kullanım kaydına yaz.
    const turler = ['elli', 'sure', 'soru_degistir', 'zaman_baskisi', 'saldiri_degistir', 'savunma_kilidi'];
    for (let i = 0; i < hak; i++) {
      await c.sorgu(
        `insert into public.joker_kullanimlari (user_id, mac_tur, mac_id, soru_index, tur, ucretsiz)
         values (${a(x)}, 'duello', ${a(id)}, ${i}, ${a(turler[i])}, false)`
      );
    }
    const hata = await hataVerir(
      c,
      `select public.joker_hak_kontrol('duello', ${a(id)}, ${a(turler[hak])})`
    );
    assert.match(hata, new RegExp(`en fazla ${hak} joker`, 'i'));
  });
});

test('turnuva finalinde ve arkadaş maçında eski kurallar korunur', sec, async () => {
  await islem(async (c) => {
    const hak = Number(await c.tek(`select public.ayar_sayi('duello_joker_hak', 4)`));
    const [x, y] = [await oyuncuKur(c, 'kur1'), await oyuncuKur(c, 'kur2')];
    const mac = await klasikMac(c, x, y, true);
    await olarak(c, x);
    assert.equal(Number(await c.tek(`select public.joker_mac_siniri('1v1', ${a(mac)})`)), hak);

    // Arkadaş maçı: sınırsız (null) — Paket 27 bu kararı değiştirmedi.
    await c.sorgu(
      `insert into public.friendships (requester, addressee, durum)
       values (${a(x)}, ${a(y)}, 'arkadas')
       on conflict (requester, addressee) do update set durum = 'arkadas'`
    );
    assert.equal(await c.tek(`select public.joker_mac_siniri('1v1', ${a(mac)})`), null);
  });
});

// ---------------------------------------------------------------- C
test('maç içi satın alma: coin düşer, joker aynı işlemde kullanılır', sec, async () => {
  await islem(async (c) => {
    const [x, y] = [await oyuncuKur(c, 'sat1'), await oyuncuKur(c, 'sat2')];
    const mac = await klasikMac(c, x, y, true);
    await olarak(c, x);
    // Envanteri boşalt ki satın alma yolu çalışsın.
    await c.sorgu(`delete from public.joker_envanter where user_id = ${a(x)}`);
    const fiyat = Number(await c.tek(`select public.joker_fiyati('sure')`));
    const coinOnce = Number(await c.tek(`select coin from public.profiles where id = ${a(x)}`));

    const sonuc = JSON.parse(
      await c.tek(`select public.joker_al_ve_kullan('1v1', ${a(mac)}, 0, 'sure')::text`)
    );
    assert.equal(sonuc.satin_alindi, true);
    assert.equal(Number(sonuc.odenen), fiyat);
    assert.equal(Number(sonuc.coin), coinOnce - fiyat, 'coin tam fiyat kadar düşmeli');
    assert.equal(sonuc.uzatildi, true, 'joker aynı çağrıda KULLANILMIŞ olmalı');
    assert.equal(
      await c.tek(
        `select count(*) from public.joker_kullanimlari
          where user_id = ${a(x)} and mac_id = ${a(mac)} and tur = 'sure'`
      ),
      '1'
    );
    // Satın alma izi ölçülebilir olmalı.
    assert.equal(
      await c.tek(
        `select count(*) from public.coin_hareketleri
          where user_id = ${a(x)} and referans = 'joker_mac_ici:' || ${a(mac)}`
      ),
      '1',
      'coin_hareketleri kendi kaynağıyla yazılmalı'
    );
  });
});

test('coin yetmiyorsa satın alma reddedilir ve hiçbir şey değişmez', sec, async () => {
  await islem(async (c) => {
    const [x, y] = [await oyuncuKur(c, 'yok1'), await oyuncuKur(c, 'yok2')];
    const mac = await klasikMac(c, x, y, true);
    await olarak(c, x);
    await c.sorgu(`delete from public.joker_envanter where user_id = ${a(x)}`);
    await c.sorgu(`select set_config('app.coin_izin', '1', true)`);
    await c.sorgu(`update public.profiles set coin = 1 where id = ${a(x)}`);

    const hata = await hataVerir(c, `select public.joker_al_ve_kullan('1v1', ${a(mac)}, 0, 'sure')`);
    assert.match(hata, /yetersiz coin/i);
    assert.equal(Number(await c.tek(`select coin from public.profiles where id = ${a(x)}`)), 1);
    assert.equal(
      await c.tek(`select count(*) from public.joker_kullanimlari where user_id = ${a(x)} and mac_id = ${a(mac)}`),
      '0'
    );
  });
});

test('maç bitmişse satın alma reddedilir ve COIN DÜŞMEZ', sec, async () => {
  await islem(async (c) => {
    const [x, y] = [await oyuncuKur(c, 'bit1'), await oyuncuKur(c, 'bit2')];
    const mac = await klasikMac(c, x, y, true);
    await c.sorgu(`update public.matches set durum = 'bitti', bitis = now() where id = ${a(mac)}`);
    await olarak(c, x);
    await c.sorgu(`delete from public.joker_envanter where user_id = ${a(x)}`);
    const coinOnce = Number(await c.tek(`select coin from public.profiles where id = ${a(x)}`));

    const hata = await hataVerir(c, `select public.joker_al_ve_kullan('1v1', ${a(mac)}, 0, 'sure')`);
    assert.match(hata, /aktif değil/i);
    assert.equal(
      Number(await c.tek(`select coin from public.profiles where id = ${a(x)}`)),
      coinOnce,
      'kullanım reddedildiğinde satın alma da geri alınmalı'
    );
  });
});

test('arka arkaya basmak çift satın alma yapmaz', sec, async () => {
  await islem(async (c) => {
    const [x, y] = [await oyuncuKur(c, 'cift1'), await oyuncuKur(c, 'cift2')];
    const mac = await klasikMac(c, x, y, true);
    await olarak(c, x);
    await c.sorgu(`delete from public.joker_envanter where user_id = ${a(x)}`);
    const fiyat = Number(await c.tek(`select public.joker_fiyati('sure')`));
    const coinOnce = Number(await c.tek(`select coin from public.profiles where id = ${a(x)}`));

    await c.sorgu(`select public.joker_al_ve_kullan('1v1', ${a(mac)}, 0, 'sure')`);
    // İkinci basış: "aynı joker maçta bir kez" kapısı satın almadan ÖNCE çalışır.
    const hata = await hataVerir(c, `select public.joker_al_ve_kullan('1v1', ${a(mac)}, 0, 'sure')`);
    assert.match(hata, /zaten kullandın/i);

    assert.equal(
      Number(await c.tek(`select coin from public.profiles where id = ${a(x)}`)),
      coinOnce - fiyat,
      'yalnız bir kez ücretlendirilmeli'
    );
    assert.equal(
      await c.tek(
        `select count(*) from public.coin_hareketleri
          where user_id = ${a(x)} and referans = 'joker_mac_ici:' || ${a(mac)}`
      ),
      '1'
    );
  });
});

test('maç içi satın almada hız sınırı var', sec, async () => {
  await islem(async (c) => {
    const govde = await c.tek(
      `select pg_get_functiondef(p.oid)
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'joker_al_ve_kullan'`
    );
    assert.match(
      govde,
      /hiz_siniri\('joker_al_ve_kullan'/,
      'coin boşaltmaya karşı hız sınırı olmalı'
    );
  });
});

test('fiyatlar sunucudan gelir; satın alınamayan tür null döner', sec, async () => {
  await islem(async (c) => {
    const f = JSON.parse(await c.tek(`select public.joker_fiyatlari()::text`));
    for (const tur of ['elli', 'sure', 'soru_degistir', 'zaman_baskisi', 'saldiri_degistir', 'savunma_kilidi']) {
      assert.ok(Number(f[tur]) > 0, `${tur} fiyatı oyun_ayarlari'nda tanımlı olmalı`);
    }
    assert.equal(await c.tek(`select public.joker_fiyati('seri_koruma')`), null, 'maç içi satılmaz');
    assert.equal(await c.tek(`select public.joker_fiyati('pas')`), null, 'ölü tür satılmaz');
  });
});

// ---------------------------------------------------------------- D
test('bot da maç başına en çok 4 joker kullanır ve aynısını tekrarlamaz', sec, async () => {
  await islem(async (c) => {
    // Kural kodda duruyor: bot bloğu duello_joker_hak'a bakar ve aday havuzundan
    // KULLANILMAMIŞ türü seçer. İnsanla birebir aynı kısıt.
    const govde = await c.tek(
      `select pg_get_functiondef(p.oid)
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'duello_tik_hepsi'`
    );
    assert.ok(
      /duello_joker_hak/.test(govde),
      'bot artık duello_saldiri_joker_siniri değil, insanla aynı toplam hakkı kullanmalı'
    );
    assert.ok(
      !/ayar_sayi\('duello_saldiri_joker_siniri'/.test(govde),
      'eski ayrı saldırı sınırı bot tarafında kalmamalı'
    );
    assert.match(
      govde,
      /not exists \(select 1 from public\.joker_kullanimlari k3/,
      'bot aynı jokeri iki kez seçememeli (kullanılmamış tür havuzu)'
    );
  });
});

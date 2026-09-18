// Sunucu testleri için ortak yardımcılar.
//
// KURAL: testler canlı veritabanına YAZMAZ. Her test bir işlem (transaction)
// içinde çalışır ve sonunda ROLLBACK edilir; hiçbir satır kalıcı olmaz.
// Bu kalıp bu depoda daha önce de kullanıldı (Paket 24, düello ve giysi testleri).
//
// Bağlantı yoksa (SUPABASE_DB_URL ve .env.local yoksa) testler ATLANIR, kırılmaz —
// böylece sırrı olmayan bir ortamda `npm test` yine de yeşil kalır ve bunu söyler.

import { PgIstemci, baglantiDizgisi, alintila } from '../../araclar/pg-mini.mjs';

export { alintila };

let dizgi;
export async function baglantiVarMi() {
  if (dizgi === undefined) dizgi = await baglantiDizgisi();
  return Boolean(dizgi);
}

/**
 * İşlem içinde çalıştır, sonunda her hâlükârda geri al.
 * `f(c, k)` alır: c = istemci, k = testte üretilen kimlikler.
 */
export async function islem(f) {
  if (!(await baglantiVarMi())) throw new Error('Veritabanı bağlantısı yok');
  const c = await new PgIstemci(dizgi).baglan();
  try {
    await c.sorgu('begin');
    try {
      await f(c);
    } finally {
      await c.sorgu('rollback');
    }
  } finally {
    await c.kapat();
  }
}

/**
 * Test için sahte oyuncu. auth.users'a satır atılır; profiles satırını
 * `handle_new_user()` tetikleyicisi KENDİSİ açar (canlıdaki akışın aynısı),
 * ek ayarlar sonradan güncellenir. Hepsi rollback ile gider.
 */
export async function oyuncuKur(c, ad, ekAyar = {}) {
  const id = await c.tek('select gen_random_uuid()');
  await c.sorgu(`insert into auth.users (id) values (${alintila(id)})`);
  // gorunen_ad üretilmiş (generated) kolondur, elle yazılmaz.
  const kolonlar = { username: `test_${ad}_${id.slice(0, 8)}`, ...ekAyar };
  // 'sql:' önekli değerler ham SQL olarak geçer (ör. tarih ifadeleri).
  const yaz = (v) => (typeof v === 'string' && v.startsWith('sql:') ? v.slice(4) : alintila(v));
  const set = Object.keys(kolonlar).map((k) => `${k} = ${yaz(kolonlar[k])}`).join(', ');
  await c.sorgu(`update public.profiles set ${set} where id = ${alintila(id)}`);
  return id;
}

/** O oyuncu olarak davran (RLS ve auth.uid() için). */
export async function olarak(c, id) {
  await c.sorgu(`select set_config('request.jwt.claims', ${alintila(JSON.stringify({ sub: id, role: 'authenticated' }))}, true)`);
}

/** auth.uid()'i temizle — sunucu (cron) gibi davran. */
export async function sunucuOlarak(c) {
  await c.sorgu(`select set_config('request.jwt.claims', '', true)`);
}

/** Bir çağrının hata verdiğini doğrula; hata metnini döndürür. */
export async function hataVerir(c, sql) {
  try {
    await c.sorgu(sql);
  } catch (e) {
    return e.message;
  }
  throw new Error(`Hata bekleniyordu ama çağrı başarılı oldu: ${sql}`);
}

/** Oyun ayarını testin içinde geçici olarak değiştir (rollback ile geri gelir). */
export async function ayarla(c, anahtar, deger) {
  await c.sorgu(
    `insert into public.oyun_ayarlari (anahtar, deger) values (${alintila(anahtar)}, ${alintila(JSON.stringify(deger))}::jsonb)
     on conflict (anahtar) do update set deger = excluded.deger`
  );
}

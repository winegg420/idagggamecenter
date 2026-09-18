// Günlük seri bonusu — `gunluk_seri_bonusu`.
//
// NE KORUYOR: seri bonusu günde BİR KEZ verilir ve yalnız gerçek oyuncuya.
// Kırılırsa ya oyuncular her maçta bonus toplar (lig enflasyonu) ya da hak
// ettikleri günlük bonusu hiç alamaz. Botun bonus alması da lig tablosunu bozar.
//
// Ayrıca Paket 24'te ölçülen kural burada kilitleniyor: bonus YALNIZ
// `mac_sonuclandir` ve `duello_bitir` yollarından geçer; grup maçı ve Hızlı Mod
// bitişi bonus vermez. Bu, "bedava seri koruma kapısı" açılmasın diyedir.

import test from 'node:test';
import assert from 'node:assert/strict';
import { islem, oyuncuKur, baglantiVarMi, alintila as a } from './yardim.mjs';

const atla = !(await baglantiVarMi());
const sec = { skip: atla ? 'veritabanı bağlantısı yok (SUPABASE_DB_URL / .env.local)' : false };

test('seri bonusu günde bir kez verilir', sec, async () => {
  await islem(async (c) => {
    const o = await oyuncuKur(c, 'seri');
    const birinci = Number(await c.tek(`select public.gunluk_seri_bonusu(${a(o)})`));
    const ikinci = Number(await c.tek(`select public.gunluk_seri_bonusu(${a(o)})`));
    assert.ok(birinci > 0, 'günün ilk çağrısı bonus vermeli');
    assert.equal(ikinci, 0, 'aynı gün ikinci çağrı bonus vermemeli');
  });
});

test('seri bonusu tavanı aşmaz', sec, async () => {
  await islem(async (c) => {
    const o = await oyuncuKur(c, 'seritavan');
    const tavan = Number(await c.tek(`select public.ayar_sayi('seri_tavan', 15)`));
    // Uzun seri: 100 günlük seri bile tavanı aşmamalı.
    await c.sorgu(
      `update public.profiles
          set seri_gun = 100,
              seri_son_gun = (now() at time zone 'Europe/Istanbul')::date,
              seri_bonus_tarihi = null
        where id = ${a(o)}`
    );
    const bonus = Number(await c.tek(`select public.gunluk_seri_bonusu(${a(o)})`));
    assert.equal(bonus, tavan, 'bonus seri_tavan ile sınırlı olmalı');
  });
});

test('bot seri bonusu almaz', sec, async () => {
  await islem(async (c) => {
    const bot = await oyuncuKur(c, 'seribot', { is_bot: true, bot_turu: 'gizli' });
    const bonus = Number(await c.tek(`select public.gunluk_seri_bonusu(${a(bot)})`));
    assert.equal(bonus, 0, 'bot bonus almamalı');
  });
});

test('seri bonusu yalnız 1v1 maç ve düello bitişinden çağrılır', sec, async () => {
  await islem(async (c) => {
    const cagiranlar = await c.sorgu(
      `select p.proname
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname <> 'gunluk_seri_bonusu'
          and pg_get_functiondef(p.oid) like '%gunluk_seri_bonusu%'
        order by 1`
    );
    const adlar = cagiranlar.map((x) => x.proname);
    assert.deepEqual(
      adlar,
      ['duello_bitir', 'mac_sonuclandir'],
      `Beklenmeyen çağıran eklendi/çıkarıldı: ${adlar.join(', ')}. ` +
        'Grup maçı ve Hızlı Mod bilerek bonus vermez (Paket 24 C.2).'
    );
  });
});

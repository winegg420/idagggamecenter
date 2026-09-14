-- ============================================================
-- 199 — Köprüde balık tutma: olta + sunucu takvimli yakalama
-- (Revizyon Paketi 13, Aşama 2)
--
-- Oyuncu köprünün ortasındaki balıkçıdan olta alır (coin_harca, tur 'olta'),
-- köprüdeyken göle olta atar. Her çekişte istemci balik_yakala() çağırır;
-- ÖDÜLÜ SUNUCU BELİRLER: olta var mı, süresi dolmuş mu, takvimdeki sıradaki
-- an gelmiş mi, günlük tavan aşılmış mı — hepsi burada. Takvimin rastgele
-- tohumu sunucuda üretilir (gen_random_uuid), istemciye hiç verilmez;
-- istemci yalnız 'bos' / 'yakalandi' / 'tavan' / 'olta_yok' görür.
--
-- Takvim (sahibinin kararı): her yakalama 1 coin; ilk beş coin ilk oltayı
-- attıktan ~1, ~3, ~7, ~14, ~28 dk sonra (her çapaya ±%15 sapma); sonrası
-- her coin 9-21 dk arası rastgele. Günlük tavan 20 coin (coin_hareketleri
-- tur='balik' bugünkü toplamı, reklam ödülü deseni). Sayılar oyun_ayarlari'nda.
--
-- Olta tek kullanımlık: olta_sure_dk (60) sonra ya da oyuncu haritadan
-- çıkınca (istemci olta_birak çağırır) biter. Botlar hiçbir RPC çağırmaz;
-- coin_ekle zaten bota coin yazmaz.
-- ============================================================

insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('olta_fiyat', '5'::jsonb, 'Balıkçıdan olta fiyatı (coin)'),
  ('olta_sure_dk', '60'::jsonb, 'Oltanın geçerlilik süresi (dk); haritadan çıkınca da biter'),
  ('balik_gunluk_tavan', '20'::jsonb, 'Balıktan günde en çok kazanılan coin'),
  ('balik_capalar', '[60,180,420,840,1680]'::jsonb, 'İlk yakalamaların oltayı ilk atıştan itibaren saniyeleri'),
  ('balik_sapma_yuzde', '15'::jsonb, 'Her çapaya uygulanan ± rastgele sapma (yüzde)'),
  ('balik_sonraki_min_dk', '9'::jsonb, 'Çapalar bitince yakalamalar arası en az (dk)'),
  ('balik_sonraki_max_dk', '21'::jsonb, 'Çapalar bitince yakalamalar arası en çok (dk)'),
  ('meydan_bot_balik_yuzde', '35'::jsonb, 'Meydan botlarının bir nöbette bir kez köprüye çıkıp olta atma olasılığı (yüzde; yalnız görsel)')
on conflict (anahtar) do nothing;

create table if not exists public.oltalar (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  alinma_at   timestamptz not null default now(),
  bitis_at    timestamptz not null,
  tohum       text not null,
  basla_at    timestamptz,          -- ilk atış (takvim buradan başlar)
  sonraki_an  timestamptz,          -- sıradaki yakalama anı (istemciye verilmez)
  yakalama    int not null default 0
);
alter table public.oltalar enable row level security;
-- Politika yok: istemci tabloya hiç dokunamaz, her şey RPC'den.
revoke all on public.oltalar from anon, authenticated;

-- ---------- Sıradaki yakalama anı ----------
create or replace function public.balik_sonraki_an(
  p_basla timestamptz, p_yakalama int, p_tohum text, p_onceki timestamptz
) returns timestamptz
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_capalar numeric[];
  v_sapma numeric := public.ayar_sayi('balik_sapma_yuzde', 15) / 100.0;
  v_min numeric := public.ayar_sayi('balik_sonraki_min_dk', 9);
  v_max numeric := public.ayar_sayi('balik_sonraki_max_dk', 21);
  v_r double precision;
begin
  select coalesce(array_agg(x::numeric order by ord), array[60,180,420,840,1680]::numeric[])
    into v_capalar
    from public.oyun_ayarlari o,
         jsonb_array_elements_text(case when jsonb_typeof(o.deger) = 'array' then o.deger else '[]'::jsonb end)
           with ordinality as t(x, ord)
   where o.anahtar = 'balik_capalar';
  if v_capalar is null or array_length(v_capalar, 1) is null then
    v_capalar := array[60,180,420,840,1680]::numeric[];
  end if;
  if v_max < v_min then v_max := v_min; end if;

  if p_yakalama < array_length(v_capalar, 1) then
    -- Çapa: ilk atıştan itibaren, ±sapma
    v_r := public.bot_rasgele(p_tohum || ':c' || p_yakalama::text);
    return p_basla + make_interval(secs => (v_capalar[p_yakalama + 1] * (1 + (v_r * 2 - 1) * v_sapma))::double precision);
  end if;
  -- Çapalar bitti: bir öncekinden 9-21 dk sonra (virajlı, sabit değil)
  v_r := public.bot_rasgele(p_tohum || ':s' || p_yakalama::text);
  return greatest(coalesce(p_onceki, now()), now())
       + make_interval(secs => ((v_min + v_r * (v_max - v_min)) * 60)::double precision);
end;
$$;
revoke all on function public.balik_sonraki_an(timestamptz, int, text, timestamptz) from public, anon, authenticated;

-- ---------- Bugün balıktan kazanılan ----------
create or replace function public.balik_bugun(p_user uuid)
returns int
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(sum(c.miktar), 0)::int
    from public.coin_hareketleri c
   where c.user_id = p_user and c.tur = 'balik' and c.miktar > 0
     and c.olusturuldu >= (((now() at time zone 'Europe/Istanbul')::date)::timestamp at time zone 'Europe/Istanbul');
$$;
revoke all on function public.balik_bugun(uuid) from public, anon, authenticated;

-- ---------- Olta al ----------
create or replace function public.olta_al()
returns table(bitis_at timestamptz, bakiye bigint)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_fiyat bigint := public.ayar_sayi('olta_fiyat', 5);
  v_sure int := public.ayar_sayi('olta_sure_dk', 60)::int;
  v_bakiye bigint;
  v_bitis timestamptz;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  perform public.hiz_siniri('olta_al', 10, interval '60 seconds');
  if exists (select 1 from public.oltalar o where o.user_id = v_me and o.bitis_at > now()) then
    raise exception 'Zaten oltan var';
  end if;
  v_bakiye := public.coin_harca(v_fiyat, 'olta', null);
  v_bitis := now() + make_interval(mins => v_sure);
  insert into public.oltalar (user_id, alinma_at, bitis_at, tohum, basla_at, sonraki_an, yakalama)
  values (v_me, now(), v_bitis, gen_random_uuid()::text, null, null, 0)
  on conflict (user_id) do update
    set alinma_at = excluded.alinma_at, bitis_at = excluded.bitis_at, tohum = excluded.tohum,
        basla_at = null, sonraki_an = null, yakalama = 0;
  return query select v_bitis, v_bakiye;
end;
$$;

-- ---------- Olta bırak (haritadan çıkınca) ----------
create or replace function public.olta_birak()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then return; end if;
  delete from public.oltalar where user_id = auth.uid();
end;
$$;

-- ---------- Olta durumum ----------
create or replace function public.olta_durumum()
returns table(bitis_at timestamptz, bugun int, tavan int, fiyat int, sunucu_zamani timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  return query
    select (select o.bitis_at from public.oltalar o where o.user_id = v_me and o.bitis_at > now()),
           public.balik_bugun(v_me),
           public.ayar_sayi('balik_gunluk_tavan', 20)::int,
           public.ayar_sayi('olta_fiyat', 5)::int,
           now();
end;
$$;

-- ---------- Balık yakala (her çekişte) ----------
create or replace function public.balik_yakala()
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  o public.oltalar%rowtype;
  v_tavan int := public.ayar_sayi('balik_gunluk_tavan', 20)::int;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  -- Bir çekiş ~6 sn: dakikada 40 çağrı, konsoldan döngü kurana da yeter.
  perform public.hiz_siniri('balik_yakala', 40, interval '60 seconds');

  select * into o from public.oltalar where user_id = v_me for update;
  if not found then return 'olta_yok'; end if;
  if o.bitis_at <= now() then
    delete from public.oltalar where user_id = v_me;
    return 'olta_yok';
  end if;

  -- İlk atış: takvim şimdi başlar; bu çekiş boş.
  if o.basla_at is null then
    update public.oltalar
       set basla_at = now(), sonraki_an = public.balik_sonraki_an(now(), 0, o.tohum, now())
     where user_id = v_me;
    return 'bos';
  end if;

  if o.sonraki_an is null or now() < o.sonraki_an then return 'bos'; end if;

  -- Günlük tavan: balık 20 + genel 400 (coin_gunluk_kalan). Tavanda takvim
  -- ilerlemez; oyuncuya "hakkın doldu" denir, animasyon sürebilir.
  if public.balik_bugun(v_me) >= v_tavan or public.coin_gunluk_kalan(v_me) <= 0 then
    return 'tavan';
  end if;

  perform public.coin_ekle(v_me, 1, 'balik', 'balik:' || o.tohum || ':' || (o.yakalama + 1)::text);
  update public.oltalar
     set yakalama = o.yakalama + 1,
         sonraki_an = public.balik_sonraki_an(o.basla_at, o.yakalama + 1, o.tohum, now())
   where user_id = v_me;
  return 'yakalandi';
end;
$$;

revoke all on function public.olta_al() from public, anon;
revoke all on function public.olta_birak() from public, anon;
revoke all on function public.olta_durumum() from public, anon;
revoke all on function public.balik_yakala() from public, anon;
grant execute on function public.olta_al() to authenticated;
grant execute on function public.olta_birak() to authenticated;
grant execute on function public.olta_durumum() to authenticated;
grant execute on function public.balik_yakala() to authenticated;

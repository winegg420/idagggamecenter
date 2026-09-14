-- ============================================================
-- MEYDANDA BOTA İKRAM — BOT İNSAN GİBİ YANITLAR
--
-- Sahibinin bildirimi (14 Eyl 2026): "Botlara da tıklayabiliyor olmalıyız."
-- Haritada bota dokunma istemcide açıldı; ama bota kahve/balon ikram
-- edilince YANIT hiç gelmiyordu: kabul, teklifi alan oyuncunun istemcisinden
-- broadcast ile gidiyor ve botun istemcisi yok. Teklif 20 sn bekleyip zaman
-- aşımına düşüyor, coin iade ediliyordu.
--
-- YENİ:
--   • `ikram_gonder`: alan bir botsa yanıt GÖNDERİM ANINDA yazılır ama
--     `yanit_at` 2-5 sn sonrasına kurulur (insan tepki süresi). Çoğunlukla
--     kabul (`ikram_bot_kabul_yuzde`), red ise coin hemen iade edilir.
--   • `ikram_durumu(p_id)`: yalnız gönderen sorar; `yanit_at` gelmeden
--     'bekliyor' döner. İstemci broadcast'e EK olarak bunu yoklar — gerçek
--     oyuncuya giden teklifte de aynı yol çalışır (paket kaybına karşı yedek).
--
-- `is_bot` İSTEMCİYE SIZMAZ: iki fonksiyon da bot bilgisi döndürmez; botun
-- yanıtı gerçek oyuncunun yanıtıyla aynı biçimde ve insana benzer sürede gelir.
-- ============================================================

insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('ikram_bot_kabul_yuzde', '85'::jsonb,
   'Meydanda bota yapılan kahve/balon ikramını botun kabul etme yüzdesi. Red edilirse coin iade edilir.'),
  ('ikram_bot_yanit_sn_min', '2'::jsonb,
   'Botun ikram teklifine yanıt vermeden önceki en kısa bekleme (sn).'),
  ('ikram_bot_yanit_sn_max', '5'::jsonb,
   'Botun ikram teklifine yanıt vermeden önceki en uzun bekleme (sn).')
on conflict (anahtar) do update set aciklama = excluded.aciklama;

create or replace function public.ikram_gonder(p_alan uuid, p_tur text)
returns table(ikram_id uuid, ikram_coin integer, bakiye bigint)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := auth.uid();
  v_fiyat int := public.ayar_sayi('coin_ikram', 5)::int;
  v_bakiye bigint;
  v_id uuid;
  v_kapali boolean;
  v_bot boolean;
  v_min numeric := public.ayar_sayi('ikram_bot_yanit_sn_min', 2)::numeric;
  v_max numeric := public.ayar_sayi('ikram_bot_yanit_sn_max', 5)::numeric;
  v_kabul boolean;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  perform public.hiz_siniri('ikram_gonder', 30, interval '60 seconds');
  if p_tur not in ('kahve','balon') then raise exception 'Geçersiz ikram'; end if;
  if p_alan is null or p_alan = v_me then raise exception 'Kendine ikram edemezsin'; end if;

  select coalesce(rahatsiz_etme, false), coalesce(is_bot, false)
    into v_kapali, v_bot
    from public.profiles where id = p_alan;
  if v_kapali is null then raise exception 'Oyuncu bulunamadı'; end if;
  if v_kapali then raise exception 'Bu oyuncu şu an ikram almak istemiyor'; end if;

  -- Coin ÖNCE düşülür; reddedilir ya da zaman aşımına uğrarsa iade edilir.
  v_bakiye := public.coin_harca(v_fiyat, 'ikram', p_tur || ':' || p_alan::text || ':' || clock_timestamp()::text);

  insert into public.meydan_ikramlari (gonderen, alan, tur, coin)
  values (v_me, p_alan, p_tur, v_fiyat)
  returning meydan_ikramlari.id into v_id;

  -- BOT: yanıt şimdi yazılır, görünür olması insan tepki süresi kadar gecikir.
  if v_bot then
    if v_max < v_min then v_max := v_min; end if;
    v_kabul := random() * 100 < public.ayar_sayi('ikram_bot_kabul_yuzde', 85);
    update public.meydan_ikramlari
       set durum = case when v_kabul then 'kabul' else 'red' end,
           yanit_at = now() + make_interval(secs => (v_min + random() * (v_max - v_min))::double precision)
     where id = v_id;
    if not v_kabul then
      perform public.coin_ekle(v_me, v_fiyat, 'ikram_iade', v_id::text);
      -- İade bakiyeye yansısın (istemci döneni gösteriyor).
      v_bakiye := v_bakiye + v_fiyat;
    end if;
  end if;

  return query select v_id, v_fiyat, v_bakiye;
end;
$fn$;

revoke all on function public.ikram_gonder(uuid, text) from public, anon;
grant execute on function public.ikram_gonder(uuid, text) to authenticated;

-- Gönderenin teklifinin durumu. Yanıt anı gelmeden 'bekliyor'.
create or replace function public.ikram_durumu(p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  r public.meydan_ikramlari%rowtype;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  select * into r from public.meydan_ikramlari where id = p_id;
  if not found or r.gonderen <> auth.uid() then raise exception 'Teklif bulunamadı'; end if;
  if r.durum = 'bekliyor' or (r.yanit_at is not null and r.yanit_at > now()) then
    return 'bekliyor';
  end if;
  return r.durum;
end;
$fn$;

revoke all on function public.ikram_durumu(uuid) from public, anon;
grant execute on function public.ikram_durumu(uuid) to authenticated;

-- ============================================================
-- PUANSIZ (NORMAL) MAÇ TAMAMEN ÖDÜLSÜZ
--
-- ÖNCE: `matches.dereceli = false` maçta lig puanı yazılmıyordu ama
-- COIN yine veriliyordu (`mac_sonuclandir` içinde `coin_mac_odulu`
-- çağrısı dereceli kontrolünden ÖNCE duruyordu). Yani "puansız maç"
-- aslında coin farmlamanın en ucuz yoluydu.
--
-- SONRA: puansız maç ne kazandırır ne kaybettirir. Keyfi maç.
--   dereceli = true  → coin + lig puanı
--   dereceli = false → hiçbiri (rozet verilmeye devam eder)
--
-- İstemciye güvenilmiyor: kural iki katmanda birden zorlanıyor.
--   1) `mac_sonuclandir` puansız maçta coin çağrısını hiç yapmıyor.
--   2) `coin_mac_odulu` referansı bir maç id'siyse maçın kendisine
--      bakıyor; dereceli değilse coin yazmıyor. Böylece başka bir yol
--      (şimdi ya da sonra) bu fonksiyonu çağırsa da kural delinmiyor.
-- ============================================================

begin;

-- ---------------------------------------- 1) ikinci savunma: coin katmanı
create or replace function public.coin_mac_odulu(
  p_referans text,
  p_kazanan uuid,
  p_oyuncular uuid[],
  p_carpan numeric default 1
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $cmo$
declare
  v_galibiyet bigint := public.ayar_sayi('coin_mac_galibiyet', 20);
  v_beraberlik bigint := public.ayar_sayi('coin_mac_beraberlik', 10);
  v_carpan numeric := coalesce(p_carpan, 1);
  v_oyuncu uuid;
  v_mac_id uuid;
  v_dereceli boolean;
begin
  if p_referans is null then return; end if;
  if v_carpan <= 0 then return; end if;      -- dostluk maçı: coin yok

  -- Referans bir 1v1 maç id'siyse: puansız maç coin vermez.
  -- (Grup/hızlı mod referansları uuid olmadığı için buradan etkilenmez.)
  begin
    v_mac_id := p_referans::uuid;
  exception when others then
    v_mac_id := null;
  end;

  if v_mac_id is not null then
    select coalesce(m.dereceli, true) into v_dereceli
      from public.matches m where m.id = v_mac_id;
    if found and not v_dereceli then
      return;
    end if;
  end if;

  if p_kazanan is not null then
    perform public.coin_ekle(p_kazanan, floor(v_galibiyet * v_carpan)::bigint, 'mac', p_referans);
  else
    foreach v_oyuncu in array coalesce(p_oyuncular, '{}'::uuid[]) loop
      perform public.coin_ekle(v_oyuncu, floor(v_beraberlik * v_carpan)::bigint, 'mac', p_referans);
    end loop;
  end if;
end;
$cmo$;

-- ------------------------------- 2) birinci savunma: maç sonuçlandırma
-- Tek değişiklik: `coin_mac_odulu` çağrısı dereceli kontrolünün ALTINA
-- indi. Geri kalan gövde migration 150 ile birebir aynı.
create or replace function public.mac_sonuclandir(
  p_match_id uuid,
  p_kazanan uuid,
  p_kaybeden uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $ms$
declare
  m public.matches%rowtype;
  v_oyuncu uuid;
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_seri int;
  v_tarih date;
  v_yeni_seri int;
  v_bonus int;
  v_carpan numeric := 1;
  v_coin_carpan numeric := 1;
  v_lig int;
  v_bot_var boolean;
  v_acik_bot boolean;
  v_kazanan_bot boolean := false;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then return; end if;

  select bool_or(coalesce(p.is_bot, false)),
         bool_or(coalesce(p.is_bot, false) and coalesce(p.bot_turu, 'acik') = 'acik')
    into v_bot_var, v_acik_bot
    from public.profiles p where p.id in (m.oyuncu1, m.oyuncu2);

  if coalesce(v_bot_var, false) then
    v_carpan := 1;                       -- bot maçında çift limiti yok
  else
    v_carpan := public.cift_odul_carpani(m.oyuncu1, m.oyuncu2, p_match_id);
  end if;

  v_coin_carpan := v_carpan;
  if coalesce(v_acik_bot, false) then
    v_coin_carpan := v_coin_carpan * public.ayar_ondalik('coin_bot_carpani', 0.5);
  end if;

  update public.matches
     set durum = 'bitti', kazanan = p_kazanan, bitis = now(),
         odul_carpan = v_carpan,
         dostluk = (v_carpan = 0)
   where id = p_match_id;

  -- PUANSIZ MAÇ: ne coin ne lig puanı. Yalnız rozet.
  if not coalesce(m.dereceli, true) then
    if p_kazanan is not null then
      perform public.award_badge(p_kazanan, 'ilk_galibiyet');
    end if;
    return;
  end if;

  perform public.coin_mac_odulu(p_match_id::text, p_kazanan, array[m.oyuncu1, m.oyuncu2], v_coin_carpan);

  if p_kazanan is not null then
    select coalesce(is_bot, false) into v_kazanan_bot from public.profiles where id = p_kazanan;
    v_lig := floor(20 * v_carpan *
      (case when v_kazanan_bot
            then public.ayar_sayi('lig_bot_puan_yuzde', 40)::numeric / 100
            else 1 end))::int;
    if v_lig > 0 then
      update public.profiles
         set puan = puan + v_lig, puan_hafta = puan_hafta + v_lig
       where id = p_kazanan;
    end if;

    perform public.award_badge(p_kazanan, 'ilk_galibiyet');
    if (select count(*) from public.matches where kazanan = p_kazanan and durum = 'bitti') >= 10 then
      perform public.award_badge(p_kazanan, 'mac_10');
    end if;
    if p_kaybeden = 'b0b00000-0000-4000-8000-000000000003' then
      perform public.award_badge(p_kazanan, 'bot_avcisi');
    end if;
    if (select count(*) from public.match_answers
        where match_id = p_match_id and user_id = p_kazanan and dogru)
       >= coalesce(array_length(m.soru_ids, 1), 0) then
      perform public.award_badge(p_kazanan, 'tam_isabet');
    end if;
  end if;

  foreach v_oyuncu in array array[m.oyuncu1, m.oyuncu2] loop
    select seri, son_seri_tarihi into v_seri, v_tarih
    from public.profiles where id = v_oyuncu and not is_bot;
    if found and v_tarih is distinct from v_bugun then
      v_yeni_seri := case when v_tarih = v_bugun - 1 then v_seri + 1 else 1 end;
      v_bonus := least(v_yeni_seri * 5, 50);
      update public.profiles
         set seri = v_yeni_seri,
             son_seri_tarihi = v_bugun,
             puan = puan + v_bonus,
             puan_hafta = puan_hafta + v_bonus
       where id = v_oyuncu;
      if v_yeni_seri >= 3 then perform public.award_badge(v_oyuncu, 'seri_3'); end if;
      if v_yeni_seri >= 7 then perform public.award_badge(v_oyuncu, 'seri_7'); end if;
    end if;
  end loop;
end;
$ms$;

commit;

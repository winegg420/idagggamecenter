-- Paket 20 · Bölüm I.3 — Maç sonu ödül dökümü
-- Sonuç ekranı tek satır gösteriyordu (+50 lig · +50 coin), gerçekte seri bonusu / seri coin'i de geliyordu (+53 / +55)
-- ve hiçbir yerde açıklanmıyordu. Artık ödülü YAZAN fonksiyonlar kalemini de yazar; ekran kalemleri sunucudan okur
-- (istemcide yeniden hesap yok → iki sayı ayrışamaz).
--
-- Bağlam: maçı bitiren fonksiyon işlem içinde `app.odul_kaynak` (mac:<id> · duello:<id> · hizli:<id> · turnuva:<id> · grup:<id>)
-- ayarlar; o işlem içindeki coin_ekle / lig puanı / rozet satırları o kaynağa kalem olarak düşer. Bağlam yoksa
-- (dükkân, ikram, görev…) hiçbir şey yazılmaz — mevcut davranış değişmez.

create table if not exists public.odul_kalemleri (
  id bigserial primary key,
  kaynak text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kalem text not null,
  lig integer not null default 0,
  coin integer not null default 0,
  detay jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists odul_kalemleri_kaynak_idx on public.odul_kalemleri (user_id, kaynak);
alter table public.odul_kalemleri enable row level security;
revoke all on table public.odul_kalemleri from anon, authenticated;
revoke all on sequence public.odul_kalemleri_id_seq from anon, authenticated;

create or replace function public.odul_baglam(p_kaynak text)
 returns void language plpgsql security definer set search_path to 'public'
as $$
begin
  perform set_config('app.odul_kaynak', coalesce(p_kaynak, ''), true);
  perform set_config('app.odul_kalem', '', true);
  perform set_config('app.odul_detay', '', true);
end $$;

-- coin_hareketleri türünden döküm kalemi adı (bağlamda app.odul_kalem varsa o kazanır)
create or replace function public.odul_kalem_adi(p_tur text, p_referans text)
 returns text language sql stable security definer set search_path to 'public'
as $$
  select coalesce(nullif(current_setting('app.odul_kalem', true), ''),
                  case when p_tur = 'turnuva' then 'turnuva_' || split_part(coalesce(p_referans, ''), ':', 1) else p_tur end);
$$;

create or replace function public.odul_kalem_yaz(p_user uuid, p_kalem text, p_lig integer, p_coin integer, p_detay jsonb default '{}'::jsonb)
 returns void language plpgsql security definer set search_path to 'public'
as $$
declare
  v_kaynak text := nullif(current_setting('app.odul_kaynak', true), '');
  v_detay jsonb;
begin
  if v_kaynak is null or p_user is null or p_kalem is null then return; end if;
  if exists (select 1 from public.profiles where id = p_user and coalesce(is_bot, false)) then return; end if;
  v_detay := jsonb_strip_nulls(coalesce(nullif(current_setting('app.odul_detay', true), '')::jsonb, '{}'::jsonb)
                               || coalesce(p_detay, '{}'::jsonb));
  -- Sıfır kalem yalnız bir şey anlatıyorsa yazılır (indirim, tavan, rozet)
  if coalesce(p_lig, 0) = 0 and coalesce(p_coin, 0) = 0 and p_kalem <> 'rozet'
     and not (v_detay ? 'indirim' or v_detay ? 'tavan') then
    return;
  end if;
  insert into public.odul_kalemleri (kaynak, user_id, kalem, lig, coin, detay)
  values (v_kaynak, p_user, p_kalem, coalesce(p_lig, 0), coalesce(p_coin, 0), v_detay);
end $$;

-- coin_mac_odulu'nun uyguladığı çarpanın sebebi (indirimler çarpılmaz → en düşüğü)
create or replace function public.odul_indirim_sebebi(p_cift numeric, p_serbest boolean, p_acik_bot boolean)
 returns text language plpgsql stable security definer set search_path to 'public'
as $$
declare v numeric := public.odul_carpani(p_cift, p_serbest, p_acik_bot);
begin
  if v >= 1 then return null; end if;
  if coalesce(p_cift, 1) <= 0 then return 'cift_odulsuz'; end if;
  if coalesce(p_cift, 1) = v then return 'cift_yari'; end if;
  if coalesce(p_serbest, false) and public.ayar_ondalik('serbest_coin_carpani', 0.5) = v then return 'serbest'; end if;
  if coalesce(p_acik_bot, false) and public.ayar_ondalik('coin_bot_carpani', 0.5) = v then return 'acik_bot'; end if;
  return null;
end $$;

create or replace function public.odul_lig_indirimi(p_carpan numeric)
 returns jsonb language sql immutable
as $$
  select case when coalesce(p_carpan, 1) <= 0 then jsonb_build_object('indirim', 'cift_odulsuz')
              when p_carpan < 1 then jsonb_build_object('indirim', 'cift_yari')
              else '{}'::jsonb end;
$$;

-- Rozet açılınca dökümde "Açılan rozet" (yalnız GERÇEKTEN yeni açıldıysa)
create or replace function public.award_badge(p_user uuid, p_badge text)
 returns void language plpgsql security definer set search_path to 'public'
as $$
declare v_n int;
begin
  insert into public.user_badges (user_id, badge_id)
  select p_user, p_badge
  where not exists (select 1 from public.profiles where id = p_user and is_bot)
  on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    perform public.odul_kalem_yaz(p_user, 'rozet', 0, 0, jsonb_build_object('rozet', p_badge));
  end if;
end $$;

revoke all on function public.odul_baglam(text) from public, anon, authenticated;
revoke all on function public.odul_kalem_adi(text, text) from public, anon, authenticated;
revoke all on function public.odul_kalem_yaz(uuid, text, integer, integer, jsonb) from public, anon, authenticated;
revoke all on function public.odul_indirim_sebebi(numeric, boolean, boolean) from public, anon, authenticated;
revoke all on function public.odul_lig_indirimi(numeric) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.coin_ekle(p_user uuid, p_miktar bigint, p_tur text, p_referans text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_bakiye bigint;
  v_bot boolean;
  v_miktar bigint := p_miktar;
  v_kalan bigint;
begin
  if p_user is null or coalesce(p_miktar, 0) <= 0 then return null; end if;

  select coalesce(is_bot, false) into v_bot from public.profiles where id = p_user;
  if coalesce(v_bot, false) then return null; end if;

  -- 'davet' tek seferlik hoş geldin ödülü: günlük tavana takılmaz (Paket 14, 3.4)
  if p_tur not in ('satin_alma', 'baslangic', 'ikram_iade', 'davet') then
    v_kalan := public.coin_gunluk_kalan(p_user);
    v_miktar := least(v_miktar, v_kalan);
    if v_miktar <= 0 then
      -- Paket 20 I.3: günlük coin tavanı doldu → dökümde görünsün
      perform public.odul_kalem_yaz(p_user, public.odul_kalem_adi(p_tur, p_referans), 0, 0,
        jsonb_build_object('tavan', true, 'istenen', p_miktar));
      return (select coin from public.profiles where id = p_user);
    end if;
  end if;

  perform set_config('app.coin_izin', '1', true);
  update public.profiles
     set coin = coin + v_miktar
   where id = p_user
  returning coin into v_bakiye;
  if v_bakiye is null then return null; end if;

  begin
    insert into public.coin_hareketleri (user_id, miktar, tur, referans, bakiye_sonra)
    values (p_user, v_miktar, p_tur, p_referans, v_bakiye);
  exception when unique_violation then
    update public.profiles set coin = coin - v_miktar where id = p_user
    returning coin into v_bakiye;
    return v_bakiye;
  end;

  -- Paket 20 I.3: maç sonu dökümü için kalem (bağlam yoksa yazılmaz)
  perform public.odul_kalem_yaz(p_user, public.odul_kalem_adi(p_tur, p_referans), 0, v_miktar::int,
    case when v_miktar < p_miktar then jsonb_build_object('tavan', true, 'istenen', p_miktar) else '{}'::jsonb end
    || case when p_tur = 'turnuva' and p_referans like 'derece:%'
            then jsonb_build_object('sira', split_part(p_referans, ':', 3)::int) else '{}'::jsonb end);
  return v_bakiye;
end;
$function$;

CREATE OR REPLACE FUNCTION public.coin_mac_odulu(p_referans text, p_kazanan uuid, p_oyuncular uuid[], p_carpan numeric DEFAULT 1, p_serbest boolean DEFAULT false, p_acik_bot boolean DEFAULT false, p_galibiyet_anahtar text DEFAULT 'coin_mac_galibiyet'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_galibiyet bigint := public.ayar_sayi(coalesce(p_galibiyet_anahtar, 'coin_mac_galibiyet'), 25);
  v_beraberlik bigint := public.ayar_sayi('coin_mac_beraberlik', 10);
  v_serbest boolean := coalesce(p_serbest, false);
  v_carpan numeric;
  v_oyuncu uuid;
  v_mac_id uuid;
  v_dereceli boolean;
begin
  if p_referans is null then return; end if;

  -- Referans bir 1v1 maç id'siyse serbest bilgisi maçın kendisinden okunur.
  begin
    v_mac_id := p_referans::uuid;
  exception when others then
    v_mac_id := null;
  end;
  if v_mac_id is not null then
    select coalesce(m.dereceli, true) into v_dereceli from public.matches m where m.id = v_mac_id;
    if found and not v_dereceli then v_serbest := true; end if;
  end if;

  v_carpan := public.odul_carpani(p_carpan, v_serbest, p_acik_bot);
  -- Paket 20 I.3: indirimin sebebi dökümde yazsın
  perform set_config('app.odul_detay', coalesce(jsonb_build_object('indirim', public.odul_indirim_sebebi(p_carpan, v_serbest, p_acik_bot))::text, ''), true);
  if v_carpan <= 0 then
    foreach v_oyuncu in array (case when p_kazanan is null then coalesce(p_oyuncular, '{}'::uuid[]) else array[p_kazanan] end) loop
      perform public.odul_kalem_yaz(v_oyuncu, case when p_kazanan is null then 'beraberlik' else 'galibiyet' end, 0, 0, '{}'::jsonb);
    end loop;
    perform set_config('app.odul_detay', '', true);
    return;
  end if;      -- dostluk maçı: coin yok

  if p_kazanan is not null then
    perform set_config('app.odul_kalem', 'galibiyet', true);
    perform public.coin_ekle(p_kazanan, floor(v_galibiyet * v_carpan)::bigint, 'mac', p_referans);
  else
    perform set_config('app.odul_kalem', 'beraberlik', true);
    foreach v_oyuncu in array coalesce(p_oyuncular, '{}'::uuid[]) loop
      perform public.coin_ekle(v_oyuncu, floor(v_beraberlik * v_carpan)::bigint, 'mac', p_referans);
    end loop;
  end if;
  perform set_config('app.odul_kalem', '', true);
  perform set_config('app.odul_detay', '', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.gunluk_seri_bonusu(p_user uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  p public.profiles%rowtype;
  v_gun int;
  v_bonus int;
begin
  select * into p from public.profiles where id = p_user for update;
  if not found or coalesce(p.is_bot, false) then return 0; end if;
  if p.seri_bonus_tarihi is not distinct from v_bugun then return 0; end if;

  -- Seri günü seri_guncelle'den (maç bitiş tetikleyicisi) gelir; tetikleyici
  -- bir sebeple çalışmadıysa burada ilerletilir.
  if p.seri_son_gun is distinct from v_bugun then
    perform public.seri_guncelle(p_user);
    select * into p from public.profiles where id = p_user;
  end if;
  v_gun := greatest(1, coalesce(p.seri_gun, 1));

  v_bonus := least(v_gun * public.ayar_sayi('seri_carpan', 3),
                   public.ayar_sayi('seri_tavan', 15))::int;
  update public.profiles
     set seri_bonus_tarihi = v_bugun,
         puan = puan + v_bonus, puan_hafta = puan_hafta + v_bonus
   where id = p_user;
  perform public.odul_kalem_yaz(p_user, 'seri', v_bonus, 0, jsonb_build_object('gun', v_gun));   -- Paket 20 I.3
  return v_bonus;
end;
$function$;

CREATE OR REPLACE FUNCTION public.seri_guncelle(p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  p public.profiles%rowtype;
  v_yeni int;
  v_coin bigint;
begin
  select * into p from public.profiles where id = p_user for update;
  if not found or coalesce(p.is_bot, false) then return; end if;
  if p.seri_son_gun = v_bugun then return; end if;   -- bugün zaten sayıldı

  if p.seri_son_gun = v_bugun - 1 then
    v_yeni := coalesce(p.seri_gun, 0) + 1;
  else
    v_yeni := 1;
  end if;

  update public.profiles
     set seri_gun = v_yeni,
         seri_son_gun = v_bugun,
         seri_en_uzun = greatest(coalesce(seri_en_uzun, 0), v_yeni),
         seri = v_yeni,
         son_seri_tarihi = v_bugun
   where id = p_user;

  v_coin := case
    when v_yeni >= 7 then public.ayar_sayi('coin_seri_7', 25)
    when v_yeni >= 5 then public.ayar_sayi('coin_seri_5', 15)
    when v_yeni >= 3 then public.ayar_sayi('coin_seri_3', 10)
    else public.ayar_sayi('coin_seri_1', 5)
  end;
  perform set_config('app.odul_detay', jsonb_build_object('gun', v_yeni)::text, true);   -- Paket 20 I.3
  perform public.coin_ekle(p_user, v_coin, 'seri', v_bugun::text);
  perform set_config('app.odul_detay', '', true);

  if v_yeni in (3, 7, 14, 30, 60, 100) then
    perform public.bildirim_anahtarla(
      p_user, 'seri', 'seri_artti',
      jsonb_build_array(v_yeni),
      '/bildim'
    );
  end if;
  if v_yeni >= 3 then perform public.award_badge(p_user, 'seri_3'); end if;
  if v_yeni >= 7 then perform public.award_badge(p_user, 'seri_7'); end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.mac_sonuclandir(p_match_id uuid, p_kazanan uuid, p_kaybeden uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m public.matches%rowtype;
  v_oyuncu uuid;
  v_carpan numeric := 1;
  v_lig int;
  v_bot_var boolean;
  v_acik_bot boolean;
  v_bot_yuzde numeric := public.ayar_sayi('lig_bot_puan_yuzde', 40)::numeric / 100;
  v_oyuncu_bot boolean;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then return; end if;
  perform public.odul_baglam('mac:' || p_match_id::text);   -- Paket 20 I.3

  select bool_or(coalesce(p.is_bot, false)),
         bool_or(coalesce(p.is_bot, false) and coalesce(p.bot_turu, 'acik') = 'acik')
    into v_bot_var, v_acik_bot
    from public.profiles p where p.id in (m.oyuncu1, m.oyuncu2);

  if coalesce(v_bot_var, false) then
    v_carpan := 1;                       -- bot maçında çift limiti yok
  else
    v_carpan := public.cift_odul_carpani(m.oyuncu1, m.oyuncu2, p_match_id);
  end if;

  update public.matches
     set durum = 'bitti', kazanan = p_kazanan, bitis = now(),
         odul_carpan = v_carpan,
         dostluk = (v_carpan = 0)
   where id = p_match_id;

  -- Coin: dereceli tam, serbest %50; indirimler çarpılmaz (coin_mac_odulu).
  perform public.coin_mac_odulu(p_match_id::text, p_kazanan, array[m.oyuncu1, m.oyuncu2],
                                v_carpan, not coalesce(m.dereceli, true), coalesce(v_acik_bot, false));

  if p_kazanan is not null then
    perform public.award_badge(p_kazanan, 'ilk_galibiyet');
  end if;

  -- SERBEST MAÇ: lig puanı yok, seri yok. Yalnız coin (%50) + rozet.
  if not coalesce(m.dereceli, true) then
    perform public.odul_baglam(null);
    return;
  end if;

  -- LİG PUANI: galibiyet / beraberlik; çift çarpanı lig puanına da uygulanır.
  if p_kazanan is not null then
    select coalesce(is_bot, false) into v_oyuncu_bot from public.profiles where id = p_kazanan;
    v_lig := floor(public.ayar_sayi('lig_mac_galibiyet', 25) * v_carpan *
                   (case when v_oyuncu_bot then v_bot_yuzde else 1 end))::int;
    if v_lig > 0 then
      update public.profiles
         set puan = puan + v_lig, puan_hafta = puan_hafta + v_lig
       where id = p_kazanan;
    end if;
    perform public.odul_kalem_yaz(p_kazanan, 'galibiyet', greatest(v_lig, 0), 0, public.odul_lig_indirimi(v_carpan));

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
  else
    foreach v_oyuncu in array array[m.oyuncu1, m.oyuncu2] loop
      select coalesce(is_bot, false) into v_oyuncu_bot from public.profiles where id = v_oyuncu;
      v_lig := floor(public.ayar_sayi('lig_mac_beraberlik', 10) * v_carpan *
                     (case when v_oyuncu_bot then v_bot_yuzde else 1 end))::int;
      if v_lig > 0 then
        update public.profiles
           set puan = puan + v_lig, puan_hafta = puan_hafta + v_lig
         where id = v_oyuncu;
      end if;
      perform public.odul_kalem_yaz(v_oyuncu, 'beraberlik', greatest(v_lig, 0), 0, public.odul_lig_indirimi(v_carpan));
    end loop;
  end if;

  foreach v_oyuncu in array array[m.oyuncu1, m.oyuncu2] loop
    perform public.gunluk_seri_bonusu(v_oyuncu);
  end loop;
  perform public.odul_baglam(null);
end;
$function$;

CREATE OR REPLACE FUNCTION public.duello_bitir(p_id uuid, p_kazanan uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d public.duellolar%rowtype;
  v_bot_var boolean;
  v_acik_bot boolean;
  v_carpan numeric := 1;
  v_lig int;
  v_kazanan_bot boolean;
  v_oyuncu uuid;
begin
  select * into d from public.duellolar where id = p_id for update;
  if not found or d.durum <> 'aktif' then return; end if;
  perform public.odul_baglam('duello:' || p_id::text);   -- Paket 20 I.3

  select bool_or(coalesce(p.is_bot, false)),
         bool_or(coalesce(p.is_bot, false) and coalesce(p.bot_turu, 'acik') = 'acik')
    into v_bot_var, v_acik_bot
    from public.profiles p where p.id in (d.oyuncu1, d.oyuncu2);

  if not coalesce(v_bot_var, false) then
    v_carpan := public.cift_odul_carpani(d.oyuncu1, d.oyuncu2, null);
  end if;

  update public.duellolar
     set durum = 'bitti', kazanan = p_kazanan, bitis = now(), odul_carpan = v_carpan,
         faz = case when faz = 'altin' then 'sonuc' else faz end, son_hareket = now()
   where id = p_id;

  -- Coin: dereceli tam, serbest yarı; indirimler çarpılmaz (coin_mac_odulu).
  perform public.coin_mac_odulu('duello:' || p_id::text, p_kazanan, array[d.oyuncu1, d.oyuncu2],
                                v_carpan, not d.dereceli, coalesce(v_acik_bot, false),
                                'coin_duello_galibiyet');

  foreach v_oyuncu in array array[d.oyuncu1, d.oyuncu2] loop
    perform public.mac_sayaci_arttir(v_oyuncu, true);
    perform public.istatistikli_mac_arttir(v_oyuncu);
  end loop;

  if p_kazanan is not null then
    perform public.award_badge(p_kazanan, 'ilk_galibiyet');
  end if;

  if d.dereceli then
    if p_kazanan is not null then
      select coalesce(is_bot, false) into v_kazanan_bot from public.profiles where id = p_kazanan;
      v_lig := floor(public.ayar_sayi('lig_duello_galibiyet', 50) * v_carpan *
                     (case when v_kazanan_bot then public.ayar_sayi('lig_bot_puan_yuzde', 40)::numeric / 100 else 1 end))::int;
      if v_lig > 0 then
        update public.profiles set puan = puan + v_lig, puan_hafta = puan_hafta + v_lig where id = p_kazanan;
      end if;
      perform public.odul_kalem_yaz(p_kazanan, 'galibiyet', greatest(v_lig, 0), 0, public.odul_lig_indirimi(v_carpan));
    end if;
    foreach v_oyuncu in array array[d.oyuncu1, d.oyuncu2] loop
      perform public.gunluk_seri_bonusu(v_oyuncu);
    end loop;
  end if;

  perform public.odul_baglam(null);
  perform public.duello_sinyal_ver(p_id);
end $function$;

CREATE OR REPLACE FUNCTION public.hizli_mod_bitir(p_oturum_id uuid)
 RETURNS TABLE(skor integer, dogru integer, yanlis integer, en_iyi_hafta integer, lig_puan integer, kazanilan_coin integer, dereceli boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  o public.hizli_mod_oturumlar%rowtype;
  v_hafta date := public.hafta_basi();
  v_en_iyi int;
  v_ham int := 0;
  v_lig int := 0;
  v_coin int := 0;
  v_bakiye_once bigint;
begin
  select * into o from public.hizli_mod_oturumlar where id = p_oturum_id for update;
  if not found then raise exception 'Oturum bulunamadı'; end if;
  if o.user_id <> auth.uid() and auth.uid() is not null then
    raise exception 'Bu oturum senin değil';
  end if;

  if o.durum = 'aktif' then
    update public.hizli_mod_oturumlar
       set durum = 'bitti', bitis = now()
     where id = p_oturum_id
    returning * into o;
    perform public.odul_baglam('hizli:' || o.id::text);   -- Paket 20 I.3

    insert into public.hizli_mod_skorlar (user_id, oturum_id, kategori, skor, hafta)
    values (o.user_id, o.id, o.kategori, o.dogru, v_hafta);

    -- ÖDÜL (Paket 14, 3.2): skor bazlı, tavanlı. Dereceli → lig puanı + tam
    -- coin; serbest → puan yok, coin serbest_coin_carpani ile.
    if not exists (select 1 from public.profiles pr where pr.id = o.user_id and coalesce(pr.is_bot, false)) then
      v_lig := least(o.dogru * public.ayar_sayi('hizli_mod_puan_dogru', 3),
                     public.ayar_sayi('hizli_mod_lig_tavan', 25))::int;
      v_ham := least(o.dogru * public.ayar_sayi('hizli_mod_coin_dogru', 3),
                     public.ayar_sayi('hizli_mod_coin_tavan', 25))::int;
      if not o.dereceli then
        v_lig := 0;
        v_ham := floor(v_ham * public.odul_carpani(1, true, false))::int;
      end if;
      if v_lig > 0 then
        update public.profiles pr
           set puan = pr.puan + v_lig, puan_hafta = pr.puan_hafta + v_lig
         where pr.id = o.user_id;
      end if;
      perform public.odul_kalem_yaz(o.user_id, 'hizli_dogru', v_lig, 0, jsonb_build_object('dogru', o.dogru));
      if v_ham > 0 then
        perform set_config('app.odul_kalem', 'hizli_dogru', true);
        perform set_config('app.odul_detay', (jsonb_build_object('dogru', o.dogru)
          || case when not o.dereceli then jsonb_build_object('indirim', 'serbest') else '{}'::jsonb end)::text, true);
        select pr.coin into v_bakiye_once from public.profiles pr where pr.id = o.user_id;
        perform public.coin_ekle(o.user_id, v_ham, 'hizli_mod', o.id::text);
        select greatest(0, pr.coin - v_bakiye_once)::int into v_coin from public.profiles pr where pr.id = o.user_id;
        perform set_config('app.odul_kalem', '', true);
        perform set_config('app.odul_detay', '', true);
      end if;
      update public.hizli_mod_oturumlar h2
         set lig_puan = v_lig, kazanilan_coin = v_coin
       where h2.id = o.id;
    end if;
    perform public.odul_baglam(null);
  end if;

  select max(s.skor) into v_en_iyi
  from public.hizli_mod_skorlar s
  where s.user_id = o.user_id and s.hafta = v_hafta;

  select h2.lig_puan, h2.kazanilan_coin into v_lig, v_coin
    from public.hizli_mod_oturumlar h2 where h2.id = o.id;
  return query select o.dogru, o.dogru, o.yanlis, coalesce(v_en_iyi, o.dogru),
                      coalesce(v_lig, 0), coalesce(v_coin, 0), o.dereceli;
end;
$function$;

CREATE OR REPLACE FUNCTION public.turnuva_odullerini_dagit(p_tournament_id uuid, p_kazanan uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  v_sira int := 0;
  v_odul bigint;
  v_lig int;
  v_bot_yuzde numeric := public.ayar_sayi('lig_bot_puan_yuzde', 40)::numeric / 100;
  v_giysi text := public.turnuva_haftalik_giysi();   -- 213: bu haftanın ilk-3 giysisi (turnuva_giysi_odulu)
  v_tekrar_coin bigint := public.ayar_sayi('turnuva_giysi_tekrar_coin', 0);
begin
  perform public.odul_baglam('turnuva:' || p_tournament_id::text);   -- Paket 20 I.3
  if p_kazanan is not null then
    perform public.esya_odul_ver(p_kazanan, 'spk_04', 'etkinlik');
    update public.profiles set turnuva_taci_at = now() where id = p_kazanan;
  end if;

  -- İlk üç: Yıldızlar efekti + dereceye göre coin
  for r in
    select tp.user_id
      from public.tournament_players tp
     where tp.tournament_id = p_tournament_id
     order by tp.elendi asc, tp.elenme_sorusu desc nulls first, tp.dogru_sayisi desc
     limit 3
  loop
    v_sira := v_sira + 1;
    perform public.esya_odul_ver(r.user_id, 'efk_02', 'etkinlik');
    -- 213: haftalık turnuva giysisi — üçü de aynı giysiyi alır; zaten sahipse eşya verilmez, yalnız coin
    if v_giysi is not null then
      if exists (select 1 from public.avatar3d_sahip s where s.oyuncu_id = r.user_id and s.parca_id = v_giysi) then
        if v_tekrar_coin > 0 then
          perform public.coin_ekle(r.user_id, v_tekrar_coin, 'turnuva', 'giysi_tekrar:' || p_tournament_id::text);
        end if;
      else
        perform public.avatar3d_odul_ver(r.user_id, v_giysi, 'turnuva');
      end if;
    end if;
    v_odul := case v_sira
      when 1 then public.ayar_sayi('coin_turnuva_1', 150)
      when 2 then public.ayar_sayi('coin_turnuva_2', 75)
      else public.ayar_sayi('coin_turnuva_3', 40) end;
    perform public.coin_ekle(r.user_id, v_odul, 'turnuva',
                             'derece:' || p_tournament_id::text || ':' || v_sira::text);
  end loop;

  -- LİG PUANI (Paket 14, 3.2): dereceye göre tek miktar —
  -- 1. / 2. / 3. / 4-10. / diğer katılanlar. Botlar gerçek maçtaki gibi
  -- lig_bot_puan_yuzde ile kırpılır.
  v_sira := 0;
  for r in
    select tp.user_id, coalesce(p.is_bot, false) as bot
      from public.tournament_players tp
      join public.profiles p on p.id = tp.user_id
     where tp.tournament_id = p_tournament_id
     order by tp.elendi asc, tp.elenme_sorusu desc nulls first, tp.dogru_sayisi desc
  loop
    v_sira := v_sira + 1;
    v_lig := case
      when v_sira = 1 then public.ayar_sayi('lig_turnuva_1', 150)
      when v_sira = 2 then public.ayar_sayi('lig_turnuva_2', 80)
      when v_sira = 3 then public.ayar_sayi('lig_turnuva_3', 40)
      when v_sira <= 10 then public.ayar_sayi('lig_turnuva_ilk10', 20)
      else public.ayar_sayi('lig_turnuva_katilim', 10) end;
    if r.bot then v_lig := floor(v_lig * v_bot_yuzde)::int; end if;
    if v_lig > 0 then
      update public.profiles
         set puan = puan + v_lig, puan_hafta = puan_hafta + v_lig
       where id = r.user_id;
    end if;
    perform public.odul_kalem_yaz(r.user_id, 'turnuva_derece', greatest(v_lig, 0), 0, jsonb_build_object('sira', v_sira));
  end loop;

  -- Katılım ödülü: turnuvaya girmiş herkese (botlara coin_ekle zaten vermez).
  for r in
    select tp.user_id from public.tournament_players tp
     where tp.tournament_id = p_tournament_id
  loop
    perform public.coin_ekle(r.user_id, public.ayar_sayi('coin_turnuva_katilim', 10),
                             'turnuva', 'katilim:' || p_tournament_id::text);
  end loop;
  perform public.odul_baglam(null);
end;
$function$;

CREATE OR REPLACE FUNCTION public.trg_turnuva_bitti()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record;
begin
  if new.durum = 'bitti' and coalesce(old.durum, '') <> 'bitti' then
    perform public.odul_baglam('turnuva:' || new.id::text);   -- Paket 20 I.3 (seri coin'i bu turnuvanın dökümüne)
    for r in
      select tp.user_id from public.tournament_players tp
      where tp.tournament_id = new.id
    loop
      perform public.mac_sayaci_arttir(r.user_id);
    end loop;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.trg_grup_bitti()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record;
begin
  if new.durum = 'bitti' and coalesce(old.durum, '') <> 'bitti' then
    perform public.odul_baglam('grup:' || new.id::text);   -- Paket 20 I.3 (rozetler dökümde)
    for r in
      select gmp.user_id from public.group_match_players gmp
      where gmp.group_match_id = new.id and gmp.davet_durumu = 'kabul'
    loop
      -- Grup maçı ödülsüz arkadaş modu: maç sayılır, seri/coin yok.
      perform public.mac_sayaci_arttir(r.user_id, false);
    end loop;
  end if;
  return new;
end;
$function$;

-- Dökümü okuyan tek kapı: yalnız oturumdaki oyuncunun kendi kalemleri
create or replace function public.odul_dokumu(p_kaynak text)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v jsonb;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  if p_kaynak is null or p_kaynak !~ '^(mac|duello|hizli|turnuva|grup):[0-9a-f-]{36}$' then raise exception 'Geçersiz kaynak'; end if;

  select jsonb_build_object(
    'hazir', exists (select 1 from public.odul_kalemleri o where o.user_id = v_me and o.kaynak = p_kaynak),
    'kalemler', coalesce((
      select jsonb_agg(jsonb_build_object('kalem', k.kalem, 'lig', k.lig, 'coin', k.coin, 'detay', k.detay) order by k.ilk)
        from (select o.kalem, sum(o.lig)::int lig, sum(o.coin)::int coin, min(o.id) ilk,
                     (select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
                        from public.odul_kalemleri x, jsonb_each(x.detay) e
                       where x.user_id = v_me and x.kaynak = p_kaynak and x.kalem = o.kalem) detay
                from public.odul_kalemleri o
               where o.user_id = v_me and o.kaynak = p_kaynak and o.kalem <> 'rozet'
               group by o.kalem) k), '[]'::jsonb),
    'rozetler', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'ad', b.ad, 'ikon', b.ikon) order by o.id)
        from public.odul_kalemleri o join public.badges b on b.id = o.detay ->> 'rozet'
       where o.user_id = v_me and o.kaynak = p_kaynak and o.kalem = 'rozet'), '[]'::jsonb),
    'toplam', (select jsonb_build_object('lig', coalesce(sum(o.lig), 0), 'coin', coalesce(sum(o.coin), 0))
                 from public.odul_kalemleri o where o.user_id = v_me and o.kaynak = p_kaynak),
    'gorevler', coalesce((select jsonb_agg(jsonb_build_object('id', g.quest_id, 'ad', g.ad, 'ilerleme', g.ilerleme,
                                                              'hedef', g.hedef, 'alindi', g.alindi))
                            from public.get_daily_quests() g), '[]'::jsonb)
  ) into v;
  return v;
end $$;
revoke all on function public.odul_dokumu(text) from public, anon;
grant execute on function public.odul_dokumu(text) to authenticated;

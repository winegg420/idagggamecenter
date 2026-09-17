-- ============================================================
-- 213 — ÖDÜLLER: lig çerçeveleri + haftalık turnuva giysisi (Aşama 2D-E)
--
-- LİG ÇERÇEVESİ
--   * Lig ATLAYINCA o ligin çerçevesi kazanılır (Gümüş, Altın, Elmas, Efsane);
--     KALICI — düşünce geri alınmaz. Satılmaz.
--   * AYRI TABLO (lig_cerceveleri), eşya tablolarına değil. Neden:
--       - kazanma kaynağı lig kapanışı; dükkân/gardırop satın alma yolu yok
--       - avatar3d_parcalar/esyalar satın alma RPC'leri kozmetik_bedava_test ile
--         ödül eşyasını da açıyordu → çerçeve oraya konsa "satılmaz" delinirdi
--       - çerçeve bir giysi yuvası değil; avatar3d_dogrula ve gardırop listesi
--         (istemcide sabit PARCALAR) değişmeden kalır
--   * Seçili çerçeve profiles.gorunum.lig_cerceve'de durur: meydan presence'ı
--     görünümü zaten taşıdığı için 3B karakterin etiketine kendiliğinden gider.
--     gorunum_dogrula / avatar3d_dogrula bilinmeyen anahtarı attığı için oyuncu
--     bu alanı elle yazamaz; yalnız lig_cerceve_sec RPC'si yazar.
--   * Oyuncu seçmediyse (lig_cerceve_elle yok) en yüksek çerçeve otomatik takılır.
--   * Geriye dönük: şu anki lig + lig_uyelik geçmişindeki en yüksek lig kadar
--     çerçeve verilir (gizli botlar dahil — gerçek oyuncudan ayırt edilmesinler).
--
-- TURNUVA GİYSİSİ
--   * Her turnuvanın ilk 3'ü AYNI giysiyi alır; giysi HAFTALIK değişir:
--     turnuva_giysi_odulu(hafta → parca_id). O haftaya satır yoksa en son satır.
--     Değiştirmek: insert into public.turnuva_giysi_odulu (hafta, parca_id) values ('2026-09-21', 'bas_tac');
--   * Zaten sahipse eşya tekrar verilmez; oyun_ayarlari.turnuva_giysi_tekrar_coin
--     (varsayılan 0 = yalnız mevcut derece coin'i) kadar ek coin.
--   * Tabloya giren parça otomatik satılmaz yapılır (coin_fiyat null, etkinlik).
--   * avatar3d_satin_al: etkinlik/ödül eşyası bedava test anahtarıyla da ALINAMAZ.
-- ============================================================

begin;

-- ---------------------------------------------------------------- tablolar
create table if not exists public.lig_cerceveleri (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  lig        text not null check (lig in ('gumus','altin','elmas','efsane')),
  kazanildi  timestamptz not null default now(),
  kaynak     text not null default 'lig_yukselme',
  primary key (user_id, lig)
);
alter table public.lig_cerceveleri enable row level security;
revoke all on public.lig_cerceveleri from anon, authenticated;

create table if not exists public.turnuva_giysi_odulu (
  hafta     date primary key,                                   -- hafta_basi() (Pazartesi, TSİ)
  parca_id  text not null references public.avatar3d_parcalar(id),
  aciklama  text
);
alter table public.turnuva_giysi_odulu enable row level security;
revoke all on public.turnuva_giysi_odulu from anon, authenticated;

insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('turnuva_giysi_tekrar_coin', '0', 'Haftalık turnuva giysisine zaten sahip olan ilk-3 oyuncuya eşya yerine verilen EK coin (0 = yalnız derece coin''i)')
on conflict (anahtar) do nothing;

-- Tabloya giren giysi satılmaz olur
create or replace function public.turnuva_giysi_satilmaz()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  update public.avatar3d_parcalar set coin_fiyat = null, nadirlik = 'etkinlik' where id = new.parca_id;
  return new;
end;
$$;
drop trigger if exists trg_turnuva_giysi_satilmaz on public.turnuva_giysi_odulu;
create trigger trg_turnuva_giysi_satilmaz after insert or update on public.turnuva_giysi_odulu
  for each row execute function public.turnuva_giysi_satilmaz();

-- Başlangıç: bu hafta Pelerin (mevcut 3B satılmaz giysi)
insert into public.turnuva_giysi_odulu (hafta, parca_id, aciklama)
values (public.hafta_basi(), 'sirt_pelerin', 'İlk haftalık turnuva giysisi')
on conflict (hafta) do nothing;

create or replace function public.turnuva_haftalik_giysi()
returns text language sql stable security definer set search_path to 'public' as $$
  select t.parca_id from public.turnuva_giysi_odulu t
    join public.avatar3d_parcalar p on p.id = t.parca_id and p.aktif
   where t.hafta <= public.hafta_basi()
   order by t.hafta desc limit 1;
$$;

-- ---------------------------------------------------------------- çerçeve verme (yalnız sunucu içi)
create or replace function public.lig_cerceve_ver(p_user uuid, p_lig text, p_kaynak text default 'lig_yukselme')
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare
  v_en text;
begin
  if p_user is null or p_lig is null or p_lig not in ('gumus','altin','elmas','efsane') then return false; end if;
  insert into public.lig_cerceveleri (user_id, lig, kaynak) values (p_user, p_lig, p_kaynak)
  on conflict do nothing;
  -- Oyuncu elle seçmediyse en yüksek çerçeve takılır
  select c.lig into v_en from public.lig_cerceveleri c
   where c.user_id = p_user order by public.lig_sirasi(c.lig) desc limit 1;
  update public.profiles
     set gorunum = coalesce(gorunum, '{}'::jsonb) || jsonb_build_object('lig_cerceve', v_en)
   where id = p_user and coalesce((gorunum ->> 'lig_cerceve_elle')::boolean, false) = false;
  return true;
end;
$$;

-- ---------------------------------------------------------------- oyuncu RPC'leri
-- Kendi çerçevelerim + hangisi seçili
create or replace function public.lig_cercevelerim()
returns table(lig text, kazanildi timestamptz, secili boolean)
language sql stable security definer set search_path to 'public' as $$
  select c.lig, c.kazanildi, coalesce((p.gorunum ->> 'lig_cerceve') = c.lig, false)
    from public.lig_cerceveleri c
    join public.profiles p on p.id = c.user_id
   where c.user_id = auth.uid()
   order by public.lig_sirasi(c.lig);
$$;

-- Çerçeve seç (null = çerçevesiz)
create or replace function public.lig_cerceve_sec(p_lig text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  perform public.hiz_siniri('lig_cerceve_sec', 20, interval '60 seconds');
  if p_lig is not null and not exists (select 1 from public.lig_cerceveleri c where c.user_id = v_me and c.lig = p_lig) then
    raise exception 'Bu çerçeveyi henüz kazanmadın';
  end if;
  update public.profiles
     set gorunum = coalesce(gorunum, '{}'::jsonb) || jsonb_build_object('lig_cerceve', p_lig, 'lig_cerceve_elle', true)
   where id = v_me;
  return p_lig;
end;
$$;

-- Başka oyuncuların seçili çerçevesi (görünüm kaydı istemciye kapalı; yalnız sonuç döner)
create or replace function public.oyuncu_lig_cerceveleri(p_idler uuid[])
returns table(id uuid, cerceve text)
language sql stable security definer set search_path to 'public' as $$
  select p.id, nullif(p.gorunum ->> 'lig_cerceve', '')
    from public.profiles p
   where p.id = any(p_idler[1:200]);
$$;

revoke all on function public.lig_cerceve_ver(uuid, text, text) from public, anon, authenticated;
revoke all on function public.turnuva_haftalik_giysi() from public, anon, authenticated;
revoke all on function public.turnuva_giysi_satilmaz() from public, anon, authenticated;
revoke all on function public.lig_cercevelerim() from public, anon;
revoke all on function public.lig_cerceve_sec(text) from public, anon;
revoke all on function public.oyuncu_lig_cerceveleri(uuid[]) from public, anon;
grant execute on function public.lig_cercevelerim() to authenticated;
grant execute on function public.lig_cerceve_sec(text) to authenticated;
grant execute on function public.oyuncu_lig_cerceveleri(uuid[]) to authenticated;

-- ---------------------------------------------------------------- geriye dönük çerçeveler
do $$
declare r record; i int;
begin
  for r in
    select p.id,
           greatest(public.lig_sirasi(coalesce(p.lig, 'bronz')),
                    coalesce((select max(public.lig_sirasi(u.lig)) from public.lig_uyelik u where u.user_id = p.id), 1)) as en
      from public.profiles p
  loop
    for i in 2 .. r.en loop
      perform public.lig_cerceve_ver(r.id, public.lig_adi(i), 'gecmis');
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------- mevcut fonksiyonlar (canlı tanımdan; yalnız "213:" işaretli ekler)

CREATE OR REPLACE FUNCTION public.lig_haftayi_kapat()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_hafta date := public.hafta_basi();
  v_yuk int := public.ayar_sayi('lig_yukselen', 5)::int;
  v_dus int := public.ayar_sayi('lig_dusen', 5)::int;
  v_pasif_esik int := public.ayar_sayi('lig_pasif_dusme_hafta', 2)::int;
  v_islenen int := 0;
  r record;
begin
  -- Aynı hafta iki kez kapanmasın (cron birden çok kez deneniyor).
  if (select deger #>> '{}' from public.oyun_ayarlari where anahtar = 'lig_son_kapanis')
     = v_hafta::text then
    return 0;
  end if;

  -- Haftalık maç sayısı: pasiflik buna bakar.
  update public.lig_uyelik u
     set mac_sayisi = (
       select count(*) from public.matches m
        where m.durum = 'bitti' and u.user_id in (m.oyuncu1, m.oyuncu2)
          and coalesce(m.bitis, m.created_at) >= v_hafta)
   where u.hafta = v_hafta;

  for r in
    select u.user_id, u.lig, u.grup_no, u.mac_sayisi, u.pasif_hafta,
           coalesce(p.is_bot, false) as bot,
           row_number() over (partition by u.lig, u.grup_no
                              order by p.puan_hafta desc, p.puan desc, p.gorunen_ad asc) as sira,
           count(*) over (partition by u.lig, u.grup_no) as grup_boyu,
           p.puan_hafta
      from public.lig_uyelik u
      join public.profiles p on p.id = u.user_id
     where u.hafta = v_hafta
       -- Açık bot tabloda görünmediği için sıraya da girmez.
       and not public.acik_bot_mu(p.is_bot, p.bot_turu)
  loop
    v_islenen := v_islenen + 1;

    -- Grup içi ödül (ilk üç) — botlara coin_ekle zaten vermiyor.
    if r.sira <= 3 then
      perform public.coin_ekle(
        r.user_id,
        public.ayar_sayi('lig_odul_' || r.lig || '_' || r.sira::text, 0),
        'lig', v_hafta::text || ':' || r.lig || ':' || r.grup_no::text);
    end if;

    if r.bot then
      continue;                      -- BOTLAR LİG DEĞİŞTİRMEZ
    end if;

    -- Pasiflik takibi
    if coalesce(r.mac_sayisi, 0) = 0 then
      update public.lig_uyelik set pasif_hafta = coalesce(pasif_hafta, 0) + 1
       where user_id = r.user_id and hafta = v_hafta;
    else
      update public.lig_uyelik set pasif_hafta = 0
       where user_id = r.user_id and hafta = v_hafta;
    end if;

    if coalesce(r.mac_sayisi, 0) = 0 then
      -- 1 hafta pasif: düşmez, yerinde kalır. Üst üste 2. haftada bir lig düşer.
      if coalesce(r.pasif_hafta, 0) + 1 >= v_pasif_esik then
        update public.profiles
           set lig = public.lig_adi(greatest(1, public.lig_sirasi(r.lig) - 1))
         where id = r.user_id;
      end if;
      continue;
    end if;

    if r.sira <= v_yuk then
      if r.lig = 'efsane' then
        perform public.award_badge(r.user_id, 'efsane_zirve');   -- üstü yok
      else
        update public.profiles
           set lig = public.lig_adi(least(5, public.lig_sirasi(r.lig) + 1))
         where id = r.user_id;
        -- 213: lig atlayınca o ligin KALICI çerçevesi (düşse de kalır)
        perform public.lig_cerceve_ver(r.user_id, public.lig_adi(least(5, public.lig_sirasi(r.lig) + 1)), 'lig_yukselme');
      end if;
    elsif r.sira > r.grup_boyu - v_dus then
      update public.profiles
         set lig = public.lig_adi(greatest(1, public.lig_sirasi(r.lig) - 1))
       where id = r.user_id;
    end if;
  end loop;

  -- Kapanış damgası (tekrar çalıştırmaya karşı)
  insert into public.oyun_ayarlari (anahtar, deger)
  values ('lig_son_kapanis', to_jsonb(v_hafta::text))
  on conflict (anahtar) do update set deger = excluded.deger;

  -- Yeni haftanın grupları: gruplar HER HAFTA yeniden karılır.
  perform public.lig_gruplarini_kur(v_hafta + 7);

  return v_islenen;
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
  end loop;

  -- Katılım ödülü: turnuvaya girmiş herkese (botlara coin_ekle zaten vermez).
  for r in
    select tp.user_id from public.tournament_players tp
     where tp.tournament_id = p_tournament_id
  loop
    perform public.coin_ekle(r.user_id, public.ayar_sayi('coin_turnuva_katilim', 10),
                             'turnuva', 'katilim:' || p_tournament_id::text);
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.avatar3d_satin_al(p_id text)
 RETURNS TABLE(bakiye bigint, alinan_id text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me     uuid := auth.uid();
  v_parca  public.avatar3d_parcalar%rowtype;
  v_bakiye bigint;
  v_bedava boolean;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  perform public.hiz_siniri('avatar3d_satin_al', 30, interval '60 seconds');

  select coalesce((deger)::boolean, false) into v_bedava
    from public.oyun_ayarlari where anahtar = 'kozmetik_bedava_test';
  v_bedava := coalesce(v_bedava, false);

  select * into v_parca from public.avatar3d_parcalar where id = p_id and aktif;
  if not found then raise exception 'Parça bulunamadı'; end if;

  -- 213: ödül/etkinlik eşyası HİÇBİR ZAMAN satılmaz (Taç, Pelerin, turnuva giysisi) —
  -- kozmetik_bedava_test açıkken de. Eskiden test anahtarı bunları da bedava açıyordu.
  if v_parca.coin_fiyat is null or v_parca.nadirlik = 'etkinlik' then
    raise exception 'Bu parça satın alınamaz, yalnız ödül olarak kazanılır';
  end if;

  if exists (select 1 from public.avatar3d_sahip s where s.oyuncu_id = v_me and s.parca_id = p_id) then
    raise exception 'Bu parça zaten sende';
  end if;

  if v_bedava or coalesce(v_parca.coin_fiyat, 0) = 0 then
    -- Coin'e dokunulmaz: bakiye olduğu gibi döner.
    select coin into v_bakiye from public.profiles where id = v_me;
  else
    v_bakiye := public.coin_harca(v_parca.coin_fiyat, 'avatar3d', p_id);
  end if;

  insert into public.avatar3d_sahip (oyuncu_id, parca_id, kaynak)
  values (v_me, p_id,
          case when v_bedava then 'bedava_test'
               when v_parca.coin_fiyat = 0 then 'baslangic'
               else 'satin' end)
  on conflict do nothing;

  return query select v_bakiye, p_id;
end;
$function$;

commit;

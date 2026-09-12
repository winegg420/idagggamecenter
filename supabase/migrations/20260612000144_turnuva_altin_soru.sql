-- ============================================================
-- Turnuvada ALTIN SORU — normal maçta berabere
--
-- Hız bonusu kalkınca (migration 143) beraberlik sıklaşacak.
--   • Normal / sıralı maç: berabere kalabilir. advance_match zaten eşit
--     skorda kazanan yazmıyor, mac_sonuclandir da ikisine beraberlik coini
--     veriyor — bu davranış korunuyor, altın soru SORULMUYOR.
--   • Turnuva: eleme olduğu için mutlaka bir kazanan çıkmalı. Sorular
--     bitip hayatta birden fazla oyuncu eşit doğru sayısıyla kaldıysa,
--     maçta kullanılmamış yeni bir "altın soru" eklenir ve biri kazanana
--     kadar devam edilir.
--
-- Altın soruda joker kullanılamaz (50:50'si olan hep kazanmasın).
-- ============================================================

alter table public.tournaments
  add column if not exists altin_soru boolean not null default false;

-- ---- Altın soru üret: turnuvada HİÇ kullanılmamış bir soru ----
create or replace function public.turnuva_altin_soru_ekle(p_tournament_id uuid)
returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare
  v_haric uuid[];
  v_yeni uuid;
begin
  select coalesce(t.soru_ids, '{}'::uuid[]) into v_haric
    from public.tournaments t where t.id = p_tournament_id;

  -- Havuz tükenirse kısıt gevşetilir; maç asla askıda kalmaz.
  select q.id into v_yeni
    from public.questions q
   where q.aktif and q.dil = 'tr' and q.id <> all(v_haric)
   order by random() limit 1;

  if v_yeni is null then
    select q.id into v_yeni
      from public.questions q
     where q.aktif and q.id <> all(v_haric)
     order by random() limit 1;
  end if;

  if v_yeni is null then return null; end if;

  update public.tournaments
     set soru_ids = coalesce(soru_ids, '{}'::uuid[]) || v_yeni,
         altin_soru = true
   where id = p_tournament_id;

  return v_yeni;
end;
$$;

revoke all on function public.turnuva_altin_soru_ekle(uuid) from public, authenticated, anon;

-- ---- İlerletme: sorular bittiğinde beraberlik varsa altın soru ----
create or replace function public.advance_tournament(p_tournament_id uuid)
 returns void
 language plpgsql security definer set search_path to 'public'
as $function$
declare
  t public.tournaments%rowtype;
  v_kalan int;
  v_elenecek int;
  v_kazanan uuid;
  v_en_iyi int;
  v_zirve int;
  v_altin uuid;
begin
  select * into t from public.tournaments where id = p_tournament_id for update;
  if not found or t.durum <> 'aktif' then return; end if;

  if now() < t.soru_baslangic + interval '16 seconds' then
    if exists (
      select 1 from public.tournament_players tp
      where tp.tournament_id = p_tournament_id and not tp.elendi
        and not exists (
          select 1 from public.tournament_answers ta
          where ta.tournament_id = p_tournament_id
            and ta.user_id = tp.user_id
            and ta.soru_index = t.aktif_soru
        )
    ) then
      return;
    end if;
  end if;

  select count(*) into v_elenecek
  from public.tournament_players tp
  where tp.tournament_id = p_tournament_id and not tp.elendi
    and not exists (
      select 1 from public.tournament_answers ta
      where ta.tournament_id = p_tournament_id
        and ta.user_id = tp.user_id
        and ta.soru_index = t.aktif_soru
        and ta.dogru
    );

  select count(*) into v_kalan
  from public.tournament_players
  where tournament_id = p_tournament_id and not elendi;

  -- Hayattakilerin HEPSİ yanlış yaptıysa kimse elenmez (berabere tur).
  if v_elenecek < v_kalan then
    update public.tournament_players tp
       set elendi = true, elenme_sorusu = t.aktif_soru
     where tp.tournament_id = p_tournament_id and not tp.elendi
       and not exists (
         select 1 from public.tournament_answers ta
         where ta.tournament_id = p_tournament_id
           and ta.user_id = tp.user_id
           and ta.soru_index = t.aktif_soru
           and ta.dogru
       );
    v_kalan := v_kalan - v_elenecek;
  end if;

  if v_kalan = 1 then
    select user_id into v_kazanan
    from public.tournament_players
    where tournament_id = p_tournament_id and not elendi;

  elsif t.aktif_soru + 1 >= coalesce(array_length(t.soru_ids, 1), 0) then
    -- SORULAR BİTTİ. Tek bir zirve varsa o kazanır; eşitlik varsa ALTIN SORU.
    select max(dogru_sayisi) into v_en_iyi
      from public.tournament_players
     where tournament_id = p_tournament_id and not elendi;

    select count(*) into v_zirve
      from public.tournament_players
     where tournament_id = p_tournament_id and not elendi
       and dogru_sayisi = v_en_iyi;

    if v_zirve = 1 then
      select user_id into v_kazanan
        from public.tournament_players
       where tournament_id = p_tournament_id and not elendi
         and dogru_sayisi = v_en_iyi;
    else
      -- Zirvenin altındakiler elenir, kalanlar altın soruda kapışır.
      update public.tournament_players
         set elendi = true, elenme_sorusu = t.aktif_soru
       where tournament_id = p_tournament_id and not elendi
         and dogru_sayisi < v_en_iyi;

      v_altin := public.turnuva_altin_soru_ekle(p_tournament_id);
      if v_altin is null then
        -- Havuzda tek soru bile kalmadı: en erken katılan kazansın,
        -- turnuva askıda kalmasın.
        select user_id into v_kazanan
          from public.tournament_players
         where tournament_id = p_tournament_id and not elendi
         order by dogru_sayisi desc, joined_at asc
         limit 1;
      end if;
    end if;
  end if;

  if v_kazanan is not null then
    update public.tournaments
       set durum = 'bitti', kazanan = v_kazanan, bitis = now()
     where id = p_tournament_id;
    update public.profiles
       set puan = puan + 250, puan_hafta = puan_hafta + 250, sampiyonluk = sampiyonluk + 1
     where id = v_kazanan;
    perform public.award_badge(v_kazanan, 'sampiyon');
    perform public.turnuva_odullerini_dagit(p_tournament_id, v_kazanan);
  else
    update public.tournaments
       set aktif_soru = aktif_soru + 1, soru_baslangic = now()
     where id = p_tournament_id;
  end if;
end;
$function$;

-- ---- Altın soruda joker yasak; final yasağı aynen duruyor ----
create or replace function public.joker_mac_siniri(p_mac_tur text, p_mac_id uuid)
 returns integer
 language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  m public.matches%rowtype;
  t public.tournaments%rowtype;
  v_rakip uuid;
  v_hayatta int;
begin
  if p_mac_tur = 'grup' then
    return null;                                   -- grup maçları arkadaş maçıdır
  elsif p_mac_tur = 'hizli' then
    return 2;                                      -- lig maçı
  elsif p_mac_tur = 'turnuva' then
    select * into t from public.tournaments where id = p_mac_id;
    -- ALTIN SORU: 50:50'si olan hep kazanmasın, joker kapalı.
    if coalesce(t.altin_soru, false) then
      return 0;
    end if;
    select count(*) into v_hayatta
    from public.tournament_players tp
    where tp.tournament_id = p_mac_id and not tp.elendi;
    if v_hayatta <= 2 then
      return 0;                                    -- FİNAL: joker yasak
    end if;
    return 2;
  elsif p_mac_tur = '1v1' then
    select * into m from public.matches where id = p_mac_id;
    if not found then raise exception 'Maç bulunamadı'; end if;
    v_rakip := case when m.oyuncu1 = auth.uid() then m.oyuncu2 else m.oyuncu1 end;
    if exists (
      select 1 from public.friendships f
      where f.durum = 'arkadas'
        and ((f.requester = auth.uid() and f.addressee = v_rakip)
          or (f.requester = v_rakip and f.addressee = auth.uid()))
    ) then
      return null;                                 -- sınırsız
    end if;
    return 2;
  end if;
  raise exception 'Geçersiz maç türü';
end;
$function$;

-- ---- Soru ekranı altın soruyu bilsin (başlık + farklı renk) ----
-- Dönüş tipine `altin` eklendiği için önce düşürülmesi gerekiyor.
drop function if exists public.get_tournament_question(uuid);
create or replace function public.get_tournament_question(p_tournament_id uuid)
 returns table(question_id uuid, soru text, secenekler jsonb, soru_index integer, baslangic timestamptz, sunucu_zamani timestamptz, dogru_cevap smallint, altin boolean)
 language plpgsql security definer set search_path to 'public'
as $function$
declare
  t public.tournaments%rowtype;
begin
  select * into t from public.tournaments where id = p_tournament_id;
  if not found then raise exception 'Turnuva bulunamadı'; end if;
  if t.durum <> 'aktif' or t.aktif_soru < 0 then raise exception 'Turnuva aktif değil'; end if;

  perform public.gorulen_kaydet(t.soru_ids[t.aktif_soru + 1]);

  return query
    select q.id, q.soru, q.secenekler, t.aktif_soru, t.soru_baslangic, now(),
           case when public.hileli_mi() then q.dogru_cevap else null end,
           coalesce(t.altin_soru, false)
    from public.questions q
    where q.id = t.soru_ids[t.aktif_soru + 1];
end;
$function$;

grant execute on function public.get_tournament_question(uuid) to authenticated;

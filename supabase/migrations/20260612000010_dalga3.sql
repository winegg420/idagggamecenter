-- ============================================================
-- Dalga 3: Davet sistemi + haftalık lig
-- ============================================================

alter table public.profiles
  add column if not exists davet_eden uuid references public.profiles(id),
  add column if not exists davet_sayisi int not null default 0,
  add column if not exists puan_hafta int not null default 0;

create index if not exists idx_profiles_puan_hafta on public.profiles (puan_hafta desc);

-- ---------- Davet ödülü: iki tarafa da +50 ----------

create or replace function public.claim_referral(p_davet_eden uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profil public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  if p_davet_eden = auth.uid() then return false; end if;

  select * into v_profil from public.profiles where id = auth.uid() for update;
  if not found then return false; end if;
  if v_profil.davet_eden is not null then return false; end if;
  if v_profil.created_at < now() - interval '24 hours' then return false; end if;

  if not exists (
    select 1 from public.profiles where id = p_davet_eden and not is_bot
  ) then
    return false;
  end if;

  update public.profiles
     set davet_eden = p_davet_eden,
         puan = puan + 50,
         puan_hafta = puan_hafta + 50
   where id = auth.uid();

  update public.profiles
     set puan = puan + 50,
         puan_hafta = puan_hafta + 50,
         davet_sayisi = davet_sayisi + 1
   where id = p_davet_eden;

  return true;
end;
$$;

revoke execute on function public.claim_referral(uuid) from public, anon;
grant execute on function public.claim_referral(uuid) to authenticated;

-- ---------- Haftalık puan: kazanım yerlerine ekle ----------

-- advance_match: +20 ve seri bonusu haftalığa da işlesin
create or replace function public.advance_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  v_cevap_sayisi int;
  v_kazanan uuid;
  v_kaybeden uuid;
  v_oyuncu uuid;
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_seri int;
  v_tarih date;
  v_yeni_seri int;
  v_bonus int;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found or m.durum <> 'aktif' then return; end if;
  if auth.uid() is not null and auth.uid() not in (m.oyuncu1, m.oyuncu2) then return; end if;

  select count(*) into v_cevap_sayisi
  from public.match_answers
  where match_id = p_match_id and soru_index = m.aktif_soru;

  if v_cevap_sayisi < 2 and now() < m.soru_baslangic + interval '16 seconds' then
    return;
  end if;

  if m.aktif_soru + 1 >= coalesce(array_length(m.soru_ids, 1), 0) then
    select * into m from public.matches where id = p_match_id;
    if m.oyuncu1_skor > m.oyuncu2_skor then v_kazanan := m.oyuncu1; v_kaybeden := m.oyuncu2;
    elsif m.oyuncu2_skor > m.oyuncu1_skor then v_kazanan := m.oyuncu2; v_kaybeden := m.oyuncu1;
    else v_kazanan := null;
    end if;

    update public.matches
       set durum = 'bitti', kazanan = v_kazanan, bitis = now()
     where id = p_match_id;

    if v_kazanan is not null then
      update public.profiles
         set puan = puan + 20, puan_hafta = puan_hafta + 20
       where id = v_kazanan;

      perform public.award_badge(v_kazanan, 'ilk_galibiyet');
      if (select count(*) from public.matches where kazanan = v_kazanan and durum = 'bitti') >= 10 then
        perform public.award_badge(v_kazanan, 'mac_10');
      end if;
      if v_kaybeden = 'b0b00000-0000-4000-8000-000000000003' then
        perform public.award_badge(v_kazanan, 'bot_avcisi');
      end if;
      if (select count(*) from public.match_answers
          where match_id = p_match_id and user_id = v_kazanan and dogru)
         >= coalesce(array_length(m.soru_ids, 1), 0) then
        perform public.award_badge(v_kazanan, 'tam_isabet');
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
  else
    update public.matches
       set aktif_soru = aktif_soru + 1, soru_baslangic = now()
     where id = p_match_id;
  end if;
end;
$$;

-- advance_tournament: +250 haftalığa da işlesin
create or replace function public.advance_tournament(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tournaments%rowtype;
  v_kalan int;
  v_elenecek int;
  v_kazanan uuid;
begin
  select * into t from public.tournaments where id = p_tournament_id for update;
  if not found or t.durum <> 'aktif' then return; end if;
  if now() < t.soru_baslangic + interval '16 seconds' then return; end if;

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
    select user_id into v_kazanan
    from public.tournament_players
    where tournament_id = p_tournament_id and not elendi
    order by dogru_sayisi desc, joined_at asc
    limit 1;
  end if;

  if v_kazanan is not null then
    update public.tournaments
       set durum = 'bitti', kazanan = v_kazanan, bitis = now()
     where id = p_tournament_id;
    update public.profiles
       set puan = puan + 250, puan_hafta = puan_hafta + 250, sampiyonluk = sampiyonluk + 1
     where id = v_kazanan;
    perform public.award_badge(v_kazanan, 'sampiyon');
  else
    update public.tournaments
       set aktif_soru = aktif_soru + 1, soru_baslangic = now()
     where id = p_tournament_id;
  end if;
end;
$$;

-- ---------- Haftalık sıfırlama: Pazartesi 00:00 TSİ (Pazar 21:00 UTC) ----------

do $$
begin
  begin
    perform cron.unschedule('bildim-hafta-sifirla');
  exception when others then null;
  end;
  perform cron.schedule('bildim-hafta-sifirla', '0 21 * * 0',
    'update public.profiles set puan_hafta = 0');
exception when others then
  raise notice 'pg_cron kurulamadı (yerel ortamda normal): %', sqlerrm;
end $$;

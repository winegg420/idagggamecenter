-- ============================================================================
-- BİLDİM — "Hatalarım": yanlış cevap kancaları + geriye dönük doldurma
--
-- Cevap değerlendiren TÜM RPC'lere `yanlis_kaydet(q.id)` çağrısı eklenir.
-- Fonksiyon gövdeleri birebir korunmuştur; yalnız yanlış dalına tek satır
-- eklenmiştir. (match_answers'ta question_id yok — kayıt, question_id'nin
-- zaten bilindiği cevap RPC'sinden yazılır.)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) 1v1 — submit_match_answer
-- ---------------------------------------------------------------------------
create or replace function public.submit_match_answer(p_match_id uuid, p_cevap smallint)
returns table(dogru boolean, dogru_cevap smallint)
language plpgsql
security definer
set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  m public.matches%rowtype;
  q public.questions%rowtype;
  v_dogru boolean;
  v_puan int;
  v_ben_p1 boolean;
  v_index int;
  v_bas timestamptz;
  v_toplam int;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if auth.uid() not in (m.oyuncu1, m.oyuncu2) then raise exception 'Bu maçta değilsin'; end if;
  if m.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;

  v_ben_p1 := (m.oyuncu1 = auth.uid());
  v_index := case when v_ben_p1 then m.oyuncu1_soru else m.oyuncu2_soru end;
  v_bas := coalesce(
    case when v_ben_p1 then m.oyuncu1_baslangic else m.oyuncu2_baslangic end,
    now()
  );
  v_toplam := coalesce(array_length(m.soru_ids, 1), 0);

  if v_index >= v_toplam then raise exception 'Bu maçta senin sıran bitti'; end if;
  -- 1 sn ağ payı
  if now() > v_bas + interval '17 seconds' then raise exception 'Süre doldu'; end if;

  select * into q from public.questions where id = m.soru_ids[v_index + 1];
  v_dogru := (p_cevap = q.dogru_cevap);

  insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
  values (p_match_id, auth.uid(), v_index, p_cevap, v_dogru)
  on conflict do nothing;

  -- Hatalarım bankası
  if not v_dogru then perform public.yanlis_kaydet(q.id); end if;

  if v_dogru then
    v_puan := 10 + greatest(0, least(15,
      ceil(extract(epoch from (v_bas + interval '16 seconds' - now())))))::int;
  else
    v_puan := 0;
  end if;

  -- Kendi sırasını ilerlet, süreyi sıfırla, skoru işle
  if v_ben_p1 then
    update public.matches
       set oyuncu1_skor = oyuncu1_skor + v_puan,
           oyuncu1_soru = v_index + 1,
           oyuncu1_baslangic = null,
           oyuncu1_bitti_at = case when v_index + 1 >= v_toplam then now() else oyuncu1_bitti_at end,
           aktif_soru = greatest(aktif_soru, v_index + 1)
     where id = p_match_id;
  else
    update public.matches
       set oyuncu2_skor = oyuncu2_skor + v_puan,
           oyuncu2_soru = v_index + 1,
           oyuncu2_baslangic = null,
           oyuncu2_bitti_at = case when v_index + 1 >= v_toplam then now() else oyuncu2_bitti_at end,
           aktif_soru = greatest(aktif_soru, v_index + 1)
     where id = p_match_id;
  end if;

  perform public.advance_match(p_match_id);

  return query select v_dogru, q.dogru_cevap;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2) Grup maçı — submit_group_match_answer
-- ---------------------------------------------------------------------------
create or replace function public.submit_group_match_answer(p_group_match_id uuid, p_cevap smallint)
returns table(dogru boolean, dogru_cevap smallint)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  gm public.group_matches%rowtype;
  q public.questions%rowtype;
  v_dogru boolean;
  v_puan int;
begin
  select * into gm from public.group_matches where id = p_group_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if not exists (
    select 1 from public.group_match_players
    where group_match_id = p_group_match_id and user_id = auth.uid() and davet_durumu = 'kabul'
  ) then
    raise exception 'Bu maçta değilsin';
  end if;
  if gm.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;
  if now() > gm.soru_baslangic + interval '16 seconds' then
    raise exception 'Süre doldu';
  end if;

  select * into q from public.questions where id = gm.soru_ids[gm.aktif_soru + 1];
  v_dogru := (p_cevap = q.dogru_cevap);

  insert into public.group_match_answers (group_match_id, user_id, soru_index, cevap, dogru)
  values (p_group_match_id, auth.uid(), gm.aktif_soru, p_cevap, v_dogru);

  -- Hatalarım bankası
  if not v_dogru then perform public.yanlis_kaydet(q.id); end if;

  if v_dogru then
    v_puan := 10 + greatest(0, least(15,
      ceil(extract(epoch from (gm.soru_baslangic + interval '16 seconds' - now())))))::int;
    update public.group_match_players
       set skor = skor + v_puan
     where group_match_id = p_group_match_id and user_id = auth.uid();
  end if;

  return query select v_dogru, q.dogru_cevap;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3) Turnuva — submit_tournament_answer
-- ---------------------------------------------------------------------------
create or replace function public.submit_tournament_answer(p_tournament_id uuid, p_cevap smallint)
returns table(dogru boolean, dogru_cevap smallint)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  t public.tournaments%rowtype;
  q public.questions%rowtype;
  p public.tournament_players%rowtype;
  v_dogru boolean;
begin
  select * into t from public.tournaments where id = p_tournament_id for update;
  if not found then raise exception 'Turnuva bulunamadı'; end if;
  if t.durum <> 'aktif' then raise exception 'Turnuva aktif değil'; end if;

  select * into p from public.tournament_players
  where tournament_id = p_tournament_id and user_id = auth.uid();
  if not found then raise exception 'Turnuvada değilsin'; end if;
  if p.elendi then raise exception 'Elendin'; end if;

  if now() > t.soru_baslangic + interval '16 seconds' then
    raise exception 'Süre doldu';
  end if;

  select * into q from public.questions where id = t.soru_ids[t.aktif_soru + 1];
  v_dogru := (p_cevap = q.dogru_cevap);

  insert into public.tournament_answers (tournament_id, user_id, soru_index, cevap, dogru)
  values (p_tournament_id, auth.uid(), t.aktif_soru, p_cevap, v_dogru);

  -- Hatalarım bankası
  if not v_dogru then perform public.yanlis_kaydet(q.id); end if;

  if v_dogru then
    update public.tournament_players
       set dogru_sayisi = dogru_sayisi + 1
     where tournament_id = p_tournament_id and user_id = auth.uid();
  end if;

  return query select v_dogru, q.dogru_cevap;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4) Hızlı Olan Kazanır — submit_hizli_cevap
-- ---------------------------------------------------------------------------
create or replace function public.submit_hizli_cevap(p_hizli_mac_id uuid, p_cevap smallint)
returns table(dogru boolean, dogru_cevap smallint, ilk boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  hm public.hizli_maclar%rowtype;
  q public.questions%rowtype;
  v_dogru boolean;
  v_ilk boolean := false;
begin
  select * into hm from public.hizli_maclar where id = p_hizli_mac_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if not exists (
    select 1 from public.hizli_oyuncular ho
    where ho.hizli_mac_id = p_hizli_mac_id and ho.user_id = auth.uid()
      and ho.davet_durumu = 'kabul'
  ) then
    raise exception 'Bu maçta değilsin';
  end if;
  if hm.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;
  if now() > hm.soru_baslangic + interval '16 seconds' then
    raise exception 'Süre doldu';
  end if;

  select * into q from public.questions where id = hm.soru_ids[hm.aktif_soru + 1];
  v_dogru := (p_cevap = q.dogru_cevap);

  -- İlk doğru mu? (satır kilidi altında kontrol edilir)
  -- `hc.dogru` NİTELİKLİ: out-parametre ile çakışmasın.
  if v_dogru then
    v_ilk := not exists (
      select 1 from public.hizli_cevaplar hc
      where hc.hizli_mac_id = p_hizli_mac_id
        and hc.soru_index = hm.aktif_soru
        and hc.dogru
    );
  end if;

  insert into public.hizli_cevaplar (hizli_mac_id, user_id, soru_index, cevap, dogru)
  values (p_hizli_mac_id, auth.uid(), hm.aktif_soru, p_cevap, v_dogru);

  -- Hatalarım bankası
  if not v_dogru then perform public.yanlis_kaydet(q.id); end if;

  if v_ilk then
    update public.hizli_oyuncular ho
       set skor = ho.skor + 10
     where ho.hizli_mac_id = p_hizli_mac_id and ho.user_id = auth.uid();
  end if;

  return query select v_dogru, q.dogru_cevap, v_ilk;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 5) Hızlı Mod (60 sn tek kişilik) — hizli_mod_cevap
-- ---------------------------------------------------------------------------
create or replace function public.hizli_mod_cevap(p_oturum_id uuid, p_soru_index integer, p_cevap smallint)
returns table(dogru boolean, dogru_cevap smallint, skor integer, kalan_toplam_sn integer, bitti boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  o public.hizli_mod_oturumlar%rowtype;
  q public.questions%rowtype;
  v_dogru boolean;
  v_kalan int;
  v_bitti boolean := false;
begin
  select * into o from public.hizli_mod_oturumlar where id = p_oturum_id for update;
  if not found then raise exception 'Oturum bulunamadı'; end if;
  if o.user_id <> auth.uid() then raise exception 'Bu oturum senin değil'; end if;
  if o.durum <> 'aktif' then raise exception 'Oturum bitti'; end if;
  if p_soru_index <> o.aktif_soru then raise exception 'Soru değişti'; end if;

  v_kalan := greatest(0, 60 - floor(extract(epoch from (now() - o.baslangic)))::int);

  select * into q from public.questions where id = o.soru_ids[o.aktif_soru + 1];

  -- Soru başına 5 sn (1 sn ağ payı); süre geçtiyse yanlış sayılır
  if now() > o.soru_baslangic + interval '6 seconds' then
    v_dogru := false;
  else
    v_dogru := (p_cevap = q.dogru_cevap);
  end if;

  -- Kategori ustalığı: hızlı modda da doğrular sayılır
  if v_dogru then
    perform public.kategori_dogru_arttir(auth.uid(), q.kategori);
  else
    -- Hatalarım bankası
    perform public.yanlis_kaydet(q.id);
  end if;

  update public.hizli_mod_oturumlar h
     set dogru = h.dogru + (case when v_dogru then 1 else 0 end),
         yanlis = h.yanlis + (case when v_dogru then 0 else 1 end),
         aktif_soru = h.aktif_soru + 1,
         soru_baslangic = now()
   where h.id = p_oturum_id
  returning h.* into o;

  if v_kalan <= 0 or o.aktif_soru >= coalesce(array_length(o.soru_ids, 1), 0) then
    perform public.hizli_mod_bitir(p_oturum_id);
    v_bitti := true;
    v_kalan := 0;
  end if;

  return query select v_dogru, q.dogru_cevap, o.dogru, v_kalan, v_bitti;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 6) GERİYE DÖNÜK DOLDURMA (tek seferlik)
--
-- Cevap tabloları question_id tutmuyor ama soru_index + üst kaydın soru_ids
-- dizisi eşleme için yeterli. Dört moddan da yanlışlar toplanır; aynı soru
-- birden çok kez yanlışsa yanlis_sayisi toplanır ve en yeni tarih alınır.
-- Botlar ve silinmiş sorular dışarıda bırakılır.
-- ---------------------------------------------------------------------------
insert into public.yanlis_sorular
  (user_id, question_id, yanlis_sayisi, dogru_serisi, son_yanlis_at, ogrenildi_at)
select t.user_id,
       t.question_id,
       count(*)::int,
       0,
       max(t.created_at),
       null
from (
  select a.user_id, m.soru_ids[a.soru_index + 1] as question_id, a.created_at
    from public.match_answers a
    join public.matches m on m.id = a.match_id
   where not a.dogru and a.soru_index >= 0
     and a.soru_index < coalesce(array_length(m.soru_ids, 1), 0)

  union all

  select a.user_id, gm.soru_ids[a.soru_index + 1], a.created_at
    from public.group_match_answers a
    join public.group_matches gm on gm.id = a.group_match_id
   where not a.dogru and a.soru_index >= 0
     and a.soru_index < coalesce(array_length(gm.soru_ids, 1), 0)

  union all

  select a.user_id, tn.soru_ids[a.soru_index + 1], a.created_at
    from public.tournament_answers a
    join public.tournaments tn on tn.id = a.tournament_id
   where not a.dogru and a.soru_index >= 0
     and a.soru_index < coalesce(array_length(tn.soru_ids, 1), 0)

  union all

  select a.user_id, hm.soru_ids[a.soru_index + 1], a.created_at
    from public.hizli_cevaplar a
    join public.hizli_maclar hm on hm.id = a.hizli_mac_id
   where not a.dogru and a.soru_index >= 0
     and a.soru_index < coalesce(array_length(hm.soru_ids, 1), 0)
) t
join public.profiles pr on pr.id = t.user_id and not coalesce(pr.is_bot, false)
join public.questions q on q.id = t.question_id
where t.question_id is not null
group by t.user_id, t.question_id
on conflict (user_id, question_id) do nothing;

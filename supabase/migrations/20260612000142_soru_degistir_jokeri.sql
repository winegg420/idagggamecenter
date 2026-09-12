-- ============================================================
-- "Pas" jokeri → "Soru Değiştir"
--
-- Yanlış cevabın cezası yok (doğru = puan, yanlış = 0). Bu yüzden pas
-- geçmek HER ZAMAN rastgele bir şıkka basmaktan kötüydü: joker işlevsizdi.
--
-- Yeni davranış: soru atlanmaz, YERİNE yeni bir soru gelir; süre baştan
-- başlar; soru sırası (indeks) değişmez; rakibin sorusu etkilenmez.
-- Maç başına 1 kez (yoksa oyuncu bildiği soru gelene kadar değiştirirdi).
--
-- Rakibin etkilenmemesi için soru KİŞİYE ÖZEL bir tabloda saklanır:
-- soru_degisimleri. Soru okuyan/cevap alan tüm RPC'ler artık o indeks için
-- önce bu tabloya bakar.
-- ============================================================

-- ---- 1) Envanter dönüşümü: mevcut Pas'lar 1'e 1 Soru Değiştir olur ----
-- Coin iadesi yok; adetler aynen taşınır.
update public.joker_envanter    set tur = 'soru_degistir' where tur = 'pas';
update public.joker_islemleri   set tur = 'soru_degistir' where tur = 'pas';
update public.joker_kullanimlari set tur = 'soru_degistir' where tur = 'pas';
update public.joker_paketleri
   set icerik = (icerik - 'pas') || jsonb_build_object('soru_degistir', icerik -> 'pas')
 where icerik ? 'pas';

-- ---- 2) Kişiye özel soru değişimi ----
create table if not exists public.soru_degisimleri (
  mac_tur     text        not null check (mac_tur in ('1v1','grup','hizli')),
  mac_id      uuid        not null,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  soru_index  int         not null,
  question_id uuid        not null references public.questions(id),
  baslangic   timestamptz not null default now(),
  primary key (mac_tur, mac_id, user_id, soru_index)
);

alter table public.soru_degisimleri enable row level security;

drop policy if exists soru_degisimleri_oku on public.soru_degisimleri;
create policy soru_degisimleri_oku on public.soru_degisimleri
  for select to authenticated using (user_id = auth.uid());

-- İlerletme sorguları bu indeksi kullanır
create index if not exists soru_degisimleri_mac_idx
  on public.soru_degisimleri (mac_tur, mac_id, soru_index);

-- ---- 3) Çözücüler ----
-- O oyuncunun bu indekste GERÇEKTEN gördüğü soru
create or replace function public.soru_id_coz(
  p_mac_tur text, p_mac_id uuid, p_user uuid, p_index int, p_varsayilan uuid)
returns uuid language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    (select d.question_id from public.soru_degisimleri d
      where d.mac_tur = p_mac_tur and d.mac_id = p_mac_id
        and d.user_id = p_user and d.soru_index = p_index),
    p_varsayilan);
$$;

-- O oyuncunun bu indeksteki süre sayacının başlangıcı
create or replace function public.soru_baslangic_coz(
  p_mac_tur text, p_mac_id uuid, p_user uuid, p_index int, p_varsayilan timestamptz)
returns timestamptz language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    (select d.baslangic from public.soru_degisimleri d
      where d.mac_tur = p_mac_tur and d.mac_id = p_mac_id
        and d.user_id = p_user and d.soru_index = p_index),
    p_varsayilan);
$$;

-- Bu indekste EN GEÇ biten sayaç (ilerletme bunu bekler; soru değiştiren
-- oyuncunun süresi dolmadan maç bir sonraki soruya geçmemeli).
create or replace function public.soru_son_baslangic(
  p_mac_tur text, p_mac_id uuid, p_index int, p_varsayilan timestamptz)
returns timestamptz language sql stable security definer set search_path to 'public' as $$
  select greatest(
    p_varsayilan,
    coalesce((select max(d.baslangic) from public.soru_degisimleri d
               where d.mac_tur = p_mac_tur and d.mac_id = p_mac_id
                 and d.soru_index = p_index),
             p_varsayilan));
$$;

-- ---- 4) Değiştirme işlemi (yalnız joker_kullan çağırır) ----
-- Maçta HİÇ kullanılmamış bir soru seçer: ne dizide, ne de daha önce
-- değiştirilmiş sorularda olmalı. Kategoride soru kalmazsa kategori gevşer.
create or replace function public.mac_soru_degistir(
  p_mac_tur text, p_mac_id uuid, p_user uuid, p_index int)
returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare
  v_haric uuid[];
  v_kategori text;
  v_dil text;
  v_yeni uuid;
begin
  if p_mac_tur = '1v1' then
    select m.soru_ids, m.kategori into v_haric, v_kategori
      from public.matches m where m.id = p_mac_id;
  elsif p_mac_tur = 'grup' then
    select gm.soru_ids, gm.kategori into v_haric, v_kategori
      from public.group_matches gm where gm.id = p_mac_id;
  elsif p_mac_tur = 'hizli' then
    select hm.soru_ids, hm.kategori into v_haric, v_kategori
      from public.hizli_maclar hm where hm.id = p_mac_id;
  else
    raise exception 'Bu maç türünde soru değiştirilemez';
  end if;

  v_haric := coalesce(v_haric, '{}'::uuid[]) || coalesce((
    select array_agg(d.question_id) from public.soru_degisimleri d
     where d.mac_tur = p_mac_tur and d.mac_id = p_mac_id), '{}'::uuid[]);

  select coalesce(pr.dil, 'tr') into v_dil from public.profiles pr where pr.id = p_user;

  -- Önce aynı kategoriden, sonra (havuz tükendiyse) kategoriden bağımsız.
  select q.id into v_yeni
    from public.questions q
   where q.aktif and q.dil = coalesce(v_dil, 'tr')
     and (v_kategori is null or q.kategori = v_kategori)
     and q.id <> all(v_haric)
   order by random() limit 1;

  if v_yeni is null then
    select q.id into v_yeni
      from public.questions q
     where q.aktif and q.dil = coalesce(v_dil, 'tr')
       and q.id <> all(v_haric)
     order by random() limit 1;
  end if;

  if v_yeni is null then
    raise exception 'Değiştirilecek yeni soru kalmadı';
  end if;

  insert into public.soru_degisimleri (mac_tur, mac_id, user_id, soru_index, question_id, baslangic)
  values (p_mac_tur, p_mac_id, p_user, p_index, v_yeni, now())
  on conflict (mac_tur, mac_id, user_id, soru_index)
    do update set question_id = excluded.question_id, baslangic = now();

  return v_yeni;
end;
$$;

revoke all on function public.mac_soru_degistir(text, uuid, uuid, int) from public, authenticated, anon;

-- ---- 5) Soru okuyan RPC'ler kişiye özel soruyu döndürür ----
create or replace function public.get_match_question(p_match_id uuid)
 returns table(question_id uuid, soru text, secenekler jsonb, soru_index integer, baslangic timestamptz, sunucu_zamani timestamptz, dogru_cevap smallint)
 language plpgsql security definer set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  m public.matches%rowtype;
  v_ben_p1 boolean;
  v_index int;
  v_bas timestamptz;
  v_soru_id uuid;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if auth.uid() not in (m.oyuncu1, m.oyuncu2) then raise exception 'Bu maçta değilsin'; end if;
  if m.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;

  v_ben_p1 := (m.oyuncu1 = auth.uid());

  if coalesce(m.senkron, false) then
    if not m.basladi or m.soru_baslangic is null then
      raise exception 'Maç henüz başlamadı';
    end if;
    v_index := m.aktif_soru;
    v_bas := m.soru_baslangic;
  else
    v_index := case when v_ben_p1 then m.oyuncu1_soru else m.oyuncu2_soru end;
    v_bas := case when v_ben_p1 then m.oyuncu1_baslangic else m.oyuncu2_baslangic end;
    if v_bas is null then
      v_bas := now();
      if v_ben_p1 then
        update public.matches set oyuncu1_baslangic = v_bas where id = p_match_id;
      else
        update public.matches set oyuncu2_baslangic = v_bas where id = p_match_id;
      end if;
    end if;
  end if;

  if v_index >= coalesce(array_length(m.soru_ids, 1), 0) then
    raise exception 'Bu maçta senin sıran bitti';
  end if;

  -- Soru Değiştir jokeri kullanıldıysa bu oyuncuya özel soru ve saat
  v_soru_id := public.soru_id_coz('1v1', p_match_id, auth.uid(), v_index, m.soru_ids[v_index + 1]);
  v_bas := public.soru_baslangic_coz('1v1', p_match_id, auth.uid(), v_index, v_bas);

  perform public.gorulen_kaydet(v_soru_id);

  return query
    select q.id, q.soru, q.secenekler, v_index, v_bas, now(),
           case when public.hileli_mi() then q.dogru_cevap else null end
    from public.questions q
    where q.id = v_soru_id;
end;
$function$;

create or replace function public.get_group_match_question(p_group_match_id uuid)
 returns table(question_id uuid, soru text, secenekler jsonb, soru_index integer, baslangic timestamptz, sunucu_zamani timestamptz, dogru_cevap smallint)
 language plpgsql security definer set search_path to 'public'
as $function$
declare
  gm public.group_matches%rowtype;
  v_soru_id uuid;
  v_bas timestamptz;
begin
  select * into gm from public.group_matches where id = p_group_match_id;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if not exists (
    select 1 from public.group_match_players
    where group_match_id = p_group_match_id and user_id = auth.uid() and davet_durumu = 'kabul'
  ) then
    raise exception 'Bu maçta değilsin';
  end if;
  if gm.durum <> 'aktif' or gm.aktif_soru < 0 then raise exception 'Maç aktif değil'; end if;

  v_soru_id := public.soru_id_coz('grup', p_group_match_id, auth.uid(), gm.aktif_soru, gm.soru_ids[gm.aktif_soru + 1]);
  v_bas := public.soru_baslangic_coz('grup', p_group_match_id, auth.uid(), gm.aktif_soru, gm.soru_baslangic);

  perform public.gorulen_kaydet(v_soru_id);

  return query
    select q.id, q.soru, q.secenekler, gm.aktif_soru, v_bas, now(),
           case when public.hileli_mi() then q.dogru_cevap else null end
    from public.questions q
    where q.id = v_soru_id;
end;
$function$;

create or replace function public.get_hizli_soru(p_hizli_mac_id uuid)
 returns table(question_id uuid, soru text, secenekler jsonb, soru_index integer, baslangic timestamptz, sunucu_zamani timestamptz)
 language plpgsql security definer set search_path to 'public'
as $function$
declare
  hm public.hizli_maclar%rowtype;
  v_soru_id uuid;
  v_bas timestamptz;
begin
  select * into hm from public.hizli_maclar where id = p_hizli_mac_id;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if not exists (
    select 1 from public.hizli_oyuncular
    where hizli_mac_id = p_hizli_mac_id and user_id = auth.uid() and davet_durumu = 'kabul'
  ) then
    raise exception 'Bu maçta değilsin';
  end if;
  if hm.durum <> 'aktif' or hm.aktif_soru < 0 then raise exception 'Maç aktif değil'; end if;

  v_soru_id := public.soru_id_coz('hizli', p_hizli_mac_id, auth.uid(), hm.aktif_soru, hm.soru_ids[hm.aktif_soru + 1]);
  v_bas := public.soru_baslangic_coz('hizli', p_hizli_mac_id, auth.uid(), hm.aktif_soru, hm.soru_baslangic);

  perform public.gorulen_kaydet(v_soru_id);

  return query
    select q.id, q.soru, q.secenekler, hm.aktif_soru, v_bas, now()
    from public.questions q
    where q.id = v_soru_id;
end;
$function$;

-- ---- 6) Cevap alan RPC'ler kişiye özel soruyu/saati kullanır ----
create or replace function public.submit_match_answer(p_match_id uuid, p_cevap smallint)
 returns table(dogru boolean, dogru_cevap smallint, puan integer, benim_skor integer, rakip_skor integer)
 language plpgsql security definer set search_path to 'public'
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
  v_senkron boolean;
  v_s1 int;
  v_s2 int;
  v_soru_id uuid;
begin
  perform public.hiz_siniri('submit_match_answer', 60, interval '60 seconds');
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if auth.uid() not in (m.oyuncu1, m.oyuncu2) then raise exception 'Bu maçta değilsin'; end if;
  if m.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;

  v_ben_p1 := (m.oyuncu1 = auth.uid());
  v_senkron := coalesce(m.senkron, false);
  v_toplam := coalesce(array_length(m.soru_ids, 1), 0);

  if v_senkron then
    if not m.basladi or m.soru_baslangic is null then raise exception 'Maç henüz başlamadı'; end if;
    if m.duraklatildi_at is not null then
      raise exception 'Rakip bağlantısı koptu — maç duraklatıldı';
    end if;
    if now() < m.soru_baslangic then raise exception 'Maç başlamak üzere'; end if;
    v_index := m.aktif_soru;
    v_bas := m.soru_baslangic;
  else
    v_index := case when v_ben_p1 then m.oyuncu1_soru else m.oyuncu2_soru end;
    v_bas := coalesce(case when v_ben_p1 then m.oyuncu1_baslangic else m.oyuncu2_baslangic end, now());
  end if;

  if v_index >= v_toplam then raise exception 'Bu maçta senin sıran bitti'; end if;

  v_soru_id := public.soru_id_coz('1v1', p_match_id, auth.uid(), v_index, m.soru_ids[v_index + 1]);
  v_bas := public.soru_baslangic_coz('1v1', p_match_id, auth.uid(), v_index, v_bas);

  if now() > v_bas + interval '17 seconds' then raise exception 'Süre doldu'; end if;

  if exists (
    select 1 from public.match_answers a
    where a.match_id = p_match_id and a.user_id = auth.uid() and a.soru_index = v_index
  ) then
    raise exception 'Bu soruyu zaten cevapladın';
  end if;

  select * into q from public.questions where id = v_soru_id;
  v_dogru := (p_cevap = q.dogru_cevap);

  insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
  values (p_match_id, auth.uid(), v_index, p_cevap, v_dogru)
  on conflict do nothing;

  if not v_dogru then perform public.yanlis_kaydet(q.id); end if;

  if v_dogru then
    v_puan := 10 + greatest(0, least(15,
      ceil(extract(epoch from (v_bas + interval '16 seconds' - now())))))::int;
  else
    v_puan := 0;
  end if;

  if v_ben_p1 then
    update public.matches
       set oyuncu1_skor = oyuncu1_skor + v_puan,
           oyuncu1_soru = v_index + 1,
           oyuncu1_baslangic = case when v_senkron then oyuncu1_baslangic else null end,
           oyuncu1_bitti_at = case when (not v_senkron) and v_index + 1 >= v_toplam then now() else oyuncu1_bitti_at end,
           aktif_soru = case when v_senkron then aktif_soru else greatest(aktif_soru, v_index + 1) end
     where id = p_match_id;
  else
    update public.matches
       set oyuncu2_skor = oyuncu2_skor + v_puan,
           oyuncu2_soru = v_index + 1,
           oyuncu2_baslangic = case when v_senkron then oyuncu2_baslangic else null end,
           oyuncu2_bitti_at = case when (not v_senkron) and v_index + 1 >= v_toplam then now() else oyuncu2_bitti_at end,
           aktif_soru = case when v_senkron then aktif_soru else greatest(aktif_soru, v_index + 1) end
     where id = p_match_id;
  end if;

  perform public.advance_match(p_match_id);

  select oyuncu1_skor, oyuncu2_skor into v_s1, v_s2
    from public.matches where id = p_match_id;

  return query select
    v_dogru, q.dogru_cevap, v_puan,
    case when v_ben_p1 then v_s1 else v_s2 end,
    case when v_ben_p1 then v_s2 else v_s1 end;
end;
$function$;

create or replace function public.submit_group_match_answer(p_group_match_id uuid, p_cevap smallint)
 returns table(dogru boolean, dogru_cevap smallint)
 language plpgsql security definer set search_path to 'public'
as $function$
declare
  gm public.group_matches%rowtype;
  q public.questions%rowtype;
  v_dogru boolean;
  v_puan int;
  v_soru_id uuid;
  v_bas timestamptz;
begin
  perform public.hiz_siniri('submit_group_match_answer', 60, interval '60 seconds');
  select * into gm from public.group_matches where id = p_group_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if not exists (
    select 1 from public.group_match_players
    where group_match_id = p_group_match_id and user_id = auth.uid() and davet_durumu = 'kabul'
  ) then
    raise exception 'Bu maçta değilsin';
  end if;
  if gm.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;

  v_soru_id := public.soru_id_coz('grup', p_group_match_id, auth.uid(), gm.aktif_soru, gm.soru_ids[gm.aktif_soru + 1]);
  v_bas := public.soru_baslangic_coz('grup', p_group_match_id, auth.uid(), gm.aktif_soru, gm.soru_baslangic);

  if now() > v_bas + interval '16 seconds' then raise exception 'Süre doldu'; end if;

  select * into q from public.questions where id = v_soru_id;
  v_dogru := (p_cevap = q.dogru_cevap);

  insert into public.group_match_answers (group_match_id, user_id, soru_index, cevap, dogru)
  values (p_group_match_id, auth.uid(), gm.aktif_soru, p_cevap, v_dogru);

  if not v_dogru then perform public.yanlis_kaydet(q.id); end if;

  if v_dogru then
    v_puan := 10 + greatest(0, least(15,
      ceil(extract(epoch from (v_bas + interval '16 seconds' - now())))))::int;
    update public.group_match_players
       set skor = skor + v_puan
     where group_match_id = p_group_match_id and user_id = auth.uid();
  end if;

  return query select v_dogru, q.dogru_cevap;
end;
$function$;

create or replace function public.submit_hizli_cevap(p_hizli_mac_id uuid, p_cevap smallint)
 returns table(dogru boolean, dogru_cevap smallint, ilk boolean)
 language plpgsql security definer set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  hm public.hizli_maclar%rowtype;
  q public.questions%rowtype;
  v_dogru boolean;
  v_ilk boolean := false;
  v_soru_id uuid;
  v_bas timestamptz;
begin
  perform public.hiz_siniri('submit_hizli_cevap', 60, interval '60 seconds');
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

  v_soru_id := public.soru_id_coz('hizli', p_hizli_mac_id, auth.uid(), hm.aktif_soru, hm.soru_ids[hm.aktif_soru + 1]);
  v_bas := public.soru_baslangic_coz('hizli', p_hizli_mac_id, auth.uid(), hm.aktif_soru, hm.soru_baslangic);

  if now() > v_bas + interval '16 seconds' then raise exception 'Süre doldu'; end if;

  select * into q from public.questions where id = v_soru_id;
  v_dogru := (p_cevap = q.dogru_cevap);

  if v_dogru then
    v_ilk := not exists (
      select 1 from public.hizli_cevaplar hc
      where hc.hizli_mac_id = p_hizli_mac_id
        and hc.soru_index = hm.aktif_soru and hc.dogru
    );
  end if;

  insert into public.hizli_cevaplar (hizli_mac_id, user_id, soru_index, cevap, dogru)
  values (p_hizli_mac_id, auth.uid(), hm.aktif_soru, p_cevap, v_dogru);

  if not v_dogru then perform public.yanlis_kaydet(q.id); end if;

  if v_ilk then
    update public.hizli_oyuncular ho
       set skor = ho.skor + 10
     where ho.hizli_mac_id = p_hizli_mac_id and ho.user_id = auth.uid();
  end if;

  return query select v_dogru, q.dogru_cevap, v_ilk;
end;
$function$;

-- ---- 7) Süre dolunca atlama ve ilerletme kişisel sayacı bekler ----
create or replace function public.mac_soruyu_atla(p_match_id uuid)
 returns table(dogru_cevap integer)
 language plpgsql security definer set search_path to 'public'
as $function$
declare
  m public.matches%rowtype;
  v_ben_p1 boolean;
  v_index int;
  v_bas timestamptz;
  v_toplam int;
  v_soru_id uuid;
  v_senkron boolean;
begin
  perform public.hiz_siniri('mac_soruyu_atla', 60, interval '60 seconds');
  select * into m from public.matches where id = p_match_id for update;
  if not found or m.durum <> 'aktif' then return; end if;
  if auth.uid() not in (m.oyuncu1, m.oyuncu2) then return; end if;

  v_ben_p1 := (m.oyuncu1 = auth.uid());
  v_senkron := coalesce(m.senkron, false);
  v_toplam := coalesce(array_length(m.soru_ids, 1), 0);

  if v_senkron then
    if not m.basladi then return; end if;
    if m.duraklatildi_at is not null then return; end if;
    v_index := m.aktif_soru;
    v_bas := m.soru_baslangic;
  else
    v_index := case when v_ben_p1 then m.oyuncu1_soru else m.oyuncu2_soru end;
    v_bas := case when v_ben_p1 then m.oyuncu1_baslangic else m.oyuncu2_baslangic end;
  end if;

  if v_index >= v_toplam then return; end if;

  v_soru_id := public.soru_id_coz('1v1', p_match_id, auth.uid(), v_index, m.soru_ids[v_index + 1]);
  v_bas := public.soru_baslangic_coz('1v1', p_match_id, auth.uid(), v_index, v_bas);

  if v_bas is null or now() <= v_bas + interval '15 seconds' then return; end if;

  insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
  values (p_match_id, auth.uid(), v_index, -1, false)
  on conflict do nothing;

  if not v_senkron then
    if v_ben_p1 then
      update public.matches
         set oyuncu1_soru = v_index + 1, oyuncu1_baslangic = null,
             oyuncu1_bitti_at = case when v_index + 1 >= v_toplam then now() else oyuncu1_bitti_at end,
             aktif_soru = greatest(aktif_soru, v_index + 1)
       where id = p_match_id;
    else
      update public.matches
         set oyuncu2_soru = v_index + 1, oyuncu2_baslangic = null,
             oyuncu2_bitti_at = case when v_index + 1 >= v_toplam then now() else oyuncu2_bitti_at end,
             aktif_soru = greatest(aktif_soru, v_index + 1)
       where id = p_match_id;
    end if;
  end if;

  perform public.advance_match(p_match_id);

  return query select q.dogru_cevap::int from public.questions q where q.id = v_soru_id;
end;
$function$;

-- advance_match: senkron maçta soru değiştiren oyuncunun sayacı dolmadan
-- ortak soru ilerlemez (yoksa jokerin verdiği süre işe yaramazdı).
create or replace function public.advance_match(p_match_id uuid)
 returns void
 language plpgsql security definer set search_path to 'public'
as $function$
declare
  m public.matches%rowtype;
  v_kazanan uuid;
  v_kaybeden uuid;
  v_toplam int;
  v_ikisi_bitti boolean;
  v_terk boolean;
  v_cevap_sayisi int;
  v_yeni int;
  v_bas timestamptz;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found or m.durum <> 'aktif' then return; end if;
  if auth.uid() is not null and auth.uid() not in (m.oyuncu1, m.oyuncu2) then return; end if;

  v_toplam := coalesce(array_length(m.soru_ids, 1), 0);

  if coalesce(m.senkron, false) then
    if not m.basladi or m.soru_baslangic is null then return; end if;
    if m.duraklatildi_at is not null then return; end if;
    if now() < m.soru_baslangic then return; end if;

    if m.aktif_soru < v_toplam then
      select count(*) into v_cevap_sayisi
        from public.match_answers a
       where a.match_id = p_match_id and a.soru_index = m.aktif_soru;

      v_bas := public.soru_son_baslangic('1v1', p_match_id, m.aktif_soru, m.soru_baslangic);
      if v_cevap_sayisi < 2 and now() <= v_bas + interval '16 seconds' then
        return;
      end if;

      v_yeni := m.aktif_soru + 1;
      update public.matches
         set aktif_soru = v_yeni,
             soru_baslangic = now(),
             oyuncu1_soru = v_yeni,
             oyuncu2_soru = v_yeni,
             oyuncu1_baslangic = null,
             oyuncu2_baslangic = null,
             oyuncu1_bitti_at = case when v_yeni >= v_toplam then now() else oyuncu1_bitti_at end,
             oyuncu2_bitti_at = case when v_yeni >= v_toplam then now() else oyuncu2_bitti_at end
       where id = p_match_id;

      if v_yeni < v_toplam then return; end if;
    end if;
  else
    v_ikisi_bitti := (m.oyuncu1_soru >= v_toplam and m.oyuncu2_soru >= v_toplam);
    v_terk := (
      (m.oyuncu1_soru >= v_toplam or m.oyuncu2_soru >= v_toplam)
      and coalesce(m.oyuncu1_bitti_at, m.oyuncu2_bitti_at) < now() - interval '24 hours'
    );
    if not (v_ikisi_bitti or v_terk) then
      return;
    end if;
  end if;

  select * into m from public.matches where id = p_match_id;
  if m.oyuncu1_skor > m.oyuncu2_skor then v_kazanan := m.oyuncu1; v_kaybeden := m.oyuncu2;
  elsif m.oyuncu2_skor > m.oyuncu1_skor then v_kazanan := m.oyuncu2; v_kaybeden := m.oyuncu1;
  else v_kazanan := null; v_kaybeden := null;
  end if;

  perform public.mac_sonuclandir(p_match_id, v_kazanan, v_kaybeden);
end;
$function$;

CREATE OR REPLACE FUNCTION public.advance_group_match(p_group_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  gm public.group_matches%rowtype;
  v_toplam_oyuncu int;
  v_cevap_sayisi int;
  v_kazanan uuid;
  v_en_yuksek int;
  v_kazanan_sayisi int;
  v_oyuncu uuid;
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_seri int;
  v_tarih date;
  v_yeni_seri int;
  v_bonus int;
  v_odul int;
begin
  select * into gm from public.group_matches where id = p_group_match_id for update;
  if not found or gm.durum <> 'aktif' then return; end if;
  -- Hazır kapısı ve kopma kilidi (bkz. grup_mac_nabiz)
  if not coalesce(gm.basladi, true) then return; end if;
  if gm.duraklatildi_at is not null then return; end if;

  select count(*) into v_toplam_oyuncu
  from public.group_match_players
  where group_match_id = p_group_match_id and davet_durumu = 'kabul' and terk_at is null;

  select count(*) into v_cevap_sayisi
  from public.group_match_answers
  where group_match_id = p_group_match_id and soru_index = gm.aktif_soru;

  -- Soru Degistir jokeri: kisisel sayaci dolmamis oyuncu beklenir
  if v_cevap_sayisi < v_toplam_oyuncu
     and now() < public.soru_son_baslangic('grup', p_group_match_id, gm.aktif_soru, gm.soru_baslangic) + interval '16 seconds' then
    return;
  end if;

  if gm.aktif_soru + 1 >= coalesce(array_length(gm.soru_ids, 1), 0) then
    select max(skor) into v_en_yuksek
    from public.group_match_players
    where group_match_id = p_group_match_id and davet_durumu = 'kabul' and terk_at is null;

    select count(*) into v_kazanan_sayisi
    from public.group_match_players
    where group_match_id = p_group_match_id and davet_durumu = 'kabul' and terk_at is null and skor = v_en_yuksek;

    if v_kazanan_sayisi = 1 then
      select user_id into v_kazanan
      from public.group_match_players
      where group_match_id = p_group_match_id and davet_durumu = 'kabul' and terk_at is null and skor = v_en_yuksek;
    else
      v_kazanan := null; -- birden fazla kişi en yüksek skorda: berabere
    end if;

    update public.group_matches
       set durum = 'bitti', kazanan = v_kazanan, bitis = now()
     where id = p_group_match_id;

    -- COİN ödülü (bkz. coin_mac_odulu): kazanana tam, berabere herkese yarım.
    perform public.coin_mac_odulu(
      p_group_match_id::text, v_kazanan,
      (select coalesce(array_agg(user_id), '{}'::uuid[])
         from public.group_match_players
        where group_match_id = p_group_match_id
          and davet_durumu = 'kabul' and terk_at is null));

    if v_kazanan is not null then
      v_odul := 10 * gm.oyuncu_sayisi; -- 3 kişi: +30, 4 kişi: +40
      update public.profiles
         set puan = puan + v_odul, puan_hafta = puan_hafta + v_odul
       where id = v_kazanan;

      perform public.award_badge(v_kazanan, 'ilk_galibiyet');
      if (select count(*) from public.group_match_answers
          where group_match_id = p_group_match_id and user_id = v_kazanan and dogru)
         >= coalesce(array_length(gm.soru_ids, 1), 0) then
        perform public.award_badge(v_kazanan, 'tam_isabet');
      end if;
    end if;

    -- Günlük seri: insan oyunculara (1v1 ile aynı kural, günde bir kez)
    for v_oyuncu in
      select user_id from public.group_match_players
      where group_match_id = p_group_match_id and davet_durumu = 'kabul' and terk_at is null
    loop
      select seri, son_seri_tarihi into v_seri, v_tarih
      from public.profiles where id = v_oyuncu and not is_bot;
      if found and v_tarih is distinct from v_bugun then
        v_yeni_seri := case when v_tarih = v_bugun - 1 then v_seri + 1 else 1 end;
        v_bonus := least(v_yeni_seri * 5, 50);
        update public.profiles
           set seri = v_yeni_seri, son_seri_tarihi = v_bugun,
               puan = puan + v_bonus, puan_hafta = puan_hafta + v_bonus
         where id = v_oyuncu;
        if v_yeni_seri >= 3 then perform public.award_badge(v_oyuncu, 'seri_3'); end if;
        if v_yeni_seri >= 7 then perform public.award_badge(v_oyuncu, 'seri_7'); end if;
      end if;
    end loop;
  else
    update public.group_matches
       set aktif_soru = aktif_soru + 1, soru_baslangic = now()
     where id = p_group_match_id;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.advance_hizli_mac(p_hizli_mac_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  hm public.hizli_maclar%rowtype;
  v_toplam_oyuncu int;
  v_cevap_sayisi int;
  v_kazanan uuid;
  v_en_yuksek int;
  v_kazanan_sayisi int;
  v_oyuncu uuid;
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_seri int;
  v_tarih date;
  v_yeni_seri int;
  v_bonus int;
  v_odul int;
begin
  select * into hm from public.hizli_maclar where id = p_hizli_mac_id for update;
  if not found or hm.durum <> 'aktif' then return; end if;
  -- Hazır kapısı ve kopma kilidi (bkz. hizli_mac_nabiz)
  if not coalesce(hm.basladi, true) then return; end if;
  if hm.duraklatildi_at is not null then return; end if;

  select count(*) into v_toplam_oyuncu
  from public.hizli_oyuncular
  where hizli_mac_id = p_hizli_mac_id and davet_durumu = 'kabul' and terk_at is null;

  select count(*) into v_cevap_sayisi
  from public.hizli_cevaplar
  where hizli_mac_id = p_hizli_mac_id and soru_index = hm.aktif_soru;

  -- Soru Degistir jokeri: kisisel sayaci dolmamis oyuncu beklenir
  if v_cevap_sayisi < v_toplam_oyuncu
     and now() < public.soru_son_baslangic('hizli', p_hizli_mac_id, hm.aktif_soru, hm.soru_baslangic) + interval '16 seconds' then
    return;
  end if;

  if hm.aktif_soru + 1 >= coalesce(array_length(hm.soru_ids, 1), 0) then
    select max(skor) into v_en_yuksek
    from public.hizli_oyuncular
    where hizli_mac_id = p_hizli_mac_id and davet_durumu = 'kabul' and terk_at is null;

    select count(*) into v_kazanan_sayisi
    from public.hizli_oyuncular
    where hizli_mac_id = p_hizli_mac_id and davet_durumu = 'kabul' and terk_at is null and skor = v_en_yuksek;

    if v_kazanan_sayisi = 1 and v_en_yuksek > 0 then
      select user_id into v_kazanan
      from public.hizli_oyuncular
      where hizli_mac_id = p_hizli_mac_id and davet_durumu = 'kabul' and terk_at is null and skor = v_en_yuksek;
    else
      v_kazanan := null; -- berabere veya kimse puan almadı
    end if;

    update public.hizli_maclar
       set durum = 'bitti', kazanan = v_kazanan, bitis = now()
     where id = p_hizli_mac_id;

    -- COİN ödülü (bkz. coin_mac_odulu)
    perform public.coin_mac_odulu(
      p_hizli_mac_id::text, v_kazanan,
      (select coalesce(array_agg(user_id), '{}'::uuid[])
         from public.hizli_oyuncular
        where hizli_mac_id = p_hizli_mac_id
          and davet_durumu = 'kabul' and terk_at is null));

    if v_kazanan is not null then
      v_odul := 50; -- 5 kişilik yarış galibi
      update public.profiles
         set puan = puan + v_odul, puan_hafta = puan_hafta + v_odul
       where id = v_kazanan;
      perform public.award_badge(v_kazanan, 'ilk_galibiyet');
    end if;

    -- Günlük seri: insan oyunculara (1v1 ile aynı kural, günde bir kez)
    for v_oyuncu in
      select user_id from public.hizli_oyuncular
      where hizli_mac_id = p_hizli_mac_id and davet_durumu = 'kabul' and terk_at is null
    loop
      select seri, son_seri_tarihi into v_seri, v_tarih
      from public.profiles where id = v_oyuncu and not is_bot;
      if found and v_tarih is distinct from v_bugun then
        v_yeni_seri := case when v_tarih = v_bugun - 1 then v_seri + 1 else 1 end;
        v_bonus := least(v_yeni_seri * 5, 50);
        update public.profiles
           set seri = v_yeni_seri, son_seri_tarihi = v_bugun,
               puan = puan + v_bonus, puan_hafta = puan_hafta + v_bonus
         where id = v_oyuncu;
        if v_yeni_seri >= 3 then perform public.award_badge(v_oyuncu, 'seri_3'); end if;
        if v_yeni_seri >= 7 then perform public.award_badge(v_oyuncu, 'seri_7'); end if;
      end if;
    end loop;
  else
    update public.hizli_maclar
       set aktif_soru = aktif_soru + 1, soru_baslangic = now()
     where id = p_hizli_mac_id;
  end if;
end;
$function$;

-- ---- 8) Envanter listesi ve joker kullanımı ----
create or replace function public.envanterim()
 returns table(tur text, adet integer)
 language sql stable security definer set search_path to 'public'
as $function$
  select t.tur, coalesce(e.adet, 0)
  from (values ('elli'), ('sure'), ('soru_degistir'), ('seri_koruma')) as t(tur)
  left join public.joker_envanter e on e.tur = t.tur and e.user_id = auth.uid();
$function$;

create or replace function public.joker_kullan(p_mac_tur text, p_mac_id uuid, p_soru_index integer, p_tur text)
 returns jsonb
 language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_sinir int;
  v_kullanilan int;
  v_ucretsiz boolean := false;
  v_soru_id uuid;
  v_dogru smallint;
  v_kapali int[];
  v_baslangic timestamptz;
  v_aktif_soru int;
  m public.matches%rowtype;
  gm public.group_matches%rowtype;
  hm public.hizli_maclar%rowtype;
  t public.tournaments%rowtype;
  v_ben_p1 boolean;
  v_yeni_soru uuid;
  v_degisti boolean;
  v_q public.questions%rowtype;
begin
  perform public.hiz_siniri('joker_kullan', 20, interval '60 seconds');
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  if p_tur not in ('elli','sure','soru_degistir') then
    raise exception 'Bu joker maç içinde kullanılamaz';
  end if;
  if p_mac_tur not in ('1v1','grup','hizli','turnuva') then
    raise exception 'Geçersiz maç türü';
  end if;
  -- Turnuva herkese AYNI soruyu sorar ve elemelidir: soru değiştirilemez.
  if p_mac_tur = 'turnuva' and p_tur = 'soru_degistir' then
    raise exception 'Turnuvada soru değiştirilemez';
  end if;

  if p_mac_tur = '1v1' then
    select * into m from public.matches where id = p_mac_id for update;
    if not found then raise exception 'Maç bulunamadı'; end if;
    if v_me not in (m.oyuncu1, m.oyuncu2) then raise exception 'Bu maçta değilsin'; end if;
    if m.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;
    v_ben_p1 := (m.oyuncu1 = v_me);
    if coalesce(m.senkron, false) then
      v_aktif_soru := m.aktif_soru;
      v_baslangic := m.soru_baslangic;
    else
      v_aktif_soru := coalesce(case when v_ben_p1 then m.oyuncu1_soru else m.oyuncu2_soru end, 0);
      v_baslangic := case when v_ben_p1 then m.oyuncu1_baslangic else m.oyuncu2_baslangic end;
    end if;
    v_soru_id := m.soru_ids[v_aktif_soru + 1];
    if exists (select 1 from public.match_answers
               where match_id = p_mac_id and user_id = v_me and soru_index = v_aktif_soru) then
      raise exception 'Bu soruyu zaten cevapladın';
    end if;

  elsif p_mac_tur = 'grup' then
    select * into gm from public.group_matches where id = p_mac_id for update;
    if not found then raise exception 'Maç bulunamadı'; end if;
    if not exists (select 1 from public.group_match_players
                   where group_match_id = p_mac_id and user_id = v_me and davet_durumu = 'kabul') then
      raise exception 'Bu maçta değilsin';
    end if;
    if gm.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;
    v_aktif_soru := gm.aktif_soru; v_baslangic := gm.soru_baslangic;
    v_soru_id := gm.soru_ids[gm.aktif_soru + 1];
    if exists (select 1 from public.group_match_answers
               where group_match_id = p_mac_id and user_id = v_me and soru_index = gm.aktif_soru) then
      raise exception 'Bu soruyu zaten cevapladın';
    end if;

  elsif p_mac_tur = 'hizli' then
    select * into hm from public.hizli_maclar where id = p_mac_id for update;
    if not found then raise exception 'Maç bulunamadı'; end if;
    if not exists (select 1 from public.hizli_oyuncular
                   where hizli_mac_id = p_mac_id and user_id = v_me and davet_durumu = 'kabul') then
      raise exception 'Bu maçta değilsin';
    end if;
    if hm.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;
    v_aktif_soru := hm.aktif_soru; v_baslangic := hm.soru_baslangic;
    v_soru_id := hm.soru_ids[hm.aktif_soru + 1];
    if exists (select 1 from public.hizli_cevaplar
               where hizli_mac_id = p_mac_id and user_id = v_me and soru_index = hm.aktif_soru) then
      raise exception 'Bu soruyu zaten cevapladın';
    end if;

  else
    select * into t from public.tournaments where id = p_mac_id for update;
    if not found then raise exception 'Turnuva bulunamadı'; end if;
    if not exists (select 1 from public.tournament_players
                   where tournament_id = p_mac_id and user_id = v_me and not elendi) then
      raise exception 'Turnuvada değilsin ya da elendin';
    end if;
    if t.durum <> 'aktif' then raise exception 'Turnuva aktif değil'; end if;
    v_aktif_soru := t.aktif_soru; v_baslangic := t.soru_baslangic;
    v_soru_id := t.soru_ids[t.aktif_soru + 1];
    if exists (select 1 from public.tournament_answers
               where tournament_id = p_mac_id and user_id = v_me and soru_index = t.aktif_soru) then
      raise exception 'Bu soruyu zaten cevapladın';
    end if;
  end if;

  -- Soru daha önce değiştirildiyse kişiye özel soru/saat geçerlidir
  if p_mac_tur <> 'turnuva' then
    v_soru_id := public.soru_id_coz(p_mac_tur, p_mac_id, v_me, v_aktif_soru, v_soru_id);
    v_baslangic := public.soru_baslangic_coz(p_mac_tur, p_mac_id, v_me, v_aktif_soru, v_baslangic);
  end if;

  if p_soru_index is not null and p_soru_index <> v_aktif_soru then
    raise exception 'Soru değişti, tekrar dene';
  end if;
  if now() > v_baslangic + interval '16 seconds' then
    raise exception 'Süre doldu';
  end if;

  v_sinir := public.joker_mac_siniri(p_mac_tur, p_mac_id);
  select count(*) into v_kullanilan
  from public.joker_kullanimlari
  where user_id = v_me and mac_tur = p_mac_tur and mac_id = p_mac_id;

  if v_sinir = 0 then
    raise exception 'Turnuva finalinde joker kullanılamaz';
  end if;
  if v_sinir is not null and v_kullanilan >= v_sinir then
    raise exception 'Bu maçta en fazla % joker kullanabilirsin', v_sinir;
  end if;

  -- SORU DEĞİŞTİR maç başına 1 kez: yoksa oyuncu bildiği soru gelene
  -- kadar değiştirir, joker "sonsuz yeniden dağıtım" olurdu.
  if p_tur = 'soru_degistir' and exists (
    select 1 from public.joker_kullanimlari
    where user_id = v_me and mac_tur = p_mac_tur and mac_id = p_mac_id
      and tur = 'soru_degistir'
  ) then
    raise exception 'Bu maçta soruyu bir kez değiştirebilirsin';
  end if;

  if p_tur = 'elli' and not exists (
    select 1 from public.joker_kullanimlari
    where user_id = v_me and mac_tur = p_mac_tur and mac_id = p_mac_id
      and tur = 'elli' and ucretsiz
  ) then
    v_ucretsiz := true;
  end if;

  if not v_ucretsiz then
    perform public.joker_hareket(v_me, p_tur, -1, 'kullanim', p_mac_tur || ':' || p_mac_id::text);
  end if;

  insert into public.joker_kullanimlari (user_id, mac_tur, mac_id, soru_index, tur, ucretsiz)
  values (v_me, p_mac_tur, p_mac_id, v_aktif_soru, p_tur, v_ucretsiz);

  select q.dogru_cevap into v_dogru from public.questions q where q.id = v_soru_id;

  if p_tur = 'elli' then
    select array_agg(x) into v_kapali from (
      select x from generate_series(0, 3) x
      where x <> v_dogru order by random() limit 2
    ) s;
    return jsonb_build_object('tur','elli','ucretsiz',v_ucretsiz,'kapali',to_jsonb(v_kapali));

  elsif p_tur = 'sure' then
    -- Soru değiştirilmişse sayaç kişisel satırda tutuluyor; onu uzat.
    v_degisti := exists (select 1 from public.soru_degisimleri d
      where d.mac_tur = p_mac_tur and d.mac_id = p_mac_id
        and d.user_id = v_me and d.soru_index = v_aktif_soru);
    if v_degisti then
      update public.soru_degisimleri
         set baslangic = baslangic + interval '10 seconds'
       where mac_tur = p_mac_tur and mac_id = p_mac_id
         and user_id = v_me and soru_index = v_aktif_soru;
    elsif p_mac_tur = '1v1' then
      if coalesce(m.senkron, false) then
        update public.matches set soru_baslangic = soru_baslangic + interval '10 seconds' where id = p_mac_id;
      elsif v_ben_p1 then
        update public.matches set oyuncu1_baslangic = oyuncu1_baslangic + interval '10 seconds' where id = p_mac_id;
      else
        update public.matches set oyuncu2_baslangic = oyuncu2_baslangic + interval '10 seconds' where id = p_mac_id;
      end if;
    elsif p_mac_tur = 'grup' then
      update public.group_matches set soru_baslangic = soru_baslangic + interval '10 seconds' where id = p_mac_id;
    elsif p_mac_tur = 'hizli' then
      update public.hizli_maclar set soru_baslangic = soru_baslangic + interval '10 seconds' where id = p_mac_id;
    else
      update public.tournaments set soru_baslangic = soru_baslangic + interval '10 seconds' where id = p_mac_id;
    end if;
    return jsonb_build_object('tur','sure','ucretsiz',false,'uzatildi',true);

  else -- soru_degistir: soru atlanmaz, yerine yenisi gelir, süre baştan başlar
    v_yeni_soru := public.mac_soru_degistir(p_mac_tur, p_mac_id, v_me, v_aktif_soru);
    select * into v_q from public.questions where id = v_yeni_soru;
    perform public.gorulen_kaydet(v_yeni_soru);
    return jsonb_build_object(
      'tur','soru_degistir','ucretsiz',false,'degisti',true,
      'soru', jsonb_build_object(
        'question_id', v_q.id,
        'soru', v_q.soru,
        'secenekler', v_q.secenekler,
        'soru_index', v_aktif_soru,
        'baslangic', (select d.baslangic from public.soru_degisimleri d
                       where d.mac_tur = p_mac_tur and d.mac_id = p_mac_id
                         and d.user_id = v_me and d.soru_index = v_aktif_soru),
        'sunucu_zamani', now(),
        'dogru_cevap', case when public.hileli_mi() then v_q.dogru_cevap else null end));
  end if;
end;
$function$;

-- ============================================================
-- SORULAR OYUNCUNUN DİLİNDE
--
-- ÖNCE: `question_translations` tablosu ve 7.682 İngilizce çeviri vardı
-- ama HİÇBİR fonksiyon bu tabloya bakmıyordu (ölçüldü: tabloya değen
-- fonksiyon sayısı 0). `soru_sec` yalnız `q.dil = oyuncunun dili` diyordu;
-- kaynak dili İngilizce soru olmadığı için İngilizce oyuncu her zaman
-- 'tr' havuzuna düşüyor ve TÜRKÇE soru görüyordu.
--
-- SONRA iki kural:
--   1. SEÇİM  — bir soru, maçtaki HER oyuncunun dilinde okunabiliyorsa
--      seçilebilir. Çevirisi olmayan soru o oyuncuya hiç sorulmaz;
--      "bulamazsan Türkçesini ver" geri düşüşü KALDIRILDI.
--   2. GÖSTERİM — metin `soru_dilinde()` üzerinden gelir: oyuncunun dili
--      kaynak dilden farklıysa çeviri, değilse özgün metin. Tek yer burası;
--      soru döndüren her RPC bu fonksiyonu çağırır.
--
-- Şık SIRASI çeviride korunuyor (bkz. migration 118 `qt_dogrula`), bu
-- yüzden `dogru_cevap` indeksi çeviride de geçerli — cevap doğrulama
-- mantığının hiçbir yerine dokunulmadı.
-- ============================================================

begin;

-- ------------------------------------------------- 1) oyuncunun dili
create or replace function public.oyuncu_dili(p_user uuid default null)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select nullif(btrim(pr.dil), '') from public.profiles pr
      where pr.id = coalesce(p_user, auth.uid())),
    'tr');
$$;

-- --------------------------------------------- 2) soru metni, o dilde
-- Çeviri yoksa özgün metin döner. Bu bilinçli: seçim katmanı zaten
-- çevirisi olmayan soruyu o oyuncuya vermiyor; buradaki coalesce yalnız
-- eski maçlar ve turnuva gibi ortak havuzlar için ağ emniyeti.
create or replace function public.soru_dilinde(p_question_id uuid, p_dil text default null)
returns table(soru text, secenekler jsonb, dogru_cevap smallint, kategori text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(t.soru, q.soru),
         coalesce(t.secenekler, q.secenekler),
         q.dogru_cevap,
         q.kategori
    from public.questions q
    left join public.question_translations t
      on t.question_id = q.id
     and t.dil = coalesce(nullif(btrim(coalesce(p_dil, '')), ''), 'tr')
     and t.dil <> q.dil
   where q.id = p_question_id;
$$;

-- --------------------------- 3) seçim: herkesin dilinde okunabilen soru
-- `v_diller`: maçtaki oyuncuların dilleri (bot ve silinmiş profil elenir).
-- Bir soru ancak bu dillerin HEPSİNDE okunabiliyorsa havuzda kalır.
create or replace function public.soru_sec(
  p_kategori text,
  p_adet integer,
  p_oyuncular uuid[] default '{}'::uuid[],
  p_dil text default null,
  p_max_okuma integer default null
)
returns uuid[]
language plpgsql
security definer
set search_path to 'public'
as $ss$
declare
  v_oyn uuid[] := coalesce(p_oyuncular, '{}'::uuid[]);
  v_adet int := greatest(1, coalesce(p_adet, 1));
  v_kat text := p_kategori;
  v_diller text[];
  v_max int := p_max_okuma;
  v_ids uuid[] := '{}'::uuid[];
  v_deneme int;
begin
  if nullif(btrim(coalesce(p_dil, '')), '') is not null then
    v_diller := array[btrim(p_dil)];
  else
    select coalesce(array_agg(distinct coalesce(nullif(btrim(pr.dil), ''), 'tr')), array['tr'])
      into v_diller
      from public.profiles pr
     where pr.id = any(v_oyn);
  end if;
  if coalesce(array_length(v_diller, 1), 0) = 0 then v_diller := array['tr']; end if;

  for v_deneme in 1..3 loop
    select coalesce(array_agg(s.id), '{}'::uuid[]) into v_ids
    from (
      select q.id
      from public.questions q
      left join lateral (
        select max(g.gorulen_at) as son
        from public.gorulen_sorular g
        where g.question_id = q.id and g.user_id = any(v_oyn)
      ) gs on true
      where q.aktif
        and q.zorluk >= 2
        and (v_kat is null or q.kategori = v_kat)
        -- HER oyuncunun dilinde okunabilmeli: ya kaynak dil o dil,
        -- ya da o dilde çevirisi var. Aksi halde soru havuzda yok.
        and not exists (
          select 1 from unnest(v_diller) d
           where d <> q.dil
             and not exists (
               select 1 from public.question_translations t
                where t.question_id = q.id and t.dil = d
             )
        )
        and (
          v_max is null
          or length(q.soru)
             + (select coalesce(sum(length(x)), 0)
                  from jsonb_array_elements_text(q.secenekler) x) <= v_max
        )
      order by (gs.son is not null), gs.son asc, random()
      limit v_adet
    ) s;

    exit when coalesce(array_length(v_ids, 1), 0) >= v_adet;

    -- Havuz genişletme SIRASI: önce okuma yükü, sonra kategori.
    -- DİL ARTIK GEVŞETİLMİYOR — oyuncuya anlamadığı dilde soru sormaktansa
    -- havuz dar kalsın (görev kararı: "çevirisi olmayan soru sorulmasın").
    if v_max is not null then
      v_max := null;
    elsif v_kat is not null then
      v_kat := null;
    else
      exit;
    end if;
  end loop;

  return v_ids;
end;
$ss$;

-- ------------------------------ 4) "Soru Değiştir" jokeri de aynı kurala
create or replace function public.mac_soru_degistir(
  p_mac_tur text, p_mac_id uuid, p_user uuid, p_index integer
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $msd$
declare
  v_haric uuid[];
  v_kategori text;
  v_oyuncular uuid[] := array[p_user];
  v_yeni uuid;
begin
  if p_mac_tur = '1v1' then
    select m.soru_ids, m.kategori, array[m.oyuncu1, m.oyuncu2]
      into v_haric, v_kategori, v_oyuncular
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

  -- Yeni soruyu `soru_sec` seçiyor: dil kuralı tek yerde kalsın.
  select s.id into v_yeni
    from unnest(public.soru_sec(v_kategori, 25, coalesce(v_oyuncular, array[p_user]))) s(id)
   where s.id <> all(v_haric)
   limit 1;

  if v_yeni is null then
    select s.id into v_yeni
      from unnest(public.soru_sec(null, 25, coalesce(v_oyuncular, array[p_user]))) s(id)
     where s.id <> all(v_haric)
     limit 1;
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
$msd$;

-- ---------------------------------- 5) turnuva havuzu: İngilizce şartı
-- Turnuva sorusu HERKESE aynı anda sorulur; kim katılacağı önceden belli
-- değil. Bu yüzden turnuvaya yalnız İngilizce çevirisi olan sorular girer
-- (şu an tek çeviri dili İngilizce; 7.682 soru var, turnuvaya 20 lazım).
create or replace function public.turnuva_soru_sec(p_adet integer, p_dil text default 'tr')
returns uuid[]
language plpgsql
security definer
set search_path to 'public'
as $tss$
declare
  v_ids uuid[] := '{}'::uuid[];
  v_parca uuid[];
  v_bant int[][] := array[array[1,2], array[3,3], array[4,5]];
  v_i int;
  v_alt int; v_ust int; v_istenen int; v_kalan int;
  v_genislet int;
begin
  for v_i in 1..3 loop
    v_alt := v_bant[v_i][1];
    v_ust := v_bant[v_i][2];
    v_istenen := case
      when v_i = 1 then least(5, p_adet)
      when v_i = 2 then least(5, greatest(0, p_adet - 5))
      else greatest(0, p_adet - 10)
    end;
    if v_istenen <= 0 then continue; end if;

    for v_genislet in 0..4 loop
      select coalesce(array_agg(s.id), '{}'::uuid[]) into v_parca
      from (
        select q.id from public.questions q
        where q.aktif and q.dil = coalesce(p_dil, 'tr')
          and exists (select 1 from public.question_translations t
                       where t.question_id = q.id and t.dil = 'en')
          and q.zorluk between greatest(1, v_alt - v_genislet) and least(5, v_ust + v_genislet)
          and q.id <> all(v_ids)
        order by random()
        limit v_istenen
      ) s;
      exit when coalesce(array_length(v_parca, 1), 0) >= v_istenen;
    end loop;

    v_ids := v_ids || coalesce(v_parca, '{}'::uuid[]);
  end loop;

  -- Havuz yine de yetmediyse kalanı serbest doldur (turnuva bozulmasın).
  v_kalan := p_adet - coalesce(array_length(v_ids, 1), 0);
  if v_kalan > 0 then
    select coalesce(array_agg(s.id), '{}'::uuid[]) into v_parca
    from (
      select q.id from public.questions q
      where q.aktif
        and exists (select 1 from public.question_translations t
                     where t.question_id = q.id and t.dil = 'en')
        and q.id <> all(v_ids)
      order by random() limit v_kalan
    ) s;
    v_ids := v_ids || coalesce(v_parca, '{}'::uuid[]);
  end if;

  return v_ids;
end;
$tss$;

-- ============================================================
-- 6) GÖSTERİM: soru döndüren her RPC metni `soru_dilinde()`den alır.
--    Gövdelerin geri kalanı değişmedi; yalnız son `return query`
--    bloklarındaki `q.soru / q.secenekler` yerini `sd.*` aldı.
-- ============================================================

create or replace function public.get_match_question(p_match_id uuid)
returns table(question_id uuid, soru text, secenekler jsonb, soru_index integer,
              baslangic timestamptz, sunucu_zamani timestamptz, dogru_cevap smallint)
language plpgsql
security definer
set search_path to 'public'
as $gmq$
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

  v_soru_id := public.soru_id_coz('1v1', p_match_id, auth.uid(), v_index, m.soru_ids[v_index + 1]);
  v_bas := public.soru_baslangic_coz('1v1', p_match_id, auth.uid(), v_index, v_bas);

  perform public.gorulen_kaydet(v_soru_id);

  return query
    select v_soru_id, sd.soru, sd.secenekler, v_index, v_bas, now(),
           case when public.hileli_mi() then sd.dogru_cevap else null end
    from public.soru_dilinde(v_soru_id, public.oyuncu_dili()) sd;
end;
$gmq$;

create or replace function public.get_group_match_question(p_group_match_id uuid)
returns table(question_id uuid, soru text, secenekler jsonb, soru_index integer,
              baslangic timestamptz, sunucu_zamani timestamptz, dogru_cevap smallint)
language plpgsql
security definer
set search_path to 'public'
as $ggq$
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
    select v_soru_id, sd.soru, sd.secenekler, gm.aktif_soru, v_bas, now(),
           case when public.hileli_mi() then sd.dogru_cevap else null end
    from public.soru_dilinde(v_soru_id, public.oyuncu_dili()) sd;
end;
$ggq$;

create or replace function public.get_tournament_question(p_tournament_id uuid)
returns table(question_id uuid, soru text, secenekler jsonb, soru_index integer,
              baslangic timestamptz, sunucu_zamani timestamptz, dogru_cevap smallint,
              altin boolean)
language plpgsql
security definer
set search_path to 'public'
as $gtq$
declare
  t public.tournaments%rowtype;
  v_soru_id uuid;
begin
  select * into t from public.tournaments where id = p_tournament_id;
  if not found then raise exception 'Turnuva bulunamadı'; end if;
  if t.durum <> 'aktif' or t.aktif_soru < 0 then raise exception 'Turnuva aktif değil'; end if;

  v_soru_id := t.soru_ids[t.aktif_soru + 1];
  perform public.gorulen_kaydet(v_soru_id);

  return query
    select v_soru_id, sd.soru, sd.secenekler, t.aktif_soru, t.soru_baslangic, now(),
           case when public.hileli_mi() then sd.dogru_cevap else null end,
           coalesce(t.altin_soru, false)
    from public.soru_dilinde(v_soru_id, public.oyuncu_dili()) sd;
end;
$gtq$;

create or replace function public.get_hizli_soru(p_hizli_mac_id uuid)
returns table(question_id uuid, soru text, secenekler jsonb, soru_index integer,
              baslangic timestamptz, sunucu_zamani timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $ghs$
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
    select v_soru_id, sd.soru, sd.secenekler, hm.aktif_soru, v_bas, now()
    from public.soru_dilinde(v_soru_id, public.oyuncu_dili()) sd;
end;
$ghs$;

create or replace function public.hizli_mod_soru(p_oturum_id uuid)
returns table(question_id uuid, soru text, secenekler jsonb, soru_index integer,
              baslangic timestamptz, sunucu_zamani timestamptz, kalan_toplam_sn integer)
language plpgsql
security definer
set search_path to 'public'
as $hms$
declare
  o public.hizli_mod_oturumlar%rowtype;
  v_kalan int;
  v_soru_id uuid;
begin
  select * into o from public.hizli_mod_oturumlar where id = p_oturum_id;
  if not found then raise exception 'Oturum bulunamadı'; end if;
  if o.user_id <> auth.uid() then raise exception 'Bu oturum senin değil'; end if;
  if o.durum <> 'aktif' then raise exception 'Oturum bitti'; end if;

  v_kalan := greatest(0, 60 - floor(extract(epoch from (now() - o.baslangic)))::int);
  if v_kalan <= 0 then
    perform public.hizli_mod_bitir(p_oturum_id);
    raise exception 'Süre doldu';
  end if;

  v_soru_id := o.soru_ids[o.aktif_soru + 1];
  perform public.gorulen_kaydet(v_soru_id);

  return query
    select v_soru_id, sd.soru, sd.secenekler, o.aktif_soru, o.soru_baslangic, now(), v_kalan
    from public.soru_dilinde(v_soru_id, public.oyuncu_dili()) sd;
end;
$hms$;

create or replace function public.calisma_soru(p_oturum_id uuid)
returns table(question_id uuid, soru text, secenekler jsonb, kategori text,
              soru_index integer, toplam integer, bankadan boolean,
              onceki_yanlis integer, dogru_serisi integer,
              baslangic timestamptz, sunucu_zamani timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $cs$
declare
  o public.calisma_oturumlari%rowtype;
  v_qid uuid;
  v_bankadan boolean;
  v_yanlis int := 0;
  v_seri int := 0;
begin
  select * into o from public.calisma_oturumlari where id = p_oturum_id;
  if not found then raise exception 'Oturum bulunamadı'; end if;
  if o.user_id <> auth.uid() then raise exception 'Bu oturum senin değil'; end if;
  if o.durum <> 'aktif' then raise exception 'Oturum bitti'; end if;
  if o.aktif_soru >= coalesce(array_length(o.soru_ids, 1), 0) then
    raise exception 'Tur bitti';
  end if;

  v_qid := o.soru_ids[o.aktif_soru + 1];
  v_bankadan := v_qid = any(o.banka_ids);

  select ys.yanlis_sayisi, ys.dogru_serisi into v_yanlis, v_seri
  from public.yanlis_sorular ys
  where ys.user_id = o.user_id and ys.question_id = v_qid;

  update public.calisma_oturumlari set soru_baslangic = now() where id = p_oturum_id;

  return query
  select v_qid, sd.soru, sd.secenekler, sd.kategori,
         o.aktif_soru,
         coalesce(array_length(o.soru_ids, 1), 0),
         v_bankadan,
         coalesce(v_yanlis, 0),
         coalesce(v_seri, 0),
         now(), now()
  from public.soru_dilinde(v_qid, public.oyuncu_dili()) sd;
end;
$cs$;

-- "Soru Değiştir" jokerinin döndürdüğü YENİ SORU da oyuncunun dilinde
-- olmalı. Gövdenin geri kalanı canlıdaki hâliyle birebir aynı; yalnız
-- questions okuması soru_dilinde() ile değişti.
create or replace function public.joker_kullan(p_mac_tur text, p_mac_id uuid, p_soru_index integer, p_tur text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
as $jk$
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
  v_q record;   -- soru_dilinde(): oyuncunun dilindeki metin
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
    -- Metin oyuncunun dilinde (bkz. migration 163 soru_dilinde)
    select v_yeni_soru as id, sd.soru, sd.secenekler, sd.dogru_cevap into v_q
      from public.soru_dilinde(v_yeni_soru, public.oyuncu_dili()) sd;
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
$jk$;

grant execute on function public.oyuncu_dili(uuid) to authenticated;
grant execute on function public.soru_dilinde(uuid, text) to authenticated;

commit;

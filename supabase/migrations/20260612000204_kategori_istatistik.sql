-- ============================================================
-- 204 — KATEGORİ İSTATİSTİĞİ + BOT KİŞİLİKLERİ (Paket 14, aşama 4.8 / 4.9)
--
-- ÖLÇÜLEN: kategori_dogru yalnız doğru sayısını tutuyor (deneme yok → yüzde
-- hesaplanamaz); match_answers'ta kategori kolonu yok (matches.soru_ids →
-- questions.kategori üzerinden bulunuyor).
--
-- · kategori_istatistik (user × kategori → dogru, toplam): TÜM modlarda her
--   cevapta güncellenir. Botlar da AYNI tabloya yazar (ayrı sahte sistem yok).
-- · oyuncu_istatistik.istatistikli_mac: istatistiği olan maç sayısı
--   (oyuncu kartında "N maç · M maçın istatistiği").
-- · bot_kategori_sapma: bot başına kişilik — 2 güçlü (+15/+20), 2 zayıf
--   (−20/−25), gerisi ±3. Tohum bot kimliğinden (bot_rasgele), her botta farklı.
-- · bot_kategori_isabet: botlar cevap verirken KATEGORİYE GÖRE isabet kullanır
--   (1v1, grup, turnuva, hızlı maç, düello). Profil hem görünen hem gerçek.
-- · Geriye doldurma: match_answers + group_match_answers + tournament_answers
--   + hizli_cevaplar → soru_ids → questions.kategori.
-- · Botların simüle edilen maçları (bot_puan_tik, toplam_mac artıyor) da
--   kişiliğe göre istatistik üretir; yoksa "300 maç, istatistik yok" botu ele verirdi.
-- Tablolar istemciye kapalı; okuma security definer RPC ile (oyuncu_kategori_profili).
-- ============================================================

insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('kategori_istatistik_min_ornek', '10', 'Kategori yüzdesi için asgari soru sayısı'),
  ('unvan_min_mac', '10', 'Kategori unvanının açılması için istatistikli maç sayısı'),
  ('bot_guclu_sapma_min', '15', 'Bot güçlü kategori: isabet +min puan'),
  ('bot_guclu_sapma_max', '20', 'Bot güçlü kategori: isabet +max puan'),
  ('bot_zayif_sapma_min', '20', 'Bot zayıf kategori: isabet −min puan'),
  ('bot_zayif_sapma_max', '25', 'Bot zayıf kategori: isabet −max puan'),
  ('bot_diger_sapma', '3', 'Bot diğer kategoriler: ±bu kadar puan'),
  ('bot_simule_soru_mac', '10', 'Botun simüle maçında istatistiğe yazılan soru sayısı')
on conflict (anahtar) do nothing;

create table if not exists public.kategori_istatistik (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kategori text not null,
  dogru int not null default 0,
  toplam int not null default 0,
  guncellendi timestamptz not null default now(),
  primary key (user_id, kategori)
);
alter table public.kategori_istatistik enable row level security;
revoke all on public.kategori_istatistik from anon, authenticated;

create table if not exists public.oyuncu_istatistik (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  istatistikli_mac int not null default 0
);
alter table public.oyuncu_istatistik enable row level security;
revoke all on public.oyuncu_istatistik from anon, authenticated;

create table if not exists public.bot_kategori_sapma (
  bot_id uuid not null references public.profiles(id) on delete cascade,
  kategori text not null,
  sapma numeric not null,
  primary key (bot_id, kategori)
);
alter table public.bot_kategori_sapma enable row level security;
revoke all on public.bot_kategori_sapma from anon, authenticated;

-- ---- yazıcılar ----
create or replace function public.kategori_istatistik_yaz(p_user uuid, p_kategori text, p_dogru boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null or p_kategori is null then return; end if;
  insert into public.kategori_istatistik (user_id, kategori, dogru, toplam)
  values (p_user, p_kategori, case when coalesce(p_dogru, false) then 1 else 0 end, 1)
  on conflict (user_id, kategori) do update
    set dogru = public.kategori_istatistik.dogru + (case when coalesce(p_dogru, false) then 1 else 0 end),
        toplam = public.kategori_istatistik.toplam + 1,
        guncellendi = now();
end;
$$;
revoke execute on function public.kategori_istatistik_yaz(uuid, text, boolean) from public, anon, authenticated;

create or replace function public.istatistikli_mac_arttir(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null then return; end if;
  insert into public.oyuncu_istatistik (user_id, istatistikli_mac) values (p_user, 1)
  on conflict (user_id) do update set istatistikli_mac = public.oyuncu_istatistik.istatistikli_mac + 1;
end;
$$;
revoke execute on function public.istatistikli_mac_arttir(uuid) from public, anon, authenticated;

-- ---- bot kişiliği ----
create or replace function public.bot_kisilik_tohumla(p_bot uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_katlar text[];
  v_i int;
  v_n int;
  v_r double precision;
  v_sapma numeric;
begin
  if p_bot is null then return; end if;
  if exists (select 1 from public.bot_kategori_sapma where bot_id = p_bot) then return; end if;

  -- Kategoriler bota özel tohumla sıralanır: ilk 2 güçlü, son 2 zayıf.
  select array_agg(k order by public.bot_rasgele('kisilik:' || p_bot::text || ':' || k)) into v_katlar
    from (select distinct kategori as k from public.questions where aktif and kategori is not null) s;
  v_n := coalesce(array_length(v_katlar, 1), 0);

  for v_i in 1..v_n loop
    v_r := public.bot_rasgele('sapma:' || p_bot::text || ':' || v_katlar[v_i]);
    if v_i <= 2 then
      v_sapma := public.ayar_sayi('bot_guclu_sapma_min', 15)
        + v_r * (public.ayar_sayi('bot_guclu_sapma_max', 20) - public.ayar_sayi('bot_guclu_sapma_min', 15));
    elsif v_i > v_n - 2 then
      v_sapma := -(public.ayar_sayi('bot_zayif_sapma_min', 20)
        + v_r * (public.ayar_sayi('bot_zayif_sapma_max', 25) - public.ayar_sayi('bot_zayif_sapma_min', 20)));
    else
      v_sapma := (v_r * 2 - 1) * public.ayar_sayi('bot_diger_sapma', 3);
    end if;
    insert into public.bot_kategori_sapma (bot_id, kategori, sapma)
    values (p_bot, v_katlar[v_i], round(v_sapma, 1))
    on conflict do nothing;
  end loop;
end;
$$;
revoke execute on function public.bot_kisilik_tohumla(uuid) from public, anon, authenticated;

create or replace function public.bot_kategori_isabet(p_bot uuid, p_kategori text)
returns double precision
language plpgsql
security definer
set search_path = public
as $$
declare
  v_taban double precision;
  v_sapma numeric;
begin
  select coalesce(bot_isabet, 0.6) into v_taban from public.profiles where id = p_bot;
  if v_taban is null then return 0.6; end if;
  if v_taban > 1 then v_taban := v_taban / 100.0; end if;

  select s.sapma into v_sapma from public.bot_kategori_sapma s
   where s.bot_id = p_bot and s.kategori = p_kategori;
  if not found and not exists (select 1 from public.bot_kategori_sapma where bot_id = p_bot) then
    perform public.bot_kisilik_tohumla(p_bot);
    select s.sapma into v_sapma from public.bot_kategori_sapma s
     where s.bot_id = p_bot and s.kategori = p_kategori;
  end if;

  return least(0.98, greatest(0.05, v_taban + coalesce(v_sapma, 0) / 100.0));
end;
$$;
revoke execute on function public.bot_kategori_isabet(uuid, text) from public, anon, authenticated;

-- Bot simüle maçı: kişiliğe göre N soruluk istatistik
create or replace function public.bot_mac_istatistik_simule(p_bot uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_katlar text[];
  v_i int;
  v_kat text;
begin
  select array_agg(distinct kategori) into v_katlar from public.questions where aktif and kategori is not null;
  if coalesce(array_length(v_katlar, 1), 0) = 0 then return; end if;
  for v_i in 1..public.ayar_sayi('bot_simule_soru_mac', 10)::int loop
    v_kat := v_katlar[1 + floor(random() * array_length(v_katlar, 1))::int];
    perform public.kategori_istatistik_yaz(p_bot, v_kat, random() < public.bot_kategori_isabet(p_bot, v_kat));
  end loop;
  perform public.istatistikli_mac_arttir(p_bot);
end;
$$;
revoke execute on function public.bot_mac_istatistik_simule(uuid) from public, anon, authenticated;

-- ---- cevap tetikleyicileri (tüm modlar; botlar dahil) ----
create or replace function public.trg_istatistik_1v1()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_kat text;
begin
  select q.kategori into v_kat
    from public.matches m
    join public.questions q on q.id = public.soru_id_coz('1v1', m.id, new.user_id, new.soru_index, m.soru_ids[new.soru_index + 1])
   where m.id = new.match_id;
  perform public.kategori_istatistik_yaz(new.user_id, v_kat, new.dogru);
  return new;
end $$;

create or replace function public.trg_istatistik_grup()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_kat text;
begin
  select q.kategori into v_kat
    from public.group_matches g
    join public.questions q on q.id = public.soru_id_coz('grup', g.id, new.user_id, new.soru_index, g.soru_ids[new.soru_index + 1])
   where g.id = new.group_match_id;
  perform public.kategori_istatistik_yaz(new.user_id, v_kat, new.dogru);
  return new;
end $$;

create or replace function public.trg_istatistik_turnuva()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_kat text;
begin
  select q.kategori into v_kat
    from public.tournaments t
    join public.questions q on q.id = t.soru_ids[new.soru_index + 1]
   where t.id = new.tournament_id;
  perform public.kategori_istatistik_yaz(new.user_id, v_kat, new.dogru);
  return new;
end $$;

create or replace function public.trg_istatistik_hizli()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_kat text;
begin
  select q.kategori into v_kat
    from public.hizli_maclar h
    join public.questions q on q.id = public.soru_id_coz('hizli', h.id, new.user_id, new.soru_index, h.soru_ids[new.soru_index + 1])
   where h.id = new.hizli_mac_id;
  perform public.kategori_istatistik_yaz(new.user_id, v_kat, new.dogru);
  return new;
end $$;

drop trigger if exists trg_match_answers_istatistik on public.match_answers;
create trigger trg_match_answers_istatistik after insert on public.match_answers
  for each row execute function public.trg_istatistik_1v1();
drop trigger if exists trg_group_answers_istatistik on public.group_match_answers;
create trigger trg_group_answers_istatistik after insert on public.group_match_answers
  for each row execute function public.trg_istatistik_grup();
drop trigger if exists trg_tournament_answers_istatistik on public.tournament_answers;
create trigger trg_tournament_answers_istatistik after insert on public.tournament_answers
  for each row execute function public.trg_istatistik_turnuva();
drop trigger if exists trg_hizli_cevaplar_istatistik on public.hizli_cevaplar;
create trigger trg_hizli_cevaplar_istatistik after insert on public.hizli_cevaplar
  for each row execute function public.trg_istatistik_hizli();

-- ---- istatistikli maç sayacı: maç bitince, o maçta cevabı olanlara ----
create or replace function public.trg_istatistikli_mac_1v1()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.durum = 'bitti' and coalesce(old.durum, '') <> 'bitti' then
    for r in select distinct a.user_id from public.match_answers a where a.match_id = new.id loop
      perform public.istatistikli_mac_arttir(r.user_id);
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists trg_matches_istatistikli_mac on public.matches;
create trigger trg_matches_istatistikli_mac after update of durum on public.matches
  for each row execute function public.trg_istatistikli_mac_1v1();

create or replace function public.trg_istatistikli_mac_grup()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.durum = 'bitti' and coalesce(old.durum, '') <> 'bitti' then
    for r in select distinct a.user_id from public.group_match_answers a where a.group_match_id = new.id loop
      perform public.istatistikli_mac_arttir(r.user_id);
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists trg_group_matches_istatistikli_mac on public.group_matches;
create trigger trg_group_matches_istatistikli_mac after update of durum on public.group_matches
  for each row execute function public.trg_istatistikli_mac_grup();

create or replace function public.trg_istatistikli_mac_turnuva()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.durum = 'bitti' and coalesce(old.durum, '') <> 'bitti' then
    for r in select distinct a.user_id from public.tournament_answers a where a.tournament_id = new.id loop
      perform public.istatistikli_mac_arttir(r.user_id);
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists trg_tournaments_istatistikli_mac on public.tournaments;
create trigger trg_tournaments_istatistikli_mac after update of durum on public.tournaments
  for each row execute function public.trg_istatistikli_mac_turnuva();

create or replace function public.trg_istatistikli_mac_hizli_mod()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.durum = 'bitti' and coalesce(old.durum, '') <> 'bitti' and (new.dogru + new.yanlis) > 0 then
    perform public.istatistikli_mac_arttir(new.user_id);
  end if;
  return new;
end $$;
drop trigger if exists trg_hizli_mod_istatistikli_mac on public.hizli_mod_oturumlar;
create trigger trg_hizli_mod_istatistikli_mac after update of durum on public.hizli_mod_oturumlar
  for each row execute function public.trg_istatistikli_mac_hizli_mod();

-- Yeni bot → kişilik
create or replace function public.trg_bot_kisilik()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.is_bot, false) then
    perform public.bot_kisilik_tohumla(new.id);
  end if;
  return new;
end $$;
drop trigger if exists trg_profiles_bot_kisilik on public.profiles;
create trigger trg_profiles_bot_kisilik after insert on public.profiles
  for each row execute function public.trg_bot_kisilik();

CREATE OR REPLACE FUNCTION public.hizli_mod_cevap(p_oturum_id uuid, p_soru_index integer, p_cevap smallint)
 RETURNS TABLE(dogru boolean, dogru_cevap smallint, skor integer, kalan_toplam_sn integer, bitti boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  o public.hizli_mod_oturumlar%rowtype;
  q public.questions%rowtype;
  v_dogru boolean;
  v_kalan int;
  v_bitti boolean := false;
  v_sure int := public.ayar_sayi('hizli_mod_sure_sn', 90)::int;
  v_soru_sure int := public.ayar_sayi('hizli_mod_soru_sure_sn', 10)::int;
begin
  -- Hız sınırı: yalnız kullanıcı tetikli çağrılar (bkz. migration 115).
  perform public.hiz_siniri('hizli_mod_cevap', 60, interval '60 seconds');
  select * into o from public.hizli_mod_oturumlar where id = p_oturum_id for update;
  if not found then raise exception 'Oturum bulunamadı'; end if;
  if o.user_id <> auth.uid() then raise exception 'Bu oturum senin değil'; end if;
  if o.durum <> 'aktif' then raise exception 'Oturum bitti'; end if;
  if p_soru_index <> o.aktif_soru then raise exception 'Soru değişti'; end if;

  v_kalan := greatest(0, v_sure - floor(extract(epoch from (now() - o.baslangic)))::int);

  select * into q from public.questions where id = o.soru_ids[o.aktif_soru + 1];

  -- Soru başına süre + 1 sn ağ payı; süre geçtiyse yanlış sayılır
  if now() > o.soru_baslangic + make_interval(secs => v_soru_sure + 1) then
    v_dogru := false;
  else
    v_dogru := (p_cevap = q.dogru_cevap);
    -- Zorluk kalibrasyonu: dogru oranini biriktir (bkz. migration 147).
    perform public.soru_sayac(q.id, v_dogru);
  end if;

  -- Kategori istatistiği (deneme + doğru; Paket 14, 4.8)
  perform public.kategori_istatistik_yaz(auth.uid(), q.kategori, v_dogru);

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


CREATE OR REPLACE FUNCTION public.bot_oyna()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  q public.questions%rowtype;
  v_cevap smallint;
  v_dogru boolean;
  v_puan int;
  v_ilk boolean;
  v_bot_index int;
  v_tepkiler text[] := array['👍','😂','😮','🔥','😎','Hadi bakalım!','Bunu biliyordum!','Vay be! 🤯'];
begin
  -- 1) Botlara gelen meydan okumaları kabul et (kategoriye saygılı)
  for r in
    select m.id, m.kategori, m.oyuncu1 from public.matches m
    join public.profiles p on p.id = m.oyuncu2 and p.is_bot
    where m.durum = 'bekliyor'
      -- GİZLİ bot daveti hemen kabul etmez: insan gibi biraz düşünür.
      -- Açık bot (adı "...Bot") anında kabul eder, oyuncu zaten biliyor.
      and public.bot_daveti_kabul_etti_mi(p.id, m.created_at, m.id::text,
                                          coalesce(p.bot_turu, 'acik'))
    for update of m skip locked
  loop
    update public.matches
       set durum = 'aktif',
           soru_ids = public.soru_sec(r.kategori, 20, array[r.oyuncu1]),
           aktif_soru = 0,
           soru_baslangic = now(),
           kabul_at = now()
     where id = r.id;
  end loop;

  -- 2) Aktif maçlarda cevapla — bot ASLA oyuncunun önüne geçmez.
  --    Bot yalnızca oyuncunun ulaştığı soruyu cevaplar (oyuncunun cevapladığı
  --    en yüksek indeks + 1) ve 2-6 sn arası rastgele gecikmeyle yanıtlar.
  --    (Eski davranış: 3 sn sonra her soruyu cevaplıyordu; 16 sn'lik otomatik
  --     ilerletmeyle birleşince bot 20 soruyu bitirirken oyuncu 2. sorudaydı.)
  for r in
    select m.*, p.id as bot_id, p.bot_isabet,
           case when m.oyuncu1 = p.id then m.oyuncu2 else m.oyuncu1 end as insan_id
    from public.matches m
    join public.profiles p on p.is_bot and p.id in (m.oyuncu1, m.oyuncu2)
    where m.durum = 'aktif'
      -- Botun sira indeksi. SENKRONDA ortak soru (aktif_soru) ile ayni olmali:
      -- bot cevapladiginda kendi indeksi bir ilerler ve sira ortak indeksten
      -- one gecer; boylece ayni soruyu ikinci kez cevaplamaz (cift puan yok).
      and (case when m.oyuncu1 = p.id then m.oyuncu1_soru else m.oyuncu2_soru end)
          < coalesce(array_length(m.soru_ids, 1), 0)
      and (
        not coalesce(m.senkron, false)
        or (m.basladi
            and (case when m.oyuncu1 = p.id then m.oyuncu1_soru else m.oyuncu2_soru end)
                = m.aktif_soru)
      )
      -- Bot, insan oyuncunun ulaştığı sırayı GEÇEMEZ
      and (case when m.oyuncu1 = p.id then m.oyuncu1_soru else m.oyuncu2_soru end)
          <= (case when m.oyuncu1 = p.id then m.oyuncu2_soru else m.oyuncu1_soru end)
      -- 2-6 sn rastgele gecikme (insanın son hamlesinden sonra)
      -- Gecikme artik ZORLUGA BAGLI ve SORU BASINA SABIT (bkz. bot_gecikme_sn).
      and now() >= coalesce(m.soru_baslangic, m.created_at)
                   + public.bot_gecikme_sn(
                       p.id,
                       m.id::text || ':' ||
                       (case when m.oyuncu1 = p.id then m.oyuncu1_soru else m.oyuncu2_soru end)::text,
                       p.bot_gecikme_min, p.bot_gecikme_max,
                       public.soru_okuma_yuku(
                         m.soru_ids[(case when m.oyuncu1 = p.id
                                          then m.oyuncu1_soru else m.oyuncu2_soru end) + 1])
                     ) * interval '1 second'
    for update of m skip locked
  loop
    v_bot_index := case when r.oyuncu1 = r.bot_id then r.oyuncu1_soru else r.oyuncu2_soru end;
    select * into q from public.questions where id = r.soru_ids[v_bot_index + 1];
    if not found then continue; end if;

    if random() < public.bot_kategori_isabet(r.bot_id, q.kategori) then
      v_cevap := q.dogru_cevap;
    else
      select x into v_cevap from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 1;
    end if;
    v_dogru := (v_cevap = q.dogru_cevap);

    insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, v_bot_index, v_cevap, v_dogru)
    on conflict do nothing;

    -- HIZ BONUSU YOK: bot da insanla ayni sabit puani alir
    v_puan := case when v_dogru then 10 else 0 end;

    if r.oyuncu1 = r.bot_id then
      update public.matches
         set oyuncu1_skor = oyuncu1_skor + v_puan,
             oyuncu1_soru = v_bot_index + 1,
             oyuncu1_bitti_at = case
               when v_bot_index + 1 >= coalesce(array_length(r.soru_ids,1),0) then now()
               else oyuncu1_bitti_at end,
             aktif_soru = case when coalesce(r.senkron, false)
                               then aktif_soru else greatest(aktif_soru, v_bot_index + 1) end,
             soru_baslangic = case when coalesce(r.senkron, false)
                                   then soru_baslangic else now() end
       where id = r.id;
    else
      update public.matches
         set oyuncu2_skor = oyuncu2_skor + v_puan,
             oyuncu2_soru = v_bot_index + 1,
             oyuncu2_bitti_at = case
               when v_bot_index + 1 >= coalesce(array_length(r.soru_ids,1),0) then now()
               else oyuncu2_bitti_at end,
             aktif_soru = case when coalesce(r.senkron, false)
                               then aktif_soru else greatest(aktif_soru, v_bot_index + 1) end,
             soru_baslangic = case when coalesce(r.senkron, false)
                                   then soru_baslangic else now() end
       where id = r.id;
    end if;

    perform public.advance_match(r.id);

    if random() < 0.15 then
      insert into public.match_messages (match_id, user_id, mesaj)
      values (r.id, r.bot_id, v_tepkiler[1 + floor(random() * array_length(v_tepkiler, 1))::int]);
    end if;
  end loop;

  -- 3) Bot maçlarını ilerlet — oyuncu cevaplamadan 16 sn'de ilerletme.
  --    İki koşuldan biri: (a) her ikisi de cevapladı, (b) süre doldu VE oyuncu
  --    bu soruyu cevapladı. Oyuncu maçı terk ederse 90 sn'lik güvenlik ağı
  --    devreye girer (maç sonsuza kadar aktif kalmasın).
  for r in
    select distinct m.id from public.matches m
    join public.profiles p on p.is_bot and p.id in (m.oyuncu1, m.oyuncu2)
    where m.durum = 'aktif'
      and (not coalesce(m.senkron, false) or m.basladi)
      and (
        2 <= (select count(*) from public.match_answers a
              where a.match_id = m.id and a.soru_index = m.aktif_soru)
        or (now() > m.soru_baslangic + interval '16 seconds'
            and exists (
              select 1 from public.match_answers a
              where a.match_id = m.id and a.soru_index = m.aktif_soru
                and a.user_id = (case when m.oyuncu1 = p.id then m.oyuncu2 else m.oyuncu1 end)
            ))
        or now() > m.soru_baslangic + interval '90 seconds'
      )
  loop
    perform public.advance_match(r.id);
  end loop;

  -- 4) Turnuvada hayatta olan botlar cevaplasın
  for r in
    select t.*, p.id as bot_id, p.bot_isabet
    from public.tournaments t
    join public.tournament_players tp on tp.tournament_id = t.id and not tp.elendi
    join public.profiles p on p.id = tp.user_id and p.is_bot
    where t.durum = 'aktif'
      -- Gecikme BOTA OZEL (bkz. bot_gecikme_sn): acik botlar aninda,
      -- gizli botlar lig seviyelerine uygun gercekci surede cevaplar.
      and now() >= t.soru_baslangic + public.bot_gecikme_sn(
            p.id, t.id::text || ':' || t.aktif_soru::text,
            p.bot_gecikme_min, p.bot_gecikme_max,
            public.soru_okuma_yuku(t.soru_ids[t.aktif_soru + 1])) * interval '1 second'
      and now() <= t.soru_baslangic + interval '15 seconds'
      and not exists (
        select 1 from public.tournament_answers ta
        where ta.tournament_id = t.id and ta.user_id = p.id and ta.soru_index = t.aktif_soru
      )
  loop
    select * into q from public.questions where id = r.soru_ids[r.aktif_soru + 1];
    if not found then continue; end if;

    if random() < public.bot_kategori_isabet(r.bot_id, q.kategori) then
      v_cevap := q.dogru_cevap;
    else
      select x into v_cevap from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 1;
    end if;
    v_dogru := (v_cevap = q.dogru_cevap);

    insert into public.tournament_answers (tournament_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, r.aktif_soru, v_cevap, v_dogru)
    on conflict do nothing;

    if v_dogru then
      update public.tournament_players
         set dogru_sayisi = dogru_sayisi + 1
       where tournament_id = r.id and user_id = r.bot_id;
    end if;
  end loop;

  -- 5) Turnuvaları ilerlet (süre dolduysa veya hayattaki herkes cevapladıysa)
  for r in
    select t.id from public.tournaments t
    where t.durum = 'aktif'
      and (now() > t.soru_baslangic + interval '16 seconds'
        or not exists (
          select 1 from public.tournament_players tp
          where tp.tournament_id = t.id and not tp.elendi
            and not exists (
              select 1 from public.tournament_answers ta
              where ta.tournament_id = t.id
                and ta.user_id = tp.user_id
                and ta.soru_index = t.aktif_soru
            )
        ))
  loop
    perform public.advance_tournament(r.id);
  end loop;

  -- 6) Botlara giden grup davetlerini kabul et
  for r in
    select gmp.group_match_id, gmp.user_id as bot_id
    from public.group_match_players gmp
    join public.profiles p on p.id = gmp.user_id and p.is_bot
    join public.group_matches gm on gm.id = gmp.group_match_id
    where gm.durum = 'bekliyor' and gmp.davet_durumu = 'bekliyor'
      and public.bot_daveti_kabul_etti_mi(p.id, gmp.joined_at, gmp.group_match_id::text,
                                          coalesce(p.bot_turu, 'acik'))
    for update of gmp skip locked
  loop
    update public.group_match_players
       set davet_durumu = 'kabul'
     where group_match_id = r.group_match_id and user_id = r.bot_id;
  end loop;

  -- 7) Herkes kabul ettiyse grup maçını başlat
  for r in
    select gm.id, gm.kategori from public.group_matches gm
    where gm.durum = 'bekliyor'
      and not exists (
        select 1 from public.group_match_players gmp
        where gmp.group_match_id = gm.id and gmp.davet_durumu <> 'kabul'
      )
    for update of gm skip locked
  loop
    update public.group_matches
       set durum = 'aktif',
           soru_ids = public.soru_sec(r.kategori, 20,
                        (select coalesce(array_agg(gmp.user_id), '{}'::uuid[])
                           from public.group_match_players gmp
                          where gmp.group_match_id = r.id)),
           aktif_soru = 0,
           soru_baslangic = now()
     where id = r.id;
  end loop;

  -- 8) Aktif grup maçlarında botlar cevaplasın (ve ara sıra tepki versin)
  for r in
    select gm.*, p.id as bot_id, p.bot_isabet
    from public.group_matches gm
    join public.group_match_players gmp on gmp.group_match_id = gm.id
      and gmp.davet_durumu = 'kabul' and gmp.terk_at is null
    join public.profiles p on p.id = gmp.user_id and p.is_bot
    where gm.durum = 'aktif' and gm.basladi and gm.duraklatildi_at is null
      -- Gecikme BOTA OZEL (1v1 ve turnuvadaki kuralin aynisi)
      and now() >= gm.soru_baslangic + public.bot_gecikme_sn(
            p.id, gm.id::text || ':' || gm.aktif_soru::text,
            p.bot_gecikme_min, p.bot_gecikme_max,
            public.soru_okuma_yuku(gm.soru_ids[gm.aktif_soru + 1])) * interval '1 second'
      and not exists (
        select 1 from public.group_match_answers a
        where a.group_match_id = gm.id and a.user_id = p.id and a.soru_index = gm.aktif_soru
      )
      -- Bot, insan oyuncularin ulastigi soruyu GECEMEZ (1v1'deki kural)
      and gm.aktif_soru <= 1 + coalesce((
        select max(a2.soru_index)
        from public.group_match_answers a2
        join public.profiles p2 on p2.id = a2.user_id
        where a2.group_match_id = gm.id and not coalesce(p2.is_bot, false)
      ), -1)
    for update of gm skip locked
  loop
    select * into q from public.questions where id = r.soru_ids[r.aktif_soru + 1];
    if not found then continue; end if;

    if random() < public.bot_kategori_isabet(r.bot_id, q.kategori) then
      v_cevap := q.dogru_cevap;
    else
      select x into v_cevap from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 1;
    end if;
    v_dogru := (v_cevap = q.dogru_cevap);

    insert into public.group_match_answers (group_match_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, r.aktif_soru, v_cevap, v_dogru)
    on conflict do nothing;

    if v_dogru then
      v_puan := 10;
      update public.group_match_players
         set skor = skor + v_puan
       where group_match_id = r.id and user_id = r.bot_id;
    end if;

    if random() < 0.15 then
      insert into public.group_match_messages (group_match_id, user_id, mesaj)
      values (r.id, r.bot_id, v_tepkiler[1 + floor(random() * array_length(v_tepkiler, 1))::int]);
    end if;
  end loop;

  -- 9) Grup maçlarını ilerlet (süre dolduysa veya kabul edenlerin hepsi cevapladıysa)
  for r in
    select gm.id from public.group_matches gm
    where gm.durum = 'aktif' and gm.basladi and gm.duraklatildi_at is null
      and (
        -- herkes cevapladi
        not exists (
          select 1 from public.group_match_players gmp
          where gmp.group_match_id = gm.id and gmp.davet_durumu = 'kabul'
            and gmp.terk_at is null
            and not exists (
              select 1 from public.group_match_answers a
              where a.group_match_id = gm.id and a.user_id = gmp.user_id and a.soru_index = gm.aktif_soru
            )
        )
        -- ya da soru suresi doldu VE en az bir insan bu soruyu fiilen oynadi
        or (now() > gm.soru_baslangic + interval '16 seconds'
            and exists (
              select 1 from public.group_match_answers a3
              join public.profiles p3 on p3.id = a3.user_id
              where a3.group_match_id = gm.id and a3.soru_index = gm.aktif_soru
                and not coalesce(p3.is_bot, false)
            ))
        -- ya da mac terk edildi (guvenlik agi)
        or now() > gm.soru_baslangic + interval '10 minutes'
      )
  loop
    perform public.advance_group_match(r.id);
  end loop;

  -- 10) Botlara giden hızlı maç davetlerini kabul et
  for r in
    select ho.hizli_mac_id, ho.user_id as bot_id
    from public.hizli_oyuncular ho
    join public.profiles p on p.id = ho.user_id and p.is_bot
    join public.hizli_maclar hm on hm.id = ho.hizli_mac_id
    where hm.durum = 'bekliyor' and ho.davet_durumu = 'bekliyor'
      and public.bot_daveti_kabul_etti_mi(p.id, ho.joined_at, ho.hizli_mac_id::text,
                                          coalesce(p.bot_turu, 'acik'))
    for update of ho skip locked
  loop
    update public.hizli_oyuncular
       set davet_durumu = 'kabul'
     where hizli_mac_id = r.hizli_mac_id and user_id = r.bot_id;
  end loop;

  -- 11) Herkes kabul ettiyse hızlı maçı başlat
  for r in
    select hm.id, hm.kategori from public.hizli_maclar hm
    where hm.durum = 'bekliyor'
      and not exists (
        select 1 from public.hizli_oyuncular ho
        where ho.hizli_mac_id = hm.id and ho.davet_durumu <> 'kabul'
      )
    for update of hm skip locked
  loop
    update public.hizli_maclar
       set durum = 'aktif',
           soru_ids = public.soru_sec(r.kategori, 20,
                        (select coalesce(array_agg(ho.user_id), '{}'::uuid[])
                           from public.hizli_oyuncular ho
                          where ho.hizli_mac_id = r.id)),
           aktif_soru = 0,
           soru_baslangic = now()
     where id = r.id;
  end loop;

  -- 12) Aktif hızlı maçlarda botlar cevaplasın (SADECE ilk doğru puan alır)
  --     Yarış durumu: hizli_maclar satırı kilitlenir, ilk doğru kontrolü yapılır.
  for r in
    select hm.*, p.id as bot_id, p.bot_isabet
    from public.hizli_maclar hm
    join public.hizli_oyuncular ho on ho.hizli_mac_id = hm.id
      and ho.davet_durumu = 'kabul' and ho.terk_at is null
    join public.profiles p on p.id = ho.user_id and p.is_bot
    where hm.durum = 'aktif' and hm.basladi and hm.duraklatildi_at is null
      -- Gecikme zorluga bagli ve (mac, soru, bot) icin SABIT: cron her 7 sn'de
      -- calistigi icin random() her tikte yeniden cekiliyordu; bu, dagilimin
      -- alt sinirina yigilmaya (bot hep ~2 sn'de basiyor) yol aciyordu.
      and now() >= hm.soru_baslangic
                   + public.bot_gecikme_sn(
                       p.id, hm.id::text || ':' || hm.aktif_soru::text,
                       p.bot_gecikme_min, p.bot_gecikme_max,
                       public.soru_okuma_yuku(hm.soru_ids[hm.aktif_soru + 1])
                     ) * interval '1 second'
      and not exists (
        select 1 from public.hizli_cevaplar a
        where a.hizli_mac_id = hm.id and a.user_id = p.id and a.soru_index = hm.aktif_soru
      )
      -- Bot, insan oyuncularin ulastigi soruyu GECEMEZ
      and hm.aktif_soru <= 1 + coalesce((
        select max(a2.soru_index)
        from public.hizli_cevaplar a2
        join public.profiles p2 on p2.id = a2.user_id
        where a2.hizli_mac_id = hm.id and not coalesce(p2.is_bot, false)
      ), -1)
    for update of hm skip locked
  loop
    select * into q from public.questions where id = r.soru_ids[r.aktif_soru + 1];
    if not found then continue; end if;

    if random() < public.bot_kategori_isabet(r.bot_id, q.kategori) then
      v_cevap := q.dogru_cevap;
    else
      select x into v_cevap from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 1;
    end if;
    v_dogru := (v_cevap = q.dogru_cevap);

    v_ilk := false;
    if v_dogru then
      v_ilk := not exists (
        select 1 from public.hizli_cevaplar
        where hizli_mac_id = r.id and soru_index = r.aktif_soru and dogru
      );
    end if;

    insert into public.hizli_cevaplar (hizli_mac_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, r.aktif_soru, v_cevap, v_dogru)
    on conflict do nothing;

    if v_ilk then
      update public.hizli_oyuncular
         set skor = skor + 10
       where hizli_mac_id = r.id and user_id = r.bot_id;
    end if;
  end loop;

  -- 13) Hızlı maçları ilerlet (süre dolduysa veya kabul edenlerin hepsi cevapladıysa)
  for r in
    select hm.id from public.hizli_maclar hm
    where hm.durum = 'aktif' and hm.basladi and hm.duraklatildi_at is null
      and (
        not exists (
          select 1 from public.hizli_oyuncular ho
          where ho.hizli_mac_id = hm.id and ho.davet_durumu = 'kabul'
            and ho.terk_at is null
            and not exists (
              select 1 from public.hizli_cevaplar a
              where a.hizli_mac_id = hm.id and a.user_id = ho.user_id and a.soru_index = hm.aktif_soru
            )
        )
        or (now() > hm.soru_baslangic + interval '16 seconds'
            and exists (
              select 1 from public.hizli_cevaplar a3
              join public.profiles p3 on p3.id = a3.user_id
              where a3.hizli_mac_id = hm.id and a3.soru_index = hm.aktif_soru
                and not coalesce(p3.is_bot, false)
            ))
        or now() > hm.soru_baslangic + interval '10 minutes'
      )
  loop
    perform public.advance_hizli_mac(r.id);
  end loop;
end;
$function$;


CREATE OR REPLACE FUNCTION public.bot_puan_tik()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  v_ara int;
  v_puan int;
  v_islenen int := 0;
  v_dk_min int := public.ayar_sayi('bot_puan_mac_dk_min', 55)::int;
  v_dk_max int := public.ayar_sayi('bot_puan_mac_dk_max', 420)::int;
  v_gal numeric := public.ayar_sayi('bot_puan_galibiyet_yuzde', 55)::numeric / 100;
  v_yuzde numeric := public.ayar_sayi('lig_bot_puan_yuzde', 40)::numeric / 100;
begin
  if v_dk_max < v_dk_min then v_dk_max := v_dk_min; end if;

  -- Yeni botlar tempoya yazılır. Başlangıç anı bota özel geriye kaydırılır
  -- ki ilk tikte hepsi birden puan almasın.
  insert into public.bot_puan_temposu (bot_id, son_mac_at)
  select p.id,
         now() - make_interval(mins => (public.bot_rasgele('puan_baslangic:' || p.id::text)
                                        * v_dk_max)::int)
    from public.profiles p
   where p.is_bot and coalesce(p.bot_aktif, true)
  on conflict (bot_id) do nothing;

  for r in
    select t.bot_id, t.son_mac_at, p.lig
      from public.bot_puan_temposu t
      join public.profiles p on p.id = t.bot_id
     where p.is_bot and coalesce(p.bot_aktif, true)
  loop
    -- Bota özel sabit tempo: aynı bot hep aynı sıklıkta "oynar".
    v_ara := v_dk_min + (public.bot_rasgele('puan_tempo:' || r.bot_id::text)
                         * (v_dk_max - v_dk_min))::int;
    if now() < r.son_mac_at + make_interval(mins => v_ara) then
      continue;
    end if;

    -- Maçı kazandı mı: maç anına bağlı, aynı tik tekrar çalışsa da aynı.
    v_puan := 0;
    if public.bot_rasgele('puan_sonuc:' || r.bot_id::text || ':'
                          || to_char(r.son_mac_at, 'YYYYMMDDHH24MI')) < v_gal then
      -- Gerçek maçtaki formülün aynısı: galibiyet puanı, bot yüzdesiyle kırpılmış.
      v_puan := floor(public.ayar_sayi('lig_mac_galibiyet', 25) * v_yuzde)::int;
    end if;

    update public.profiles
       set puan = puan + v_puan,
           puan_hafta = puan_hafta + v_puan,
           toplam_mac = coalesce(toplam_mac, 0) + 1
     where id = r.bot_id;

    -- Simüle maç kişiliğe göre kategori istatistiği de üretir (Paket 14, 4.9)
    perform public.bot_mac_istatistik_simule(r.bot_id);

    update public.bot_puan_temposu
       set son_mac_at = r.son_mac_at + make_interval(mins => v_ara),
           mac_sayisi = mac_sayisi + 1
     where bot_id = r.bot_id;

    v_islenen := v_islenen + 1;
  end loop;

  return v_islenen;
end;
$function$;


-- ---- okuma: oyuncu kartı / düello profili ----
create or replace function public.oyuncu_unvani(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select k.kategori
    from public.kategori_istatistik k
   where k.user_id = p_user
     and k.toplam >= public.ayar_sayi('kategori_istatistik_min_ornek', 10)
     and coalesce((select o.istatistikli_mac from public.oyuncu_istatistik o where o.user_id = p_user), 0)
         >= public.ayar_sayi('unvan_min_mac', 10)
   order by k.dogru::numeric / nullif(k.toplam, 0) desc, k.toplam desc
   limit 1;
$$;
revoke execute on function public.oyuncu_unvani(uuid) from public, anon, authenticated;

create or replace function public.oyuncu_kategori_profili(p_user uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := coalesce(p_user, auth.uid());
  v_min int := public.ayar_sayi('kategori_istatistik_min_ornek', 10)::int;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  if not exists (select 1 from public.profiles where id = v_user) then return null; end if;
  return jsonb_build_object(
    'toplam_mac', coalesce((select toplam_mac from public.profiles where id = v_user), 0),
    'istatistikli_mac', coalesce((select istatistikli_mac from public.oyuncu_istatistik where user_id = v_user), 0),
    'unvan', public.oyuncu_unvani(v_user),
    'min_ornek', v_min,
    'kategoriler', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kategori', k.kategori,
               'toplam', k.toplam,
               'yuzde', case when k.toplam >= v_min
                             then round(100.0 * k.dogru / k.toplam)::int end)
             order by k.kategori)
        from public.kategori_istatistik k where k.user_id = v_user), '[]'::jsonb)
  );
end;
$$;
revoke execute on function public.oyuncu_kategori_profili(uuid) from public, anon;
grant execute on function public.oyuncu_kategori_profili(uuid) to authenticated;

-- ============================================================
-- GERİYE DOLDURMA
-- ============================================================
insert into public.kategori_istatistik (user_id, kategori, dogru, toplam)
select x.user_id, x.kategori, count(*) filter (where x.dogru), count(*)
  from (
    select a.user_id, q.kategori, a.dogru
      from public.match_answers a
      join public.matches m on m.id = a.match_id
      join public.questions q on q.id = m.soru_ids[a.soru_index + 1]
    union all
    select a.user_id, q.kategori, a.dogru
      from public.group_match_answers a
      join public.group_matches g on g.id = a.group_match_id
      join public.questions q on q.id = g.soru_ids[a.soru_index + 1]
    union all
    select a.user_id, q.kategori, a.dogru
      from public.tournament_answers a
      join public.tournaments t on t.id = a.tournament_id
      join public.questions q on q.id = t.soru_ids[a.soru_index + 1]
    union all
    select a.user_id, q.kategori, a.dogru
      from public.hizli_cevaplar a
      join public.hizli_maclar h on h.id = a.hizli_mac_id
      join public.questions q on q.id = h.soru_ids[a.soru_index + 1]
  ) x
 join public.profiles p on p.id = x.user_id
 where x.kategori is not null
 group by x.user_id, x.kategori
on conflict (user_id, kategori) do update
  set dogru = excluded.dogru, toplam = excluded.toplam, guncellendi = now();

insert into public.oyuncu_istatistik (user_id, istatistikli_mac)
select y.user_id, count(*)
  from (
    select distinct a.user_id, '1v1:' || a.match_id::text as mac from public.match_answers a
    union
    select distinct a.user_id, 'grup:' || a.group_match_id::text from public.group_match_answers a
    union
    select distinct a.user_id, 'turnuva:' || a.tournament_id::text from public.tournament_answers a
    union
    select distinct a.user_id, 'hizli:' || a.hizli_mac_id::text from public.hizli_cevaplar a
  ) y
  join public.profiles p on p.id = y.user_id
 group by y.user_id
on conflict (user_id) do update set istatistikli_mac = excluded.istatistikli_mac;

-- Bot kişilikleri
select public.bot_kisilik_tohumla(p.id) from public.profiles p where p.is_bot;

-- Botların simüle geçmişi (bot_puan_tik'in saydığı maçlar): kişiliğe göre,
-- deterministik tohumla. Gerçek cevaplardan sayılan maçlar düşülür.
do $$
declare
  b record;
  k record;
  v_sim int;
  v_soru int;
  v_toplam int;
  v_agirlik_toplam double precision;
begin
  for b in
    select p.id, coalesce(p.toplam_mac, 0) as toplam_mac,
           coalesce((select o.istatistikli_mac from public.oyuncu_istatistik o where o.user_id = p.id), 0) as gercek
      from public.profiles p where p.is_bot
  loop
    v_sim := greatest(0, b.toplam_mac - b.gercek);
    if v_sim = 0 then continue; end if;
    v_soru := v_sim * public.ayar_sayi('bot_simule_soru_mac', 10)::int;

    select sum(0.6 + 0.8 * public.bot_rasgele('pay:' || b.id::text || ':' || s.kategori))
      into v_agirlik_toplam from public.bot_kategori_sapma s where s.bot_id = b.id;

    for k in select s.kategori from public.bot_kategori_sapma s where s.bot_id = b.id loop
      v_toplam := round(v_soru * (0.6 + 0.8 * public.bot_rasgele('pay:' || b.id::text || ':' || k.kategori))
                        / nullif(v_agirlik_toplam, 0))::int;
      if coalesce(v_toplam, 0) <= 0 then continue; end if;
      insert into public.kategori_istatistik (user_id, kategori, dogru, toplam)
      values (b.id, k.kategori,
              least(v_toplam, round(v_toplam * public.bot_kategori_isabet(b.id, k.kategori)
                     * (0.94 + 0.12 * public.bot_rasgele('isabet:' || b.id::text || ':' || k.kategori)))::int),
              v_toplam)
      on conflict (user_id, kategori) do update
        set dogru = public.kategori_istatistik.dogru + excluded.dogru,
            toplam = public.kategori_istatistik.toplam + excluded.toplam;
    end loop;

    insert into public.oyuncu_istatistik (user_id, istatistikli_mac) values (b.id, v_sim)
    on conflict (user_id) do update set istatistikli_mac = public.oyuncu_istatistik.istatistikli_mac + v_sim;
  end loop;
end $$;

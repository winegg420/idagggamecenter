-- Paket 20 · Bölüm II — Soru kalite mekanizması (AI'sız katmanlar + sahibinin elle yürüttüğü denetim hattı)
--
-- Sunucuda otomatik AI taraması YOK (ANTHROPIC_API_KEY Supabase'e eklenmez — kalıcı karar).
-- Katmanlar:
--   0) Oyuncu bildirimi  : vote_question(p_question_id, p_adil, p_sebep) → eşik kadar GERÇEK oyuncu bildirirse karantina
--   1) Kural taraması    : soru_kural_isaretleri() — her soru girişte (tetikleyici) + soru_supheli_tara() tüm havuz
--   2) İstatistik        : soru_istatistik_tara() — gerçek oyuncu cevaplarından doğruluk + "yanlışlar tek şıkta" (ters anahtar)
--   3) Denetim hattı     : soru_denetim_disa_aktar / soru_denetim_ice_aktar (yalnız service_role; npm run soru:disari / soru:iceri)
-- Veri silinmez: kaldırma = aktif=false; düzeltmeden önce eski hâl soru_surum'a yazılır.

create extension if not exists pg_trgm with schema extensions;

-- ---------- Ayarlar (koda gömülü eşik yok) ----------
insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('soru_bildirim_esigi', '3'::jsonb, 'Kaç farklı GERÇEK oyuncu bildirirse soru karantinaya alınır (aktif=false)'),
  ('soru_istatistik_asgari', '20'::jsonb, 'İstatistik taraması için en az gerçek oyuncu cevabı'),
  ('soru_supheli_oran', '0.15'::jsonb, 'Doğruluk oranı bunun altındaysa soru şüpheli (4 şıkta rastgele %25)'),
  ('soru_ters_anahtar_pay', '0.7'::jsonb, 'Yanlış cevapların bu payı tek şıkta toplanırsa anahtar ters girilmiş olabilir'),
  ('soru_uzun_sik_oran', '1.6'::jsonb, 'Doğru şık en uzun diğer şıktan bu kat uzunsa işaret'),
  ('soru_benzerlik_esigi', '0.75'::jsonb, 'Aynı kategoride soru metni benzerliği (pg_trgm) bu değerin üstündeyse yakın varyant'),
  ('soru_celiski_benzerlik', '0.9'::jsonb, 'Çelişki için soru metni benzerliği (yakın varyanttan sıkı)'),
  ('soru_kategori_carpik_pay', '0.4'::jsonb, 'Bir kategoride tek doğru-cevap indeksinin payı bunu aşarsa çarpık dağılım'),
  ('soru_supheli_rekabetci_haric', 'true'::jsonb, 'true: denetlenmemiş ve kural işareti taşıyan soru Dereceli/Düello/Turnuva havuzuna girmez'),
  ('soru_rekabetci_haric_agirlik', '2'::jsonb, 'Rekabetçi havuzdan çıkarmak için gereken en düşük işaret ağırlığı (1 zayıf · 2 orta · 3 güçlü)'),
  ('soru_parti_boyutu', '100'::jsonb, 'npm run soru:disari parti başına soru sayısı')
on conflict (anahtar) do nothing;

-- ---------- Şema eklemeleri (mevcut satırlar bozulmaz) ----------
alter table public.question_votes add column if not exists sebep text;
alter table public.question_votes drop constraint if exists question_votes_sebep_chk;
alter table public.question_votes add constraint question_votes_sebep_chk
  check (sebep is null or sebep in ('cevap_yanlis', 'anlasilmiyor', 'birden_fazla_dogru', 'yazim_hatasi', 'guncel_degil'));

alter table public.questions add column if not exists denetim_durumu text not null default 'bekliyor';
alter table public.questions add column if not exists surum integer not null default 1;
alter table public.questions add column if not exists supheli_isaretler text[] not null default '{}'::text[];
alter table public.questions add column if not exists supheli_agirlik smallint not null default 0;
alter table public.questions drop constraint if exists questions_denetim_durumu_chk;
alter table public.questions add constraint questions_denetim_durumu_chk
  check (denetim_durumu in ('bekliyor', 'onaylandi', 'duzeltildi', 'reddedildi', 'karantina'));

alter table public.question_translations add column if not exists eskidi boolean not null default false;
alter table public.question_translations add column if not exists eskidi_at timestamptz;

create table if not exists public.soru_denetim (
  id bigserial primary key,
  question_id uuid not null references public.questions(id) on delete cascade,
  durum text not null check (durum in ('bekliyor', 'onaylandi', 'duzeltildi', 'reddedildi', 'karantina')),
  sebep text,
  kaynak text,          -- sorunun doğrulandığı referans (serbest metin / URL) ya da kaydın kaynağı
  denetleyen text,
  tarih timestamptz not null default now(),
  not_metni text        -- "not" SQL'de ayrılmış kelime
);
create index if not exists soru_denetim_soru_idx on public.soru_denetim (question_id, tarih desc);

create table if not exists public.soru_surum (
  id bigserial primary key,
  question_id uuid not null references public.questions(id) on delete cascade,
  surum integer not null,
  soru text not null,
  secenekler jsonb not null,
  dogru_cevap smallint not null,
  degisiklik_notu text,
  tarih timestamptz not null default now()
);
create index if not exists soru_surum_soru_idx on public.soru_surum (question_id, surum);

-- Hızlı Mod ve Hatalarım şık bazında cevap tutmuyordu; istatistik taraması için yalnız bu iki mod yazar
-- (diğer modların kendi cevap tabloları var).
create table if not exists public.soru_cevap_kaydi (
  id bigserial primary key,
  question_id uuid not null references public.questions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mod text not null,
  cevap smallint,
  dogru boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists soru_cevap_kaydi_soru_idx on public.soru_cevap_kaydi (question_id);

alter table public.soru_denetim enable row level security;
alter table public.soru_surum enable row level security;
alter table public.soru_cevap_kaydi enable row level security;
revoke all on table public.soru_denetim, public.soru_surum, public.soru_cevap_kaydi from anon, authenticated;
revoke all on sequence public.soru_denetim_id_seq, public.soru_surum_id_seq, public.soru_cevap_kaydi_id_seq from anon, authenticated;

create index if not exists questions_soru_trgm_idx on public.questions using gin (soru extensions.gin_trgm_ops);

-- ---------- Katman 1: kural tabanlı işaretler ----------
create or replace function public.soru_normalize(p text)
 returns text language sql immutable
as $$
  select regexp_replace(
           lower(translate(coalesce(p, ''), 'İIŞĞÜÖÇÂÎÛâîû', 'iışğüöçaiuaiu')),
           '[^a-z0-9çğıöşü]+', '', 'g');
$$;

-- Harf/rakam dışı her şey tek boşluk: tam kelime karşılaştırması için
create or replace function public.soru_kelimeler(p text)
 returns text language sql immutable
as $$
  select btrim(regexp_replace(lower(translate(coalesce(p, ''), 'İIŞĞÜÖÇÂÎÛâîû', 'iışğüöçaiuaiu')), '[^a-z0-9çğıöşü]+', ' ', 'g'));
$$;

create or replace function public.soru_isaret_agirligi(p_isaret text)
 returns smallint language sql immutable
as $$
  select (case p_isaret
    when 'sik_sayisi' then 3 when 'ayni_sik' then 3 when 'celiski' then 3 when 'ters_anahtar' then 3
    when 'cevap_sizmasi' then 2 when 'hepsi_hicbiri' then 2 when 'dusuk_dogruluk' then 2
    when 'dogru_en_uzun' then 1 when 'sayisal_uc' then 1 when 'yakin_varyant' then 1 when 'kategori_carpik' then 1
    else 1 end)::smallint;
$$;

create or replace function public.soru_kural_isaretleri(p_soru text, p_secenekler jsonb, p_dogru smallint)
 returns text[] language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_isaret text[] := '{}';
  v_sik text[];
  v_n int;
  v_dogru text;
  v_diger_max int;
  v_oran numeric := public.ayar_ondalik('soru_uzun_sik_oran', 1.6);
  v_sayilar numeric[];
begin
  if p_secenekler is null or jsonb_typeof(p_secenekler) <> 'array' then return array['sik_sayisi']; end if;
  select array_agg(x order by o) into v_sik from jsonb_array_elements_text(p_secenekler) with ordinality e(x, o);
  v_n := coalesce(array_length(v_sik, 1), 0);
  if v_n <> 4 or p_dogru is null or p_dogru < 0 or p_dogru >= v_n then return array['sik_sayisi']; end if;
  v_dogru := v_sik[p_dogru + 1];

  -- İki şık birebir ya da normalize edilince aynı
  if (select count(distinct public.soru_normalize(x)) from unnest(v_sik) x) < v_n then
    v_isaret := array_append(v_isaret, 'ayni_sik');
  end if;

  -- Doğru şık belirgin şekilde en uzun (AI üretiminin klasik kalıbı)
  select max(length(btrim(x))) into v_diger_max from unnest(v_sik) with ordinality u(x, o) where o <> p_dogru + 1;
  if length(btrim(v_dogru)) >= v_oran * greatest(v_diger_max, 1) and length(btrim(v_dogru)) - v_diger_max >= 8 then
    v_isaret := array_append(v_isaret, 'dogru_en_uzun');
  end if;

  -- Soru metninde doğru şık TAM KELİME olarak geçiyor (cevap sızıyor); başka şık da geçiyorsa sayılmaz.
  -- Alt dizgi yetmez: "Yazı" ⊂ "yazılması" yanlış alarm veriyordu (ölçüldü).
  if length(public.soru_normalize(v_dogru)) >= 4
     and ' ' || public.soru_kelimeler(p_soru) || ' ' like '% ' || public.soru_kelimeler(v_dogru) || ' %'
     and not exists (select 1 from unnest(v_sik) with ordinality u(x, o)
                      where o <> p_dogru + 1 and length(public.soru_normalize(x)) >= 4
                        and ' ' || public.soru_kelimeler(p_soru) || ' ' like '% ' || public.soru_kelimeler(x) || ' %') then
    v_isaret := array_append(v_isaret, 'cevap_sizmasi');
  end if;

  -- "Hepsi" / "hiçbiri"
  if exists (select 1 from unnest(v_sik) x
              where ' ' || public.soru_kelimeler(x) || ' ' ~ ' (hiçbiri|hicbiri|yukarıdakilerin|all of the above|none of the above) '
                 or public.soru_kelimeler(x) in ('hepsi', 'tümü', 'hepsi doğru', 'ikisi de', 'hiçbiri')) then
    v_isaret := array_append(v_isaret, 'hepsi_hicbiri');
  end if;

  -- Şıklar sayısal ve doğru cevap uç değer (zayıf işaret)
  if (select bool_and(btrim(x) ~ '^-?[0-9]+([.,][0-9]+)?$') from unnest(v_sik) x) then
    select array_agg(replace(btrim(x), ',', '.')::numeric) into v_sayilar from unnest(v_sik) x;
    if replace(btrim(v_dogru), ',', '.')::numeric in ((select min(s) from unnest(v_sayilar) s), (select max(s) from unnest(v_sayilar) s)) then
      v_isaret := array_append(v_isaret, 'sayisal_uc');
    end if;
  end if;

  return v_isaret;
end $$;

create or replace function public.trg_soru_kural_isaret()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  new.supheli_isaretler := public.soru_kural_isaretleri(new.soru, new.secenekler, new.dogru_cevap);
  new.supheli_agirlik := coalesce((select max(public.soru_isaret_agirligi(i)) from unnest(new.supheli_isaretler) i), 0);
  return new;
end $$;
drop trigger if exists trg_questions_kural_isaret on public.questions;
create trigger trg_questions_kural_isaret
  before insert or update of soru, secenekler, dogru_cevap on public.questions
  for each row execute function public.trg_soru_kural_isaret();

-- Mevcut havuza bir kez uygula (tetikleyici yalnız ilgili kolonlar değişince çalışır)
update public.questions q
   set supheli_isaretler = s.isaret,
       supheli_agirlik = coalesce((select max(public.soru_isaret_agirligi(i)) from unnest(s.isaret) i), 0)
  from (select id, public.soru_kural_isaretleri(soru, secenekler, dogru_cevap) isaret from public.questions) s
 where s.id = q.id;

-- Rekabetçi havuz ayrımı açık mı? (Hatalarım işlem içinde app.soru_havuzu='serbest' der)
create or replace function public.soru_supheli_haric_mi()
 returns boolean language sql stable security definer set search_path to 'public'
as $$
  select coalesce((select deger::text = 'true' from public.oyun_ayarlari where anahtar = 'soru_supheli_rekabetci_haric'), true)
     and coalesce(current_setting('app.soru_havuzu', true), '') <> 'serbest';
$$;

-- Tüm havuz taraması: soru başına işaretler + kategori dağılımı + yakın varyant / çelişki
create or replace function public.soru_supheli_tara()
 returns table(question_id uuid, kategori text, isaret text, agirlik smallint, ayrinti jsonb)
 language plpgsql stable security definer set search_path to 'public', 'extensions'
as $$
declare
  v_esik numeric := public.ayar_ondalik('soru_benzerlik_esigi', 0.75);
  v_pay numeric := public.ayar_ondalik('soru_kategori_carpik_pay', 0.4);
begin
  perform set_config('pg_trgm.similarity_threshold', v_esik::text, true);

  return query
  select q.id, q.kategori, i, public.soru_isaret_agirligi(i), '{}'::jsonb
    from public.questions q, unnest(q.supheli_isaretler) i
   where q.aktif;

  return query
  select null::uuid, d.kategori, 'kategori_carpik'::text, public.soru_isaret_agirligi('kategori_carpik'),
         jsonb_build_object('dogru_indeks', d.dogru_cevap, 'pay', round(d.pay, 3), 'adet', d.adet, 'toplam', d.toplam)
    from (select x.kategori, x.dogru_cevap, count(*) adet, sum(count(*)) over (partition by x.kategori) toplam,
                 count(*)::numeric / sum(count(*)) over (partition by x.kategori) pay
            from public.questions x where x.aktif group by x.kategori, x.dogru_cevap) d
   where d.pay > v_pay;

  -- Yakın varyant: aynı kategori, soru metni benzer (kopya riski, zayıf).
  -- Çelişki (güçlü) yalnız: metin neredeyse aynı (soru_celiski_benzerlik) VE diğer sorunun doğru cevabı bu sorunun
  -- şıkları arasında olup burada YANLIŞ işaretli VE iki doğru metin birbirini içermiyor. İlk sürüm (yalnız "doğru
  -- metinler farklı") 352 soru çıkardı, örneklerin çoğu farklı konu (hentbol/basketbol) ya da aynı cevabın başka
  -- yazımıydı (Pasteur / Louis Pasteur) — ölçüldü, kural daraltıldı.
  return query
  select a.id, a.kategori, x.isaret, public.soru_isaret_agirligi(x.isaret),
         jsonb_build_object('diger_id', b.id, 'diger_soru', b.soru, 'diger_dogru', b.secenekler ->> b.dogru_cevap,
                            'diger_aktif', b.aktif, 'benzerlik', round(similarity(a.soru, b.soru)::numeric, 2),
                            'bu_dogru', a.secenekler ->> a.dogru_cevap)
    from public.questions a
    -- LATERAL: trigram GIN dizini soru başına kullanılır (düz join 130 sn, bu biçim ~10 sn — ölçüldü)
    cross join lateral (select x.id, x.soru, x.secenekler, x.dogru_cevap, x.aktif from public.questions x
                         where x.soru % a.soru and x.id <> a.id and x.kategori = a.kategori) b
    cross join lateral (
      select case when similarity(a.soru, b.soru) >= public.ayar_ondalik('soru_celiski_benzerlik', 0.9)
                   and public.soru_normalize(a.secenekler ->> a.dogru_cevap) <> public.soru_normalize(b.secenekler ->> b.dogru_cevap)
                   and position(public.soru_normalize(a.secenekler ->> a.dogru_cevap) in public.soru_normalize(b.secenekler ->> b.dogru_cevap)) = 0
                   and position(public.soru_normalize(b.secenekler ->> b.dogru_cevap) in public.soru_normalize(a.secenekler ->> a.dogru_cevap)) = 0
                   and exists (select 1 from jsonb_array_elements_text(a.secenekler) with ordinality e(s, o)
                                where o - 1 <> a.dogru_cevap and public.soru_normalize(s) = public.soru_normalize(b.secenekler ->> b.dogru_cevap))
                  then 'celiski' else 'yakin_varyant' end::text as isaret) x
   where a.aktif;
end $$;

-- ---------- Katman 2: istatistik (yalnız GERÇEK oyuncular; botlar anahtarı sunucudan bilir) ----------
create or replace function public.soru_cevaplari_gercek()
 returns table(question_id uuid, user_id uuid, cevap smallint, dogru boolean)
 language sql stable security definer set search_path to 'public'
as $$
  select c.question_id, c.user_id, c.cevap, c.dogru
  from (
    select m.soru_ids[a.soru_index + 1] question_id, a.user_id, a.cevap, a.dogru
      from public.match_answers a join public.matches m on m.id = a.match_id
    union all
    select g.soru_ids[a.soru_index + 1], a.user_id, a.cevap, a.dogru
      from public.group_match_answers a join public.group_matches g on g.id = a.group_match_id
    union all
    select t.soru_ids[a.soru_index + 1], a.user_id, a.cevap, a.dogru
      from public.tournament_answers a join public.tournaments t on t.id = a.tournament_id
    union all
    select h.soru_id, h.savunan, h.cevap, h.dogru from public.duello_hamleler h
    union all
    select k.question_id, k.user_id, k.cevap, k.dogru from public.soru_cevap_kaydi k
  ) c
  join public.profiles p on p.id = c.user_id and not coalesce(p.is_bot, false)
  where c.question_id is not null and c.cevap between 0 and 3;   -- süre dolan (-1 / null) şık seçmedi
$$;

create or replace function public.soru_istatistik_tara()
 returns table(question_id uuid, kategori text, ornek integer, dogru integer, oran numeric,
               yanlis_toplam integer, en_cok_yanlis_sik smallint, yanlis_pay numeric, isaret text, agirlik smallint)
 language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_asgari int := public.ayar_sayi('soru_istatistik_asgari', 20)::int;
  v_oran numeric := public.ayar_ondalik('soru_supheli_oran', 0.15);
  v_pay numeric := public.ayar_ondalik('soru_ters_anahtar_pay', 0.7);
begin
  return query
  with c as (select * from public.soru_cevaplari_gercek()),
  ozet as (
    select c.question_id, count(*)::int n, count(*) filter (where c.dogru)::int d from c group by c.question_id
  ),
  yanlis as (
    select distinct on (c.question_id) c.question_id, c.cevap sik, count(*)::int adet
      from c where not c.dogru group by c.question_id, c.cevap
     order by c.question_id, count(*) desc
  )
  select o.question_id, q.kategori, o.n, o.d, round(o.d::numeric / o.n, 3),
         (o.n - o.d), y.sik, case when o.n > o.d then round(y.adet::numeric / (o.n - o.d), 3) end,
         x.isaret, public.soru_isaret_agirligi(x.isaret)
    from ozet o
    join public.questions q on q.id = o.question_id
    left join yanlis y on y.question_id = o.question_id
    cross join lateral (
      select case
        when o.n >= v_asgari and (o.n - o.d) >= 1 and y.adet::numeric / nullif(o.n - o.d, 0) >= v_pay
             and o.d::numeric / o.n < 0.5 then 'ters_anahtar'
        when o.n >= v_asgari and o.d::numeric / o.n < v_oran then 'dusuk_dogruluk'
      end as isaret
    ) x
   where x.isaret is not null;
end $$;

-- ---------- Katman 0: oyuncu bildirimi + otomatik karantina ----------
drop function if exists public.vote_question(uuid, boolean);
create or replace function public.vote_question(p_question_id uuid, p_adil boolean, p_sebep text default null)
 returns void language plpgsql security definer set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_adil int; v_toplam int; v_bildiren int;
  v_esik int := public.ayar_sayi('soru_bildirim_esigi', 3)::int;
  v_son_karar timestamptz;
  v_sebepler jsonb;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  perform public.hiz_siniri('vote_question', 30, interval '60 seconds');
  if p_sebep is not null and p_sebep not in ('cevap_yanlis', 'anlasilmiyor', 'birden_fazla_dogru', 'yazim_hatasi', 'guncel_degil') then
    raise exception 'Geçersiz sebep';
  end if;
  -- Yalnız karşılaşılmış soru bildirilebilir (rastgele id ile karantina yapılamasın)
  if not exists (select 1 from public.gorulen_sorular g where g.user_id = v_me and g.question_id = p_question_id)
     and not exists (select 1 from public.yanlis_sorular y where y.user_id = v_me and y.question_id = p_question_id)
     and not exists (select 1 from public.calisma_oturumlari c where c.user_id = v_me and p_question_id = any(c.soru_ids))
     and not exists (select 1 from public.duello_hamleler h join public.duellolar d on d.id = h.duello_id
                      where h.soru_id = p_question_id and v_me in (d.oyuncu1, d.oyuncu2)) then
    raise exception 'Bu soruyu görmedin';
  end if;

  insert into public.question_votes (question_id, user_id, adil, sebep)
  values (p_question_id, v_me, p_adil, case when p_adil then null else p_sebep end)
  on conflict (question_id, user_id) do update
    set adil = excluded.adil, sebep = excluded.sebep, created_at = now();

  select count(*) filter (where adil), count(*) into v_adil, v_toplam
    from public.question_votes where question_id = p_question_id;
  update public.questions set adil_oy = v_adil, toplam_oy = v_toplam where id = p_question_id;

  if p_adil then return; end if;

  -- Eşik: son onay/düzeltmeden SONRA bildiren farklı gerçek oyuncu sayısı (bot hariç)
  select max(sd.tarih) into v_son_karar from public.soru_denetim sd
   where sd.question_id = p_question_id and sd.durum in ('onaylandi', 'duzeltildi');
  select count(distinct v.user_id), jsonb_object_agg(coalesce(v.sebep, 'belirtilmedi'), 1)
    into v_bildiren, v_sebepler
    from public.question_votes v join public.profiles p on p.id = v.user_id and not coalesce(p.is_bot, false)
   where v.question_id = p_question_id and not v.adil
     and (v_son_karar is null or v.created_at > v_son_karar);

  if v_bildiren >= v_esik and exists (select 1 from public.questions where id = p_question_id and aktif) then
    update public.questions set aktif = false, denetim_durumu = 'karantina' where id = p_question_id;
    insert into public.soru_denetim (question_id, durum, sebep, kaynak, denetleyen, not_metni)
    select p_question_id, 'karantina', 'oyuncu_bildirimi', 'question_votes', 'sistem',
           v_bildiren || ' gerçek oyuncu bildirdi · sebepler: ' ||
           coalesce((select string_agg(s.sebep || ' ×' || s.n, ', ' order by s.n desc)
                       from (select coalesce(v.sebep, 'belirtilmedi') sebep, count(*) n
                               from public.question_votes v join public.profiles p on p.id = v.user_id and not coalesce(p.is_bot, false)
                              where v.question_id = p_question_id and not v.adil
                                and (v_son_karar is null or v.created_at > v_son_karar)
                              group by 1) s), '');
  end if;
end $$;
revoke all on function public.vote_question(uuid, boolean, text) from public, anon;
grant execute on function public.vote_question(uuid, boolean, text) to authenticated;

-- Hızlı Mod / Hatalarım cevap kaydı
create or replace function public.soru_cevap_yaz(p_question uuid, p_user uuid, p_cevap smallint, p_dogru boolean, p_mod text)
 returns void language sql security definer set search_path to 'public'
as $$
  insert into public.soru_cevap_kaydi (question_id, user_id, mod, cevap, dogru)
  select p_question, p_user, p_mod, p_cevap, coalesce(p_dogru, false)
   where p_question is not null and p_user is not null;
$$;

-- ---------- Maç sonu: bu maçın soruları (bildir + doğru cevap) ----------
create or replace function public.mac_sorulari(p_kaynak text)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_tur text := split_part(coalesce(p_kaynak, ''), ':', 1);
  v_id uuid;
  v_dil text;
  v jsonb;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  begin v_id := split_part(p_kaynak, ':', 2)::uuid; exception when others then raise exception 'Geçersiz kaynak'; end;
  select coalesce(nullif(btrim(dil), ''), 'tr') into v_dil from public.profiles where id = v_me;

  with liste as (
    select s.question_id, s.sira, s.benim_cevap, s.ben_cevapladim, s.ek
    from (
      select m.soru_ids[i] question_id, i sira, a.cevap benim_cevap, a.user_id is not null ben_cevapladim, '{}'::jsonb ek
        from public.matches m cross join generate_subscripts(m.soru_ids, 1) i
        left join public.match_answers a on a.match_id = m.id and a.user_id = v_me and a.soru_index = i - 1
       where v_tur = 'mac' and m.id = v_id and m.durum = 'bitti' and v_me in (m.oyuncu1, m.oyuncu2)
      union all
      select h.soru_id, h.id::int, case when h.savunan = v_me then h.cevap end, h.savunan = v_me,
             jsonb_build_object('tur', h.tur, 'ben_saldirdim', h.saldiran = v_me, 'dogru', h.dogru, 'riskli', h.riskli,
                                'kategori', h.kategori, 'rakip_cevap', case when h.saldiran = v_me then h.cevap end)
        from public.duello_hamleler h join public.duellolar d on d.id = h.duello_id
       where v_tur = 'duello' and d.id = v_id and d.durum <> 'aktif' and v_me in (d.oyuncu1, d.oyuncu2)
      union all
      select o.soru_ids[i], i, k.cevap, k.id is not null, '{}'::jsonb
        from public.hizli_mod_oturumlar o cross join generate_series(1, least(o.aktif_soru, coalesce(array_length(o.soru_ids, 1), 0))) i
        left join lateral (select kk.id, kk.cevap from public.soru_cevap_kaydi kk
                            where kk.user_id = v_me and kk.mod = 'hizli' and kk.question_id = o.soru_ids[i]
                              and kk.created_at >= o.baslangic order by kk.id limit 1) k on true
       where v_tur = 'hizli' and o.id = v_id and o.user_id = v_me and o.durum = 'bitti'
      union all
      select g.soru_ids[i], i, a.cevap, a.user_id is not null, '{}'::jsonb
        from public.group_matches g cross join generate_series(1, least(g.aktif_soru + 1, coalesce(array_length(g.soru_ids, 1), 0))) i
        left join public.group_match_answers a on a.group_match_id = g.id and a.user_id = v_me and a.soru_index = i - 1
       where v_tur = 'grup' and g.id = v_id and g.durum = 'bitti'
         and exists (select 1 from public.group_match_players gp where gp.group_match_id = g.id and gp.user_id = v_me)
      union all
      select t.soru_ids[i], i, a.cevap, a.user_id is not null, '{}'::jsonb
        from public.tournaments t cross join generate_series(1, least(t.aktif_soru + 1, coalesce(array_length(t.soru_ids, 1), 0))) i
        left join public.tournament_answers a on a.tournament_id = t.id and a.user_id = v_me and a.soru_index = i - 1
       where v_tur = 'turnuva' and t.id = v_id and t.durum = 'bitti'
         and exists (select 1 from public.tournament_players tp where tp.tournament_id = t.id and tp.user_id = v_me)
    ) s where s.question_id is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'question_id', l.question_id, 'sira', l.sira, 'soru', sd.soru, 'secenekler', sd.secenekler,
           'dogru_cevap', sd.dogru_cevap, 'benim_cevap', l.benim_cevap, 'ben_cevapladim', l.ben_cevapladim,
           'bildirdim', exists (select 1 from public.question_votes v where v.question_id = l.question_id and v.user_id = v_me and not v.adil)
         ) || l.ek order by l.sira), '[]'::jsonb)
    into v
    from liste l cross join lateral public.soru_dilinde(l.question_id, v_dil) sd;
  return v;
end $$;
revoke all on function public.mac_sorulari(text) from public, anon;
grant execute on function public.mac_sorulari(text) to authenticated;

-- ---------- Katman 3: toplu denetim hattı (yalnız service_role — sahibinin betikleri) ----------
create or replace function public.soru_denetim_disa_aktar(p_adet integer default null, p_parti text default null)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  v_adet int := coalesce(p_adet, public.ayar_sayi('soru_parti_boyutu', 100)::int);
  v jsonb;
begin
  with _tara as materialized (select * from public.soru_supheli_tara()),
  _ist as materialized (select * from public.soru_istatistik_tara()),
  son as (
    select distinct on (sd.question_id) sd.question_id, sd.durum, sd.sebep, sd.tarih
      from public.soru_denetim sd order by sd.question_id, sd.tarih desc, sd.id desc
  ),
  bild as (
    select v.question_id, count(*) filter (where not v.adil) sayi,
           coalesce(jsonb_object_agg(coalesce(v.sebep, 'belirtilmedi'), 1) filter (where not v.adil), '{}'::jsonb) sebepler
      from public.question_votes v join public.profiles p on p.id = v.user_id and not coalesce(p.is_bot, false)
     group by v.question_id
  ),
  isaret as (
    select t.question_id, max(t.agirlik) agirlik,
           jsonb_agg(jsonb_build_object('isaret', t.isaret, 'agirlik', t.agirlik) || case when t.ayrinti = '{}'::jsonb then '{}'::jsonb else jsonb_build_object('ayrinti', t.ayrinti) end) liste
      from _tara t where t.question_id is not null group by t.question_id
  ),
  aday as (
    select q.id, q.soru, q.secenekler, q.dogru_cevap, q.kategori, q.zorluk, q.aktif, q.denetim_durumu, q.surum,
           case when q.denetim_durumu = 'karantina' then 1
                when i2.question_id is not null or coalesce(b.sayi, 0) > 0 then 2
                when i.question_id is not null then 3
                else 4 end oncelik,
           i.agirlik, i.liste, b.sayi, b.sebepler,
           to_jsonb(i2) - 'question_id' - 'kategori' istatistik
      from public.questions q
      left join son s on s.question_id = q.id
      left join isaret i on i.question_id = q.id
      left join _ist i2 on i2.question_id = q.id
      left join bild b on b.question_id = q.id
     where q.denetim_durumu in ('bekliyor', 'karantina')
       and (q.aktif or q.denetim_durumu = 'karantina')
       and not (s.durum is not distinct from 'bekliyor' and s.sebep is not distinct from 'disa_aktarildi')
     order by oncelik, coalesce(i2.agirlik, 0) desc, coalesce(b.sayi, 0) desc, coalesce(i.agirlik, 0) desc, q.created_at
     limit v_adet
  ),
  kayit as (
    insert into public.soru_denetim (question_id, durum, sebep, kaynak, denetleyen)
    select a.id, 'bekliyor', 'disa_aktarildi', p_parti, 'soru:disari' from aday a
    returning question_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'kategori', a.kategori, 'zorluk', a.zorluk, 'aktif', a.aktif, 'denetim_durumu', a.denetim_durumu,
      'surum', a.surum, 'oncelik', a.oncelik, 'soru', a.soru, 'secenekler', a.secenekler,
      'dogru_indeks', a.dogru_cevap, 'dogru_metin', a.secenekler ->> a.dogru_cevap,
      'isaretler', coalesce(a.liste, '[]'::jsonb), 'istatistik', a.istatistik,
      'bildirim', jsonb_build_object('sayi', coalesce(a.sayi, 0), 'sebepler', coalesce(a.sebepler, '{}'::jsonb)),
      'ceviri_en', (select jsonb_build_object('soru', t.soru, 'secenekler', t.secenekler, 'eskidi', t.eskidi)
                      from public.question_translations t where t.question_id = a.id and t.dil = 'en')
    ) order by a.oncelik, a.agirlik desc nulls last), '[]'::jsonb)
    into v
    from aday a
   where exists (select 1 from kayit k where k.question_id = a.id);
  return v;
end $$;

create or replace function public.soru_denetim_ice_aktar(p_kayitlar jsonb, p_denetleyen text default 'sahip', p_parti text default null)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  r jsonb;
  q public.questions%rowtype;
  v_karar text;
  v_sik jsonb;
  v_dogru int;
  v_soru text;
  v_atlanan jsonb := '[]'::jsonb;
  v_ozet jsonb := jsonb_build_object('onayla', 0, 'duzelt', 0, 'kaldir', 0);
  v_eski_karantina boolean;
  v_i int := 0;
begin
  if jsonb_typeof(p_kayitlar) <> 'array' then raise exception 'Kayıtlar dizi olmalı'; end if;
  for r in select * from jsonb_array_elements(p_kayitlar) loop
    v_i := v_i + 1;
    begin
      v_karar := r ->> 'karar';
      if (r ->> 'id') is null or (r ->> 'id') !~ '^[0-9a-f-]{36}$' then
        v_atlanan := v_atlanan || jsonb_build_object('sira', v_i, 'id', r ->> 'id', 'sebep', 'geçersiz id'); continue;
      end if;
      select * into q from public.questions where id = (r ->> 'id')::uuid for update;
      if not found then
        v_atlanan := v_atlanan || jsonb_build_object('sira', v_i, 'id', r ->> 'id', 'sebep', 'bilinmeyen id'); continue;
      end if;
      if v_karar is null or v_karar not in ('onayla', 'duzelt', 'kaldir') then
        v_atlanan := v_atlanan || jsonb_build_object('sira', v_i, 'id', q.id, 'sebep', 'karar onayla/duzelt/kaldir olmalı'); continue;
      end if;
      v_eski_karantina := q.denetim_durumu = 'karantina';

      if v_karar = 'onayla' then
        update public.questions set denetim_durumu = 'onaylandi', aktif = (aktif or v_eski_karantina) where id = q.id;
        insert into public.soru_denetim (question_id, durum, sebep, kaynak, denetleyen, not_metni)
        values (q.id, 'onaylandi', 'denetim', coalesce(r ->> 'kaynak', p_parti), p_denetleyen, r ->> 'not');

      elsif v_karar = 'kaldir' then
        update public.questions set denetim_durumu = 'reddedildi', aktif = false where id = q.id;
        insert into public.soru_denetim (question_id, durum, sebep, kaynak, denetleyen, not_metni)
        values (q.id, 'reddedildi', 'denetim', coalesce(r ->> 'kaynak', p_parti), p_denetleyen, r ->> 'not');

      else
        v_soru := coalesce(nullif(btrim(r ->> 'soru'), ''), q.soru);
        v_sik := coalesce(r -> 'secenekler', q.secenekler);
        if jsonb_typeof(v_sik) <> 'array' or jsonb_array_length(v_sik) <> 4
           or exists (select 1 from jsonb_array_elements(v_sik) e where jsonb_typeof(e) <> 'string' or btrim(e #>> '{}') = '') then
          v_atlanan := v_atlanan || jsonb_build_object('sira', v_i, 'id', q.id, 'sebep', 'secenekler tam 4 dolu metin olmalı'); continue;
        end if;
        if r ? 'dogru_cevap' then
          if jsonb_typeof(r -> 'dogru_cevap') <> 'number' or (r ->> 'dogru_cevap') !~ '^[0-3]$' then
            v_atlanan := v_atlanan || jsonb_build_object('sira', v_i, 'id', q.id, 'sebep', 'dogru_cevap 0-3 arası tam sayı olmalı'); continue;
          end if;
          v_dogru := (r ->> 'dogru_cevap')::int;
        else
          v_dogru := q.dogru_cevap;
        end if;
        if v_soru = q.soru and v_sik = q.secenekler and v_dogru = q.dogru_cevap then
          v_atlanan := v_atlanan || jsonb_build_object('sira', v_i, 'id', q.id, 'sebep', 'duzelt ama hiçbir alan değişmemiş (onayla kullan)'); continue;
        end if;

        insert into public.soru_surum (question_id, surum, soru, secenekler, dogru_cevap, degisiklik_notu)
        values (q.id, q.surum, q.soru, q.secenekler, q.dogru_cevap, r ->> 'not');
        update public.questions
           set soru = v_soru, secenekler = v_sik, dogru_cevap = v_dogru::smallint,
               surum = q.surum + 1, denetim_durumu = 'duzeltildi', aktif = (aktif or v_eski_karantina)
         where id = q.id;
        -- Türkçe değişti → çeviri eskidi (yeniden çevrilene kadar o dilde sorulmaz)
        update public.question_translations set eskidi = true, eskidi_at = now() where question_id = q.id and not eskidi;
        insert into public.soru_denetim (question_id, durum, sebep, kaynak, denetleyen, not_metni)
        values (q.id, 'duzeltildi', 'denetim', coalesce(r ->> 'kaynak', p_parti), p_denetleyen, r ->> 'not');
      end if;
      v_ozet := jsonb_set(v_ozet, array[v_karar], to_jsonb((v_ozet ->> v_karar)::int + 1));
    exception when others then
      v_atlanan := v_atlanan || jsonb_build_object('sira', v_i, 'id', r ->> 'id', 'sebep', sqlerrm);
    end;
  end loop;
  return jsonb_build_object('toplam', v_i, 'islenen', v_ozet, 'atlanan', v_atlanan);
end $$;

revoke all on function public.soru_normalize(text) from public, anon, authenticated;
revoke all on function public.soru_kelimeler(text) from public, anon, authenticated;
revoke all on function public.soru_isaret_agirligi(text) from public, anon, authenticated;
revoke all on function public.soru_kural_isaretleri(text, jsonb, smallint) from public, anon, authenticated;
revoke all on function public.trg_soru_kural_isaret() from public, anon, authenticated;
revoke all on function public.soru_supheli_haric_mi() from public, anon, authenticated;
revoke all on function public.soru_supheli_tara() from public, anon, authenticated;
revoke all on function public.soru_cevaplari_gercek() from public, anon, authenticated;
revoke all on function public.soru_istatistik_tara() from public, anon, authenticated;
revoke all on function public.soru_cevap_yaz(uuid, uuid, smallint, boolean, text) from public, anon, authenticated;
revoke all on function public.soru_denetim_disa_aktar(integer, text) from public, anon, authenticated;
revoke all on function public.soru_denetim_ice_aktar(jsonb, text, text) from public, anon, authenticated;
grant execute on function public.soru_supheli_tara(), public.soru_istatistik_tara(),
  public.soru_denetim_disa_aktar(integer, text), public.soru_denetim_ice_aktar(jsonb, text, text) to service_role;

-- ---------- Havuz seçimi + cevap kaydı (canlı tanımlara hedefli satırlar) ----------
CREATE OR REPLACE FUNCTION public.soru_sec(p_kategori text, p_adet integer, p_oyuncular uuid[] DEFAULT '{}'::uuid[], p_dil text DEFAULT NULL::text, p_max_okuma integer DEFAULT NULL::integer)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_oyn uuid[] := coalesce(p_oyuncular, '{}'::uuid[]);
  v_adet int := greatest(1, coalesce(p_adet, 1));
  v_kat text := p_kategori;
  v_diller text[];
  v_max int := p_max_okuma;
  v_ids uuid[] := '{}'::uuid[];
  v_deneme int;
  v_supheli_haric boolean := public.soru_supheli_haric_mi();   -- Paket 20 II.6
  v_haric_agirlik int := public.ayar_sayi('soru_rekabetci_haric_agirlik', 2)::int;
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
        -- Paket 20 II.6: denetlenmemiş + kural işaretli soru rekabetçi havuza girmez (ayar: soru_supheli_rekabetci_haric)
        and not (v_supheli_haric and q.denetim_durumu = 'bekliyor' and q.supheli_agirlik >= v_haric_agirlik)
        and q.zorluk >= 2
        and (v_kat is null or q.kategori = v_kat)
        -- HER oyuncunun dilinde okunabilmeli: ya kaynak dil o dil,
        -- ya da o dilde çevirisi var. Aksi halde soru havuzda yok.
        and not exists (
          select 1 from unnest(v_diller) d
           where d <> q.dil
             and not exists (
               select 1 from public.question_translations t
                where t.question_id = q.id and t.dil = d and not t.eskidi
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
$function$;

CREATE OR REPLACE FUNCTION public.turnuva_soru_sec(p_adet integer, p_dil text DEFAULT 'tr'::text)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ids uuid[] := '{}'::uuid[];
  v_parca uuid[];
  v_bant int[][] := array[array[1,2], array[3,3], array[4,5]];
  v_i int;
  v_alt int; v_ust int; v_istenen int; v_kalan int;
  v_genislet int;
  v_supheli_haric boolean := public.soru_supheli_haric_mi();   -- Paket 20 II.6
  v_haric_agirlik int := public.ayar_sayi('soru_rekabetci_haric_agirlik', 2)::int;
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
          and not (v_supheli_haric and q.denetim_durumu = 'bekliyor' and q.supheli_agirlik >= v_haric_agirlik)
          and exists (select 1 from public.question_translations t
                       where t.question_id = q.id and t.dil = 'en' and not t.eskidi)
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
        and not (v_supheli_haric and q.denetim_durumu = 'bekliyor' and q.supheli_agirlik >= v_haric_agirlik)
        and exists (select 1 from public.question_translations t
                     where t.question_id = q.id and t.dil = 'en' and not t.eskidi)
        and q.id <> all(v_ids)
      order by random() limit v_kalan
    ) s;
    v_ids := v_ids || coalesce(v_parca, '{}'::uuid[]);
  end if;

  return v_ids;
end;
$function$;

CREATE OR REPLACE FUNCTION public.duello_soru_bul(p_id uuid, p_kategori text, p_oyuncular uuid[], p_haric uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_adaylar uuid[];
  v_s uuid;
  v_supheli_haric boolean := public.soru_supheli_haric_mi();   -- Paket 20 II.6
  v_haric_agirlik int := public.ayar_sayi('soru_rekabetci_haric_agirlik', 2)::int;
begin
  v_adaylar := public.soru_sec(p_kategori, 8, p_oyuncular);
  foreach v_s in array coalesce(v_adaylar, '{}') loop
    if not (v_s = any(coalesce(p_haric, '{}'))) then return v_s; end if;
  end loop;
  select q.id into v_s from public.questions q
   where q.aktif and q.kategori = p_kategori and not (q.id = any(coalesce(p_haric, '{}')))
     and not (v_supheli_haric and q.denetim_durumu = 'bekliyor' and q.supheli_agirlik >= v_haric_agirlik)
   order by random() limit 1;
  return v_s;
end $function$;

CREATE OR REPLACE FUNCTION public.calisma_baslat(p_kategori text DEFAULT NULL::text, p_soru_sayisi integer DEFAULT 10)
 RETURNS TABLE(oturum_id uuid, soru_sayisi integer, bankadan integer, havuzdan integer, soru_sure_sn integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me uuid := auth.uid();
  v_kat text;
  v_adet int;
  v_banka uuid[] := '{}'::uuid[];
  v_havuz uuid[] := '{}'::uuid[];
  v_tum uuid[] := '{}'::uuid[];
  v_eksik int;
  v_id uuid;
begin
  -- Hız sınırı: yalnız kullanıcı tetikli çağrılar (bkz. migration 115).
  perform public.hiz_siniri('calisma_baslat', 10, interval '60 seconds');
  if v_me is null then raise exception 'Giriş gerekli'; end if;

  v_adet := least(50, greatest(5, coalesce(p_soru_sayisi, 10)));
  v_kat := nullif(btrim(coalesce(p_kategori, '')), '');
  if v_kat is not null
     and not exists (select 1 from public.questions q where q.aktif and q.kategori = v_kat) then
    raise exception 'Geçersiz kategori';
  end if;

  -- Aynı anda tek aktif oturum
  update public.calisma_oturumlari
     set durum = 'bitti', bitis = coalesce(bitis, now())
   where user_id = v_me and durum = 'aktif';

  -- Bankadan: öğrenilmemiş; eski yanlışlar ve çok yanlışlananlar önce
  select coalesce(array_agg(s.question_id), '{}'::uuid[]) into v_banka
  from (
    select ys.question_id
    from public.yanlis_sorular ys
    join public.questions q on q.id = ys.question_id
    where ys.user_id = v_me
      and ys.ogrenildi_at is null
      and q.aktif
      and (v_kat is null or q.kategori = v_kat)
    order by ys.son_yanlis_at asc, ys.yanlis_sayisi desc
    limit v_adet
  ) s;

  v_eksik := v_adet - coalesce(array_length(v_banka, 1), 0);

  -- Yetmezse normal havuzdan (soru_sec görülmemişleri öne alır).
  -- LIMIT, id'lerin satır satır açıldığı iç sorguda olmalı.
  if v_eksik > 0 then
    -- Paket 20 II.6: Hatalarım rekabetçi değil; denetlenmemiş işaretli sorular da gelebilir
    perform set_config('app.soru_havuzu', 'serbest', true);
    select coalesce(array_agg(t.x), '{}'::uuid[]) into v_havuz
    from (
      select s.x
      from (
        select unnest(
          public.soru_sec(
            v_kat,
            v_eksik + coalesce(array_length(v_banka, 1), 0) + 5,
            array[v_me]
          )
        ) as x
      ) s
      where not (s.x = any(v_banka))
      limit v_eksik
    ) t;
    perform set_config('app.soru_havuzu', '', true);
  end if;

  v_tum := v_banka || coalesce(v_havuz, '{}'::uuid[]);

  if coalesce(array_length(v_tum, 1), 0) = 0 then
    raise exception 'Çalışılacak soru bulunamadı';
  end if;

  insert into public.calisma_oturumlari (user_id, kategori, soru_ids, banka_ids)
  values (v_me, v_kat, v_tum, v_banka)
  returning id into v_id;

  return query
  select v_id,
         coalesce(array_length(v_tum, 1), 0),
         coalesce(array_length(v_banka, 1), 0),
         coalesce(array_length(v_havuz, 1), 0),
         20;
end;
$function$;

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
  v_tavan int := public.ayar_sayi('hizli_mod_soru_tavani', 9)::int;   -- 212: oturum başına en çok soru
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
    perform public.soru_cevap_yaz(q.id, auth.uid(), p_cevap, v_dogru, 'hizli');   -- Paket 20 II.4
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

  -- 212: tavana ulaşınca oturum biter, kalan süre kullanılmaz (hızlı cevaplayan daha çok soru görmesin)
  if v_kalan <= 0 or o.aktif_soru >= least(coalesce(array_length(o.soru_ids, 1), 0), greatest(v_tavan, 1)) then
    perform public.hizli_mod_bitir(p_oturum_id);
    v_bitti := true;
    v_kalan := 0;
  end if;

  return query select v_dogru, q.dogru_cevap, o.dogru, v_kalan, v_bitti;
end;
$function$;

CREATE OR REPLACE FUNCTION public.calisma_cevap(p_oturum_id uuid, p_soru_index integer, p_cevap smallint)
 RETURNS TABLE(dogru boolean, dogru_cevap smallint, bankadan boolean, yeni_seri integer, ogrenildi boolean, onceki_yanlis integer, bitti boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  o public.calisma_oturumlari%rowtype;
  q public.questions%rowtype;
  v_dogru boolean;
  v_bankadan boolean;
  v_seri int := 0;
  v_yanlis int := 0;
  v_ogrenildi boolean := false;
  v_bitti boolean := false;
  v_var boolean;
begin
  -- Hız sınırı: yalnız kullanıcı tetikli çağrılar (bkz. migration 115).
  perform public.hiz_siniri('calisma_cevap', 60, interval '60 seconds');
  select * into o from public.calisma_oturumlari where id = p_oturum_id for update;
  if not found then raise exception 'Oturum bulunamadı'; end if;
  if o.user_id <> auth.uid() then raise exception 'Bu oturum senin değil'; end if;
  if o.durum <> 'aktif' then raise exception 'Oturum bitti'; end if;
  if p_soru_index <> o.aktif_soru then raise exception 'Soru değişti'; end if;

  select * into q from public.questions where id = o.soru_ids[o.aktif_soru + 1];
  v_bankadan := q.id = any(o.banka_ids);

  -- Süre 20 sn (+1 sn ağ payı); geçtiyse yanlış sayılır
  if now() > o.soru_baslangic + interval '21 seconds' then
    v_dogru := false;
  else
    v_dogru := (p_cevap = q.dogru_cevap);
    -- Zorluk kalibrasyonu: dogru oranini biriktir (bkz. migration 147).
    perform public.soru_sayac(q.id, v_dogru);
    perform public.soru_cevap_yaz(q.id, o.user_id, p_cevap, v_dogru, 'calisma');   -- Paket 20 II.4
  end if;

  -- Bankadaki satırın önceki durumunu al
  select true, ys.yanlis_sayisi, ys.dogru_serisi
    into v_var, v_yanlis, v_seri
  from public.yanlis_sorular ys
  where ys.user_id = o.user_id and ys.question_id = q.id;

  if v_dogru then
    -- Kategori ustalığı: çalışma modunda da doğrular sayılır
    perform public.kategori_dogru_arttir(o.user_id, q.kategori);

    if coalesce(v_var, false) then
      v_seri := coalesce(v_seri, 0) + 1;
      if v_seri >= 2 then
        v_ogrenildi := true;
        update public.yanlis_sorular ys
           set dogru_serisi = v_seri, ogrenildi_at = now()
         where ys.user_id = o.user_id and ys.question_id = q.id;
      else
        update public.yanlis_sorular ys
           set dogru_serisi = v_seri, ogrenildi_at = null
         where ys.user_id = o.user_id and ys.question_id = q.id;
      end if;
    end if;
    -- Havuzdan gelen soru doğru bilindiyse bankaya hiç girmez.
  else
    -- Yanlış: seri sıfırlanır, banka satırı açılır/güncellenir
    perform public.yanlis_kaydet(q.id);
    v_seri := 0;
    v_yanlis := coalesce(v_yanlis, 0) + 1;
    v_ogrenildi := false;
  end if;

  update public.calisma_oturumlari c
     set dogru = c.dogru + (case when v_dogru then 1 else 0 end),
         yanlis = c.yanlis + (case when v_dogru then 0 else 1 end),
         ogrenilen = c.ogrenilen + (case when v_ogrenildi then 1 else 0 end),
         aktif_soru = c.aktif_soru + 1,
         soru_baslangic = now()
   where c.id = p_oturum_id
  returning c.* into o;

  if o.aktif_soru >= coalesce(array_length(o.soru_ids, 1), 0) then
    v_bitti := true;
  end if;

  return query select v_dogru, q.dogru_cevap, v_bankadan,
                      coalesce(v_seri, 0), v_ogrenildi,
                      coalesce(v_yanlis, 0), v_bitti;
end;
$function$;

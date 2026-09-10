-- Çok dilli soru altyapısı — FAZ 1: şema
--
-- İki katmanlı soru havuzu:
--   kapsam='global' → evrensel bilgi, 8 dile çevrilir, her maçta sorulabilir
--   kapsam='yerel'  → ülkeye özgü, çevrilmez, yalnız tüm oyuncular aynı ülkedense
--
-- Bu migration CANLI OYUNU DEĞİŞTİRMEZ: mevcut soruların tamamı
-- kapsam='yerel', ulke='TR' işaretlenir; ayıklama FAZ 2'de yapılır.

begin;

-- ---------------------------------------------------------------- questions
alter table public.questions
  add column if not exists kapsam     text not null default 'yerel',
  add column if not exists ulke       text,
  add column if not exists kaynak_dil text not null default 'tr';

-- Mevcut tüm sorular Türkçe yerel havuza (dil kolonu zaten 'tr')
update public.questions
   set kapsam = 'yerel',
       ulke = 'TR',
       kaynak_dil = coalesce(nullif(btrim(dil), ''), 'tr')
 where kapsam is distinct from 'yerel'
    or ulke is distinct from 'TR'
    or kaynak_dil is distinct from coalesce(nullif(btrim(dil), ''), 'tr');

alter table public.questions drop constraint if exists questions_kapsam_chk;
alter table public.questions
  add constraint questions_kapsam_chk check (kapsam in ('global', 'yerel'));

-- global → ulke null olmalı; yerel → ulke dolu olmalı
alter table public.questions drop constraint if exists questions_kapsam_ulke_chk;
alter table public.questions
  add constraint questions_kapsam_ulke_chk check (
    (kapsam = 'global' and ulke is null) or
    (kapsam = 'yerel'  and ulke is not null and btrim(ulke) <> '')
  );

alter table public.questions drop constraint if exists questions_ulke_bicim_chk;
alter table public.questions
  add constraint questions_ulke_bicim_chk check (ulke is null or ulke ~ '^[A-Z]{2}$');

alter table public.questions drop constraint if exists questions_kaynak_dil_chk;
alter table public.questions
  add constraint questions_kaynak_dil_chk
  check (kaynak_dil in ('tr','en','de','es','pt','fr','it','ru'));

-- Havuz seçimi bu indeks üzerinden çalışır (soru_sec)
create index if not exists questions_havuz_idx
  on public.questions (kapsam, ulke, kategori) where aktif;

-- `dil` eski kolondur; `kaynak_dil` ile aynı anlamı taşır. Eski yazma yolları
-- (generate-questions edge function, soru migration'ları) `dil` yazmaya devam
-- edebilsin diye ikisi trigger ile senkron tutulur.
create or replace function public.questions_dil_senkron()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.kaynak_dil is distinct from 'tr' then
      new.dil := new.kaynak_dil;
    elsif new.dil is distinct from 'tr' then
      new.kaynak_dil := new.dil;
    end if;
  else
    if new.kaynak_dil is distinct from old.kaynak_dil then
      new.dil := new.kaynak_dil;
    elsif new.dil is distinct from old.dil then
      new.kaynak_dil := new.dil;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_questions_dil_senkron on public.questions;
create trigger trg_questions_dil_senkron
  before insert or update on public.questions
  for each row execute function public.questions_dil_senkron();

-- ------------------------------------------------------- question_translations
-- Şık sırası KORUNUR: dogru_cevap yalnızca questions tablosunda tutulur,
-- çeviride şıklar aynı sırada olmak zorundadır. Aşağıdaki trigger bunu
-- doğrular (şık sayısı eşit, hepsi dolu ve birbirinden farklı).
create table if not exists public.question_translations (
  question_id uuid        not null references public.questions(id) on delete cascade,
  dil         text        not null,
  soru        text        not null,
  secenekler  jsonb       not null,
  created_at  timestamptz not null default now(),
  primary key (question_id, dil)
);

alter table public.question_translations drop constraint if exists qt_dil_chk;
alter table public.question_translations
  add constraint qt_dil_chk check (dil in ('tr','en','de','es','pt','fr','it','ru'));

create index if not exists qt_dil_idx on public.question_translations (dil);

create or replace function public.qt_dogrula()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.questions%rowtype;
  v_n int;
  v_i int;
  v_metin text;
begin
  select * into q from public.questions where id = new.question_id;
  if not found then
    raise exception 'Çeviri: soru bulunamadı (%)', new.question_id;
  end if;

  -- Kaynak dilin kendisi çeviri tablosuna yazılmaz; metin questions'ta durur.
  if new.dil = q.kaynak_dil then
    raise exception 'Çeviri: kaynak dil (%) çeviri olarak yazılamaz', new.dil;
  end if;

  if jsonb_typeof(new.secenekler) <> 'array' then
    raise exception 'Çeviri: secenekler dizi olmalı';
  end if;

  v_n := jsonb_array_length(new.secenekler);
  if v_n <> jsonb_array_length(q.secenekler) then
    raise exception 'Çeviri: şık sayısı kaynakla aynı olmalı (% ≠ %)',
      v_n, jsonb_array_length(q.secenekler);
  end if;

  if btrim(new.soru) = '' then
    raise exception 'Çeviri: soru metni boş olamaz';
  end if;

  for v_i in 0 .. v_n - 1 loop
    v_metin := new.secenekler ->> v_i;
    if v_metin is null or btrim(v_metin) = '' then
      raise exception 'Çeviri: % numaralı şık boş', v_i;
    end if;
  end loop;

  -- Şıklar birbirinden farklı olmalı (yoksa doğru cevap belirsizleşir)
  if (select count(distinct btrim(lower(x))) from jsonb_array_elements_text(new.secenekler) x) <> v_n then
    raise exception 'Çeviri: şıklar birbirinden farklı olmalı';
  end if;

  -- dogru_cevap indeksi çeviride de geçerli olmalı
  if q.dogru_cevap < 0 or q.dogru_cevap >= v_n then
    raise exception 'Çeviri: dogru_cevap indeksi şık sayısının dışında';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_qt_dogrula on public.question_translations;
create trigger trg_qt_dogrula
  before insert or update on public.question_translations
  for each row execute function public.qt_dogrula();

-- RLS: questions ile aynı desen — istemciye hiçbir yetki verilmez,
-- yalnız security definer RPC'ler okur.
alter table public.question_translations enable row level security;
revoke all on public.question_translations from anon, authenticated;

-- ---------------------------------------------------------------- profiles
-- profiles.dil zaten var (default 'tr'); geçersiz değerleri 'en'e çek ve kısıtla.
update public.profiles
   set dil = 'en'
 where dil is null or dil not in ('tr','en','de','es','pt','fr','it','ru');

alter table public.profiles drop constraint if exists profiles_dil_chk;
alter table public.profiles
  add constraint profiles_dil_chk
  check (dil in ('tr','en','de','es','pt','fr','it','ru'));

commit;

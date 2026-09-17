-- ============================================================
-- 210 — Çeviri üretim hattı + kalite güvencesi (Aşama 2C, Bölüm D)
--
-- Sorun: generate-questions yeni soruyu yalnız Türkçe yazıyordu. soru_dilinde()
-- coalesce ile sessizce Türkçeye düştüğü için bozulma görünmüyordu.
--
-- Bu migration hattın VERİ tarafıdır; mantık Edge Function'da (ceviri.ts):
--   1) ceviri_atlanan çok dilli olur: birincil anahtar (question_id, dil),
--      sebep kodu (kod) ve makine ayrıntısı (ayrinti) eklenir.
--   2) ceviri_dil_kurallari: DİLE ÖZEL her şey VERİDE durur — çeviri kuralları,
--      sayı biçimi, oyun terimleri sözlüğü, benzerlik için atılacak kelimeler.
--      Yeni dil = yeni satır; hat kodu değişmez.
--   3) oyun_ayarlari: hedef diller, parti boyu, benzerlik eşiği, süre sınırı.
--   4) Hattın okuduğu RPC'ler (yalnız service_role) + uyarı raporu.
--
-- Sözlük kaynağı: bildim/lib/dil.js (oyun arayüzünün kendi karşılıkları).
-- Arayüzde bir terim değişirse bu satır da güncellenmelidir.
-- ============================================================

begin;

-- ---------------------------------------------------- 1) ceviri_atlanan
alter table public.ceviri_atlanan add column if not exists kod text not null default 'elle';
alter table public.ceviri_atlanan add column if not exists ayrinti jsonb;
alter table public.ceviri_atlanan drop constraint if exists ceviri_atlanan_pkey;
alter table public.ceviri_atlanan add constraint ceviri_atlanan_pkey primary key (question_id, dil);
comment on column public.ceviri_atlanan.kod is
  'Sebep kodu: elle | cevrilemez | geri_kontrol_farkli | geri_kontrol_coklu | sik_sayisi | sik_sirasi | benzer_sik | ozel_isim | sayi | bicim | db_dogrulama';

-- ---------------------------------------------- 2) dil kuralları (veri)
create table if not exists public.ceviri_dil_kurallari (
  dil         text primary key check (dil in ('tr','en','de','es','pt','fr','it','ru')),
  ad          text not null,                       -- modele verilen dil adı ("English")
  aktif       boolean not null default true,
  kurallar    text not null default '',            -- dile özel çeviri kuralları (istem metnine girer)
  ondalik     text not null default '.',           -- sayı biçimi: ondalık ayırıcı
  binlik      text not null default ',',           -- sayı biçimi: binlik ayırıcı
  sozluk      jsonb not null default '{}'::jsonb,  -- oyun terimi (TR) → bu dildeki karşılığı
  atilacak    jsonb not null default '[]'::jsonb,  -- şık benzerliğinde yok sayılan kelimeler (the, a…)
  updated_at  timestamptz not null default now()
);
alter table public.ceviri_dil_kurallari enable row level security;
revoke all on public.ceviri_dil_kurallari from anon, authenticated;

insert into public.ceviri_dil_kurallari (dil, ad, kurallar, ondalik, binlik, sozluk, atilacak) values (
  'en', 'English',
  'Use natural, neutral international English. Keep every digit as digits (do not spell numbers out). '
  || 'Write numbers in English format: decimal point, comma for thousands (1,000.50). Years stay as they are (1453). '
  || 'Proper names of people, places, works and brands keep their international spelling and are NEVER translated as common nouns '
  || '(the poet Cami is "Jami", not "Mosque"; Kaz Dağları is "Kaz Mountains", not "Goose Mountains"). '
  || 'Use a well-established English exonym only when one exists (İstanbul → Istanbul, Kızıl Meydan → Red Square) and list it in yerlesik_adlar. '
  || 'Keep the options parallel in length and grammar; do not make the correct option longer or more specific than the others.',
  '.', ',',
  jsonb_build_object(
    'Quiz Tactics', 'Quiz Tactics',
    'Normal Maç', 'Normal Match', 'Hızlı Mod', 'Quick Mode', 'Düello', 'Duel', 'Turnuva', 'Tournament',
    'Grup Maçı', 'Group Match', 'Dereceli', 'Ranked', 'Serbest', 'Casual', 'Altın Soru', 'Golden Question',
    'Zaman Baskısı', 'Time Pressure', 'Soru Değiştir', 'Swap Question', 'Savunma Kilidi', 'Defense Lock', 'Ek Süre', 'Extra Time',
    'Bronz', 'Bronze', 'Gümüş', 'Silver', 'Altın', 'Gold', 'Elmas', 'Diamond', 'Efsane', 'Legend',
    'Taç', 'Crown', 'Pelerin', 'Cape', 'Uzay Kıyafeti', 'Space Suit',
    'Lig', 'League', 'Dükkân', 'Shop', 'Meydan', 'Plaza', 'Gardırop', 'Wardrobe', 'Joker', 'Joker', 'Coin', 'Coins'
  ),
  '["the","a","an","of"]'::jsonb
) on conflict (dil) do nothing;

-- ---------------------------------------------------------- 3) ayarlar
insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('ceviri_hedef_diller', '["en"]'::jsonb, 'generate-questions yeni soruyu bu dillere çevirir (ceviri_dil_kurallari satırı aktif olmalı)'),
  ('ceviri_parti_boyu', '10'::jsonb, 'Tek çeviri/geri kontrol çağrısındaki soru sayısı (geriye dönük çalıştırmada üst sınır da budur)'),
  ('ceviri_benzerlik_esigi', '0.9'::jsonb, 'Çeviride iki şık normalize edilince bu oranın üstünde benzerse (kaynakta değilken) çeviri atlanır'),
  ('ceviri_sure_siniri_sn', '100'::jsonb, 'Üretim çağrısında bu süre geçildiyse çeviri o çağrıda yapılmaz, geriye dönük çalıştırmaya kalır')
on conflict (anahtar) do nothing;

-- -------------------------------------------- 4) hattın okuduğu RPC'ler
-- Çevirisi olmayan ve atlanmamış aktif sorular (geriye dönük çalıştırma).
create or replace function public.ceviri_bekleyen_sorular(p_dil text, p_adet int)
returns table(id uuid, soru text, secenekler jsonb, dogru_cevap smallint, kategori text)
language sql stable security definer set search_path to 'public'
as $$
  select q.id, q.soru, q.secenekler, q.dogru_cevap, q.kategori
    from public.questions q
   where q.aktif and q.kaynak_dil <> p_dil
     and not exists (select 1 from public.question_translations t where t.question_id = q.id and t.dil = p_dil)
     and not exists (select 1 from public.ceviri_atlanan a where a.question_id = q.id and a.dil = p_dil)
   order by q.created_at
   limit greatest(1, least(coalesce(p_adet, 10), 50));
$$;

-- Kuru deneme için: çevirisi OLAN rastgele sorular (hiçbir şey yazılmaz).
create or replace function public.ceviri_ornek_sorular(p_dil text, p_adet int)
returns table(id uuid, soru text, secenekler jsonb, dogru_cevap smallint, kategori text, mevcut_soru text, mevcut_secenekler jsonb)
language sql volatile security definer set search_path to 'public'
as $$
  select q.id, q.soru, q.secenekler, q.dogru_cevap, q.kategori, t.soru, t.secenekler
    from public.questions q
    join public.question_translations t on t.question_id = q.id and t.dil = p_dil
   where q.aktif
   order by random()
   limit greatest(1, least(coalesce(p_adet, 10), 50));
$$;

-- ------------------------------------------------- 5) uyarı raporu
-- coalesce sessizce Türkçeye düştüğü için sayılar görünür olmalı:
--   select * from public.ceviri_uyari_raporu();
--   select * from public.ceviri_atlanan_dagilim();
create or replace function public.ceviri_uyari_raporu()
returns table(dil text, aktif_soru bigint, cevirili bigint, atlanan bigint, cevirisiz bigint)
language sql stable security definer set search_path to 'public'
as $$
  select k.dil,
         count(q.id),
         count(q.id) filter (where exists (select 1 from public.question_translations t where t.question_id = q.id and t.dil = k.dil)),
         count(q.id) filter (where exists (select 1 from public.ceviri_atlanan a where a.question_id = q.id and a.dil = k.dil)),
         count(q.id) filter (where not exists (select 1 from public.question_translations t where t.question_id = q.id and t.dil = k.dil)
                               and not exists (select 1 from public.ceviri_atlanan a where a.question_id = q.id and a.dil = k.dil))
    from public.ceviri_dil_kurallari k
    left join public.questions q on q.aktif and q.kaynak_dil <> k.dil
   where k.aktif
   group by k.dil
   order by k.dil;
$$;

create or replace function public.ceviri_atlanan_dagilim()
returns table(dil text, kod text, adet bigint, ornek_neden text)
language sql stable security definer set search_path to 'public'
as $$
  select a.dil, a.kod, count(*), min(a.neden)
    from public.ceviri_atlanan a
    join public.questions q on q.id = a.question_id and q.aktif
   group by a.dil, a.kod
   order by a.dil, count(*) desc;
$$;

revoke all on function public.ceviri_bekleyen_sorular(text, int) from public, anon, authenticated;
revoke all on function public.ceviri_ornek_sorular(text, int) from public, anon, authenticated;
revoke all on function public.ceviri_uyari_raporu() from public, anon, authenticated;
revoke all on function public.ceviri_atlanan_dagilim() from public, anon, authenticated;
grant execute on function public.ceviri_bekleyen_sorular(text, int) to service_role;
grant execute on function public.ceviri_ornek_sorular(text, int) to service_role;
grant execute on function public.ceviri_uyari_raporu() to service_role;
grant execute on function public.ceviri_atlanan_dagilim() to service_role;

commit;

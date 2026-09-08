-- ============================================================
-- 56 — KATEGORİ BİRLEŞTİRME
--
-- Sorun (canlı sitede görüldü): kategori seçicide üç şey birden duruyordu —
--   * "Karışık" (tüm kategoriler, kategori seçmemek demek)
--   * eski `karisik` kategorisi (36 soru)
--   * eski `genel` kategorisi (221 soru)
-- Üçü de aynı şeyi çağrıştırdığı için oyuncu ne seçtiğini anlamıyordu.
--
-- Çözüm: `genel` ve `karisik` kategorilerindeki sorular `genel_kultur`'a taşınır;
-- `get_categories` bu iki anahtarı hiç döndürmez. Böylece "Karışık = kategori
-- seçme" tek seçenek olarak kalır.
--
-- NOT: 055 numarası daha önce `seri_hatirlatma` için kullanıldı; bu yüzden
-- kategori birleştirme 056, soru kalitesi 057 numarasını aldı.
-- ============================================================

-- ---------- 1) Soruları taşı ----------
update public.questions
   set kategori = 'genel_kultur'
 where kategori in ('genel', 'karisik');

-- ---------- 2) Kategoriye bağlı kayıtları da taşı ----------
-- Devam eden/bekleyen maçlar boşta kalmasın
update public.matches        set kategori = 'genel_kultur' where kategori in ('genel','karisik');
update public.group_matches  set kategori = 'genel_kultur' where kategori in ('genel','karisik');
update public.hizli_maclar   set kategori = 'genel_kultur' where kategori in ('genel','karisik');

-- Hızlı mod oturumları ve skorları
update public.hizli_mod_oturumlar set kategori = 'genel_kultur' where kategori in ('genel','karisik');
update public.hizli_mod_skorlar   set kategori = 'genel_kultur' where kategori in ('genel','karisik');

-- Oyuncuların varsayılan kategorisi
update public.profiles set tercih_kategori = 'genel_kultur' where tercih_kategori in ('genel','karisik');

-- Eşleştirme kuyruğu
update public.matchmaking_queue set kategori = 'genel_kultur' where kategori in ('genel','karisik');

-- ---------- 3) Kategori ustalığı sayaçlarını birleştir ----------
-- Aynı oyuncunun genel/karisik doğrularını genel_kultur'a ekle, sonra eskileri sil.
with toplam as (
  select user_id, sum(dogru_sayisi)::int as adet
  from public.kategori_dogru
  where kategori in ('genel','karisik')
  group by user_id
)
insert into public.kategori_dogru (user_id, kategori, dogru_sayisi)
select t.user_id, 'genel_kultur', t.adet from toplam t
on conflict (user_id, kategori) do update
  set dogru_sayisi = public.kategori_dogru.dogru_sayisi + excluded.dogru_sayisi;

delete from public.kategori_dogru where kategori in ('genel','karisik');

-- ---------- 4) get_categories: eski anahtarları hiç döndürme ----------
drop function if exists public.get_categories();
create or replace function public.get_categories()
returns table (kategori text, soru_sayisi bigint, gorulen_sayisi bigint)
language sql
stable
security definer
set search_path = public
as $$
  select q.kategori,
         count(*) as soru_sayisi,
         count(*) filter (where g.user_id is not null) as gorulen_sayisi
  from public.questions q
  left join public.gorulen_sorular g
    on g.question_id = q.id and g.user_id = auth.uid()
  where q.aktif
    and q.dil = coalesce((select pr.dil from public.profiles pr where pr.id = auth.uid()), 'tr')
    -- 'genel' ve 'karisik' birleştirildi; "Karışık" artık kategori SEÇMEMEK demek
    and q.kategori not in ('genel', 'karisik')
  group by q.kategori
  having count(*) >= 15
  order by (q.kategori = 'genel_kultur') desc, count(*) desc;
$$;

revoke execute on function public.get_categories() from public, anon;
grant execute on function public.get_categories() to authenticated;

-- ---------- 5) tercih_kategori doğrulaması eski anahtarları kabul etmesin ----------
create or replace function public.tercih_kategori_kaydet(p_kategori text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kat text;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  v_kat := nullif(btrim(coalesce(p_kategori, '')), '');

  if v_kat in ('genel', 'karisik') then
    v_kat := 'genel_kultur';           -- eski anahtarlar birleştirildi
  end if;

  if v_kat is not null
     and not exists (
       select 1 from public.questions q
       where q.aktif and q.kategori = v_kat and q.kategori not in ('genel','karisik')
     )
  then
    raise exception 'Geçersiz kategori';
  end if;

  update public.profiles set tercih_kategori = v_kat where id = auth.uid();
end;
$$;

revoke execute on function public.tercih_kategori_kaydet(text) from public, anon;
grant execute on function public.tercih_kategori_kaydet(text) to authenticated;

-- ============================================================
-- "HIZLI OLAN KAZANIR" MAÇI AÇILMIYORDU (KRİTİK)
--
-- Belirti: yarış kuruluyor, /bildim/hizli-mac/<id> adresine gidiliyor, sayfa
-- kalıcı olarak "Yükleniyor…" kalıyor. Konsolda hata yok — sessiz kilitlenme.
-- Grup maçında aynı akış sorunsuz çalışıyor.
--
-- GERÇEK KÖK NEDEN (tahmin değil, sorgu çalıştırılarak bulundu):
--   select ... from hizli_oyuncular where hizli_mac_id = '<id>'
--   → ERROR: infinite recursion detected in policy for relation "hizli_oyuncular"
--
-- `hizli_oyuncular_select_own` politikası KENDİ TABLOSUNU sorguluyordu:
--     exists (select 1 from hizli_oyuncular ho2
--             where ho2.hizli_mac_id = hizli_oyuncular.hizli_mac_id
--               and ho2.user_id = auth.uid())
-- Alt sorguya da RLS uygulandığı için özyineleme oluşuyor. `hizli_maclar`
-- politikası da aynı tabloyu sorguladığından o da tetikleniyordu.
--
-- Grup maçında bu sorun YOK, çünkü orada `grup_mac_uyesi_mi(uuid)` adında bir
-- SECURITY DEFINER yardımcı fonksiyon kullanılmış (RLS'i baypas eder).
-- Aynı desen hızlı maça uygulanmamış. Bu migration onu uyguluyor.
-- ============================================================

-- Grup maçındaki `grup_mac_uyesi_mi` ile birebir aynı desen
create or replace function public.hizli_mac_uyesi_mi(p_hizli_mac_id uuid)
returns boolean
language sql
stable
security definer          -- RLS'i baypas eder → özyineleme kırılır
set search_path = public
as $$
  select exists (
    select 1 from public.hizli_oyuncular ho
    where ho.hizli_mac_id = p_hizli_mac_id
      and ho.user_id = auth.uid()
  );
$$;

revoke execute on function public.hizli_mac_uyesi_mi(uuid) from public, anon;
grant execute on function public.hizli_mac_uyesi_mi(uuid) to authenticated;

-- Politikalar artık yardımcı fonksiyonu kullanıyor
drop policy if exists "hizli_oyuncular_select_own" on public.hizli_oyuncular;
create policy "hizli_oyuncular_select_own" on public.hizli_oyuncular for select
  using (public.hizli_mac_uyesi_mi(hizli_mac_id));

drop policy if exists "hizli_maclar_select_own" on public.hizli_maclar;
create policy "hizli_maclar_select_own" on public.hizli_maclar for select
  using (public.hizli_mac_uyesi_mi(id));

-- ------------------------------------------------------------
-- Yarım kalmış hızlı maçları toparlama
-- ------------------------------------------------------------

-- Bildirilen takılı maç kapatılıyor
update public.hizli_maclar
   set durum = 'iptal', bitis = coalesce(bitis, now())
 where id = 'ddeae48c-f282-424b-b17a-62b416e58984'
   and durum <> 'bitti';

-- 10 dakikadır ilerlememiş hızlı maçları kapatan temizlik
create or replace function public.hizli_mac_temizle()
returns void
language sql
security definer
set search_path = public
as $$
  update public.hizli_maclar
     set durum = 'iptal', bitis = coalesce(bitis, now())
   where durum in ('bekliyor', 'aktif')
     and coalesce(soru_baslangic, created_at) < now() - interval '10 minutes';
$$;

revoke execute on function public.hizli_mac_temizle() from public, anon, authenticated;

-- Aynı temizlik grup maçları için de (yarım kalan maç birikmesin)
create or replace function public.grup_mac_temizle()
returns void
language sql
security definer
set search_path = public
as $$
  update public.group_matches
     set durum = 'iptal', bitis = coalesce(bitis, now())
   where durum in ('bekliyor', 'aktif')
     and coalesce(soru_baslangic, created_at) < now() - interval '30 minutes';
$$;

revoke execute on function public.grup_mac_temizle() from public, anon, authenticated;

-- Saatte bir çalışsın
select cron.schedule(
  'bildim-yarim-mac-temizle',
  '15 * * * *',
  $cron$select public.hizli_mac_temizle(); select public.grup_mac_temizle();$cron$
);

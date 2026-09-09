-- ============================================================
-- GÜVENLİK/GİZLİLİK: profiles tablosu herkese açıktı
--
-- BULGU (yayın öncesi denetim, 9 Eylül 2026):
-- `profiles` üzerindeki RLS politikası `using (true)` idi ve SELECT yetkisi
-- `anon` rolüne de verilmişti. Uygulamanın anon anahtarı JS paketinin içinde
-- (tasarım gereği açık) olduğundan, GİRİŞ YAPMADAN tüm profiller dökülebiliyordu.
-- Canlı doğrulama: `GET /rest/v1/profiles?select=*` → 27 kayıt, içinde
--   * `username`  — gerçek addan türetiliyor (ör. "emiralkaya_12cd"),
--   * `avatar_url` — Google profil fotoğrafı adresi (gerçek yüz),
--   * `davet_kodu`, `provider`, `last_seen`, `hile_yetkisi`.
-- Oyun ekranda "Gerçek adın hiçbir zaman gösterilmez" sözü veriyor; API
-- seviyesinde bu söz tutulmuyordu. KVKK/GDPR açısından da yayın engeli.
--
-- Ayrıca `anon` ve `authenticated` rollerinde profiles üzerinde
-- INSERT / DELETE / TRUNCATE / TRIGGER / REFERENCES yetkileri vardı.
-- TRUNCATE RLS'e tabi DEĞİLDİR; bu yetki hiç durmamalı.
--
-- ÇÖZÜM
--  1) anon'un profiles erişimi tamamen kaldırıldı (oyun zaten giriş istiyor).
--  2) authenticated yalnız GÖSTERİM sütunlarını okuyabiliyor
--     (id, gorunen_ad, gorunen_avatar, puan, ...). Gerçek adı taşıyan
--     `username`, Google fotoğrafı `avatar_url`, `davet_kodu` ve diğer özel
--     alanlar artık başkası tarafından okunamıyor.
--  3) Oyuncu KENDİ tam profilini `profilim()` RPC'siyle alıyor.
--  4) Gereksiz yazma yetkileri geri alındı.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Kendi profilini tam getiren RPC (jsonb: yeni sütun eklenince kırılmaz)
-- ------------------------------------------------------------
create or replace function public.profilim()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(p) from public.profiles p where p.id = auth.uid();
$$;

revoke execute on function public.profilim() from public, anon;
grant execute on function public.profilim() to authenticated;

-- ------------------------------------------------------------
-- 2) Yetkiler: her şeyi geri al, yalnız gerekli olanı ver
-- ------------------------------------------------------------
revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;

-- Başka oyuncularda görünen alanlar (lig, maç listeleri, avatar).
-- `username`, `avatar_url`, `davet_kodu`, `provider`, `hile_yetkisi`,
-- `takma_ad*`, `konum_degisti_at`, `davet_eden` BİLEREK dışarıda.
grant select (
  id, gorunen_ad, gorunen_avatar, puan, puan_hafta, sampiyonluk,
  seri, seri_gun, seri_en_uzun, toplam_mac, ulke, sehir, dil,
  is_bot, bot_isabet, bot_seviye, last_seen, created_at, tercih_kategori
) on public.profiles to authenticated;

-- Oyuncu yalnız kendi satırında sınırlı alanları güncelleyebilir.
-- (Takma ad / avatar / konum zaten doğrulamalı RPC'lerden geçiyor.)
grant update (tercih_kategori, dil, last_seen) on public.profiles to authenticated;

-- ------------------------------------------------------------
-- 3) RLS politikası: anon değil, yalnız giriş yapmış kullanıcı
-- ------------------------------------------------------------
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

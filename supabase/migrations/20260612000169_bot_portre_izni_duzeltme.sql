-- ============================================================
-- BOT PORTRESİ YAZMA İZNİ — DÜZELTME
--
-- Migration ...168'deki politika `public.profiles`'ı DOĞRUDAN sorguluyordu.
-- Politika, çağıranın rolüyle (authenticated) çalışır ve o rolün profiles
-- üzerinde genel SELECT hakkı yok (yalnız belirli kolonlar verilmiş) —
-- bu yüzden yükleme "permission denied for table profiles" ile düşüyordu.
--
-- Kontrol `security definer` bir yardımcıya taşındı: politika artık
-- profiles'a dokunmuyor, yalnız bu fonksiyonu çağırıyor.
-- ============================================================

create or replace function public.bot_portre_yolu_mu(p_ad text)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.profiles p
     where coalesce(p.is_bot, false)
       and p_ad = 'botlar/' || p.id::text || '.png'
  );
$fn$;

grant execute on function public.bot_portre_yolu_mu(text) to authenticated;

drop policy if exists avatarlar_bot_portre_yaz on storage.objects;
create policy avatarlar_bot_portre_yaz on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatarlar' and public.bot_portre_yolu_mu(name));

drop policy if exists avatarlar_bot_portre_guncelle on storage.objects;
create policy avatarlar_bot_portre_guncelle on storage.objects
  for update to authenticated
  using (bucket_id = 'avatarlar' and public.bot_portre_yolu_mu(name))
  with check (bucket_id = 'avatarlar' and public.bot_portre_yolu_mu(name));

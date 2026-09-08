-- ============================================================
-- 46 — Hesap silme (Google Play zorunluluğu)
--
-- Oyuncunun kendi hesabını kalıcı silmesi. public.profiles'a bağlı tüm
-- oyun tabloları `on delete cascade` olduğundan profil satırı silinince
-- maçlar, cevaplar, rozetler, arkadaşlıklar, mesajlar, görülen sorular,
-- lig arşivi ve diğer oyunların (kafatopu_/meyvekes_/pr_/dg_/gl_) kayıtları
-- da silinir.
--
-- auth.users satırı: bu fonksiyon önce onu silmeyi dener (cascade ile profil
-- de gider) ve 'tam' döner.
--
-- DOĞRULANDI (8 Eylül 2026, canlı DB): fonksiyon `postgres` rolüne ait ve bu
-- rol auth.users üzerinde DELETE yetkisine sahip → 'tam' dönüyor, ek bir
-- Edge Function GEREKMİYOR.
--
-- Yedek yol: ileride yetki değişir de auth şemasına yazılamazsa fonksiyon
-- yalnızca public.profiles satırını siler ve 'kismi' döner. O durumda
-- auth.users kaydını temizlemek için service_role anahtarıyla çalışan bir
-- Edge Function (admin.deleteUser) yazılması gerekir.
-- ============================================================

create or replace function public.hesabimi_sil()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;

  if exists (select 1 from public.profiles p where p.id = v_me and coalesce(p.is_bot, false)) then
    raise exception 'Bot hesabı silinemez';
  end if;

  begin
    delete from auth.users where id = v_me;
    return 'tam';
  exception when others then
    -- auth şemasına yetki yoksa en azından tüm oyun verisini sil
    delete from public.profiles where id = v_me;
    return 'kismi';
  end;
end;
$$;

revoke execute on function public.hesabimi_sil() from public, anon;
grant execute on function public.hesabimi_sil() to authenticated;

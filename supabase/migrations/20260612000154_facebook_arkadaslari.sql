-- ============================================================
-- FACEBOOK ARKADAŞ ÖNERİLERİ
--
-- KISIT (bilerek yazılıyor): Facebook 2014'ten beri tam arkadaş listesi
-- vermiyor. `/me/friends` YALNIZ uygulamayı da kullanan arkadaşları
-- döndürür ve `user_friends` izni App Review gerektirir.
--
--   ✅ Yapılan: "Facebook arkadaşların Quiz Square'de" listesi — eşleşenler
--      arkadaş ÖNERİSİ olarak gösterilir.
--   ❌ Yapılmayan: "tüm FB arkadaşlarını davet et" — Facebook'ta mümkün
--      değil. Onun yerine paylaşım/davet diyaloğu kullanılır.
--
-- Eşleştirme için oyuncunun Facebook kimliği profilinde tutulur. Kimlik
-- yalnız EŞLEŞTİRME içindir, hiçbir yerde gösterilmez.
--
-- App Review onayı gelmeden de çalışır: izin yoksa istemci listeyi hiç
-- isteyemez, bölüm sessizce gizlenir, giriş akışı etkilenmez.
-- ============================================================

alter table public.profiles
  add column if not exists facebook_id text;

create unique index if not exists profiles_facebook_id_idx
  on public.profiles (facebook_id) where facebook_id is not null;

-- Kendi Facebook kimliğini kaydeder (giriş sonrası bir kez).
create or replace function public.facebook_kimligi_kaydet(p_fb_id text)
returns void language plpgsql security definer set search_path to 'public' as $fkk$
declare
  v_me uuid := auth.uid();
  v_temiz text;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  v_temiz := nullif(btrim(coalesce(p_fb_id, '')), '');
  if v_temiz is null or length(v_temiz) > 64 then return; end if;

  -- Başka bir hesapta kayıtlıysa dokunma: hesap birleştirme Auth tarafının
  -- işi (aynı e-posta ile kimlik bağlama), burada ikinci sahip yaratmayız.
  if exists (select 1 from public.profiles
              where facebook_id = v_temiz and id <> v_me) then
    return;
  end if;

  update public.profiles set facebook_id = v_temiz where id = v_me;
end;
$fkk$;

grant execute on function public.facebook_kimligi_kaydet(text) to authenticated;

-- Facebook arkadaş id'lerinden Quiz Square oyuncularını bulur.
-- Zaten arkadaş olduklarım ve botlar listeye girmez.
create or replace function public.facebook_arkadas_onerileri(p_fb_idler text[])
returns table(user_id uuid, gorunen_ad text, gorunen_avatar text)
language sql stable security definer set search_path to 'public' as $$
  select p.id, p.gorunen_ad, p.gorunen_avatar
  from public.profiles p
  where p.facebook_id = any(coalesce(p_fb_idler, '{}'::text[]))
    and p.id <> auth.uid()
    and not coalesce(p.is_bot, false)
    and not exists (
      select 1 from public.friendships f
      where ((f.requester = auth.uid() and f.addressee = p.id)
          or (f.requester = p.id and f.addressee = auth.uid()))
    )
  order by p.gorunen_ad
  limit 50;
$$;

grant execute on function public.facebook_arkadas_onerileri(text[]) to authenticated;

-- ============================================================
-- YENİ OYUNCU: rastgele bedava karakterle başlar
--
-- İlk girişte oyuncu görünüm sayfasına YÖNLENDİRİLİR ama seçim yapmaya
-- ZORLANMAZ. Seçmezse hesabına açılışta rastgele bir bedava karakter
-- yazılır — herkes aynı karakterle dolaşmasın, oyun ölü görünmesin.
-- Karakter zaten seçilmişse dokunulmaz.
-- ============================================================
create or replace function public.ucretsiz_karakter_ve_parca_ver(p_user uuid)
returns void language plpgsql security definer set search_path to 'public' as $ukp$
declare v_kar text;
begin
  if p_user is null then return; end if;

  insert into public.oyuncu_karakterleri (user_id, karakter_id, kaynak)
  select p_user, k.id, 'baslangic'
    from public.karakterler k where k.aktif and k.baslangic
  on conflict do nothing;

  insert into public.oyuncu_esyalari (user_id, esya_kod, kaynak)
  select p_user, e.kod, 'baslangic'
    from public.esyalar e
   where e.aktif and e.sistem = '2b' and e.coin_fiyat = 0
  on conflict do nothing;

  -- Henüz karakteri yoksa rastgele bir BEDAVA karakterle başlat
  if not exists (
    select 1 from public.profiles p
     where p.id = p_user and coalesce(p.gorunum, '{}'::jsonb) ? 'karakter'
  ) then
    select k.id into v_kar
      from public.karakterler k
     where k.aktif and k.baslangic
     order by random() limit 1;
    if v_kar is not null then
      update public.profiles
         set gorunum = coalesce(gorunum, '{}'::jsonb) || jsonb_build_object('karakter', v_kar)
       where id = p_user;
    end if;
  end if;
end;
$ukp$;

-- Mevcut hesaplara da uygula (karakteri olmayanlara rastgele bedava karakter)
do $ilk$
declare r record;
begin
  for r in select id from public.profiles where not coalesce(is_bot, false) loop
    perform public.ucretsiz_karakter_ve_parca_ver(r.id);
  end loop;
end
$ilk$;

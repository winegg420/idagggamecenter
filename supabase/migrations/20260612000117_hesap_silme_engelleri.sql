-- ============================================================================
-- DÜZELTME: Bazı oyuncular hesabını SİLEMİYORDU
--
-- hesabimi_sil() auth.users'tan siliyor ve cascade'e güveniyor. Ama beş
-- yabancı anahtar ON DELETE NO ACTION idi; silinmeyen bir satır kullanıcıya
-- işaret ediyorsa silme FK ihlaliyle patlıyordu.
--
-- UÇTAN UCA TESTLE DOĞRULANAN İKİ ENGEL (bildim/_test/hesap-silme-test.mjs
-- ve kenar durum denemeleri):
--
--   B) TURNUVA KAZANMIŞ oyuncu silinemiyordu
--      → "violates foreign key constraint tournaments_kazanan_fkey"
--      Turnuva kaydı paylaşılan bir varlık; oyuncuyla birlikte silinmez,
--      bu yüzden kazanan referansı ayakta kalıp silmeyi bloke ediyordu.
--
--   C) BAŞKASINI DAVET ETMİŞ oyuncu silinemiyordu
--      → "violates foreign key constraint profiles_davet_eden_fkey"
--      Davet ettiği kişinin profili duruyor ve davet_eden ona işaret ediyor.
--      Oyun daveti aktif olarak teşvik ediyor ("her davet için ikiniz de
--      +50 puan"), yani bu nadir değil — davet eden herkesi etkiler.
--
-- 1v1 / grup / hızlı maç kazananları ETKİLENMİYORDU çünkü o maç satırları
-- zaten oyuncuyla birlikte cascade siliniyor. Yine de aynı tuzağa bir daha
-- düşülmesin diye o üç kısıt da SET NULL yapıldı.
--
-- ÇÖZÜM: kazanan/davet_eden alanları ON DELETE SET NULL. Kayıt korunur
-- (turnuva geçmişi, davet edilenin profili), yalnız silinen kişiye olan
-- bağ kopar. Silme = veri kaybı değil, bağ kopması.
--
-- AYRICA: pr_error_logs.user_id'nin yabancı anahtarı YOK (tek istisna).
-- 7 günde bir otomatik temizleniyor ama silme talebinde hemen gitmeli;
-- hesabimi_sil() artık onu açıkça siliyor.
-- ============================================================================

alter table public.tournaments   drop constraint tournaments_kazanan_fkey;
alter table public.tournaments   add  constraint tournaments_kazanan_fkey
  foreign key (kazanan) references public.profiles(id) on delete set null;

alter table public.profiles      drop constraint profiles_davet_eden_fkey;
alter table public.profiles      add  constraint profiles_davet_eden_fkey
  foreign key (davet_eden) references public.profiles(id) on delete set null;

alter table public.matches       drop constraint matches_kazanan_fkey;
alter table public.matches       add  constraint matches_kazanan_fkey
  foreign key (kazanan) references public.profiles(id) on delete set null;

alter table public.group_matches drop constraint group_matches_kazanan_fkey;
alter table public.group_matches add  constraint group_matches_kazanan_fkey
  foreign key (kazanan) references public.profiles(id) on delete set null;

alter table public.hizli_maclar  drop constraint hizli_maclar_kazanan_fkey;
alter table public.hizli_maclar  add  constraint hizli_maclar_kazanan_fkey
  foreign key (kazanan) references public.profiles(id) on delete set null;

-- Yabancı anahtarı olmayan tek tablo: PatiRun hata günlüğü.
create or replace function public.hesabimi_sil()
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;

  if exists (select 1 from public.profiles p where p.id = v_me and coalesce(p.is_bot, false)) then
    raise exception 'Bot hesabı silinemez';
  end if;

  -- Yabancı anahtarı olmadığı için cascade'e takılmayan kayıtlar:
  begin
    delete from public.pr_error_logs where user_id = v_me;
  exception when undefined_table then
    null; -- PatiRun kurulu değilse sorun yok
  end;

  begin
    delete from auth.users where id = v_me;
    return 'tam';
  exception when others then
    -- auth şemasına yetki yoksa en azından tüm oyun verisini sil
    delete from public.profiles where id = v_me;
    return 'kismi';
  end;
end;
$function$;

-- Alt bardaki "bekleyen" rozetinin sayımı tek RPC'ye taşındı.
--
-- ÖNCESİ: Layout.jsx iki ayrı PostgREST HEAD isteği atıyordu
--   HEAD /matches?select=id&oyuncu2=eq.<uid>&durum=eq.bekliyor      (count=exact)
--   HEAD /friendships?select=id&addressee=eq.<uid>&durum=eq.bekliyor (count=exact)
-- Canlı ağ denetiminde bu iki isteğin 503 döndüğü, sayının null geldiği ve
-- rozetin hiç görünmediği raporlandı. Üstelik istemcide `error` hiç
-- okunmuyordu, yani hata sessizce yutuluyordu.
--
-- SONRASI: tek çağrı, sayım sunucuda. RLS altında iki ayrı `count=exact`
-- taraması yerine tek fonksiyon çalışıyor; istemci de tek sayı alıyor.
--
-- auth.uid() kullanıldığı için oyuncu yalnız KENDİ bekleyenlerini sayar;
-- parametre yok, başkasının sayısı sorulamaz.

begin;

create or replace function public.bekleyen_sayim()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.matches
      where oyuncu2 = auth.uid() and durum = 'bekliyor')
    +
    (select count(*) from public.friendships
      where addressee = auth.uid() and durum = 'bekliyor')
$$;

revoke execute on function public.bekleyen_sayim() from public, anon;
grant execute on function public.bekleyen_sayim() to authenticated;

commit;

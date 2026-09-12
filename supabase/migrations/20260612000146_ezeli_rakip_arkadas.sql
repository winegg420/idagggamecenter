-- ============================================================
-- "Ezeli rakip" istatistiği yalnız arkadaşlarla tutulur
--
-- Sahibinin sözü: "tanımadığımız insanlarla aramızdaki istatistiği
-- tutmayalım, bu hiçbir oyunda yok."
--
-- Rastgele eşleşilen tanımadık oyuncularla karşılıklı skor artık
-- GÖSTERİLMEZ. Maç bitiminde "tekrar oyna" düğmesi kalabilir — o anlık,
-- kalıcı kayıt yok. Mevcut maç kayıtları silinmiyor; yalnız bu özet
-- arkadaş listesiyle sınırlanıyor.
-- ============================================================

create or replace function public.ezeli_rakip()
 returns table(user_id uuid, gorunen_ad text, gorunen_avatar text,
               toplam integer, galibiyet integer, maglubiyet integer, beraberlik integer)
 language sql stable security definer set search_path to 'public'
as $function$
  with maclar as (
    select
      case when m.oyuncu1 = auth.uid() then m.oyuncu2 else m.oyuncu1 end as rakip,
      m.kazanan
    from public.matches m
    where m.durum = 'bitti'
      and auth.uid() in (m.oyuncu1, m.oyuncu2)
      -- YALNIZ ARKADAŞLAR: tanımadık rakiple karşılıklı istatistik tutulmaz.
      and exists (
        select 1 from public.friendships f
        where f.durum = 'arkadas'
          and ((f.requester = auth.uid()
                and f.addressee = case when m.oyuncu1 = auth.uid() then m.oyuncu2 else m.oyuncu1 end)
            or (f.addressee = auth.uid()
                and f.requester = case when m.oyuncu1 = auth.uid() then m.oyuncu2 else m.oyuncu1 end))
      )
  ), ozet as (
    select rakip,
           count(*)::int as toplam,
           count(*) filter (where kazanan = auth.uid())::int as galibiyet,
           count(*) filter (where kazanan is not null and kazanan <> auth.uid())::int as maglubiyet,
           count(*) filter (where kazanan is null)::int as beraberlik
    from maclar
    group by rakip
    having count(*) >= 3
  )
  select o.rakip, p.gorunen_ad, p.gorunen_avatar, o.toplam, o.galibiyet, o.maglubiyet, o.beraberlik
  from ozet o
  join public.profiles p on p.id = o.rakip
  order by o.toplam desc, o.maglubiyet desc
  limit 1;
$function$;

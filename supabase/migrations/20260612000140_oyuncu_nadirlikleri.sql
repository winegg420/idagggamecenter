-- ============================================================
-- OYUNCU NADİRLİKLERİ — avatar çerçevesi için
--
-- Çerçeve rengi, oyuncunun GİYDİĞİ en yüksek nadirlikteki eşyadan gelir
-- ('sirali' < 'ozel' < 'etkinlik'). İstemci bunu kendi hesaplayamıyor:
-- `profiles` üzerinde `authenticated` rolüne KOLON KOLON select verilmiş
-- (gizlilik beyaz listesi) ve `gorunum` o listede YOK — bilerek. Ham görünüm
-- kaydını açmak yerine yalnız SONUCU döndüren bu RPC veriliyor.
--
-- Tek çağrıda çok kimlik: lig tablosu 100 satır çizerken 100 istek atılmasın.
-- İstemci (bildim/lib/nadirlik.js) çağrıları aynı karede toplayıp tek seferde
-- gönderir ve sonucu önbelleğe alır.
--
-- RPC yoksa (migration henüz uygulanmadıysa) istemci sessizce 'sirali'
-- çerçeveye düşer; hiçbir ekran bozulmaz.
-- ============================================================
create or replace function public.oyuncu_nadirlikleri(p_idler uuid[])
returns table(id uuid, nadirlik text)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    p.id,
    case coalesce((
      select max(
        case e.nadirlik
          when 'etkinlik' then 3
          when 'ozel' then 2
          else 1
        end
      )
      from public.esyalar e
      where e.kod in (
        p.gorunum->>'sac',   p.gorunum->>'gozluk', p.gorunum->>'kupe',
        p.gorunum->>'sapka', p.gorunum->>'ust',    p.gorunum->>'alt',
        p.gorunum->>'ayakkabi', p.gorunum->>'efekt'
      )
    ), 1)
      when 3 then 'etkinlik'
      when 2 then 'ozel'
      else 'sirali'
    end
    from public.profiles p
   where p.id = any(p_idler);
$fn$;

revoke all on function public.oyuncu_nadirlikleri(uuid[]) from public, anon;
grant execute on function public.oyuncu_nadirlikleri(uuid[]) to authenticated;

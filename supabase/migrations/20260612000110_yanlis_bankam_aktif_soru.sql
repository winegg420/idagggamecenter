-- ============================================================================
-- DÜZELTME: "Hatalarım" sayacı, çalışılamayacak soruları da sayıyordu
--
-- BELİRTİ: Profil ve Çalışma ekranında "Bankanda N soru var" yazıyor ama o
-- sayıya asla ulaşılamıyor; bir kısmı hiç soru olarak gelmiyor ve bankadan
-- düşmüyor.
--
-- KÖK NEDEN: calisma_baslat soruları seçerken `q.aktif` filtresi uyguluyor
-- (pasife alınmış sorular oyuncuya gösterilmez). yanlis_bankam ise bu filtreyi
-- uygulamıyordu; pasife alınmış soruların bankadaki kayıtlarını da sayıyordu.
-- Ölçüm (düzeltme anında): 16 kullanıcının bankasında toplam 47 ölü kayıt.
-- En uçtaki örnek: 4 soruluk bankanın 2'si ölü.
--
-- KARAR: `bekleyen` ve kategori kırılımı artık yalnız AKTİF soruları sayıyor —
-- yani calisma_baslat'ın gerçekten verebileceği soruları. `ogrenilen` bilerek
-- filtrelenmedi: o bir başarı sayacı ("Bugüne kadar toplam N soru öğrendin"),
-- bir soru sonradan pasife alındı diye geriye gitmesi yanlış olurdu.
-- `toplam` = ogrenilen + bekleyen olarak kuruldu ki arayüzdeki aritmetik tutsun.
--
-- Mevcut migration'lar değiştirilmedi.
-- ============================================================================

create or replace function public.yanlis_bankam()
returns table(toplam integer, ogrenilen integer, bekleyen integer, kategori text, kategori_adet integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_bekleyen int;
  v_ogrenilen int;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;

  -- Bekleyen: yalnız calisma_baslat'ın verebileceği sorular (aktif olanlar).
  select count(*)::int into v_bekleyen
  from public.yanlis_sorular ys
  join public.questions q on q.id = ys.question_id
  where ys.user_id = v_me and ys.ogrenildi_at is null and q.aktif;

  -- Öğrenilen: başarı sayacı, pasife alınan soru için geriye gitmemeli.
  select count(*)::int into v_ogrenilen
  from public.yanlis_sorular ys
  where ys.user_id = v_me and ys.ogrenildi_at is not null;

  return query
  select (v_ogrenilen + v_bekleyen),
         v_ogrenilen,
         v_bekleyen,
         q.kategori,
         count(*)::int
  from public.yanlis_sorular ys
  join public.questions q on q.id = ys.question_id
  where ys.user_id = v_me and ys.ogrenildi_at is null and q.aktif
  group by q.kategori
  order by count(*) desc;

  -- Çalışılacak soru yoksa yine tek satır dönsün (arayüz sıfırları göstersin)
  if v_bekleyen = 0 then
    return query select (v_ogrenilen + 0), v_ogrenilen, 0, null::text, 0;
  end if;
end;
$function$;

revoke execute on function public.yanlis_bankam() from public, anon;
grant execute on function public.yanlis_bankam() to authenticated;

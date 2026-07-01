-- ============================================================
-- Düzeltme: grup_mac_uyesi_mi() fonksiyonuna anon rolü de
-- yürütme izni alsın; aksi halde girişsiz bir istek RLS
-- filtrelemesi yerine "permission denied" hatası alıyordu
-- (diğer tablolardaki gibi anon isteği boş sonuç dönmeli).
-- ============================================================

grant execute on function public.grup_mac_uyesi_mi(uuid) to anon;

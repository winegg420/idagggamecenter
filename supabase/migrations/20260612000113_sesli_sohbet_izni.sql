-- ============================================================================
-- SESLİ SOHBET: izin kapısı
--
-- Kural (kullanıcı kararı): sesli sohbet YALNIZ 1v1 maçta ve YALNIZ karşılıklı
-- arkadaş olan iki oyuncu arasında açılabilir. Oyun 13 yaş üstüne açık;
-- yabancılarla ses açmak taciz riski ve denetim yükü getiriyor, üstelik ses
-- kaydedilmediği için şikayette kanıt da olmuyor.
--
-- Bu fonksiyon kuralı TEK YERDE tanımlar. İstemci ses düğmesini göstermeden
-- önce bunu çağırır. Not: asıl koruma karşılıklı onaydır — ses doğrudan iki
-- tarayıcı arasında (WebRTC) gider ve karşı taraf kabul etmeden bağlantı
-- kurulamaz. Bu fonksiyon ürün kuralını uygular, tek başına güvenlik sınırı
-- değildir.
--
-- Botlar elenir: is_bot olan rakiple ses açılamaz.
-- ============================================================================

create or replace function public.sesli_sohbet_izni(p_match_id uuid)
returns table(izinli boolean, neden text, rakip_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  m public.matches%rowtype;
  v_rakip uuid;
  v_bot boolean;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;

  select * into m from public.matches where id = p_match_id;
  if not found then
    return query select false, 'Maç bulunamadı', null::uuid; return;
  end if;
  if v_me not in (m.oyuncu1, m.oyuncu2) then
    return query select false, 'Bu maçta değilsin', null::uuid; return;
  end if;
  if m.durum <> 'aktif' then
    return query select false, 'Maç aktif değil', null::uuid; return;
  end if;

  v_rakip := case when m.oyuncu1 = v_me then m.oyuncu2 else m.oyuncu1 end;

  select coalesce(is_bot, false) into v_bot from public.profiles where id = v_rakip;
  if coalesce(v_bot, false) then
    return query select false, 'Rakibin bir bot', v_rakip; return;
  end if;

  -- Karşılıklı arkadaşlık: yön fark etmeksizin kabul edilmiş olmalı.
  -- durum sütunu yalnız 'bekliyor' | 'arkadas' alabilir (tablo CHECK kuralı);
  -- kabul edilmiş arkadaşlığın değeri 'arkadas'.
  if not exists (
    select 1 from public.friendships f
    where f.durum = 'arkadas'
      and ((f.requester = v_me and f.addressee = v_rakip)
        or (f.requester = v_rakip and f.addressee = v_me))
  ) then
    return query select false, 'Sesli sohbet yalnız arkadaşlarınla açılabilir', v_rakip; return;
  end if;

  return query select true, null::text, v_rakip;
end;
$function$;

revoke execute on function public.sesli_sohbet_izni(uuid) from public, anon;
grant execute on function public.sesli_sohbet_izni(uuid) to authenticated;

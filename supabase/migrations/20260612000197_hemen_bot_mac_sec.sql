-- ============================================================
-- 197 — "Beklemeden bot ile oyna": oyuncu açık botu kendisi seçer
-- (Revizyon Paketi 12, madde 6)
--
-- Eski hemen_bot_mac(p_kategori, p_dereceli) seviyeye en yakın açık botu
-- rastgele seçer — dokunulmadı. Aynı imzaya p_bot eklemek iki varsayılanlı
-- aşırı yükleme belirsizliği doğururdu; bu yüzden ayrı fonksiyon.
--
-- Kurallar aynen: yalnız AÇIK ve aktif bot (gizli bot seçilemez — gizli
-- kalmalı), açık bot maçı kuralları (%50 coin, anında cevap) maç
-- motorunda botun türüne bağlı, burada değişmez. Çift maç ve maç kotası
-- denetimleri eskisiyle aynı.
-- ============================================================

create or replace function public.hemen_bot_mac_sec(
  p_bot uuid, p_kategori text default null, p_dereceli boolean default true
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
  v_kat text;
begin
  perform public.hiz_siniri('hemen_bot_mac', 20, interval '60 seconds');
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;

  -- Zaten aktif maçı varsa oraya döndür (çift maç açılmasın).
  select m.id into v_id from public.matches m
   where m.durum = 'aktif' and auth.uid() in (m.oyuncu1, m.oyuncu2)
   limit 1;
  if found then
    delete from public.matchmaking_queue where user_id = auth.uid();
    return v_id;
  end if;

  -- Seçilen kimlik gerçekten açık ve aktif bir bot mu? (istemciye güvenme)
  if not exists (
    select 1 from public.profiles p
     where p.id = p_bot and p.is_bot and coalesce(p.bot_aktif, true)
       and public.acik_bot_mu(p.is_bot, p.bot_turu)
  ) then
    raise exception 'Bu bot şu an oynanamıyor.';
  end if;

  perform public.mac_kotasi_kontrol();

  v_kat := coalesce(
    nullif(btrim(coalesce(p_kategori, '')), ''),
    (select pr.tercih_kategori from public.profiles pr where pr.id = auth.uid())
  );

  delete from public.matchmaking_queue where user_id = auth.uid();

  insert into public.matches
    (oyuncu1, oyuncu2, durum, kategori, soru_ids, aktif_soru, soru_baslangic, dereceli)
  values (
    auth.uid(), p_bot, 'aktif', v_kat,
    public.soru_sec(v_kat, 20, array[auth.uid()]),
    0, now(), p_dereceli
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.hemen_bot_mac_sec(uuid, text, boolean) from public, anon;
grant execute on function public.hemen_bot_mac_sec(uuid, text, boolean) to authenticated;

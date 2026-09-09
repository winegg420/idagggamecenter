-- ============================================================
-- BİLDİRİM GÜRÜLTÜSÜ (9 Eylül 2026)
--
-- Kanıt: bildirim panelinde üst üste 5 adet "<Bot> hamlesini yaptı — sıra
-- sende!" bildirimi vardı; aralarında gerçek olaylar (meydan okuma, seri,
-- ustalık) kaybolmuştu.
--
-- Kök neden: `trg_mac_sira_bildir` ilerleyen tarafın bot olup olmadığına
-- bakmıyordu. Bot her tikte bir soru ilerlettiği için 20 soruluk bir maç
-- boyunca oyuncuya defalarca "sıra sende" düşüyordu. Bot zaten her an hazır
-- olduğundan bu bildirimin bilgi değeri yok.
--
-- Yapılanlar:
--  1) Bot ilerlemesinde "sıra sende" bildirimi ÜRETİLMİYOR.
--  2) Mevcut bot kaynaklı "sıra sende" bildirimleri temizlendi.
--  3) 7 günden eski OKUNMUŞ bildirimler siliniyor (RPC + günlük cron).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Bot ilerlemesi bildirim üretmesin
-- ------------------------------------------------------------
create or replace function public.trg_mac_sira_bildir()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bekleyen uuid;
  v_ilerleyen uuid;
  v_ad text;
  v_toplam int;
  v_bot boolean;
begin
  if new.durum <> 'aktif' then return new; end if;
  v_toplam := coalesce(array_length(new.soru_ids, 1), 0);
  if v_toplam = 0 then return new; end if;

  -- Kim ilerledi, kim geride kaldı?
  if new.oyuncu1_soru > old.oyuncu1_soru and new.oyuncu2_soru < v_toplam
     and new.oyuncu1_soru > new.oyuncu2_soru then
    v_ilerleyen := new.oyuncu1; v_bekleyen := new.oyuncu2;
  elsif new.oyuncu2_soru > old.oyuncu2_soru and new.oyuncu1_soru < v_toplam
     and new.oyuncu2_soru > new.oyuncu1_soru then
    v_ilerleyen := new.oyuncu2; v_bekleyen := new.oyuncu1;
  else
    return new;
  end if;

  -- BOT ilerlemesi bildirim üretmez: bot her an hazır, "sıra sende" demenin
  -- bilgi değeri yok; üstelik her soruda tetiklenip paneli dolduruyordu.
  select coalesce(is_bot, false) into v_bot from public.profiles where id = v_ilerleyen;
  if coalesce(v_bot, false) then return new; end if;

  -- Saatte bir defadan fazla rahatsız etme
  if exists (
    select 1 from public.bildirimler b
    where b.user_id = v_bekleyen and b.tip = 'sira_sende'
      and b.yol = '/bildim/mac/' || new.id::text
      and b.created_at > now() - interval '1 hour'
  ) then
    return new;
  end if;

  select gorunen_ad into v_ad from public.profiles where id = v_ilerleyen;

  perform public.bildirim_yaz(
    v_bekleyen, 'sira_sende',
    coalesce(v_ad, 'Rakibin') || ' hamlesini yaptı — sıra sende! ⏳',
    '/bildim/mac/' || new.id::text
  );
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 2) Birikmiş bot kaynaklı "sıra sende" bildirimlerini sil
--    (yol '/bildim/mac/<id>' üzerinden maça bakılır; rakip bot ise silinir)
-- ------------------------------------------------------------
delete from public.bildirimler b
where b.tip = 'sira_sende'
  and exists (
    select 1
    from public.matches m
    join public.profiles p
      on p.id = (case when m.oyuncu1 = b.user_id then m.oyuncu2 else m.oyuncu1 end)
    where b.yol = '/bildim/mac/' || m.id::text
      and coalesce(p.is_bot, false)
  );

-- ------------------------------------------------------------
-- 3) Eski bildirim temizliği
--    7 günden eski OKUNMUŞ bildirimler silinir. Okunmamışlara dokunulmaz
--    (kullanıcı görmediği bir olayı kaybetmesin).
-- ------------------------------------------------------------
create or replace function public.bildirim_temizle()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  delete from public.bildirimler
   where okundu and created_at < now() - interval '7 days';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke execute on function public.bildirim_temizle() from public, anon, authenticated;

-- Okuma anında da temizlensin: cron dursa bile liste şişmesin.
create or replace function public.bildirimleri_oku()
returns void
language sql
security definer
set search_path = public
as $$
  with okundu_yaz as (
    update public.bildirimler set okundu = true
    where user_id = auth.uid() and not okundu
    returning 1
  )
  delete from public.bildirimler
   where user_id = auth.uid()
     and okundu
     and created_at < now() - interval '7 days';
$$;

revoke execute on function public.bildirimleri_oku() from public, anon;
grant execute on function public.bildirimleri_oku() to authenticated;

-- Günlük genel temizlik
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('bildim-bildirim-temizle')
      where exists (select 1 from cron.job where jobname = 'bildim-bildirim-temizle');
    perform cron.schedule('bildim-bildirim-temizle', '20 3 * * *',
      'select public.bildirim_temizle()');
  end if;
end $$;

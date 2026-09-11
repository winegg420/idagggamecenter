-- ============================================================
-- DERECELİ / NORMAL MAÇ + SEVİYEYE GÖRE EŞLEŞME
--
-- ÖNCE: tek tür 1v1 maç vardı. Rakip tamamen rastgele seçiliyordu
-- (kuyrukta kim varsa, kimse yoksa rastgele bot) ve her maç puan yazıyordu.
-- Yeni oyuncu 1450 puanlı bota düşebiliyor, pes edip bırakıyordu.
--
-- SONRA iki mod:
--   DERECELİ  → seviyeye yakın rakip, kazanan +20 puan, lig sıralaması değişir
--   NORMAL    → serbest rakip, PUAN YOK (seri bonusu da yok), sadece eğlence
--
-- SEVİYE = oyuncunun `puan`ı. Eşikler arayüzdeki rütbelerle birebir aynı
-- (bildim/lib/ranks.js): Çaylak 0 · Bilge 100 · Üstat 500 · Kahin 1500 ·
-- Efsane 5000. Böylece "rütben neyse rakibin/botun da o" diyebiliyoruz.
--
-- EŞLEŞME KURALI (kullanıcı kararı): seviyene uygun rakip yoksa DAHA DÜŞÜK
-- seviyeye düşülür, yukarı çıkılmaz. Sebep: güçlü rakiple ezilmek, zayıf
-- rakiple kolay kazanmaktan daha çok oyuncu kaçırıyor.
-- ============================================================

begin;

-- ------------------------------------------------------------ 1) kolon
alter table public.matches
  add column if not exists dereceli boolean not null default true;

comment on column public.matches.dereceli is
  'true: puan/lig etkiler, seviyeye göre eşleşir. false: normal maç, puan yazılmaz.';

-- Geçmiş maçların tamamı dereceli sayılır (varsayılan true) — puanları
-- zaten yazılmıştı, geriye dönük bir şey değişmiyor.

-- Kuyruk da hangi modda beklendiğini bilmeli: dereceli bekleyen, normal
-- bekleyenle eşleşmemeli.
alter table public.matchmaking_queue
  add column if not exists dereceli boolean not null default true;

-- ------------------------------------------- 2) seviye yardımcı fonksiyonu
-- Puandan rütbe basamağı (0..4). Hem rakip hem bot seçiminde kullanılıyor.
create or replace function public.seviye_basamagi(p_puan int)
returns int
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(p_puan, 0) >= 5000 then 4   -- Efsane
    when coalesce(p_puan, 0) >= 1500 then 3   -- Kahin
    when coalesce(p_puan, 0) >=  500 then 2   -- Üstat
    when coalesce(p_puan, 0) >=  100 then 1   -- Bilge
    else 0                                    -- Çaylak
  end;
$$;

-- Oyuncunun seviyesine uygun bot. Basamak 4 (Efsane) için de en zor bot
-- döner; bot havuzu dört seviyeli (bkz. migration 125).
create or replace function public.seviyeye_gore_bot(p_puan int)
returns uuid
language sql
stable
set search_path = public
as $$
  select p.id
    from public.profiles p
   where p.is_bot and coalesce(p.bot_aktif, true)
   order by
     -- Oyuncunun basamağına en yakın isabetli bot:
     -- 0->%42, 1->%58, 2->%75, 3+->%90
     abs(coalesce(p.bot_isabet, 0.5) - (
       case public.seviye_basamagi(p_puan)
         when 0 then 0.42
         when 1 then 0.58
         when 2 then 0.75
         else 0.90
       end
     )),
     random()
   limit 1;
$$;

-- --------------------------------------------------- 3) kuyruğa gir (1v1)
-- Dereceli modda yalnız YAKIN seviyedeki rakiple eşleşilir; beklerken
-- aralık genişler ve aşağı doğru açılır.
drop function if exists public.kuyruga_gir(text);
create function public.kuyruga_gir(
  p_kategori text default null,
  p_dereceli boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kat text;
  v_id uuid;
  v_rakip uuid;
  v_rakip_kat text;
  v_secilen_kat text;
  v_puan int;
  v_bekleme int;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;

  v_kat := coalesce(
    nullif(btrim(coalesce(p_kategori, '')), ''),
    (select pr.tercih_kategori from public.profiles pr where pr.id = auth.uid())
  );
  select coalesce(pr.puan, 0) into v_puan from public.profiles pr where pr.id = auth.uid();

  -- Devam eden aktif maçım varsa ona dön
  select m.id into v_id from public.matches m
  where m.durum = 'aktif' and auth.uid() in (m.oyuncu1, m.oyuncu2)
  limit 1;
  if found then
    delete from public.matchmaking_queue where user_id = auth.uid();
    return v_id;
  end if;

  delete from public.matchmaking_queue where created_at < now() - interval '90 seconds';

  -- Kuyrukta ne kadardır bekliyorum? (saniye) Aralık buna göre genişler.
  select coalesce(extract(epoch from (now() - q.created_at))::int, 0)
    into v_bekleme
    from public.matchmaking_queue q where q.user_id = auth.uid();
  v_bekleme := coalesce(v_bekleme, 0);

  -- 1) Aynı kategori + (dereceliyse) uygun seviye
  select q.user_id, q.kategori into v_rakip, v_rakip_kat
  from public.matchmaking_queue q
  join public.profiles pr on pr.id = q.user_id
  where q.user_id <> auth.uid()
    and q.kategori is not distinct from v_kat
    and (
      not p_dereceli
      or coalesce(q.dereceli, true) = p_dereceli
    )
    and (
      not p_dereceli
      -- DERECELİ: kendi basamağım ya da ALTI. Yukarı çıkma yok.
      -- 20 sn'den fazla bekledimse bir basamak daha aşağı açılır.
      or public.seviye_basamagi(pr.puan) between
           greatest(0, public.seviye_basamagi(v_puan) - (case when v_bekleme > 20 then 2 else 1 end))
           and public.seviye_basamagi(v_puan)
    )
  order by
    -- En yakın seviyeden başla
    abs(public.seviye_basamagi(pr.puan) - public.seviye_basamagi(v_puan)),
    q.created_at
  limit 1
  for update skip locked;

  -- 2) Yoksa: 20 saniyedir bekleyen herhangi bir rakip (karışık kategori)
  if not found then
    select q.user_id, null::text into v_rakip, v_rakip_kat
    from public.matchmaking_queue q
    join public.profiles pr on pr.id = q.user_id
    where q.user_id <> auth.uid()
      and q.created_at < now() - interval '20 seconds'
      and (not p_dereceli or coalesce(q.dereceli, true) = p_dereceli)
      and (
        not p_dereceli
        or public.seviye_basamagi(pr.puan) <= public.seviye_basamagi(v_puan)
      )
    order by q.created_at
    limit 1
    for update skip locked;
  end if;

  if found and v_rakip is not null then
    v_secilen_kat := v_rakip_kat;
    delete from public.matchmaking_queue where user_id in (v_rakip, auth.uid());

    if not public.hileli_mi() then
      perform public.mac_kotasi_kontrol();
    end if;

    insert into public.matches
      (oyuncu1, oyuncu2, durum, kategori, soru_ids, aktif_soru, soru_baslangic, dereceli)
    values (
      v_rakip, auth.uid(), 'aktif', v_secilen_kat,
      public.soru_sec(v_secilen_kat, 20, array[auth.uid(), v_rakip]),
      0, now(), p_dereceli
    )
    returning id into v_id;
    return v_id;
  end if;

  -- Eşleşme yok: kuyruğa gir (varsa süreyi koru — 20 sn sayacı sıfırlanmasın)
  insert into public.matchmaking_queue (user_id, kategori, dereceli)
  values (auth.uid(), v_kat, p_dereceli)
  on conflict (user_id) do update
    set kategori = excluded.kategori,
        dereceli = excluded.dereceli;

  return null;
end;
$$;

-- ------------------------------------------------ 4) hızlı eşleşme / bot
drop function if exists public.quick_match(text);
create function public.quick_match(
  p_kategori text default null,
  p_dereceli boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_rakip uuid;
  v_bot uuid;
  v_kat text;
  v_puan int;
begin
  perform public.hiz_siniri('quick_match', 10, interval '60 seconds');
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;

  v_kat := coalesce(
    nullif(btrim(coalesce(p_kategori, '')), ''),
    (select pr.tercih_kategori from public.profiles pr where pr.id = auth.uid())
  );
  select coalesce(pr.puan, 0) into v_puan from public.profiles pr where pr.id = auth.uid();

  select m.id into v_id from public.matches m
  where m.durum = 'aktif' and auth.uid() in (m.oyuncu1, m.oyuncu2)
  limit 1;
  if found then
    delete from public.matchmaking_queue where user_id = auth.uid();
    return v_id;
  end if;

  perform public.mac_kotasi_kontrol();

  delete from public.matchmaking_queue where created_at < now() - interval '90 seconds';

  -- Bekleyen oyuncu (dereceli modda kendi seviyem ve altı)
  select q.user_id into v_rakip
  from public.matchmaking_queue q
  join public.profiles pr on pr.id = q.user_id
  where q.user_id <> auth.uid()
    and (not p_dereceli or coalesce(q.dereceli, true) = p_dereceli)
    and (
      not p_dereceli
      or public.seviye_basamagi(pr.puan) <= public.seviye_basamagi(v_puan)
    )
  order by abs(public.seviye_basamagi(pr.puan) - public.seviye_basamagi(v_puan)), q.created_at
  limit 1
  for update skip locked;

  if found then
    delete from public.matchmaking_queue where user_id in (v_rakip, auth.uid());
    insert into public.matches
      (oyuncu1, oyuncu2, durum, kategori, soru_ids, aktif_soru, soru_baslangic, dereceli)
    values (
      v_rakip, auth.uid(), 'aktif', v_kat,
      public.soru_sec(v_kat, 20, array[auth.uid(), v_rakip]),
      0, now(), p_dereceli
    )
    returning id into v_id;
    return v_id;
  end if;

  delete from public.matchmaking_queue where user_id = auth.uid();

  -- Bot: DERECELİ modda oyuncunun seviyesine uygun olan, normalde rastgele.
  -- Eskiden her zaman rastgeleydi: yeni oyuncuya %90 isabetli bot düşüyordu.
  if p_dereceli then
    v_bot := public.seviyeye_gore_bot(v_puan);
  else
    select id into v_bot from public.profiles
     where is_bot and coalesce(bot_aktif, true)
     order by random() limit 1;
  end if;

  insert into public.matches
    (oyuncu1, oyuncu2, durum, kategori, soru_ids, aktif_soru, soru_baslangic, dereceli)
  values (
    auth.uid(), v_bot, 'aktif', v_kat,
    public.soru_sec(v_kat, 20, array[auth.uid()]),
    0, now(), p_dereceli
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- ------------------------------------------- 5) puan yalnız dereceli maçta
create or replace function public.mac_sonuclandir(
  p_match_id uuid,
  p_kazanan uuid,
  p_kaybeden uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  v_oyuncu uuid;
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_seri int;
  v_tarih date;
  v_yeni_seri int;
  v_bonus int;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then return; end if;

  update public.matches
     set durum = 'bitti', kazanan = p_kazanan, bitis = now()
   where id = p_match_id;

  -- NORMAL MAÇ: rozet verilir ama PUAN ve SERİ yazılmaz.
  if not coalesce(m.dereceli, true) then
    if p_kazanan is not null then
      perform public.award_badge(p_kazanan, 'ilk_galibiyet');
    end if;
    return;
  end if;

  if p_kazanan is not null then
    update public.profiles
       set puan = puan + 20, puan_hafta = puan_hafta + 20
     where id = p_kazanan;

    perform public.award_badge(p_kazanan, 'ilk_galibiyet');
    if (select count(*) from public.matches where kazanan = p_kazanan and durum = 'bitti') >= 10 then
      perform public.award_badge(p_kazanan, 'mac_10');
    end if;
    if p_kaybeden = 'b0b00000-0000-4000-8000-000000000003' then
      perform public.award_badge(p_kazanan, 'bot_avcisi');
    end if;
    if (select count(*) from public.match_answers
        where match_id = p_match_id and user_id = p_kazanan and dogru)
       >= coalesce(array_length(m.soru_ids, 1), 0) then
      perform public.award_badge(p_kazanan, 'tam_isabet');
    end if;
  end if;

  foreach v_oyuncu in array array[m.oyuncu1, m.oyuncu2] loop
    select seri, son_seri_tarihi into v_seri, v_tarih
    from public.profiles where id = v_oyuncu and not is_bot;
    if found and v_tarih is distinct from v_bugun then
      v_yeni_seri := case when v_tarih = v_bugun - 1 then v_seri + 1 else 1 end;
      v_bonus := least(v_yeni_seri * 5, 50);
      update public.profiles
         set seri = v_yeni_seri,
             son_seri_tarihi = v_bugun,
             puan = puan + v_bonus,
             puan_hafta = puan_hafta + v_bonus
       where id = v_oyuncu;
      if v_yeni_seri >= 3 then perform public.award_badge(v_oyuncu, 'seri_3'); end if;
      if v_yeni_seri >= 7 then perform public.award_badge(v_oyuncu, 'seri_7'); end if;
    end if;
  end loop;
end;
$$;

grant execute on function public.seviye_basamagi(int) to authenticated;
grant execute on function public.seviyeye_gore_bot(int) to authenticated;
grant execute on function public.kuyruga_gir(text, boolean) to authenticated;
grant execute on function public.quick_match(text, boolean) to authenticated;

commit;

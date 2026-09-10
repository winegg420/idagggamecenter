-- 1v1 maç iptali
--
-- Grup ve hızlı maçta iptal vardı (grup_mac_iptal / hizli_mac_iptal), 1v1'de
-- yoktu. Aynı desende mac_iptal(p_match_id) ekleniyor.
--
-- ADALET: Oyuncu kaybettiği maçı iptal ederek yenilgiden kaçamamalı, yoksa
-- sıralama anlamını yitirir. Kural tablosu:
--
--   bekliyor + daveti ben gönderdim   -> sade iptal, puan yok
--   bekliyor + davet bana geldi       -> bu RPC reddetmez (mevcut reddetme akışı kullanılır)
--   rakip BOT                         -> sade iptal, puan yok
--   gerçek rakip, hiç cevap yok       -> sade iptal, iki tarafa da ceza yok
--   gerçek rakip, en az bir cevap var -> HÜKMEN MAĞLUBİYET (iptal eden kaybeder)
--
-- Hükmen mağlubiyette puan/rozet/seri güncellemesi normal maç bitişiyle AYNI
-- yoldan geçer: advance_match içindeki bitiriş bloğu mac_sonuclandir()
-- fonksiyonuna çıkarıldı, iki çağıran da onu kullanıyor. Ayrı bir puan
-- hesabı YAZILMADI.

begin;

-- ============================================================
-- 1) Ortak bitiriş: puan, rozet, seri
--    advance_match'in bitiriş bloğunun birebir aynısı (davranış değişmedi).
-- ============================================================
create or replace function public.mac_sonuclandir(
  p_match_id uuid,
  p_kazanan  uuid,
  p_kaybeden uuid
) returns void
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

revoke all on function public.mac_sonuclandir(uuid, uuid, uuid) from public, anon, authenticated;

-- ============================================================
-- 2) advance_match — bitiriş bloğu artık mac_sonuclandir'a devrediyor.
--    Kazanan/kaybeden belirleme ve bitiş koşulları AYNEN korundu.
-- ============================================================
create or replace function public.advance_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  v_kazanan uuid;
  v_kaybeden uuid;
  v_toplam int;
  v_ikisi_bitti boolean;
  v_terk boolean;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found or m.durum <> 'aktif' then return; end if;
  if auth.uid() is not null and auth.uid() not in (m.oyuncu1, m.oyuncu2) then return; end if;

  -- ASENKRON: maç, İKİ oyuncu da kendi sorularını bitirince biter.
  -- Bir taraf bitirip diğeri 24 saattir oynamıyorsa maç yine kapanır (terk).
  v_toplam := coalesce(array_length(m.soru_ids, 1), 0);
  v_ikisi_bitti := (m.oyuncu1_soru >= v_toplam and m.oyuncu2_soru >= v_toplam);
  v_terk := (
    (m.oyuncu1_soru >= v_toplam or m.oyuncu2_soru >= v_toplam)
    and coalesce(m.oyuncu1_bitti_at, m.oyuncu2_bitti_at) < now() - interval '24 hours'
  );

  if not (v_ikisi_bitti or v_terk) then
    return;   -- henüz bitmedi; herkes kendi hızında oynamaya devam eder
  end if;

  select * into m from public.matches where id = p_match_id;
  if m.oyuncu1_skor > m.oyuncu2_skor then v_kazanan := m.oyuncu1; v_kaybeden := m.oyuncu2;
  elsif m.oyuncu2_skor > m.oyuncu1_skor then v_kazanan := m.oyuncu2; v_kaybeden := m.oyuncu1;
  else v_kazanan := null; v_kaybeden := null;
  end if;

  perform public.mac_sonuclandir(p_match_id, v_kazanan, v_kaybeden);
end;
$$;

-- ============================================================
-- 3) mac_iptal — 1v1 iptal
--    Döner: (sonuc text, kazanan uuid)
--      sonuc = 'iptal'  -> sade iptal, puan değişmedi
--      sonuc = 'hukmen' -> iptal eden yenik sayıldı, kazanan rakip
-- ============================================================
create or replace function public.mac_iptal(p_match_id uuid)
returns table (sonuc text, kazanan uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  m public.matches%rowtype;
  v_rakip uuid;
  v_rakip_bot boolean;
  v_cevap_sayisi int;
  v_ad text;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;

  -- Kullanıcı tetikli uç: hız sınırı (bkz. migration 115)
  perform public.hiz_siniri('mac_iptal', 20, interval '60 seconds');

  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if v_me not in (m.oyuncu1, m.oyuncu2) then
    raise exception 'Bu maçta değilsin';
  end if;
  if m.durum in ('bitti', 'iptal', 'reddedildi') then
    raise exception 'Bu maç zaten kapanmış';
  end if;

  v_rakip := case when m.oyuncu1 = v_me then m.oyuncu2 else m.oyuncu1 end;
  select coalesce(is_bot, false) into v_rakip_bot from public.profiles where id = v_rakip;

  -- Gelen daveti reddetmek bu RPC'nin işi değil; mevcut reddetme akışı var.
  if m.durum = 'bekliyor' and m.oyuncu2 = v_me then
    raise exception 'Gelen daveti reddetme akışını kullan';
  end if;

  select count(*) into v_cevap_sayisi
    from public.match_answers where match_id = p_match_id;

  -- HÜKMEN MAĞLUBİYET yalnız: aktif maç + gerçek rakip + en az bir cevap
  if m.durum = 'aktif'
     and not coalesce(v_rakip_bot, false)
     and v_cevap_sayisi > 0
  then
    perform public.mac_sonuclandir(p_match_id, v_rakip, v_me);

    select gorunen_ad into v_ad from public.profiles where id = v_me;
    perform public.bildirim_yaz(
      v_rakip, 'mac_bitti',
      coalesce(v_ad, 'Rakibin') || ' maçı iptal etti — hükmen kazandın! 🏆',
      '/bildim/mac/' || p_match_id::text
    );

    return query select 'hukmen'::text, v_rakip;
    return;
  end if;

  -- Sade iptal: puan yok, mağlubiyet yazılmaz
  update public.matches
     set durum = 'iptal', kazanan = null, bitis = now()
   where id = p_match_id;

  if not coalesce(v_rakip_bot, false) then
    select gorunen_ad into v_ad from public.profiles where id = v_me;
    perform public.bildirim_yaz(
      v_rakip, 'mac_bitti',
      coalesce(v_ad, 'Rakibin') || ' maçı iptal etti. Kimseye puan yazılmadı.',
      '/bildim/meydan'
    );
  end if;

  return query select 'iptal'::text, null::uuid;
end;
$$;

revoke all on function public.mac_iptal(uuid) from public, anon;
grant execute on function public.mac_iptal(uuid) to authenticated;

commit;

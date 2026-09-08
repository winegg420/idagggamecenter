-- ============================================================
-- BİLDİRİMDE HAM KATEGORİ ANAHTARI
--
-- Canlı: "🎖️ genel_kultur kategorisinde Çırak oldun!" — kullanıcıya
-- veritabanı anahtarı gösteriliyordu.
--
-- Tüm bildirim tipleri tarandı; ham anahtar/ID sızan TEK yer buydu.
-- Diğerleri gorunen_ad, sayı ya da sabit metin kullanıyor (maç id / kullanıcı
-- id hiçbir bildirim metninde geçmiyor).
-- ============================================================

-- Okunabilir kategori adı — istemcideki bildim/lib/kategoriler.js ile aynı
create or replace function public.kategori_adi(p_kategori text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_kategori
    when 'genel_kultur' then 'Genel Kültür'
    when 'genel'        then 'Genel'
    when 'bilim'        then 'Bilim'
    when 'tarih'        then 'Tarih'
    when 'cografya'     then 'Coğrafya'
    when 'edebiyat'     then 'Edebiyat'
    when 'spor'         then 'Spor'
    when 'sanat'        then 'Sanat'
    when 'sinema'       then 'Sinema'
    when 'muzik'        then 'Müzik'
    when 'teknoloji'    then 'Teknoloji'
    when 'karisik'      then 'Karışık'
    else coalesce(p_kategori, 'Karışık')
  end;
$$;

grant execute on function public.kategori_adi(text) to authenticated, anon;

-- Ustalık bildirimi artık okunabilir adı kullanıyor
-- (gövde 053'teki ile aynı; yalnız metin satırı değişti)
create or replace function public.kategori_dogru_arttir(p_user uuid, p_kategori text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yeni int;
  v_onceki text;
  v_simdi text;
begin
  if p_user is null or p_kategori is null then return; end if;
  if exists (select 1 from public.profiles where id = p_user and coalesce(is_bot, false)) then
    return;
  end if;

  insert into public.kategori_dogru (user_id, kategori, dogru_sayisi)
  values (p_user, p_kategori, 1)
  on conflict (user_id, kategori) do update
    set dogru_sayisi = public.kategori_dogru.dogru_sayisi + 1
  returning dogru_sayisi into v_yeni;

  v_onceki := public.ustalik_seviye(v_yeni - 1);
  v_simdi := public.ustalik_seviye(v_yeni);

  if v_simdi is not null and v_simdi is distinct from v_onceki then
    perform public.bildirim_yaz(
      p_user, 'ustalik',
      '🎖️ ' || public.kategori_adi(p_kategori) || ' kategorisinde ' || v_simdi || ' oldun!',
      '/bildim/profil'
    );
    perform public.award_badge(
      p_user,
      case v_simdi
        when 'Çırak' then 'ustalik_cirak'
        when 'Kalfa' then 'ustalik_kalfa'
        when 'Usta' then 'ustalik_usta'
        when 'Üstat' then 'ustalik_ustat'
        else 'ustalik_efsane'
      end
    );
  end if;
end;
$$;

revoke execute on function public.kategori_dogru_arttir(uuid, text) from public, anon, authenticated;

-- Daha önce yazılmış bildirimlerdeki ham anahtarları da düzelt
update public.bildirimler b
   set metin = replace(b.metin, k.anahtar || ' kategorisinde',
                                public.kategori_adi(k.anahtar) || ' kategorisinde')
  from (select unnest(array['genel_kultur','genel','bilim','tarih','cografya',
                            'edebiyat','spor','sanat','sinema','muzik',
                            'teknoloji','karisik']) as anahtar) k
 where b.tip = 'ustalik'
   and b.metin like '%' || k.anahtar || ' kategorisinde%';

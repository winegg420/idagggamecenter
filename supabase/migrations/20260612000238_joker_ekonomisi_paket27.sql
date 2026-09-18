-- Paket 27 — Joker ekonomisi.
--
-- GEREKÇE (sahibinin kurgusu): joker, oyunun kalan tek coin harcama yeri.
-- Ücretsiz joker bu tek sink'i sulandırıyordu. Yeni kural: joker kazanılan
-- coin'le alınır — ama öğrenmek için başlangıç stoğu verilir ve maçın ortasında
-- dükkâna gitmeye gerek kalmaz (maç içi satın alma, migration'ın C bölümü).
--
-- Rakamların hiçbiri koda gömülmedi; hepsi oyun_ayarlari'nda.
-- Hiçbir ayar ve hiçbir satır SİLİNMEDİ; kaldırma = değeri 0'a çekme.

-- ===========================================================================
-- 0) AYARLAR
-- ===========================================================================
insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('baslangic_joker_adet', '2'::jsonb,
   'Yeni hesaba her KULLANIMDA OLAN joker türünden verilen adet (Paket 27 A)'),
  ('duello_joker_hak', '4'::jsonb,
   'Maç başına toplam joker hakkı — TÜM modlar. Saldırı + savunma birlikte sayılır. '
   'Aynı joker türü maç başına yalnız bir kez kullanılabilir, yani hak farklı türlere dağıtılır.')
on conflict (anahtar) do nothing;

-- Düellodaki ücretsiz saldırı jokeri KALDIRILDI. Ayar silinmiyor, 0'a çekiliyor.
update public.oyun_ayarlari
   set deger = '0'::jsonb,
       aciklama = 'Düello: maç başına ücretsiz saldırı jokeri. Paket 27''de 0''a çekildi '
                  '(hiçbir joker ücretsiz değil). Geri açmak: değeri 1 yap.'
 where anahtar = 'duello_ucretsiz_saldiri_joker';

-- Ayrı saldırı/savunma sınırları yerini tek toplam hakka bıraktı.
-- Değerleri duruyor ama artık OKUNMUYOR; açıklamaları bunu söylesin.
update public.oyun_ayarlari
   set aciklama = 'KULLANILMIYOR (Paket 27) — yerine duello_joker_hak (toplam hak). Değer geriye dönük duruyor.'
 where anahtar in ('duello_saldiri_joker_siniri', 'duello_savunma_joker_siniri');

-- ===========================================================================
-- A) BAŞLANGIÇ JOKERİ
--
-- Ölçülen durum: yeni oyuncuya coin veriliyordu ama hiç joker verilmiyordu
-- (joker_envanter tamamen boştu — canlıda 0 satır).
--
-- HANGİ TÜRLER: joker_envanter kısıtı sekiz tür tanıyor ama 'pas' ÖLÜ bir tür.
-- Ölçüldü: joker_kullan yalnız ('elli','sure','soru_degistir') kabul ediyor,
-- düello fonksiyonları da 'pas'ı reddediyor — yani 'pas' envantere girebilir
-- ama HİÇBİR YERDE harcanamaz. Bu yüzden başlangıçta verilmiyor.
-- (Paket 14'te "Pas" jokeri "Soru Değiştir"e dönüştü; tür adı geriye uyum için duruyor.)
-- ===========================================================================
create or replace function public.baslangic_jokerleri_ver(p_user uuid)
returns integer
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_adet int := public.ayar_sayi('baslangic_joker_adet', 2)::int;
  v_tur text;
  v_verilen int := 0;
begin
  if p_user is null or v_adet <= 0 then return 0; end if;
  -- Botlara verilmez: botun envanteri yok, jokerini sunucu simüle eder.
  if exists (select 1 from public.profiles where id = p_user and coalesce(is_bot, false)) then
    return 0;
  end if;
  -- Bir kez verilir: hesapta zaten joker varsa tekrar eklenmez (idempotent).
  if exists (select 1 from public.joker_envanter where user_id = p_user) then
    return 0;
  end if;

  foreach v_tur in array array['elli', 'sure', 'soru_degistir',
                               'zaman_baskisi', 'saldiri_degistir', 'savunma_kilidi',
                               'seri_koruma'] loop
    perform public.joker_hareket(p_user, v_tur, v_adet, 'baslangic', null);
    v_verilen := v_verilen + v_adet;
  end loop;
  return v_verilen;
end;
$function$;

-- handle_new_user'a bağlanıyor. Mevcut gövde korunuyor; tek eklenen satır
-- başlangıç jokeri çağrısı ve o da mevcut "ödül verilemese bile profil düşmesin"
-- exception bloğunun içinde.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, username, avatar_url, provider, davet_kodu)
  values (
    new.id,
    'oyuncu_' || substr(md5(new.id::text || random()::text), 1, 8),
    null,                                    -- Google fotoğrafı ALINMAZ
    new.raw_app_meta_data->>'provider',
    public.yeni_davet_kodu()
  );

  begin
    perform public.coin_ekle(new.id, public.ayar_sayi('coin_baslangic', 300), 'baslangic', null);
    perform public.ucretsiz_esyalari_ver(new.id);
    perform public.ucretsiz_karakter_ve_parca_ver(new.id);
    perform public.baslangic_jokerleri_ver(new.id);   -- Paket 27 A
  exception when others then
    null;   -- ödül verilemese bile profil oluşturma asla düşmesin
  end;

  return new;
end;
$function$;

-- ===========================================================================
-- B) MAÇ BAŞINA JOKER HAKKI — tek kural, mod fark etmez
--
-- 1. Toplam hak: duello_joker_hak (4). Saldırı + savunma birlikte sayılır.
-- 2. AYNI TÜR MAÇ BAŞINA BİR KEZ. Hak dört FARKLI türe dağıtılır.
--    Bu, eski "soru_degistir maç başına 1 kez" istisnasını genelleştirir.
-- 3. Ücretsiz joker yalnız tek yerde kaldı: SERBEST Klasik Mod'un ilk 50:50'si.
--    Dereceli Klasik Mod'da ve düelloda hiçbir joker ücretsiz değil.
--
-- Klasik Mod'un seti üç tür (elli · sure · soru_degistir) olduğu için orada
-- fiilî tavan 3'tür — ayrı bir kural değil, aynı kuralın sonucu.
-- ===========================================================================

-- Maç başına toplam sınır artık tek ayardan gelir. Turnuva finali (0) ve
-- arkadaş maçı (sınırsız) kararlarına DOKUNULMADI.
create or replace function public.joker_mac_siniri(p_mac_tur text, p_mac_id uuid)
returns integer
language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  m public.matches%rowtype;
  t public.tournaments%rowtype;
  v_rakip uuid;
  v_hayatta int;
  v_hak int := public.ayar_sayi('duello_joker_hak', 4)::int;   -- Paket 27 B
begin
  if p_mac_tur = 'grup' then
    return null;                                   -- grup maçları arkadaş maçıdır
  elsif p_mac_tur = 'hizli' then
    return v_hak;
  elsif p_mac_tur = 'turnuva' then
    select * into t from public.tournaments where id = p_mac_id;
    -- ALTIN SORU: 50:50'si olan hep kazanmasın, joker kapalı.
    if coalesce(t.altin_soru, false) then
      return 0;
    end if;
    select count(*) into v_hayatta
    from public.tournament_players tp
    where tp.tournament_id = p_mac_id and not tp.elendi;
    if v_hayatta <= 2 then
      return 0;                                    -- FİNAL: joker yasak
    end if;
    return v_hak;
  elsif p_mac_tur = '1v1' then
    select * into m from public.matches where id = p_mac_id;
    if not found then raise exception 'Maç bulunamadı'; end if;
    v_rakip := case when m.oyuncu1 = auth.uid() then m.oyuncu2 else m.oyuncu1 end;
    if exists (
      select 1 from public.friendships f
      where f.durum = 'arkadas'
        and ((f.requester = auth.uid() and f.addressee = v_rakip)
          or (f.requester = v_rakip and f.addressee = auth.uid()))
    ) then
      return null;                                 -- sınırsız
    end if;
    return v_hak;
  end if;
  raise exception 'Geçersiz maç türü';
end;
$function$;

-- Ücretsiz 50:50 hakkı artık moda bağlı: yalnız SERBEST 1v1.
create or replace function public.joker_ucretsiz_elli_hakki(p_mac_tur text, p_mac_id uuid)
returns boolean
language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_dereceli boolean;
begin
  -- Paket 27 B.1.2: ücretsiz 50:50 YALNIZ serbest Klasik Mod'da.
  -- Dereceli Klasik Mod, düello, turnuva, grup, hızlı: ücretsiz joker YOK.
  if p_mac_tur <> '1v1' then return false; end if;
  select coalesce(dereceli, true) into v_dereceli from public.matches where id = p_mac_id;
  if not found or v_dereceli then return false; end if;
  -- Bu maçta ücretsizi daha önce kullandıysa hak bitmiştir.
  return not exists (
    select 1 from public.joker_kullanimlari
     where user_id = auth.uid() and mac_tur = p_mac_tur and mac_id = p_mac_id
       and tur = 'elli' and ucretsiz);
end;
$function$;

-- Ortak kapı: maç başına toplam hak + aynı tür bir kez.
-- Hem joker_kullan hem düello fonksiyonları buradan geçer ki kural tek yerde dursun.
create or replace function public.joker_hak_kontrol(p_mac_tur text, p_mac_id uuid, p_tur text)
returns void
language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_sinir int;
  v_kullanilan int;
begin
  -- AYNI JOKER MAÇ BAŞINA BİR KEZ (Paket 27 B.1.5)
  if exists (
    select 1 from public.joker_kullanimlari
     where user_id = v_me and mac_tur = p_mac_tur and mac_id = p_mac_id and tur = p_tur
  ) then
    raise exception 'Bu jokeri bu maçta zaten kullandın';
  end if;

  if p_mac_tur = 'duello' then
    v_sinir := public.ayar_sayi('duello_joker_hak', 4)::int;
  else
    v_sinir := public.joker_mac_siniri(p_mac_tur, p_mac_id);
  end if;

  if v_sinir = 0 then
    raise exception 'Turnuva finalinde joker kullanılamaz';
  end if;
  if v_sinir is null then
    return;                                        -- arkadaş maçı: sınırsız
  end if;

  select count(*) into v_kullanilan
    from public.joker_kullanimlari
   where user_id = v_me and mac_tur = p_mac_tur and mac_id = p_mac_id;
  if v_kullanilan >= v_sinir then
    raise exception 'Bu maçta en fazla % joker kullanabilirsin', v_sinir;
  end if;
end;
$function$;

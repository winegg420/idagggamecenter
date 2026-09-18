-- Paket 27 (devam) — B'nin fonksiyon değişiklikleri, C (maç içi satın alma), D (bot simetrisi).
--
-- Gövdeler CANLIDAKİ hâlinden alındı; yalnız ilgili bloklar değiştirildi
-- (minimum değişiklik). Değişen yerlerin her birinde "Paket 27" yorumu var.

-- ===========================================================================
-- C) MAÇ İÇİNDE JOKER SATIN ALMA
--
-- Oyuncu maçtan çıkmadan, dükkâna gitmeden joker alır ve AYNI ANDA kullanır.
-- Tek RPC, tek işlem: kullanım herhangi bir sebeple reddedilirse (maç bitti,
-- faz uygun değil, hak doldu) işlem geri alınır ve COIN DÜŞMEZ.
-- Fiyat SUNUCUDAN okunur; istemciden gelen fiyata asla bakılmaz.
-- ===========================================================================

-- Tek jokerin fiyatı. Satın alınamayan tür için null döner.
create or replace function public.joker_fiyati(p_tur text)
returns bigint
language sql stable security definer set search_path to 'public'
as $function$
  select case
    when p_tur in ('elli', 'sure', 'soru_degistir',
                   'zaman_baskisi', 'saldiri_degistir', 'savunma_kilidi')
      then public.ayar_sayi('coin_joker_' || p_tur, 0)
    else null
  end;
$function$;

-- İstemcinin pop-up'ta fiyat gösterebilmesi için tek çağrıda hepsi.
-- Maç içinde satın alınabilen türler; 'seri_koruma' maç içi değildir (paketle alınır),
-- 'pas' ölü türdür (hiçbir yerde harcanamaz) — ikisi de listede yok.
create or replace function public.joker_fiyatlari()
returns jsonb
language sql stable security definer set search_path to 'public'
as $function$
  select jsonb_object_agg(t, public.joker_fiyati(t))
    from unnest(array['elli', 'sure', 'soru_degistir',
                      'zaman_baskisi', 'saldiri_degistir', 'savunma_kilidi']) t;
$function$;

-- Satın al + kullan, TEK işlem.
create or replace function public.joker_al_ve_kullan(
  p_mac_tur text, p_mac_id uuid, p_soru_index integer, p_tur text
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_fiyat bigint;
  v_adet int;
  v_satin boolean := false;
  v_sonuc jsonb;
begin
  -- Arka arkaya basılıp coin boşaltılamasın.
  perform public.hiz_siniri('joker_al_ve_kullan', 10, interval '60 seconds');
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  if p_mac_tur not in ('1v1', 'grup', 'hizli', 'turnuva', 'duello') then
    raise exception 'Geçersiz maç türü';
  end if;

  v_fiyat := public.joker_fiyati(p_tur);
  if v_fiyat is null or v_fiyat <= 0 then raise exception 'Bu joker satın alınamaz'; end if;

  -- Hak kapısı satın almadan ÖNCE: hakkı dolmuş oyuncudan coin alınmasın.
  -- (Aynı kapı kullanım fonksiyonunda tekrar çalışır; burada erken dönmek için.)
  perform public.joker_hak_kontrol(p_mac_tur, p_mac_id, p_tur);

  -- Profil kilidi: iki sekmeden aynı anda satın alma aynı coin'i harcayamaz.
  perform 1 from public.profiles where id = v_me for update;

  select coalesce(e.adet, 0) into v_adet
    from public.joker_envanter e where e.user_id = v_me and e.tur = p_tur;

  -- Ücretsiz 50:50 hakkı duruyorsa satın almaya gerek yok — coin boşa gitmesin.
  if coalesce(v_adet, 0) <= 0 and not (p_tur = 'elli'
      and public.joker_ucretsiz_elli_hakki(p_mac_tur, p_mac_id)) then
    perform public.coin_harca(v_fiyat, 'joker', 'joker_mac_ici:' || p_mac_id::text);
    perform public.joker_hareket(v_me, p_tur, 1, 'mac_ici', p_mac_tur || ':' || p_mac_id::text);
    v_satin := true;
  end if;

  -- Kullanım: buradan sonra bir hata çıkarsa İŞLEMİN TAMAMI geri alınır,
  -- yani coin de joker de geri gelir.
  if p_mac_tur = 'duello' then
    if p_tur in ('zaman_baskisi', 'saldiri_degistir', 'savunma_kilidi') then
      perform public.duello_saldiri_jokeri(p_mac_id, p_tur);
    else
      perform public.duello_savunma_jokeri(p_mac_id, p_tur);
    end if;
    v_sonuc := jsonb_build_object('tur', p_tur);
  else
    v_sonuc := public.joker_kullan(p_mac_tur, p_mac_id, p_soru_index, p_tur);
  end if;

  return v_sonuc
    || jsonb_build_object(
         'satin_alindi', v_satin,
         'odenen', case when v_satin then v_fiyat else 0 end,
         'coin', (select pr.coin from public.profiles pr where pr.id = v_me));
end;
$function$;


-- ===========================================================================
-- B) DEĞİŞEN KULLANIM FONKSİYONLARI (gövdeler canlıdan, yalnız ilgili blok değişti)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.joker_kullan(p_mac_tur text, p_mac_id uuid, p_soru_index integer, p_tur text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me uuid := auth.uid();
  v_sinir int;
  v_kullanilan int;
  v_ucretsiz boolean := false;
  v_soru_id uuid;
  v_dogru smallint;
  v_kapali int[];
  v_baslangic timestamptz;
  v_aktif_soru int;
  m public.matches%rowtype;
  gm public.group_matches%rowtype;
  hm public.hizli_maclar%rowtype;
  t public.tournaments%rowtype;
  v_ben_p1 boolean;
  v_yeni_soru uuid;
  v_degisti boolean;
  v_q record;   -- soru_dilinde(): oyuncunun dilindeki metin
begin
  perform public.hiz_siniri('joker_kullan', 20, interval '60 seconds');
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  if p_tur not in ('elli','sure','soru_degistir') then
    raise exception 'Bu joker maç içinde kullanılamaz';
  end if;
  if p_mac_tur not in ('1v1','grup','hizli','turnuva') then
    raise exception 'Geçersiz maç türü';
  end if;
  -- Turnuva herkese AYNI soruyu sorar ve elemelidir: soru değiştirilemez.
  if p_mac_tur = 'turnuva' and p_tur = 'soru_degistir' then
    raise exception 'Turnuvada soru değiştirilemez';
  end if;

  if p_mac_tur = '1v1' then
    select * into m from public.matches where id = p_mac_id for update;
    if not found then raise exception 'Maç bulunamadı'; end if;
    if v_me not in (m.oyuncu1, m.oyuncu2) then raise exception 'Bu maçta değilsin'; end if;
    if m.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;
    v_ben_p1 := (m.oyuncu1 = v_me);
    if coalesce(m.senkron, false) then
      v_aktif_soru := m.aktif_soru;
      v_baslangic := m.soru_baslangic;
    else
      v_aktif_soru := coalesce(case when v_ben_p1 then m.oyuncu1_soru else m.oyuncu2_soru end, 0);
      v_baslangic := case when v_ben_p1 then m.oyuncu1_baslangic else m.oyuncu2_baslangic end;
    end if;
    v_soru_id := m.soru_ids[v_aktif_soru + 1];
    if exists (select 1 from public.match_answers
               where match_id = p_mac_id and user_id = v_me and soru_index = v_aktif_soru) then
      raise exception 'Bu soruyu zaten cevapladın';
    end if;

  elsif p_mac_tur = 'grup' then
    select * into gm from public.group_matches where id = p_mac_id for update;
    if not found then raise exception 'Maç bulunamadı'; end if;
    if not exists (select 1 from public.group_match_players
                   where group_match_id = p_mac_id and user_id = v_me and davet_durumu = 'kabul') then
      raise exception 'Bu maçta değilsin';
    end if;
    if gm.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;
    v_aktif_soru := gm.aktif_soru; v_baslangic := gm.soru_baslangic;
    v_soru_id := gm.soru_ids[gm.aktif_soru + 1];
    if exists (select 1 from public.group_match_answers
               where group_match_id = p_mac_id and user_id = v_me and soru_index = gm.aktif_soru) then
      raise exception 'Bu soruyu zaten cevapladın';
    end if;

  elsif p_mac_tur = 'hizli' then
    select * into hm from public.hizli_maclar where id = p_mac_id for update;
    if not found then raise exception 'Maç bulunamadı'; end if;
    if not exists (select 1 from public.hizli_oyuncular
                   where hizli_mac_id = p_mac_id and user_id = v_me and davet_durumu = 'kabul') then
      raise exception 'Bu maçta değilsin';
    end if;
    if hm.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;
    v_aktif_soru := hm.aktif_soru; v_baslangic := hm.soru_baslangic;
    v_soru_id := hm.soru_ids[hm.aktif_soru + 1];
    if exists (select 1 from public.hizli_cevaplar
               where hizli_mac_id = p_mac_id and user_id = v_me and soru_index = hm.aktif_soru) then
      raise exception 'Bu soruyu zaten cevapladın';
    end if;

  else
    select * into t from public.tournaments where id = p_mac_id for update;
    if not found then raise exception 'Turnuva bulunamadı'; end if;
    if not exists (select 1 from public.tournament_players
                   where tournament_id = p_mac_id and user_id = v_me and not elendi) then
      raise exception 'Turnuvada değilsin ya da elendin';
    end if;
    if t.durum <> 'aktif' then raise exception 'Turnuva aktif değil'; end if;
    v_aktif_soru := t.aktif_soru; v_baslangic := t.soru_baslangic;
    v_soru_id := t.soru_ids[t.aktif_soru + 1];
    if exists (select 1 from public.tournament_answers
               where tournament_id = p_mac_id and user_id = v_me and soru_index = t.aktif_soru) then
      raise exception 'Bu soruyu zaten cevapladın';
    end if;
  end if;

  -- Soru daha önce değiştirildiyse kişiye özel soru/saat geçerlidir
  if p_mac_tur <> 'turnuva' then
    v_soru_id := public.soru_id_coz(p_mac_tur, p_mac_id, v_me, v_aktif_soru, v_soru_id);
    v_baslangic := public.soru_baslangic_coz(p_mac_tur, p_mac_id, v_me, v_aktif_soru, v_baslangic);
  end if;

  if p_soru_index is not null and p_soru_index <> v_aktif_soru then
    raise exception 'Soru değişti, tekrar dene';
  end if;
  if now() > v_baslangic + interval '16 seconds' then
    raise exception 'Süre doldu';
  end if;

  -- Paket 27 B: toplam hak + "aynı joker maçta bir kez" tek yerden (joker_hak_kontrol).
  perform public.joker_hak_kontrol(p_mac_tur, p_mac_id, p_tur);

  -- "Soru Değiştir maç başına 1 kez" kuralı artık BÜTÜN türler için geçerli;
  -- yukarıdaki joker_hak_kontrol uyguluyor, ayrı istisnaya gerek kalmadı.

  -- Ücretsiz 50:50 yalnız SERBEST Klasik Mod'da (Paket 27 B.1.2).
  if p_tur = 'elli' then
    v_ucretsiz := public.joker_ucretsiz_elli_hakki(p_mac_tur, p_mac_id);
  end if;

  if not v_ucretsiz then
    perform public.joker_hareket(v_me, p_tur, -1, 'kullanim', p_mac_tur || ':' || p_mac_id::text);
  end if;

  insert into public.joker_kullanimlari (user_id, mac_tur, mac_id, soru_index, tur, ucretsiz)
  values (v_me, p_mac_tur, p_mac_id, v_aktif_soru, p_tur, v_ucretsiz);

  select q.dogru_cevap into v_dogru from public.questions q where q.id = v_soru_id;

  if p_tur = 'elli' then
    select array_agg(x) into v_kapali from (
      select x from generate_series(0, 3) x
      where x <> v_dogru order by random() limit 2
    ) s;
    return jsonb_build_object('tur','elli','ucretsiz',v_ucretsiz,'kapali',to_jsonb(v_kapali));

  elsif p_tur = 'sure' then
    -- Soru değiştirilmişse sayaç kişisel satırda tutuluyor; onu uzat.
    v_degisti := exists (select 1 from public.soru_degisimleri d
      where d.mac_tur = p_mac_tur and d.mac_id = p_mac_id
        and d.user_id = v_me and d.soru_index = v_aktif_soru);
    if v_degisti then
      update public.soru_degisimleri
         set baslangic = baslangic + interval '10 seconds'
       where mac_tur = p_mac_tur and mac_id = p_mac_id
         and user_id = v_me and soru_index = v_aktif_soru;
    elsif p_mac_tur = '1v1' then
      if coalesce(m.senkron, false) then
        update public.matches set soru_baslangic = soru_baslangic + interval '10 seconds' where id = p_mac_id;
      elsif v_ben_p1 then
        update public.matches set oyuncu1_baslangic = oyuncu1_baslangic + interval '10 seconds' where id = p_mac_id;
      else
        update public.matches set oyuncu2_baslangic = oyuncu2_baslangic + interval '10 seconds' where id = p_mac_id;
      end if;
    elsif p_mac_tur = 'grup' then
      update public.group_matches set soru_baslangic = soru_baslangic + interval '10 seconds' where id = p_mac_id;
    elsif p_mac_tur = 'hizli' then
      update public.hizli_maclar set soru_baslangic = soru_baslangic + interval '10 seconds' where id = p_mac_id;
    else
      update public.tournaments set soru_baslangic = soru_baslangic + interval '10 seconds' where id = p_mac_id;
    end if;
    return jsonb_build_object('tur','sure','ucretsiz',false,'uzatildi',true);

  else -- soru_degistir: soru atlanmaz, yerine yenisi gelir, süre baştan başlar
    v_yeni_soru := public.mac_soru_degistir(p_mac_tur, p_mac_id, v_me, v_aktif_soru);
    -- Metin oyuncunun dilinde (bkz. migration 163 soru_dilinde)
    select v_yeni_soru as id, sd.soru, sd.secenekler, sd.dogru_cevap into v_q
      from public.soru_dilinde(v_yeni_soru, public.oyuncu_dili()) sd;
    perform public.gorulen_kaydet(v_yeni_soru);
    return jsonb_build_object(
      'tur','soru_degistir','ucretsiz',false,'degisti',true,
      'soru', jsonb_build_object(
        'question_id', v_q.id,
        'soru', v_q.soru,
        'secenekler', v_q.secenekler,
        'soru_index', v_aktif_soru,
        'baslangic', (select d.baslangic from public.soru_degisimleri d
                       where d.mac_tur = p_mac_tur and d.mac_id = p_mac_id
                         and d.user_id = v_me and d.soru_index = v_aktif_soru),
        'sunucu_zamani', now(),
        'dogru_cevap', case when public.hileli_mi() then v_q.dogru_cevap else null end));
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.duello_saldiri_jokeri(p_id uuid, p_tur text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d public.duellolar%rowtype;
  v_me uuid := auth.uid();
  v_kullanilan int;
  v_ucretsiz boolean;
  v_soru uuid;
  v_savunan uuid;
begin
  perform public.hiz_siniri('duello_eylem', 90, interval '60 seconds');
  if p_tur not in ('zaman_baskisi','saldiri_degistir','savunma_kilidi') then raise exception 'Geçersiz joker'; end if;
  d := public.duello_kilitle(p_id);
  if d.durum <> 'aktif' or d.faz <> 'hazirlik' or d.saldiran <> v_me or now() >= d.faz_bitis then
    raise exception 'Saldırı jokerleri yalnız Saldırı Hazırlığı sırasında kullanılır';
  end if;
  if (p_tur = 'zaman_baskisi' and d.zaman_baskisi) or (p_tur = 'savunma_kilidi' and d.savunma_kilidi) then
    raise exception 'Bu joker bu saldırıda zaten kullanıldı';
  end if;
  if p_tur = 'saldiri_degistir' and d.soru_degisti_saldiri then
    raise exception 'Yeni gelen soru ikinci kez değiştirilemez';
  end if;

  -- Paket 27 B: saldırı ve savunma ayrı ayrı değil, TEK toplam hak sayılır;
  -- aynı joker maçta bir kez. Düelloda hiçbir joker ücretsiz DEĞİL.
  perform public.joker_hak_kontrol('duello', p_id, p_tur);
  v_ucretsiz := false;
  perform public.joker_hareket(v_me, p_tur, -1, 'kullanim', 'duello:' || p_id::text);
  insert into public.joker_kullanimlari (user_id, mac_tur, mac_id, soru_index, tur, ucretsiz)
  values (v_me, 'duello', p_id, d.tur * 2 + d.saldiri_sirasi, p_tur, v_ucretsiz);

  if p_tur = 'zaman_baskisi' then
    update public.duellolar set zaman_baskisi = true, son_hareket = now() where id = p_id;
  elsif p_tur = 'savunma_kilidi' then
    update public.duellolar set savunma_kilidi = true, son_hareket = now() where id = p_id;
  else
    v_savunan := case when d.saldiran = d.oyuncu1 then d.oyuncu2 else d.oyuncu1 end;
    v_soru := public.duello_soru_bul(p_id, d.kategori, array[v_savunan, v_me], d.kullanilan_sorular);
    if v_soru is null then raise exception 'Bu kategoride başka soru kalmadı'; end if;
    update public.duellolar
       set soru_id = v_soru, soru_degisti_saldiri = true,
           kullanilan_sorular = kullanilan_sorular || v_soru, son_hareket = now()
     where id = p_id;
    perform public.gorulen_kaydet(v_soru);
  end if;
  perform public.duello_sinyal_ver(p_id);
end $function$;

CREATE OR REPLACE FUNCTION public.duello_savunma_jokeri(p_id uuid, p_tur text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d public.duellolar%rowtype;
  v_me uuid := auth.uid();
  v_kullanilan int;
  v_ucretsiz boolean := false;
  v_dogru smallint;
  v_soru uuid;
begin
  perform public.hiz_siniri('duello_eylem', 90, interval '60 seconds');
  if p_tur not in ('elli','sure','soru_degistir') then raise exception 'Geçersiz joker'; end if;
  d := public.duello_kilitle(p_id);
  if d.durum <> 'aktif' or d.faz <> 'cevap' or d.saldiran = v_me or now() > d.faz_bitis then
    raise exception 'Savunma jokerleri yalnız cevap verirken kullanılır';
  end if;
  if d.savunma_kilidi then raise exception 'Rakip bu soruda savunma jokeri kullanamaz'; end if;
  if p_tur = 'elli' and d.elli_kapali is not null then raise exception 'Bu soruda 50:50 zaten kullanıldı'; end if;
  if p_tur = 'sure' and d.ek_sure then raise exception 'Bu soruda Ek Süre zaten kullanıldı'; end if;

  -- Paket 27 B: tek toplam hak + aynı joker maçta bir kez (joker_hak_kontrol).
  -- Düellodaki ücretsiz 50:50 KALDIRILDI: düelloda hiçbir joker ücretsiz değil.
  perform public.joker_hak_kontrol('duello', p_id, p_tur);
  v_ucretsiz := false;
  perform public.joker_hareket(v_me, p_tur, -1, 'kullanim', 'duello:' || p_id::text);
  insert into public.joker_kullanimlari (user_id, mac_tur, mac_id, soru_index, tur, ucretsiz)
  values (v_me, 'duello', p_id, d.tur * 2 + d.saldiri_sirasi, p_tur, v_ucretsiz);

  if p_tur = 'elli' then
    select dogru_cevap into v_dogru from public.questions where id = d.soru_id;
    update public.duellolar
       set elli_kapali = (select array_agg(x) from (select x from generate_series(0, 3) x
                            where x <> v_dogru order by random() limit 2) s),
           son_hareket = now()
     where id = p_id;
  elsif p_tur = 'sure' then
    update public.duellolar
       set ek_sure = true, faz_bitis = faz_bitis + make_interval(secs => public.ayar_sayi('duello_ek_sure_sn', 5)),
           son_hareket = now()
     where id = p_id;
  else
    v_soru := public.duello_soru_bul(p_id, d.kategori, array[v_me, d.saldiran], d.kullanilan_sorular);
    if v_soru is null then raise exception 'Bu kategoride başka soru kalmadı'; end if;
    update public.duellolar
       set soru_id = v_soru, soru_degisti_savunma = true, elli_kapali = null,
           kullanilan_sorular = kullanilan_sorular || v_soru,
           faz_bitis = now() + make_interval(secs =>
             case when zaman_baskisi then public.ayar_sayi('duello_zaman_baskisi_sn', 10)
                  else public.ayar_sayi('duello_cevap_sn', 15) end),
           son_hareket = now()
     where id = p_id;
  end if;
  perform public.duello_sinyal_ver(p_id);
end $function$;

CREATE OR REPLACE FUNCTION public.duello_durum(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d public.duellolar%rowtype;
  v_me uuid := auth.uid();
  v_rakip uuid;
  v_savunan uuid;
  v_dil text := public.oyuncu_dili();
  v_soru_goster boolean;
  v_soru jsonb;
  v_arkadas boolean;
  v_ezeli jsonb;
  v_odul jsonb;
  v_envanter jsonb;
  v_kullanim jsonb;
begin
  perform public.hiz_siniri('duello_durum', 400, interval '60 seconds');
  d := public.duello_kilitle(p_id);
  v_rakip := case when d.oyuncu1 = v_me then d.oyuncu2 else d.oyuncu1 end;
  v_savunan := case when d.saldiran = d.oyuncu1 then d.oyuncu2 else d.oyuncu1 end;

  v_soru_goster := d.soru_id is not null and (
       (d.faz = 'hazirlik' and d.saldiran = v_me)
    or d.faz in ('cevap','sonuc','altin')
    or d.durum <> 'aktif');
  if v_soru_goster then
    select jsonb_build_object('soru', sd.soru, 'secenekler', sd.secenekler, 'kategori', sd.kategori)
      into v_soru from public.soru_dilinde(d.soru_id, v_dil) sd;
  end if;

  v_arkadas := exists (select 1 from public.friendships f where f.durum = 'arkadas'
     and ((f.requester = v_me and f.addressee = v_rakip) or (f.requester = v_rakip and f.addressee = v_me)));
  if v_arkadas then
    select jsonb_build_object(
             'ben', count(*) filter (where x.kazanan = v_me),
             'rakip', count(*) filter (where x.kazanan = v_rakip))
      into v_ezeli
      from public.duellolar x
     where x.durum = 'bitti'
       and ((x.oyuncu1 = v_me and x.oyuncu2 = v_rakip) or (x.oyuncu1 = v_rakip and x.oyuncu2 = v_me));
  end if;

  if d.durum = 'bitti' then
    v_odul := jsonb_build_object(
      'lig_puan', case when d.dereceli and d.kazanan = v_me
                       then floor(public.ayar_sayi('lig_duello_galibiyet', 50) * d.odul_carpan)::int else 0 end,
      'coin', coalesce((select sum(h.miktar) from public.coin_hareketleri h
                         where h.user_id = v_me and h.tur = 'mac' and h.referans = 'duello:' || p_id::text), 0));
  end if;

  select coalesce(jsonb_object_agg(e.tur, e.adet), '{}'::jsonb) into v_envanter
    from public.joker_envanter e where e.user_id = v_me;
  select jsonb_build_object(
           'saldiri', count(*) filter (where k.tur in ('zaman_baskisi','saldiri_degistir','savunma_kilidi')),
           'saldiri_ucretsiz', count(*) filter (where k.ucretsiz and k.tur in ('zaman_baskisi','saldiri_degistir','savunma_kilidi')),
           'savunma', count(*) filter (where k.tur in ('elli','sure','soru_degistir')),
           'elli_ucretsiz', bool_or(k.tur = 'elli' and k.ucretsiz),
           'soru_degistir', bool_or(k.tur = 'soru_degistir'),
           -- Paket 27 B: aynı tür maçta bir kez — istemci hangi türün
           -- tükendiğini bilsin ki düğmeyi boşuna açmasın.
           'turler', coalesce(jsonb_agg(distinct k.tur) filter (where k.tur is not null), '[]'::jsonb))
    into v_kullanim
    from public.joker_kullanimlari k where k.user_id = v_me and k.mac_tur = 'duello' and k.mac_id = p_id;

  return jsonb_build_object(
    'id', d.id, 'durum', d.durum, 'dereceli', d.dereceli,
    'tur', d.tur, 'max_tur', public.ayar_sayi('duello_max_tur', 10), 'saldiri_sirasi', d.saldiri_sirasi,
    'faz', d.faz, 'faz_bitis', d.faz_bitis, 'sunucu_zamani', now(),
    'ben', v_me, 'saldiran', d.saldiran, 'savunan', v_savunan,
    'oyuncular', jsonb_build_array(
      (select jsonb_build_object('id', p.id, 'gorunen_ad', p.gorunen_ad, 'gorunen_avatar', p.gorunen_avatar,
               'gorunum', p.gorunum, 'can', d.can1, 'dogru', d.dogru1, 'profil', d.profil1, 'zayif', d.zayif1,
               'unvan', public.oyuncu_unvani(p.id))
         from public.profiles p where p.id = d.oyuncu1),
      (select jsonb_build_object('id', p.id, 'gorunen_ad', p.gorunen_ad, 'gorunen_avatar', p.gorunen_avatar,
               'gorunum', p.gorunum, 'can', d.can2, 'dogru', d.dogru2, 'profil', d.profil2, 'zayif', d.zayif2,
               'unvan', public.oyuncu_unvani(p.id))
         from public.profiles p where p.id = d.oyuncu2)),
    'kategoriler', to_jsonb(public.duello_kategorileri()),
    'kategori_max', public.ayar_sayi('duello_kategori_max', 2),
    'kullanim', jsonb_build_object(d.oyuncu1::text, public.duello_kategori_kullanimi(p_id, d.oyuncu1),
                                   d.oyuncu2::text, public.duello_kategori_kullanimi(p_id, d.oyuncu2)),
    'kategori', d.kategori,
    'soru', v_soru,
    'elli_kapali', case when v_me = v_savunan and d.faz = 'cevap' then to_jsonb(d.elli_kapali) end,
    'zaman_baskisi', d.zaman_baskisi, 'savunma_kilidi', d.savunma_kilidi, 'ek_sure', d.ek_sure,
    'soru_degisti_saldiri', d.soru_degisti_saldiri,
    'son_hamle', case when d.faz in ('sonuc','kategori','altin') or d.durum <> 'aktif' then d.son_hamle end,
    'altin', case when d.faz = 'altin' then jsonb_build_object(
                    'ben_cevapladim', d.altin_cevaplar ? v_me::text,
                    'benim_cevabim', d.altin_cevaplar -> v_me::text -> 'cevap',
                    'rakip_cevapladi', d.altin_cevaplar ? v_rakip::text) end,
    'jokerler', jsonb_build_object(
       'envanter', v_envanter, 'kullanim', v_kullanim,
       -- Paket 27 B: tek toplam hak. Eski alanlar (saldiri_siniri/savunma_siniri/
       -- ucretsiz_saldiri) eski istemci sürümü kırılmasın diye aynı yapıda
       -- doldurulmaya devam ediyor; yeni istemci 'hak' ve 'kullanilan'a bakar.
       'hak', public.ayar_sayi('duello_joker_hak', 4),
       'kullanilan', (select count(*) from public.joker_kullanimlari k2
                       where k2.user_id = v_me and k2.mac_tur = 'duello' and k2.mac_id = p_id),
       'fiyatlar', public.joker_fiyatlari(),
       'coin', (select coalesce(pr.coin, 0) from public.profiles pr where pr.id = v_me),
       'saldiri_siniri', public.ayar_sayi('duello_joker_hak', 4),
       'savunma_siniri', public.ayar_sayi('duello_joker_hak', 4),
       'ucretsiz_saldiri', public.ayar_sayi('duello_ucretsiz_saldiri_joker', 0)),
    'sureler', jsonb_build_object('cevap', public.ayar_sayi('duello_cevap_sn', 15),
       'zaman_baskisi', public.ayar_sayi('duello_zaman_baskisi_sn', 10),
       'hazirlik', public.ayar_sayi('duello_hazirlik_sn', 4),
       'kategori', public.ayar_sayi('duello_kategori_sn', 20),
       'altin', public.ayar_sayi('duello_altin_sn', 15)),
    'kazanan', d.kazanan, 'odul', v_odul, 'ezeli', v_ezeli,
    'rovans', jsonb_build_object('isteyen', d.rovans_isteyen, 'id', d.rovans_id,
       'gecerli', d.rovans_at is not null and d.rovans_at > now() - make_interval(secs => public.ayar_sayi('duello_rovans_sn', 60)))
  );
end $function$;


-- ===========================================================================
-- D) BOT SİMETRİSİ — duello_tik_hepsi
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.duello_tik_hepsi()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  d public.duellolar%rowtype;
  v_bot uuid;
  v_bot_saldiran boolean;
  v_kat text;
  v_cevap smallint;
  v_dogru_cevap smallint;
  v_bas timestamptz;
  v_gecikme double precision;
  v_islenen int := 0;
  v_tur text;
  v_min real;
  v_max real;
begin
  -- Paket 26 E: aynı işin iki kopyası aynı anda çalışmasın. Ölçüldü (17 Eyl 15:00 UTC):
  -- migration uygulanırken fonksiyon derlemesi kilitlenince 2 saniyelik işler birikti ve
  -- 9 koşu 120 sn'lik ifade zaman aşımına düştü. Kilidi alamayan koşu sessizce atlar.
  if not pg_try_advisory_xact_lock(hashtext('duello_tik_hepsi')) then return 0; end if;
  for r in select x.id from public.duellolar x where x.durum = 'aktif' loop
    begin
      select * into d from public.duellolar where id = r.id for update skip locked;
      if not found then continue; end if;
      perform public.duello_ilerlet(r.id);
      select * into d from public.duellolar where id = r.id;
      if d.durum <> 'aktif' then continue; end if;

      select p.id, p.bot_gecikme_min, p.bot_gecikme_max into v_bot, v_min, v_max
        from public.profiles p where p.id in (d.oyuncu1, d.oyuncu2) and coalesce(p.is_bot, false) limit 1;
      if v_bot is null then continue; end if;
      v_bot_saldiran := (d.saldiran = v_bot);

      if d.faz = 'kategori' and v_bot_saldiran then
        v_bas := d.faz_bitis - make_interval(secs => public.ayar_sayi('duello_kategori_sn', 20));
        if now() >= v_bas + make_interval(secs =>
             public.ayar_ondalik('duello_bot_kategori_min_sn', 2)
             + public.bot_rasgele('dkat:' || d.id::text || ':' || d.tur || ':' || d.saldiri_sirasi)
               * (public.ayar_ondalik('duello_bot_kategori_max_sn', 5) - public.ayar_ondalik('duello_bot_kategori_min_sn', 2))) then
          v_kat := public.duello_bot_kategori(d.id);
          if v_kat is not null then
            perform public.duello_kategori_uygula(d.id, v_kat);
            perform public.duello_sinyal_ver(d.id);
          end if;
        end if;

      elsif d.faz = 'hazirlik' and v_bot_saldiran and not d.zaman_baskisi and not d.savunma_kilidi then
        -- Bir kez zar at (saldırı başına sabit tohum)
        -- Paket 27 D — BOT SİMETRİSİ.
        -- Ölçülen adaletsizlik: bot %15 olasılıkla saldırı jokeri kullanıyordu ama
        -- envanterinden ya da coin'inden hiçbir şey düşmüyordu; insan her joker için
        -- ödüyordu. Botun envanteri olmadığı için "ödesin" demek anlamsız — doğrusu
        -- botu insanın GERÇEK KISITINA sokmak: maç başına en çok duello_joker_hak (4)
        -- joker ve AYNI JOKER İKİ KEZ KULLANILAMAZ. Sıklık ayarı (yüzde) korundu.
        if public.bot_rasgele('djok:' || d.id::text || ':' || d.tur || ':' || d.saldiri_sirasi) * 100
             < public.ayar_sayi('duello_bot_joker_yuzde', 15)
           and (select count(*) from public.joker_kullanimlari k
                 where k.user_id = v_bot and k.mac_tur = 'duello' and k.mac_id = d.id)
               < public.ayar_sayi('duello_joker_hak', 4) then
          -- Bu maçta bot tarafından HENÜZ KULLANILMAMIŞ saldırı jokerlerinden biri.
          -- Havuz bilerek iki tür: botun 'saldiri_degistir' için soru değiştirme
          -- yolu yok (aşağıdaki update yalnız iki bayrağı yazar), eklenirse bot
          -- etkisiz bir joker harcamış olurdu.
          -- Seçim tohumu eskisiyle aynı; yalnız aday havuzu daralıyor.
          select k2 into v_tur
            from unnest(array['zaman_baskisi', 'savunma_kilidi']) k2
           where not exists (select 1 from public.joker_kullanimlari k3
                              where k3.user_id = v_bot and k3.mac_tur = 'duello'
                                and k3.mac_id = d.id and k3.tur = k2)
           order by public.bot_rasgele('djt:' || d.id::text || ':' || d.tur || ':' || k2)
           limit 1;
        else
          v_tur := null;
        end if;

        if v_tur is not null then
          insert into public.joker_kullanimlari (user_id, mac_tur, mac_id, soru_index, tur, ucretsiz)
          values (v_bot, 'duello', d.id, d.tur * 2 + d.saldiri_sirasi, v_tur, true);
          update public.duellolar
             set zaman_baskisi = zaman_baskisi or v_tur = 'zaman_baskisi',
                 savunma_kilidi = savunma_kilidi or v_tur = 'savunma_kilidi'
           where id = d.id;
          perform public.duello_sinyal_ver(d.id);
        end if;

      elsif d.faz = 'cevap' and not v_bot_saldiran then
        v_bas := d.faz_bitis - make_interval(secs =>
                   case when d.zaman_baskisi then public.ayar_sayi('duello_zaman_baskisi_sn', 10)
                        else public.ayar_sayi('duello_cevap_sn', 15) end)
                 - case when d.ek_sure then make_interval(secs => public.ayar_sayi('duello_ek_sure_sn', 5)) else interval '0' end;
        v_gecikme := least(
          extract(epoch from (d.faz_bitis - v_bas)) - 0.8,
          public.bot_gecikme_sn(v_bot, 'duello:' || d.id::text || ':' || d.soru_id::text, v_min, v_max,
                                public.soru_okuma_yuku(d.soru_id)));
        if now() >= v_bas + v_gecikme * interval '1 second' then
          select dogru_cevap into v_dogru_cevap from public.questions where id = d.soru_id;
          if random() < public.bot_kategori_isabet(v_bot, d.kategori) then
            v_cevap := v_dogru_cevap;
          else
            select x into v_cevap from generate_series(0, 3) x where x <> v_dogru_cevap order by random() limit 1;
          end if;
          perform public.duello_cozumle(d.id, v_cevap);
          perform public.duello_sinyal_ver(d.id);
        end if;

      elsif d.faz = 'altin' and not (d.altin_cevaplar ? v_bot::text) then
        v_bas := d.faz_bitis - make_interval(secs => public.ayar_sayi('duello_altin_sn', 15));
        v_gecikme := least(
          public.ayar_ondalik('duello_altin_sn', 15) - 0.8,
          public.bot_gecikme_sn(v_bot, 'dalt:' || d.id::text || ':' || d.soru_id::text, v_min, v_max,
                                public.soru_okuma_yuku(d.soru_id)));
        if now() >= v_bas + v_gecikme * interval '1 second' then
          select dogru_cevap into v_dogru_cevap from public.questions where id = d.soru_id;
          if random() < public.bot_kategori_isabet(v_bot, d.kategori) then
            v_cevap := v_dogru_cevap;
          else
            select x into v_cevap from generate_series(0, 3) x where x <> v_dogru_cevap order by random() limit 1;
          end if;
          update public.duellolar
             set altin_cevaplar = altin_cevaplar || jsonb_build_object(v_bot::text,
                   jsonb_build_object('cevap', v_cevap, 'dogru', v_cevap = v_dogru_cevap))
           where id = d.id;
          perform public.kategori_istatistik_yaz(v_bot, d.kategori, v_cevap = v_dogru_cevap);
          select * into d from public.duellolar where id = d.id;
          if (d.altin_cevaplar ? d.oyuncu1::text) and (d.altin_cevaplar ? d.oyuncu2::text) then
            perform public.duello_altin_degerlendir(d.id);
          end if;
          perform public.duello_sinyal_ver(d.id);
        end if;
      end if;
      v_islenen := v_islenen + 1;
    exception when others then
      raise warning 'duello_tik_hepsi %: %', r.id, sqlerrm;
    end;
  end loop;

  -- Bota gelen rövanş istekleri: insan gibi gecikmeyle kabul
  for r in
    select x.id, p.id as bot_id, p.bot_turu, x.rovans_at
      from public.duellolar x
      join public.profiles p on p.id in (x.oyuncu1, x.oyuncu2) and coalesce(p.is_bot, false)
     where x.durum = 'bitti' and x.rovans_isteyen is not null and x.rovans_isteyen <> p.id
       and x.rovans_id is null
       and x.rovans_at > now() - make_interval(secs => public.ayar_sayi('duello_rovans_sn', 60))
  loop
    begin
      if now() >= r.rovans_at + make_interval(secs => 2 + 4 * public.bot_rasgele('drov:' || r.id::text)) then
        perform public.duello_rovans_baslat(r.id);
      end if;
    exception when others then
      raise warning 'duello rovans %: %', r.id, sqlerrm;
    end;
  end loop;

  return v_islenen;
end $function$;

-- ===========================================================================
-- YETKİ (Paket 26 A kuralı) — yeni fonksiyonlar da varsayılan olarak PUBLIC'e
-- açılır. İstemcinin çağırdığı ikisi dışında hepsi kapatılıyor; iç çağrılar
-- SECURITY DEFINER olduğu için sahibin hakkıyla çalışmaya devam eder.
-- ===========================================================================
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as imza, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('baslangic_jokerleri_ver', 'joker_hak_kontrol',
                         'joker_ucretsiz_elli_hakki', 'joker_fiyati')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.imza);
    execute format('grant execute on function %s to postgres, service_role', r.imza);
  end loop;
end $$;

-- İstemcinin çağırdıkları: yalnız giriş yapmış oyuncuya.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as imza
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('joker_al_ve_kullan', 'joker_fiyatlari')
  loop
    execute format('revoke execute on function %s from public, anon', r.imza);
    execute format('grant execute on function %s to authenticated, postgres, service_role', r.imza);
  end loop;
end $$;

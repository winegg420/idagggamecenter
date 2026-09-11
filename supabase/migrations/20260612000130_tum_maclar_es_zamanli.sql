-- ============================================================
-- TÜM MAÇLAR EŞ ZAMANLI: HAZIR KAPISI + KOPMA KİLİDİ + HÜKMEN MAĞLUBİYET
--
-- İstenen davranış:
--   1) Eşleşme bittikten sonra rakip beklenir; İKİ TARAF DA "Hazır"a basınca
--      maç başlar (128'deki sessiz otomatik başlatma yerine açık onay).
--   2) Rakip oyundan çıkar ya da ekran değiştirirse KARŞI TARAFIN EKRANI DA
--      KİLİTLENİR ve "rakip bekleniyor" yazar. Maç duraklar: bekleyen oyuncu
--      bu yüzden süre kaybetmez (soru saati dönüşte ileri kaydırılır).
--   3) Belli sürede dönmezse maçı terk etmiş sayılır ve HÜKMEN MAĞLUP olur.
--
-- Aynı kurallar üç moda da uygulanır: 1v1 (matches), grup maçı ve hızlı maç.
-- Turnuva zaten ortak saatli ve kendi lobisi var; dokunulmadı.
--
-- Süreler: nabız penceresi 12 sn (istemci 3 sn'de bir atar), terk 45 sn.
-- ============================================================

-- ---------- kolonlar ----------
alter table public.matches
  add column if not exists oyuncu1_hazir boolean not null default false,
  add column if not exists oyuncu2_hazir boolean not null default false,
  add column if not exists duraklatildi_at timestamptz,
  add column if not exists terk_eden uuid references public.profiles(id);

alter table public.group_matches
  add column if not exists basladi boolean not null default false,
  add column if not exists duraklatildi_at timestamptz;

alter table public.group_match_players
  add column if not exists hazir boolean not null default false,
  add column if not exists nabiz_at timestamptz,
  add column if not exists terk_at timestamptz;

alter table public.hizli_maclar
  add column if not exists basladi boolean not null default false,
  add column if not exists duraklatildi_at timestamptz;

alter table public.hizli_oyuncular
  add column if not exists hazir boolean not null default false,
  add column if not exists nabiz_at timestamptz,
  add column if not exists terk_at timestamptz;

-- Devam eden / bitmiş maçlar yeni kapıya takılmasın: başlamış sayılırlar.
update public.matches set oyuncu1_hazir = true, oyuncu2_hazir = true where basladi;
update public.group_matches set basladi = true where durum in ('aktif', 'bitti');
update public.hizli_maclar set basladi = true where durum in ('aktif', 'bitti');

-- ============================================================
-- 1v1 — NABIZ
-- İstemci 3 sn'de bir çağırır. p_hazir true gelirse "Hazır"a basılmış demektir
-- (bir kez true olur, geri alınmaz). Dönüş, ekranın ne çizeceğini söyler.
-- ============================================================
create or replace function public.mac_nabiz(p_match_id uuid, p_hazir boolean default false)
returns table(durum text, basladi boolean, ben_hazir boolean, rakip_hazir boolean,
              rakip_baglantili boolean, duraklatildi boolean, duraklama_sn int,
              baslangic timestamptz, sunucu_zamani timestamptz, terk_eden uuid)
language plpgsql
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  m public.matches%rowtype;
  v_ben_p1 boolean;
  v_rakip uuid;
  v_rakip_bot boolean;
  v_rakip_hazir boolean;
  v_ben_hazir boolean;
  v_rakip_bagli boolean;
  v_duraklama int := 0;
  v_terk uuid;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if auth.uid() not in (m.oyuncu1, m.oyuncu2) then raise exception 'Bu maçta değilsin'; end if;

  v_ben_p1 := (m.oyuncu1 = auth.uid());
  v_rakip := case when v_ben_p1 then m.oyuncu2 else m.oyuncu1 end;
  select coalesce(is_bot, false) into v_rakip_bot from public.profiles where id = v_rakip;

  -- Eski (asenkron) maç: kapı ve kilit yok.
  if not coalesce(m.senkron, false) then
    return query select m.durum, true, true, true, true, false, 0, m.soru_baslangic, now(), m.terk_eden;
    return;
  end if;

  -- Nabzımı at, gerekiyorsa hazır işaretle
  if v_ben_p1 then
    update public.matches
       set oyuncu1_hazir_at = now(),
           oyuncu1_hazir = oyuncu1_hazir or coalesce(p_hazir, false)
     where id = p_match_id;
  else
    update public.matches
       set oyuncu2_hazir_at = now(),
           oyuncu2_hazir = oyuncu2_hazir or coalesce(p_hazir, false)
     where id = p_match_id;
  end if;
  select * into m from public.matches where id = p_match_id;

  v_ben_hazir := case when v_ben_p1 then m.oyuncu1_hazir else m.oyuncu2_hazir end;
  -- Bot her zaman hazır ve bağlı.
  v_rakip_hazir := coalesce(v_rakip_bot, false)
    or (case when v_ben_p1 then m.oyuncu2_hazir else m.oyuncu1_hazir end);
  v_rakip_bagli := coalesce(v_rakip_bot, false) or
    coalesce(case when v_ben_p1 then m.oyuncu2_hazir_at else m.oyuncu1_hazir_at end,
             '-infinity'::timestamptz) > now() - interval '12 seconds';

  if m.durum = 'aktif' and not m.basladi then
    -- ---- HAZIR KAPISI ----
    if v_ben_hazir and v_rakip_hazir and v_rakip_bagli then
      update public.matches
         set basladi = true, aktif_soru = 0, soru_baslangic = now(),
             oyuncu1_soru = 0, oyuncu2_soru = 0,
             oyuncu1_baslangic = null, oyuncu2_baslangic = null
       where id = p_match_id;
      select * into m from public.matches where id = p_match_id;
    end if;

  elsif m.durum = 'aktif' and m.basladi then
    -- ---- KOPMA KİLİDİ ----
    if not v_rakip_bagli and m.duraklatildi_at is null then
      update public.matches set duraklatildi_at = now() where id = p_match_id;
      select * into m from public.matches where id = p_match_id;

    elsif v_rakip_bagli and m.duraklatildi_at is not null then
      -- Rakip döndü: duraklanan süre kadar soru saatini İLERİ al ki bekleyen
      -- oyuncu bu yüzden süre kaybetmesin.
      update public.matches
         set soru_baslangic = soru_baslangic + (now() - m.duraklatildi_at),
             duraklatildi_at = null
       where id = p_match_id;
      select * into m from public.matches where id = p_match_id;

    elsif not v_rakip_bagli and m.duraklatildi_at is not null
          and now() > m.duraklatildi_at + interval '45 seconds' then
      -- ---- HÜKMEN MAĞLUBİYET ----
      -- Maçı terk etti: kalan sorular oynanmaz, buradaki oyuncu kazanır.
      update public.matches set terk_eden = v_rakip where id = p_match_id;
      perform public.mac_sonuclandir(p_match_id, auth.uid(), v_rakip);
      select * into m from public.matches where id = p_match_id;
    end if;
  end if;

  if m.duraklatildi_at is not null then
    v_duraklama := greatest(0, extract(epoch from (now() - m.duraklatildi_at))::int);
  end if;
  v_terk := m.terk_eden;

  return query select m.durum, m.basladi, v_ben_hazir, v_rakip_hazir, v_rakip_bagli,
                      (m.duraklatildi_at is not null), v_duraklama,
                      m.soru_baslangic, now(), v_terk;
end;
$fn$;

grant execute on function public.mac_nabiz(uuid, boolean) to authenticated;

-- Eski istemci hâlâ mac_hazir çağırabilir: varlığını "hazırım" sayıp
-- yeni akışa bağlarız (sürüm geçişinde maç kilitlenmesin).
create or replace function public.mac_hazir(p_match_id uuid)
returns table(basladi boolean, rakip_hazir boolean, baslangic timestamptz, sunucu_zamani timestamptz)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r record;
begin
  select * into r from public.mac_nabiz(p_match_id, true);
  return query select r.basladi, r.rakip_hazir, r.baslangic, r.sunucu_zamani;
end;
$fn$;

-- ============================================================
-- 1v1 — duraklatılmışken ilerleme ve cevap YOK
-- ============================================================
create or replace function public.advance_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  m public.matches%rowtype;
  v_kazanan uuid;
  v_kaybeden uuid;
  v_toplam int;
  v_ikisi_bitti boolean;
  v_terk boolean;
  v_cevap_sayisi int;
  v_yeni int;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found or m.durum <> 'aktif' then return; end if;
  if auth.uid() is not null and auth.uid() not in (m.oyuncu1, m.oyuncu2) then return; end if;

  v_toplam := coalesce(array_length(m.soru_ids, 1), 0);

  if coalesce(m.senkron, false) then
    -- ---- SENKRON ----
    if not m.basladi or m.soru_baslangic is null then return; end if;
    -- Rakip kopmuş ve maç duraklamış: soru geçmez, saat işlemez.
    if m.duraklatildi_at is not null then return; end if;

    if m.aktif_soru < v_toplam then
      select count(*) into v_cevap_sayisi
        from public.match_answers a
       where a.match_id = p_match_id and a.soru_index = m.aktif_soru;

      if v_cevap_sayisi < 2 and now() <= m.soru_baslangic + interval '16 seconds' then
        return;
      end if;

      v_yeni := m.aktif_soru + 1;
      update public.matches
         set aktif_soru = v_yeni,
             soru_baslangic = now(),
             oyuncu1_soru = v_yeni,
             oyuncu2_soru = v_yeni,
             oyuncu1_baslangic = null,
             oyuncu2_baslangic = null,
             oyuncu1_bitti_at = case when v_yeni >= v_toplam then now() else oyuncu1_bitti_at end,
             oyuncu2_bitti_at = case when v_yeni >= v_toplam then now() else oyuncu2_bitti_at end
       where id = p_match_id;

      if v_yeni < v_toplam then return; end if;
    end if;
  else
    v_ikisi_bitti := (m.oyuncu1_soru >= v_toplam and m.oyuncu2_soru >= v_toplam);
    v_terk := (
      (m.oyuncu1_soru >= v_toplam or m.oyuncu2_soru >= v_toplam)
      and coalesce(m.oyuncu1_bitti_at, m.oyuncu2_bitti_at) < now() - interval '24 hours'
    );
    if not (v_ikisi_bitti or v_terk) then
      return;
    end if;
  end if;

  select * into m from public.matches where id = p_match_id;
  if m.oyuncu1_skor > m.oyuncu2_skor then v_kazanan := m.oyuncu1; v_kaybeden := m.oyuncu2;
  elsif m.oyuncu2_skor > m.oyuncu1_skor then v_kazanan := m.oyuncu2; v_kaybeden := m.oyuncu1;
  else v_kazanan := null; v_kaybeden := null;
  end if;

  perform public.mac_sonuclandir(p_match_id, v_kazanan, v_kaybeden);
end;
$fn$;

-- ============================================================
-- GRUP MAÇI — NABIZ
-- ============================================================
create or replace function public.grup_mac_nabiz(p_group_match_id uuid, p_hazir boolean default false)
returns table(durum text, basladi boolean, ben_hazir boolean, hazir_sayisi int,
              toplam_oyuncu int, bekleyenler text[], duraklatildi boolean,
              duraklama_sn int, baslangic timestamptz, sunucu_zamani timestamptz)
language plpgsql
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  gm public.group_matches%rowtype;
  v_ben_hazir boolean;
  v_hazir int;
  v_toplam int;
  v_kopuk int;
  v_bekleyenler text[];
  v_duraklama int := 0;
begin
  select * into gm from public.group_matches where id = p_group_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if not exists (
    select 1 from public.group_match_players
    where group_match_id = p_group_match_id and user_id = auth.uid()
  ) then raise exception 'Bu maçta değilsin'; end if;

  update public.group_match_players
     set nabiz_at = now(),
         hazir = hazir or coalesce(p_hazir, false)
   where group_match_id = p_group_match_id and user_id = auth.uid();

  -- Oynayan (kabul etmiş, terk etmemiş) oyuncular
  select count(*),
         count(*) filter (where gp.hazir or coalesce(pr.is_bot, false)),
         count(*) filter (where not coalesce(pr.is_bot, false)
                            and coalesce(gp.nabiz_at, '-infinity'::timestamptz)
                                <= now() - interval '12 seconds'),
         coalesce(array_agg(pr.gorunen_ad) filter (
           where not coalesce(pr.is_bot, false)
             and coalesce(gp.nabiz_at, '-infinity'::timestamptz) <= now() - interval '12 seconds'
         ), '{}'::text[])
    into v_toplam, v_hazir, v_kopuk, v_bekleyenler
    from public.group_match_players gp
    join public.profiles pr on pr.id = gp.user_id
   where gp.group_match_id = p_group_match_id
     and gp.davet_durumu = 'kabul'
     and gp.terk_at is null;

  select (hazir or coalesce((select is_bot from public.profiles where id = auth.uid()), false))
    into v_ben_hazir
    from public.group_match_players
   where group_match_id = p_group_match_id and user_id = auth.uid();

  if gm.durum = 'aktif' and not gm.basladi then
    -- Herkes hazır: ortak saat şimdi başlar.
    if v_toplam > 0 and v_hazir >= v_toplam and v_kopuk = 0 then
      update public.group_matches
         set basladi = true, aktif_soru = 0, soru_baslangic = now()
       where id = p_group_match_id;
      select * into gm from public.group_matches where id = p_group_match_id;
    end if;

  elsif gm.durum = 'aktif' and gm.basladi then
    if v_kopuk > 0 and gm.duraklatildi_at is null then
      update public.group_matches set duraklatildi_at = now() where id = p_group_match_id;
      select * into gm from public.group_matches where id = p_group_match_id;

    elsif v_kopuk = 0 and gm.duraklatildi_at is not null then
      update public.group_matches
         set soru_baslangic = soru_baslangic + (now() - gm.duraklatildi_at),
             duraklatildi_at = null
       where id = p_group_match_id;
      select * into gm from public.group_matches where id = p_group_match_id;

    elsif v_kopuk > 0 and gm.duraklatildi_at is not null
          and now() > gm.duraklatildi_at + interval '45 seconds' then
      -- Dönmeyenler maçtan ayrılmış sayılır; maç kalanlarla sürer.
      update public.group_match_players gp
         set terk_at = now()
        from public.profiles pr
       where gp.group_match_id = p_group_match_id
         and pr.id = gp.user_id
         and gp.davet_durumu = 'kabul'
         and gp.terk_at is null
         and not coalesce(pr.is_bot, false)
         and coalesce(gp.nabiz_at, '-infinity'::timestamptz) <= now() - interval '12 seconds';

      update public.group_matches
         set soru_baslangic = soru_baslangic + (now() - gm.duraklatildi_at),
             duraklatildi_at = null
       where id = p_group_match_id;

      -- Tek kişi kaldıysa maç biter.
      if (select count(*) from public.group_match_players
           where group_match_id = p_group_match_id
             and davet_durumu = 'kabul' and terk_at is null) <= 1 then
        perform public.advance_group_match(p_group_match_id);
      end if;
      select * into gm from public.group_matches where id = p_group_match_id;
      v_kopuk := 0;
      v_bekleyenler := '{}'::text[];
    end if;
  end if;

  if gm.duraklatildi_at is not null then
    v_duraklama := greatest(0, extract(epoch from (now() - gm.duraklatildi_at))::int);
  end if;

  return query select gm.durum, gm.basladi, coalesce(v_ben_hazir, false), v_hazir, v_toplam,
                      v_bekleyenler, (gm.duraklatildi_at is not null), v_duraklama,
                      gm.soru_baslangic, now();
end;
$fn$;

grant execute on function public.grup_mac_nabiz(uuid, boolean) to authenticated;

-- ============================================================
-- HIZLI MAÇ — NABIZ (grup ile aynı kurgu)
-- ============================================================
create or replace function public.hizli_mac_nabiz(p_hizli_mac_id uuid, p_hazir boolean default false)
returns table(durum text, basladi boolean, ben_hazir boolean, hazir_sayisi int,
              toplam_oyuncu int, bekleyenler text[], duraklatildi boolean,
              duraklama_sn int, baslangic timestamptz, sunucu_zamani timestamptz)
language plpgsql
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  hm public.hizli_maclar%rowtype;
  v_ben_hazir boolean;
  v_hazir int;
  v_toplam int;
  v_kopuk int;
  v_bekleyenler text[];
  v_duraklama int := 0;
begin
  select * into hm from public.hizli_maclar where id = p_hizli_mac_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if not exists (
    select 1 from public.hizli_oyuncular
    where hizli_mac_id = p_hizli_mac_id and user_id = auth.uid()
  ) then raise exception 'Bu maçta değilsin'; end if;

  update public.hizli_oyuncular
     set nabiz_at = now(),
         hazir = hazir or coalesce(p_hazir, false)
   where hizli_mac_id = p_hizli_mac_id and user_id = auth.uid();

  select count(*),
         count(*) filter (where ho.hazir or coalesce(pr.is_bot, false)),
         count(*) filter (where not coalesce(pr.is_bot, false)
                            and coalesce(ho.nabiz_at, '-infinity'::timestamptz)
                                <= now() - interval '12 seconds'),
         coalesce(array_agg(pr.gorunen_ad) filter (
           where not coalesce(pr.is_bot, false)
             and coalesce(ho.nabiz_at, '-infinity'::timestamptz) <= now() - interval '12 seconds'
         ), '{}'::text[])
    into v_toplam, v_hazir, v_kopuk, v_bekleyenler
    from public.hizli_oyuncular ho
    join public.profiles pr on pr.id = ho.user_id
   where ho.hizli_mac_id = p_hizli_mac_id
     and ho.davet_durumu = 'kabul'
     and ho.terk_at is null;

  select (hazir or coalesce((select is_bot from public.profiles where id = auth.uid()), false))
    into v_ben_hazir
    from public.hizli_oyuncular
   where hizli_mac_id = p_hizli_mac_id and user_id = auth.uid();

  if hm.durum = 'aktif' and not hm.basladi then
    if v_toplam > 0 and v_hazir >= v_toplam and v_kopuk = 0 then
      update public.hizli_maclar
         set basladi = true, aktif_soru = 0, soru_baslangic = now()
       where id = p_hizli_mac_id;
      select * into hm from public.hizli_maclar where id = p_hizli_mac_id;
    end if;

  elsif hm.durum = 'aktif' and hm.basladi then
    if v_kopuk > 0 and hm.duraklatildi_at is null then
      update public.hizli_maclar set duraklatildi_at = now() where id = p_hizli_mac_id;
      select * into hm from public.hizli_maclar where id = p_hizli_mac_id;

    elsif v_kopuk = 0 and hm.duraklatildi_at is not null then
      update public.hizli_maclar
         set soru_baslangic = soru_baslangic + (now() - hm.duraklatildi_at),
             duraklatildi_at = null
       where id = p_hizli_mac_id;
      select * into hm from public.hizli_maclar where id = p_hizli_mac_id;

    elsif v_kopuk > 0 and hm.duraklatildi_at is not null
          and now() > hm.duraklatildi_at + interval '45 seconds' then
      update public.hizli_oyuncular ho
         set terk_at = now()
        from public.profiles pr
       where ho.hizli_mac_id = p_hizli_mac_id
         and pr.id = ho.user_id
         and ho.davet_durumu = 'kabul'
         and ho.terk_at is null
         and not coalesce(pr.is_bot, false)
         and coalesce(ho.nabiz_at, '-infinity'::timestamptz) <= now() - interval '12 seconds';

      update public.hizli_maclar
         set soru_baslangic = soru_baslangic + (now() - hm.duraklatildi_at),
             duraklatildi_at = null
       where id = p_hizli_mac_id;

      if (select count(*) from public.hizli_oyuncular
           where hizli_mac_id = p_hizli_mac_id
             and davet_durumu = 'kabul' and terk_at is null) <= 1 then
        perform public.advance_hizli_mac(p_hizli_mac_id);
      end if;
      select * into hm from public.hizli_maclar where id = p_hizli_mac_id;
      v_kopuk := 0;
      v_bekleyenler := '{}'::text[];
    end if;
  end if;

  if hm.duraklatildi_at is not null then
    v_duraklama := greatest(0, extract(epoch from (now() - hm.duraklatildi_at))::int);
  end if;

  return query select hm.durum, hm.basladi, coalesce(v_ben_hazir, false), v_hazir, v_toplam,
                      v_bekleyenler, (hm.duraklatildi_at is not null), v_duraklama,
                      hm.soru_baslangic, now();
end;
$fn$;

grant execute on function public.hizli_mac_nabiz(uuid, boolean) to authenticated;

-- ============================================================
-- CANLI TANIMDAN ÜRETİLDİ — yalnız aşağıdaki satırlar eklendi
-- ============================================================

-- 1v1: duraklatılmışken cevap gönderilemez
create or replace FUNCTION public.submit_match_answer(p_match_id uuid, p_cevap smallint)
 RETURNS TABLE(dogru boolean, dogru_cevap smallint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  m public.matches%rowtype;
  q public.questions%rowtype;
  v_dogru boolean;
  v_puan int;
  v_ben_p1 boolean;
  v_index int;
  v_bas timestamptz;
  v_toplam int;
  v_senkron boolean;
begin
  perform public.hiz_siniri('submit_match_answer', 60, interval '60 seconds');
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if auth.uid() not in (m.oyuncu1, m.oyuncu2) then raise exception 'Bu maçta değilsin'; end if;
  if m.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;

  v_ben_p1 := (m.oyuncu1 = auth.uid());
  v_senkron := coalesce(m.senkron, false);
  v_toplam := coalesce(array_length(m.soru_ids, 1), 0);

  if v_senkron then
    if not m.basladi or m.soru_baslangic is null then raise exception 'Maç henüz başlamadı'; end if;
    -- Rakip koptu, maç duraklatıldı: kimse cevap veremez (ekran kilitli).
    if m.duraklatildi_at is not null then
      raise exception 'Rakip bağlantısı koptu — maç duraklatıldı';
    end if;
    v_index := m.aktif_soru;
    v_bas := m.soru_baslangic;
  else
    v_index := case when v_ben_p1 then m.oyuncu1_soru else m.oyuncu2_soru end;
    v_bas := coalesce(case when v_ben_p1 then m.oyuncu1_baslangic else m.oyuncu2_baslangic end, now());
  end if;

  if v_index >= v_toplam then raise exception 'Bu maçta senin sıran bitti'; end if;
  -- 1 sn ağ payı
  if now() > v_bas + interval '17 seconds' then raise exception 'Süre doldu'; end if;

  -- Senkronda aynı soruya ikinci kez cevap gönderilemez (çift puan olmasın).
  if exists (
    select 1 from public.match_answers a
    where a.match_id = p_match_id and a.user_id = auth.uid() and a.soru_index = v_index
  ) then
    raise exception 'Bu soruyu zaten cevapladın';
  end if;

  select * into q from public.questions where id = m.soru_ids[v_index + 1];
  v_dogru := (p_cevap = q.dogru_cevap);

  insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
  values (p_match_id, auth.uid(), v_index, p_cevap, v_dogru)
  on conflict do nothing;

  if not v_dogru then perform public.yanlis_kaydet(q.id); end if;

  if v_dogru then
    v_puan := 10 + greatest(0, least(15,
      ceil(extract(epoch from (v_bas + interval '16 seconds' - now())))))::int;
  else
    v_puan := 0;
  end if;

  -- SENKRON: ortak indeks (aktif_soru) BURADA ilerletilmez; advance_match
  -- iki taraf da cevaplayınca ya da süre dolunca ilerletir. `oyuncuN_soru`
  -- yalnız "bu soruyu cevapladım" göstergesi olarak ilerler.
  if v_ben_p1 then
    update public.matches
       set oyuncu1_skor = oyuncu1_skor + v_puan,
           oyuncu1_soru = v_index + 1,
           oyuncu1_baslangic = case when v_senkron then oyuncu1_baslangic else null end,
           oyuncu1_bitti_at = case when (not v_senkron) and v_index + 1 >= v_toplam then now() else oyuncu1_bitti_at end,
           aktif_soru = case when v_senkron then aktif_soru else greatest(aktif_soru, v_index + 1) end
     where id = p_match_id;
  else
    update public.matches
       set oyuncu2_skor = oyuncu2_skor + v_puan,
           oyuncu2_soru = v_index + 1,
           oyuncu2_baslangic = case when v_senkron then oyuncu2_baslangic else null end,
           oyuncu2_bitti_at = case when (not v_senkron) and v_index + 1 >= v_toplam then now() else oyuncu2_bitti_at end,
           aktif_soru = case when v_senkron then aktif_soru else greatest(aktif_soru, v_index + 1) end
     where id = p_match_id;
  end if;

  perform public.advance_match(p_match_id);

  return query select v_dogru, q.dogru_cevap;
end;
$function$
;

-- 1v1: duraklatılmışken soru atlanmaz
create or replace FUNCTION public.mac_soruyu_atla(p_match_id uuid)
 RETURNS TABLE(dogru_cevap integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m public.matches%rowtype;
  v_ben_p1 boolean;
  v_index int;
  v_bas timestamptz;
  v_toplam int;
  v_soru_id uuid;
  v_senkron boolean;
begin
  perform public.hiz_siniri('mac_soruyu_atla', 60, interval '60 seconds');
  select * into m from public.matches where id = p_match_id for update;
  if not found or m.durum <> 'aktif' then return; end if;
  if auth.uid() not in (m.oyuncu1, m.oyuncu2) then return; end if;

  v_ben_p1 := (m.oyuncu1 = auth.uid());
  v_senkron := coalesce(m.senkron, false);
  v_toplam := coalesce(array_length(m.soru_ids, 1), 0);

  if v_senkron then
    if not m.basladi then return; end if;
    -- Duraklatılmışken süre işlemez; soru atlanmaz.
    if m.duraklatildi_at is not null then return; end if;
    v_index := m.aktif_soru;
    v_bas := m.soru_baslangic;
  else
    v_index := case when v_ben_p1 then m.oyuncu1_soru else m.oyuncu2_soru end;
    v_bas := case when v_ben_p1 then m.oyuncu1_baslangic else m.oyuncu2_baslangic end;
  end if;

  if v_index >= v_toplam then return; end if;
  -- Yalnız gerçekten süresi dolduysa
  if v_bas is null or now() <= v_bas + interval '17 seconds' then return; end if;

  v_soru_id := m.soru_ids[v_index + 1];

  -- cevap kolonu NOT NULL; -1 = "süre doldu, cevaplanmadı"
  insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
  values (p_match_id, auth.uid(), v_index, -1, false)
  on conflict do nothing;

  -- SENKRON: indeksi advance_match ilerletir (iki tarafı birden).
  if not v_senkron then
    if v_ben_p1 then
      update public.matches
         set oyuncu1_soru = v_index + 1, oyuncu1_baslangic = null,
             oyuncu1_bitti_at = case when v_index + 1 >= v_toplam then now() else oyuncu1_bitti_at end,
             aktif_soru = greatest(aktif_soru, v_index + 1)
       where id = p_match_id;
    else
      update public.matches
         set oyuncu2_soru = v_index + 1, oyuncu2_baslangic = null,
             oyuncu2_bitti_at = case when v_index + 1 >= v_toplam then now() else oyuncu2_bitti_at end,
             aktif_soru = greatest(aktif_soru, v_index + 1)
       where id = p_match_id;
    end if;
  end if;

  perform public.advance_match(p_match_id);

  -- Soru bu oyuncu için kapandı; doğru cevap artık gösterilebilir
  return query select q.dogru_cevap::int from public.questions q where q.id = v_soru_id;
end;
$function$
;

-- Grup maçı: hazır kapısı, kopma kilidi, terk edenler sayılmaz
create or replace FUNCTION public.advance_group_match(p_group_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  gm public.group_matches%rowtype;
  v_toplam_oyuncu int;
  v_cevap_sayisi int;
  v_kazanan uuid;
  v_en_yuksek int;
  v_kazanan_sayisi int;
  v_oyuncu uuid;
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_seri int;
  v_tarih date;
  v_yeni_seri int;
  v_bonus int;
  v_odul int;
begin
  select * into gm from public.group_matches where id = p_group_match_id for update;
  if not found or gm.durum <> 'aktif' then return; end if;
  -- Hazır kapısı ve kopma kilidi (bkz. grup_mac_nabiz)
  if not coalesce(gm.basladi, true) then return; end if;
  if gm.duraklatildi_at is not null then return; end if;

  select count(*) into v_toplam_oyuncu
  from public.group_match_players
  where group_match_id = p_group_match_id and davet_durumu = 'kabul' and terk_at is null;

  select count(*) into v_cevap_sayisi
  from public.group_match_answers
  where group_match_id = p_group_match_id and soru_index = gm.aktif_soru;

  if v_cevap_sayisi < v_toplam_oyuncu and now() < gm.soru_baslangic + interval '16 seconds' then
    return;
  end if;

  if gm.aktif_soru + 1 >= coalesce(array_length(gm.soru_ids, 1), 0) then
    select max(skor) into v_en_yuksek
    from public.group_match_players
    where group_match_id = p_group_match_id and davet_durumu = 'kabul' and terk_at is null;

    select count(*) into v_kazanan_sayisi
    from public.group_match_players
    where group_match_id = p_group_match_id and davet_durumu = 'kabul' and terk_at is null and skor = v_en_yuksek;

    if v_kazanan_sayisi = 1 then
      select user_id into v_kazanan
      from public.group_match_players
      where group_match_id = p_group_match_id and davet_durumu = 'kabul' and terk_at is null and skor = v_en_yuksek;
    else
      v_kazanan := null; -- birden fazla kişi en yüksek skorda: berabere
    end if;

    update public.group_matches
       set durum = 'bitti', kazanan = v_kazanan, bitis = now()
     where id = p_group_match_id;

    if v_kazanan is not null then
      v_odul := 10 * gm.oyuncu_sayisi; -- 3 kişi: +30, 4 kişi: +40
      update public.profiles
         set puan = puan + v_odul, puan_hafta = puan_hafta + v_odul
       where id = v_kazanan;

      perform public.award_badge(v_kazanan, 'ilk_galibiyet');
      if (select count(*) from public.group_match_answers
          where group_match_id = p_group_match_id and user_id = v_kazanan and dogru)
         >= coalesce(array_length(gm.soru_ids, 1), 0) then
        perform public.award_badge(v_kazanan, 'tam_isabet');
      end if;
    end if;

    -- Günlük seri: insan oyunculara (1v1 ile aynı kural, günde bir kez)
    for v_oyuncu in
      select user_id from public.group_match_players
      where group_match_id = p_group_match_id and davet_durumu = 'kabul' and terk_at is null
    loop
      select seri, son_seri_tarihi into v_seri, v_tarih
      from public.profiles where id = v_oyuncu and not is_bot;
      if found and v_tarih is distinct from v_bugun then
        v_yeni_seri := case when v_tarih = v_bugun - 1 then v_seri + 1 else 1 end;
        v_bonus := least(v_yeni_seri * 5, 50);
        update public.profiles
           set seri = v_yeni_seri, son_seri_tarihi = v_bugun,
               puan = puan + v_bonus, puan_hafta = puan_hafta + v_bonus
         where id = v_oyuncu;
        if v_yeni_seri >= 3 then perform public.award_badge(v_oyuncu, 'seri_3'); end if;
        if v_yeni_seri >= 7 then perform public.award_badge(v_oyuncu, 'seri_7'); end if;
      end if;
    end loop;
  else
    update public.group_matches
       set aktif_soru = aktif_soru + 1, soru_baslangic = now()
     where id = p_group_match_id;
  end if;
end;
$function$
;

-- Hızlı maç: hazır kapısı, kopma kilidi, terk edenler sayılmaz
create or replace FUNCTION public.advance_hizli_mac(p_hizli_mac_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  hm public.hizli_maclar%rowtype;
  v_toplam_oyuncu int;
  v_cevap_sayisi int;
  v_kazanan uuid;
  v_en_yuksek int;
  v_kazanan_sayisi int;
  v_oyuncu uuid;
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_seri int;
  v_tarih date;
  v_yeni_seri int;
  v_bonus int;
  v_odul int;
begin
  select * into hm from public.hizli_maclar where id = p_hizli_mac_id for update;
  if not found or hm.durum <> 'aktif' then return; end if;
  -- Hazır kapısı ve kopma kilidi (bkz. hizli_mac_nabiz)
  if not coalesce(hm.basladi, true) then return; end if;
  if hm.duraklatildi_at is not null then return; end if;

  select count(*) into v_toplam_oyuncu
  from public.hizli_oyuncular
  where hizli_mac_id = p_hizli_mac_id and davet_durumu = 'kabul' and terk_at is null;

  select count(*) into v_cevap_sayisi
  from public.hizli_cevaplar
  where hizli_mac_id = p_hizli_mac_id and soru_index = hm.aktif_soru;

  if v_cevap_sayisi < v_toplam_oyuncu and now() < hm.soru_baslangic + interval '16 seconds' then
    return;
  end if;

  if hm.aktif_soru + 1 >= coalesce(array_length(hm.soru_ids, 1), 0) then
    select max(skor) into v_en_yuksek
    from public.hizli_oyuncular
    where hizli_mac_id = p_hizli_mac_id and davet_durumu = 'kabul' and terk_at is null;

    select count(*) into v_kazanan_sayisi
    from public.hizli_oyuncular
    where hizli_mac_id = p_hizli_mac_id and davet_durumu = 'kabul' and terk_at is null and skor = v_en_yuksek;

    if v_kazanan_sayisi = 1 and v_en_yuksek > 0 then
      select user_id into v_kazanan
      from public.hizli_oyuncular
      where hizli_mac_id = p_hizli_mac_id and davet_durumu = 'kabul' and terk_at is null and skor = v_en_yuksek;
    else
      v_kazanan := null; -- berabere veya kimse puan almadı
    end if;

    update public.hizli_maclar
       set durum = 'bitti', kazanan = v_kazanan, bitis = now()
     where id = p_hizli_mac_id;

    if v_kazanan is not null then
      v_odul := 50; -- 5 kişilik yarış galibi
      update public.profiles
         set puan = puan + v_odul, puan_hafta = puan_hafta + v_odul
       where id = v_kazanan;
      perform public.award_badge(v_kazanan, 'ilk_galibiyet');
    end if;

    -- Günlük seri: insan oyunculara (1v1 ile aynı kural, günde bir kez)
    for v_oyuncu in
      select user_id from public.hizli_oyuncular
      where hizli_mac_id = p_hizli_mac_id and davet_durumu = 'kabul' and terk_at is null
    loop
      select seri, son_seri_tarihi into v_seri, v_tarih
      from public.profiles where id = v_oyuncu and not is_bot;
      if found and v_tarih is distinct from v_bugun then
        v_yeni_seri := case when v_tarih = v_bugun - 1 then v_seri + 1 else 1 end;
        v_bonus := least(v_yeni_seri * 5, 50);
        update public.profiles
           set seri = v_yeni_seri, son_seri_tarihi = v_bugun,
               puan = puan + v_bonus, puan_hafta = puan_hafta + v_bonus
         where id = v_oyuncu;
        if v_yeni_seri >= 3 then perform public.award_badge(v_oyuncu, 'seri_3'); end if;
        if v_yeni_seri >= 7 then perform public.award_badge(v_oyuncu, 'seri_7'); end if;
      end if;
    end loop;
  else
    update public.hizli_maclar
       set aktif_soru = aktif_soru + 1, soru_baslangic = now()
     where id = p_hizli_mac_id;
  end if;
end;
$function$
;

-- Bot döngüsü: başlamamış / duraklamış maça dokunmaz, terk edeni beklemez
create or replace FUNCTION public.bot_oyna()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  q public.questions%rowtype;
  v_cevap smallint;
  v_dogru boolean;
  v_puan int;
  v_ilk boolean;
  v_bot_index int;
  v_tepkiler text[] := array['👍','😂','😮','🔥','😎','Hadi bakalım!','Bunu biliyordum!','Vay be! 🤯'];
begin
  -- 1) Botlara gelen meydan okumaları kabul et (kategoriye saygılı)
  for r in
    select m.id, m.kategori, m.oyuncu1 from public.matches m
    join public.profiles p on p.id = m.oyuncu2 and p.is_bot
    where m.durum = 'bekliyor'
    for update of m skip locked
  loop
    update public.matches
       set durum = 'aktif',
           soru_ids = public.soru_sec(r.kategori, 20, array[r.oyuncu1]),
           aktif_soru = 0,
           soru_baslangic = now(),
           kabul_at = now()
     where id = r.id;
  end loop;

  -- 2) Aktif maçlarda cevapla — bot ASLA oyuncunun önüne geçmez.
  --    Bot yalnızca oyuncunun ulaştığı soruyu cevaplar (oyuncunun cevapladığı
  --    en yüksek indeks + 1) ve 2-6 sn arası rastgele gecikmeyle yanıtlar.
  --    (Eski davranış: 3 sn sonra her soruyu cevaplıyordu; 16 sn'lik otomatik
  --     ilerletmeyle birleşince bot 20 soruyu bitirirken oyuncu 2. sorudaydı.)
  for r in
    select m.*, p.id as bot_id, p.bot_isabet,
           case when m.oyuncu1 = p.id then m.oyuncu2 else m.oyuncu1 end as insan_id
    from public.matches m
    join public.profiles p on p.is_bot and p.id in (m.oyuncu1, m.oyuncu2)
    where m.durum = 'aktif'
      -- Botun sira indeksi. SENKRONDA ortak soru (aktif_soru) ile ayni olmali:
      -- bot cevapladiginda kendi indeksi bir ilerler ve sira ortak indeksten
      -- one gecer; boylece ayni soruyu ikinci kez cevaplamaz (cift puan yok).
      and (case when m.oyuncu1 = p.id then m.oyuncu1_soru else m.oyuncu2_soru end)
          < coalesce(array_length(m.soru_ids, 1), 0)
      and (
        not coalesce(m.senkron, false)
        or (m.basladi
            and (case when m.oyuncu1 = p.id then m.oyuncu1_soru else m.oyuncu2_soru end)
                = m.aktif_soru)
      )
      -- Bot, insan oyuncunun ulaştığı sırayı GEÇEMEZ
      and (case when m.oyuncu1 = p.id then m.oyuncu1_soru else m.oyuncu2_soru end)
          <= (case when m.oyuncu1 = p.id then m.oyuncu2_soru else m.oyuncu1_soru end)
      -- 2-6 sn rastgele gecikme (insanın son hamlesinden sonra)
      -- Gecikme artik ZORLUGA BAGLI ve SORU BASINA SABIT (bkz. bot_gecikme_sn).
      and now() >= coalesce(m.soru_baslangic, m.created_at)
                   + public.bot_gecikme_sn(
                       p.id,
                       m.id::text || ':' ||
                       (case when m.oyuncu1 = p.id then m.oyuncu1_soru else m.oyuncu2_soru end)::text,
                       p.bot_gecikme_min, p.bot_gecikme_max
                     ) * interval '1 second'
    for update of m skip locked
  loop
    v_bot_index := case when r.oyuncu1 = r.bot_id then r.oyuncu1_soru else r.oyuncu2_soru end;
    select * into q from public.questions where id = r.soru_ids[v_bot_index + 1];
    if not found then continue; end if;

    if random() < r.bot_isabet then
      v_cevap := q.dogru_cevap;
    else
      select x into v_cevap from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 1;
    end if;
    v_dogru := (v_cevap = q.dogru_cevap);

    insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, v_bot_index, v_cevap, v_dogru)
    on conflict do nothing;

    -- Bot da insan gibi hızına göre puan alır (3-12 sn arası makul bir aralık)
    v_puan := case when v_dogru then 10 + (3 + floor(random() * 10))::int else 0 end;

    if r.oyuncu1 = r.bot_id then
      update public.matches
         set oyuncu1_skor = oyuncu1_skor + v_puan,
             oyuncu1_soru = v_bot_index + 1,
             oyuncu1_bitti_at = case
               when v_bot_index + 1 >= coalesce(array_length(r.soru_ids,1),0) then now()
               else oyuncu1_bitti_at end,
             aktif_soru = case when coalesce(r.senkron, false)
                               then aktif_soru else greatest(aktif_soru, v_bot_index + 1) end,
             soru_baslangic = case when coalesce(r.senkron, false)
                                   then soru_baslangic else now() end
       where id = r.id;
    else
      update public.matches
         set oyuncu2_skor = oyuncu2_skor + v_puan,
             oyuncu2_soru = v_bot_index + 1,
             oyuncu2_bitti_at = case
               when v_bot_index + 1 >= coalesce(array_length(r.soru_ids,1),0) then now()
               else oyuncu2_bitti_at end,
             aktif_soru = case when coalesce(r.senkron, false)
                               then aktif_soru else greatest(aktif_soru, v_bot_index + 1) end,
             soru_baslangic = case when coalesce(r.senkron, false)
                                   then soru_baslangic else now() end
       where id = r.id;
    end if;

    perform public.advance_match(r.id);

    if random() < 0.15 then
      insert into public.match_messages (match_id, user_id, mesaj)
      values (r.id, r.bot_id, v_tepkiler[1 + floor(random() * array_length(v_tepkiler, 1))::int]);
    end if;
  end loop;

  -- 3) Bot maçlarını ilerlet — oyuncu cevaplamadan 16 sn'de ilerletme.
  --    İki koşuldan biri: (a) her ikisi de cevapladı, (b) süre doldu VE oyuncu
  --    bu soruyu cevapladı. Oyuncu maçı terk ederse 90 sn'lik güvenlik ağı
  --    devreye girer (maç sonsuza kadar aktif kalmasın).
  for r in
    select distinct m.id from public.matches m
    join public.profiles p on p.is_bot and p.id in (m.oyuncu1, m.oyuncu2)
    where m.durum = 'aktif'
      and (not coalesce(m.senkron, false) or m.basladi)
      and (
        2 <= (select count(*) from public.match_answers a
              where a.match_id = m.id and a.soru_index = m.aktif_soru)
        or (now() > m.soru_baslangic + interval '16 seconds'
            and exists (
              select 1 from public.match_answers a
              where a.match_id = m.id and a.soru_index = m.aktif_soru
                and a.user_id = (case when m.oyuncu1 = p.id then m.oyuncu2 else m.oyuncu1 end)
            ))
        or now() > m.soru_baslangic + interval '90 seconds'
      )
  loop
    perform public.advance_match(r.id);
  end loop;

  -- 4) Turnuvada hayatta olan botlar cevaplasın
  for r in
    select t.*, p.id as bot_id, p.bot_isabet
    from public.tournaments t
    join public.tournament_players tp on tp.tournament_id = t.id and not tp.elendi
    join public.profiles p on p.id = tp.user_id and p.is_bot
    where t.durum = 'aktif'
      and now() >= t.soru_baslangic + interval '3 seconds'
      and now() <= t.soru_baslangic + interval '15 seconds'
      and not exists (
        select 1 from public.tournament_answers ta
        where ta.tournament_id = t.id and ta.user_id = p.id and ta.soru_index = t.aktif_soru
      )
  loop
    select * into q from public.questions where id = r.soru_ids[r.aktif_soru + 1];
    if not found then continue; end if;

    if random() < r.bot_isabet then
      v_cevap := q.dogru_cevap;
    else
      select x into v_cevap from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 1;
    end if;
    v_dogru := (v_cevap = q.dogru_cevap);

    insert into public.tournament_answers (tournament_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, r.aktif_soru, v_cevap, v_dogru)
    on conflict do nothing;

    if v_dogru then
      update public.tournament_players
         set dogru_sayisi = dogru_sayisi + 1
       where tournament_id = r.id and user_id = r.bot_id;
    end if;
  end loop;

  -- 5) Turnuvaları ilerlet (süre dolduysa veya hayattaki herkes cevapladıysa)
  for r in
    select t.id from public.tournaments t
    where t.durum = 'aktif'
      and (now() > t.soru_baslangic + interval '16 seconds'
        or not exists (
          select 1 from public.tournament_players tp
          where tp.tournament_id = t.id and not tp.elendi
            and not exists (
              select 1 from public.tournament_answers ta
              where ta.tournament_id = t.id
                and ta.user_id = tp.user_id
                and ta.soru_index = t.aktif_soru
            )
        ))
  loop
    perform public.advance_tournament(r.id);
  end loop;

  -- 6) Botlara giden grup davetlerini kabul et
  for r in
    select gmp.group_match_id, gmp.user_id as bot_id
    from public.group_match_players gmp
    join public.profiles p on p.id = gmp.user_id and p.is_bot
    join public.group_matches gm on gm.id = gmp.group_match_id
    where gm.durum = 'bekliyor' and gmp.davet_durumu = 'bekliyor'
    for update of gmp skip locked
  loop
    update public.group_match_players
       set davet_durumu = 'kabul'
     where group_match_id = r.group_match_id and user_id = r.bot_id;
  end loop;

  -- 7) Herkes kabul ettiyse grup maçını başlat
  for r in
    select gm.id, gm.kategori from public.group_matches gm
    where gm.durum = 'bekliyor'
      and not exists (
        select 1 from public.group_match_players gmp
        where gmp.group_match_id = gm.id and gmp.davet_durumu <> 'kabul'
      )
    for update of gm skip locked
  loop
    update public.group_matches
       set durum = 'aktif',
           soru_ids = public.soru_sec(r.kategori, 20,
                        (select coalesce(array_agg(gmp.user_id), '{}'::uuid[])
                           from public.group_match_players gmp
                          where gmp.group_match_id = r.id)),
           aktif_soru = 0,
           soru_baslangic = now()
     where id = r.id;
  end loop;

  -- 8) Aktif grup maçlarında botlar cevaplasın (ve ara sıra tepki versin)
  for r in
    select gm.*, p.id as bot_id, p.bot_isabet
    from public.group_matches gm
    join public.group_match_players gmp on gmp.group_match_id = gm.id
      and gmp.davet_durumu = 'kabul' and gmp.terk_at is null
    join public.profiles p on p.id = gmp.user_id and p.is_bot
    where gm.durum = 'aktif' and gm.basladi and gm.duraklatildi_at is null
      and now() >= gm.soru_baslangic + (2 + random() * 4) * interval '1 second'
      and not exists (
        select 1 from public.group_match_answers a
        where a.group_match_id = gm.id and a.user_id = p.id and a.soru_index = gm.aktif_soru
      )
      -- Bot, insan oyuncularin ulastigi soruyu GECEMEZ (1v1'deki kural)
      and gm.aktif_soru <= 1 + coalesce((
        select max(a2.soru_index)
        from public.group_match_answers a2
        join public.profiles p2 on p2.id = a2.user_id
        where a2.group_match_id = gm.id and not coalesce(p2.is_bot, false)
      ), -1)
    for update of gm skip locked
  loop
    select * into q from public.questions where id = r.soru_ids[r.aktif_soru + 1];
    if not found then continue; end if;

    if random() < r.bot_isabet then
      v_cevap := q.dogru_cevap;
    else
      select x into v_cevap from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 1;
    end if;
    v_dogru := (v_cevap = q.dogru_cevap);

    insert into public.group_match_answers (group_match_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, r.aktif_soru, v_cevap, v_dogru)
    on conflict do nothing;

    if v_dogru then
      v_puan := 10 + greatest(0, least(15,
        ceil(extract(epoch from (r.soru_baslangic + interval '16 seconds' - now())))))::int;
      update public.group_match_players
         set skor = skor + v_puan
       where group_match_id = r.id and user_id = r.bot_id;
    end if;

    if random() < 0.15 then
      insert into public.group_match_messages (group_match_id, user_id, mesaj)
      values (r.id, r.bot_id, v_tepkiler[1 + floor(random() * array_length(v_tepkiler, 1))::int]);
    end if;
  end loop;

  -- 9) Grup maçlarını ilerlet (süre dolduysa veya kabul edenlerin hepsi cevapladıysa)
  for r in
    select gm.id from public.group_matches gm
    where gm.durum = 'aktif' and gm.basladi and gm.duraklatildi_at is null
      and (
        -- herkes cevapladi
        not exists (
          select 1 from public.group_match_players gmp
          where gmp.group_match_id = gm.id and gmp.davet_durumu = 'kabul'
            and gmp.terk_at is null
            and not exists (
              select 1 from public.group_match_answers a
              where a.group_match_id = gm.id and a.user_id = gmp.user_id and a.soru_index = gm.aktif_soru
            )
        )
        -- ya da soru suresi doldu VE en az bir insan bu soruyu fiilen oynadi
        or (now() > gm.soru_baslangic + interval '16 seconds'
            and exists (
              select 1 from public.group_match_answers a3
              join public.profiles p3 on p3.id = a3.user_id
              where a3.group_match_id = gm.id and a3.soru_index = gm.aktif_soru
                and not coalesce(p3.is_bot, false)
            ))
        -- ya da mac terk edildi (guvenlik agi)
        or now() > gm.soru_baslangic + interval '10 minutes'
      )
  loop
    perform public.advance_group_match(r.id);
  end loop;

  -- 10) Botlara giden hızlı maç davetlerini kabul et
  for r in
    select ho.hizli_mac_id, ho.user_id as bot_id
    from public.hizli_oyuncular ho
    join public.profiles p on p.id = ho.user_id and p.is_bot
    join public.hizli_maclar hm on hm.id = ho.hizli_mac_id
    where hm.durum = 'bekliyor' and ho.davet_durumu = 'bekliyor'
    for update of ho skip locked
  loop
    update public.hizli_oyuncular
       set davet_durumu = 'kabul'
     where hizli_mac_id = r.hizli_mac_id and user_id = r.bot_id;
  end loop;

  -- 11) Herkes kabul ettiyse hızlı maçı başlat
  for r in
    select hm.id, hm.kategori from public.hizli_maclar hm
    where hm.durum = 'bekliyor'
      and not exists (
        select 1 from public.hizli_oyuncular ho
        where ho.hizli_mac_id = hm.id and ho.davet_durumu <> 'kabul'
      )
    for update of hm skip locked
  loop
    update public.hizli_maclar
       set durum = 'aktif',
           soru_ids = public.soru_sec(r.kategori, 20,
                        (select coalesce(array_agg(ho.user_id), '{}'::uuid[])
                           from public.hizli_oyuncular ho
                          where ho.hizli_mac_id = r.id)),
           aktif_soru = 0,
           soru_baslangic = now()
     where id = r.id;
  end loop;

  -- 12) Aktif hızlı maçlarda botlar cevaplasın (SADECE ilk doğru puan alır)
  --     Yarış durumu: hizli_maclar satırı kilitlenir, ilk doğru kontrolü yapılır.
  for r in
    select hm.*, p.id as bot_id, p.bot_isabet
    from public.hizli_maclar hm
    join public.hizli_oyuncular ho on ho.hizli_mac_id = hm.id
      and ho.davet_durumu = 'kabul' and ho.terk_at is null
    join public.profiles p on p.id = ho.user_id and p.is_bot
    where hm.durum = 'aktif' and hm.basladi and hm.duraklatildi_at is null
      -- Gecikme zorluga bagli ve (mac, soru, bot) icin SABIT: cron her 7 sn'de
      -- calistigi icin random() her tikte yeniden cekiliyordu; bu, dagilimin
      -- alt sinirina yigilmaya (bot hep ~2 sn'de basiyor) yol aciyordu.
      and now() >= hm.soru_baslangic
                   + public.bot_gecikme_sn(
                       p.id, hm.id::text || ':' || hm.aktif_soru::text,
                       p.bot_gecikme_min, p.bot_gecikme_max
                     ) * interval '1 second'
      and not exists (
        select 1 from public.hizli_cevaplar a
        where a.hizli_mac_id = hm.id and a.user_id = p.id and a.soru_index = hm.aktif_soru
      )
      -- Bot, insan oyuncularin ulastigi soruyu GECEMEZ
      and hm.aktif_soru <= 1 + coalesce((
        select max(a2.soru_index)
        from public.hizli_cevaplar a2
        join public.profiles p2 on p2.id = a2.user_id
        where a2.hizli_mac_id = hm.id and not coalesce(p2.is_bot, false)
      ), -1)
    for update of hm skip locked
  loop
    select * into q from public.questions where id = r.soru_ids[r.aktif_soru + 1];
    if not found then continue; end if;

    if random() < r.bot_isabet then
      v_cevap := q.dogru_cevap;
    else
      select x into v_cevap from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 1;
    end if;
    v_dogru := (v_cevap = q.dogru_cevap);

    v_ilk := false;
    if v_dogru then
      v_ilk := not exists (
        select 1 from public.hizli_cevaplar
        where hizli_mac_id = r.id and soru_index = r.aktif_soru and dogru
      );
    end if;

    insert into public.hizli_cevaplar (hizli_mac_id, user_id, soru_index, cevap, dogru)
    values (r.id, r.bot_id, r.aktif_soru, v_cevap, v_dogru)
    on conflict do nothing;

    if v_ilk then
      update public.hizli_oyuncular
         set skor = skor + 10
       where hizli_mac_id = r.id and user_id = r.bot_id;
    end if;
  end loop;

  -- 13) Hızlı maçları ilerlet (süre dolduysa veya kabul edenlerin hepsi cevapladıysa)
  for r in
    select hm.id from public.hizli_maclar hm
    where hm.durum = 'aktif' and hm.basladi and hm.duraklatildi_at is null
      and (
        not exists (
          select 1 from public.hizli_oyuncular ho
          where ho.hizli_mac_id = hm.id and ho.davet_durumu = 'kabul'
            and ho.terk_at is null
            and not exists (
              select 1 from public.hizli_cevaplar a
              where a.hizli_mac_id = hm.id and a.user_id = ho.user_id and a.soru_index = hm.aktif_soru
            )
        )
        or (now() > hm.soru_baslangic + interval '16 seconds'
            and exists (
              select 1 from public.hizli_cevaplar a3
              join public.profiles p3 on p3.id = a3.user_id
              where a3.hizli_mac_id = hm.id and a3.soru_index = hm.aktif_soru
                and not coalesce(p3.is_bot, false)
            ))
        or now() > hm.soru_baslangic + interval '10 minutes'
      )
  loop
    perform public.advance_hizli_mac(r.id);
  end loop;
end;
$function$
;

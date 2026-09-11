-- ============================================================
-- ARKADAŞ MAÇI LOBİSİ: 3-2-1 GERİ SAYIM + "ASENKRON BIRAK" SEÇENEĞİ
--
-- NOT — GÖREV METNİYLE FARK:
-- Görev "şu an 1v1 asenkron" diyor ve yalnız arkadaş davetlerinin senkron
-- olmasını istiyor. Oysa bir önceki istek üzerine (migration 128 ve 130)
-- TÜM maçlar senkron yapıldı: eşleşmeyle bulunan rakip maçları da hazır
-- kapısından geçiyor. Sahibinin en son sözlü talimatı bu yöndeydi, o yüzden
-- senkronluk geri alınmadı. Bu migration görevin GERÇEKTEN EKSİK olan
-- parçalarını tamamlıyor:
--   1) `lobi_baslangic` damgası — rakip ne zamandır bekleniyor?
--   2) 3-2-1 geri sayım — iki tarafta da AYNI ANDA, sunucu saatiyle.
--   3) 2 dakika sonra "Asenkron bırak" — maç eski sıra tabanlı davranışa
--      döner; oyuncu rakibi beklemeden kendi bölümünü oynar.
--
-- Geri sayım İSTEMCİDE ÜRETİLMEZ: maç başlarken soru saati 3 sn İLERİ
-- kurulur. İki istemci de aynı anı gördüğü için ilk soru ikisinde de
-- gecikmesiz başlar.
-- ============================================================

alter table public.matches
  add column if not exists lobi_baslangic timestamptz;

-- Devam eden maçlara damga: "ne zamandır bekleniyor" hesabı bozulmasın.
update public.matches
   set lobi_baslangic = coalesce(kabul_at, created_at)
 where lobi_baslangic is null;

insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('mac_geri_sayim_sn', '3'::jsonb,   'Maç başlarken 3-2-1 geri sayımı (saniye)'),
  ('lobi_bekleme_sn',   '120'::jsonb, 'Bu süre sonunda "Asenkron bırak" seçeneği çıkar')
on conflict (anahtar) do nothing;

-- ------------------------------------------------------------
-- NABIZ — maç başlarken 3 sn'lik geri sayım kurulur
-- ------------------------------------------------------------
-- Dönüş tipine yeni kolon (lobi_saniye) eklendiği için create or replace
-- yetmiyor: PostgreSQL dönüş tipini değiştirmeye izin vermez. Önce
-- düşürülüp yeniden yaratılıyor; mac_hazir sarmalayıcısı aşağıda yeniden
-- kuruluyor.
drop function if exists public.mac_hazir(uuid);
drop function if exists public.mac_nabiz(uuid, boolean);

create function public.mac_nabiz(p_match_id uuid, p_hazir boolean default false)
returns table(durum text, basladi boolean, ben_hazir boolean, rakip_hazir boolean,
              rakip_baglantili boolean, duraklatildi boolean, duraklama_sn int,
              baslangic timestamptz, sunucu_zamani timestamptz, terk_eden uuid,
              lobi_saniye int)
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
  v_geri_sayim int := public.ayar_sayi('mac_geri_sayim_sn', 3)::int;
  v_lobi int := 0;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if auth.uid() not in (m.oyuncu1, m.oyuncu2) then raise exception 'Bu maçta değilsin'; end if;

  v_ben_p1 := (m.oyuncu1 = auth.uid());
  v_rakip := case when v_ben_p1 then m.oyuncu2 else m.oyuncu1 end;
  select coalesce(is_bot, false) into v_rakip_bot from public.profiles where id = v_rakip;

  -- Eski (asenkron) maç: kapı ve kilit yok.
  if not coalesce(m.senkron, false) then
    return query select m.durum, true, true, true, true, false, 0,
                        m.soru_baslangic, now(), m.terk_eden, 0;
    return;
  end if;

  if v_ben_p1 then
    update public.matches
       set oyuncu1_hazir_at = now(),
           oyuncu1_hazir = oyuncu1_hazir or coalesce(p_hazir, false),
           lobi_baslangic = coalesce(lobi_baslangic, now())
     where id = p_match_id;
  else
    update public.matches
       set oyuncu2_hazir_at = now(),
           oyuncu2_hazir = oyuncu2_hazir or coalesce(p_hazir, false),
           lobi_baslangic = coalesce(lobi_baslangic, now())
     where id = p_match_id;
  end if;
  select * into m from public.matches where id = p_match_id;

  v_ben_hazir := case when v_ben_p1 then m.oyuncu1_hazir else m.oyuncu2_hazir end;
  v_rakip_hazir := coalesce(v_rakip_bot, false)
    or (case when v_ben_p1 then m.oyuncu2_hazir else m.oyuncu1_hazir end);
  v_rakip_bagli := coalesce(v_rakip_bot, false) or
    coalesce(case when v_ben_p1 then m.oyuncu2_hazir_at else m.oyuncu1_hazir_at end,
             '-infinity'::timestamptz) > now() - interval '12 seconds';

  if m.durum = 'aktif' and not m.basladi then
    -- ---- HAZIR KAPISI + 3-2-1 ----
    -- Soru saati geri sayım kadar İLERİ kurulur; iki istemci de aynı anı
    -- görür, ilk soru ikisinde de gecikmesiz başlar.
    if v_ben_hazir and v_rakip_hazir and v_rakip_bagli then
      update public.matches
         set basladi = true, aktif_soru = 0,
             soru_baslangic = now() + (v_geri_sayim || ' seconds')::interval,
             oyuncu1_soru = 0, oyuncu2_soru = 0,
             oyuncu1_baslangic = null, oyuncu2_baslangic = null
       where id = p_match_id;
      select * into m from public.matches where id = p_match_id;
    end if;

  elsif m.durum = 'aktif' and m.basladi then
    if not v_rakip_bagli and m.duraklatildi_at is null then
      update public.matches set duraklatildi_at = now() where id = p_match_id;
      select * into m from public.matches where id = p_match_id;

    elsif v_rakip_bagli and m.duraklatildi_at is not null then
      update public.matches
         set soru_baslangic = soru_baslangic + (now() - m.duraklatildi_at),
             duraklatildi_at = null
       where id = p_match_id;
      select * into m from public.matches where id = p_match_id;

    elsif not v_rakip_bagli and m.duraklatildi_at is not null
          and now() > m.duraklatildi_at + interval '45 seconds' then
      update public.matches set terk_eden = v_rakip where id = p_match_id;
      perform public.mac_sonuclandir(p_match_id, auth.uid(), v_rakip);
      select * into m from public.matches where id = p_match_id;
    end if;
  end if;

  if m.duraklatildi_at is not null then
    v_duraklama := greatest(0, extract(epoch from (now() - m.duraklatildi_at))::int);
  end if;
  if m.lobi_baslangic is not null and not m.basladi then
    v_lobi := greatest(0, extract(epoch from (now() - m.lobi_baslangic))::int);
  end if;
  v_terk := m.terk_eden;

  return query select m.durum, m.basladi, v_ben_hazir, v_rakip_hazir, v_rakip_bagli,
                      (m.duraklatildi_at is not null), v_duraklama,
                      m.soru_baslangic, now(), v_terk, v_lobi;
end;
$fn$;

grant execute on function public.mac_nabiz(uuid, boolean) to authenticated;

-- ------------------------------------------------------------
-- ASENKRON BIRAK
-- Rakip gelmiyorsa oyuncu maçı eski SIRA TABANLI davranışa çevirebilir:
-- kendi bölümünü oynar, rakip kendi zamanında oynar.
-- ------------------------------------------------------------
create or replace function public.mac_asenkrona_gec(p_match_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  m public.matches%rowtype;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  perform public.hiz_siniri('mac_asenkrona_gec', 20, interval '60 seconds');

  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if auth.uid() not in (m.oyuncu1, m.oyuncu2) then raise exception 'Bu maçta değilsin'; end if;
  if m.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;
  if not coalesce(m.senkron, false) then return true; end if;   -- zaten asenkron
  -- BAŞLAMIŞ maç asenkrona çevrilemez: ortak saatte oynanan sorular bozulur.
  if m.basladi then raise exception 'Maç başladı, artık eş zamanlı oynanıyor'; end if;

  update public.matches
     set senkron = false,
         basladi = true,            -- kapı kalksın
         duraklatildi_at = null,
         soru_baslangic = now(),
         oyuncu1_baslangic = null,
         oyuncu2_baslangic = null
   where id = p_match_id;

  return true;
end;
$fn$;

grant execute on function public.mac_asenkrona_gec(uuid) to authenticated;

-- ------------------------------------------------------------
-- GERİ SAYIM SÜRERKEN CEVAP YOK
-- Soru saati ileri kurulduğu için 3 sn boyunca soru "henüz başlamadı".
-- ------------------------------------------------------------
create or replace function public.submit_match_answer(p_match_id uuid, p_cevap smallint)
returns table(dogru boolean, dogru_cevap smallint)
language plpgsql
security definer
set search_path = public
as $fn$
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
    if m.duraklatildi_at is not null then
      raise exception 'Rakip bağlantısı koptu — maç duraklatıldı';
    end if;
    -- 3-2-1 geri sayımı sürerken cevap gönderilemez
    if now() < m.soru_baslangic then raise exception 'Maç başlamak üzere'; end if;
    v_index := m.aktif_soru;
    v_bas := m.soru_baslangic;
  else
    v_index := case when v_ben_p1 then m.oyuncu1_soru else m.oyuncu2_soru end;
    v_bas := coalesce(case when v_ben_p1 then m.oyuncu1_baslangic else m.oyuncu2_baslangic end, now());
  end if;

  if v_index >= v_toplam then raise exception 'Bu maçta senin sıran bitti'; end if;
  if now() > v_bas + interval '17 seconds' then raise exception 'Süre doldu'; end if;

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
$fn$;

-- ------------------------------------------------------------
-- GERİ SAYIM SÜRERKEN İLERLEME DE YOK
-- ------------------------------------------------------------
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
    if not m.basladi or m.soru_baslangic is null then return; end if;
    if m.duraklatildi_at is not null then return; end if;
    -- 3-2-1 geri sayımı sürüyor: henüz ilk soru başlamadı.
    if now() < m.soru_baslangic then return; end if;

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

-- Eski istemci sarmalayıcısı yeni imzaya uydurulur.
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

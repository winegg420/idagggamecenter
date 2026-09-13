-- ============================================================
-- 1v1 LOBİSİNDE DE BOT HEMEN HAZIR OLMASIN
--
-- Migration 177 hızlı maç ve grup maçı lobilerini düzeltti; 1v1 lobisi
-- (`mac_nabiz`) atlanmıştı — oysa sahibinin şikâyet ettiği asıl yer
-- burası: "eşleş tamamlandıktan sonra insansı fake bot ile eşleştiğimizde
-- otomatik olarak hazıra basmış oluyor".
--
-- ÖLÇÜLEN ÖNCEKİ DURUM:
--   v_rakip_hazir := coalesce(v_rakip_bot, false) or (…)
--   → bot, lobinin 0. saniyesinde hazır sayılıyordu.
--
-- YENİ: bot ancak `bot_hazir_mi` (0.5-3 sn, bota özel ve deterministik)
-- geçtikten sonra hazır sayılır. Ölçüm anı `lobi_baslangic` — lobinin
-- ilk nabzında kurulur.
--
-- `v_rakip_bagli` BİLEREK DEĞİŞMEDİ: botlar nabız göndermez, bağlantı
-- kontrolünde bot hep "bağlı" sayılmalı; yoksa maç boşuna duraklar.
-- ============================================================

create or replace function public.mac_nabiz(p_match_id uuid, p_hazir boolean default false)
returns table(durum text, basladi boolean, ben_hazir boolean, rakip_hazir boolean,
              rakip_baglantili boolean, duraklatildi boolean, duraklama_sn integer,
              baslangic timestamptz, sunucu_zamani timestamptz, terk_eden uuid,
              lobi_saniye integer)
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
  -- DEĞİŞEN TEK SATIR: bot artık gecikmeyle hazır oluyor.
  v_rakip_hazir := (coalesce(v_rakip_bot, false)
                    and public.bot_hazir_mi(v_rakip, m.lobi_baslangic, p_match_id::text))
    or (case when v_ben_p1 then m.oyuncu2_hazir else m.oyuncu1_hazir end);
  v_rakip_bagli := coalesce(v_rakip_bot, false) or
    coalesce(case when v_ben_p1 then m.oyuncu2_hazir_at else m.oyuncu1_hazir_at end,
             '-infinity'::timestamptz) > now() - interval '12 seconds';

  if m.durum = 'aktif' and not m.basladi then
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

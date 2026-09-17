-- Paket 20 · Bölüm I.1 + I.2
-- I.1: günlük görev sayaçları yalnız Normal Maç'ı (matches / match_answers) sayıyordu.
--      Artık lig_aktif_mac_sayisi (Paket 18 A) ile aynı mod listesi: Normal Maç, Düello, Hızlı Mod,
--      Grup Maçı (kabul etmiş oyuncu), Turnuva; hepsi durum='bitti', TSİ gün sınırı.
--      Grup Maçı ödülsüz mod olsa da görevlere SAYILIR (ürün kararı: oyuncu gerçekten oynuyor).
--      "Kazan": modun kazanan alanı (Hızlı Mod tek kişilik, kazananı yok → galibiyete sayılmaz).
--      "Doğru": her modun kendi cevap kaydı (Düello: savunanın hamlesi; Hızlı Mod: oturumun doğru sayısı).
-- I.2: Düello doğruları kategori_dogru_arttir'a gitmiyordu (ustalık 0 kalıyordu). Savunan doğrusu ve
--      altın soru doğrusu artık sayılıyor. Turnuva zaten trg_kategori_turnuva tetikleyicisiyle sayılıyor.

create or replace function public.gorev_sayaci(p_quest_id text, p_user uuid, p_tarih date)
 returns bigint
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with sinir as (
    select (p_tarih::timestamp at time zone 'Europe/Istanbul') as bas,
           ((p_tarih + 1)::timestamp at time zone 'Europe/Istanbul') as son
  )
  select case p_quest_id
    when 'mac_oyna_3' then
      (select count(*) from public.matches m, sinir s
        where m.durum = 'bitti' and p_user in (m.oyuncu1, m.oyuncu2) and m.bitis >= s.bas and m.bitis < s.son)
    + (select count(*) from public.duellolar d, sinir s
        where d.durum = 'bitti' and p_user in (d.oyuncu1, d.oyuncu2) and d.bitis >= s.bas and d.bitis < s.son)
    + (select count(*) from public.hizli_mod_oturumlar h, sinir s
        where h.durum = 'bitti' and h.user_id = p_user and h.bitis >= s.bas and h.bitis < s.son)
    + (select count(*) from public.group_matches g join public.group_match_players gp on gp.group_match_id = g.id, sinir s
        where g.durum = 'bitti' and gp.user_id = p_user and gp.davet_durumu = 'kabul' and g.bitis >= s.bas and g.bitis < s.son)
    + (select count(*) from public.tournaments t join public.tournament_players tp on tp.tournament_id = t.id, sinir s
        where t.durum = 'bitti' and tp.user_id = p_user and t.bitis >= s.bas and t.bitis < s.son)
    when 'mac_kazan_5' then
      (select count(*) from public.matches m, sinir s
        where m.durum = 'bitti' and m.kazanan = p_user and m.bitis >= s.bas and m.bitis < s.son)
    + (select count(*) from public.duellolar d, sinir s
        where d.durum = 'bitti' and d.kazanan = p_user and d.bitis >= s.bas and d.bitis < s.son)
    + (select count(*) from public.group_matches g join public.group_match_players gp on gp.group_match_id = g.id, sinir s
        where g.durum = 'bitti' and g.kazanan = p_user and gp.user_id = p_user and gp.davet_durumu = 'kabul' and g.bitis >= s.bas and g.bitis < s.son)
    + (select count(*) from public.tournaments t, sinir s
        where t.durum = 'bitti' and t.kazanan = p_user and t.bitis >= s.bas and t.bitis < s.son)
    when 'dogru_25' then
      (select count(*) from public.match_answers a, sinir s
        where a.user_id = p_user and a.dogru and a.created_at >= s.bas and a.created_at < s.son)
    + (select count(*) from public.duello_hamleler dh, sinir s
        where dh.savunan = p_user and dh.dogru and dh.created_at >= s.bas and dh.created_at < s.son)
    + (select coalesce(sum(h.dogru), 0) from public.hizli_mod_oturumlar h, sinir s
        where h.durum = 'bitti' and h.user_id = p_user and h.bitis >= s.bas and h.bitis < s.son)
    + (select count(*) from public.group_match_answers ga, sinir s
        where ga.user_id = p_user and ga.dogru and ga.created_at >= s.bas and ga.created_at < s.son)
    + (select count(*) from public.tournament_answers ta, sinir s
        where ta.user_id = p_user and ta.dogru and ta.created_at >= s.bas and ta.created_at < s.son)
    else 0
  end;
$function$;

CREATE OR REPLACE FUNCTION public.duello_cevap(p_id uuid, p_cevap smallint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d public.duellolar%rowtype;
  v_me uuid := auth.uid();
  v_dogru boolean;
begin
  perform public.hiz_siniri('duello_eylem', 90, interval '60 seconds');
  if p_cevap is null or p_cevap not between 0 and 3 then raise exception 'Geçersiz cevap'; end if;
  d := public.duello_kilitle(p_id);
  if d.durum <> 'aktif' then raise exception 'Düello bitti'; end if;

  if d.faz = 'cevap' then
    if d.saldiran = v_me then raise exception 'Kendi saldırını cevaplayamazsın'; end if;
    perform public.gorulen_kaydet(d.soru_id);
    perform public.duello_cozumle(p_id, p_cevap);
  elsif d.faz = 'altin' then
    if d.altin_cevaplar ? v_me::text then raise exception 'Bu soruyu zaten cevapladın'; end if;
    v_dogru := p_cevap = (select dogru_cevap from public.questions where id = d.soru_id);
    update public.duellolar
       set altin_cevaplar = altin_cevaplar || jsonb_build_object(v_me::text,
             jsonb_build_object('cevap', p_cevap, 'dogru', v_dogru)),
           son_hareket = now()
     where id = p_id;
    perform public.gorulen_kaydet(d.soru_id);
    perform public.kategori_istatistik_yaz(v_me, d.kategori, v_dogru);
    -- Paket 20 I.2: altın soru doğrusu kategori ustalığına da sayılır (bot filtresi fonksiyonun içinde)
    if v_dogru then perform public.kategori_dogru_arttir(v_me, d.kategori); end if;
    select * into d from public.duellolar where id = p_id;
    if (d.altin_cevaplar ? d.oyuncu1::text) and (d.altin_cevaplar ? d.oyuncu2::text) then
      perform public.duello_altin_degerlendir(p_id);
    end if;
  else
    raise exception 'Şu an cevap verilemez';
  end if;
  perform public.duello_sinyal_ver(p_id);
end $function$;

CREATE OR REPLACE FUNCTION public.duello_cozumle(p_id uuid, p_cevap smallint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d public.duellolar%rowtype;
  v_savunan uuid;
  v_dogru_cevap smallint;
  v_dogru boolean;
  v_riskli boolean;
  v_kaybeden uuid;
begin
  select * into d from public.duellolar where id = p_id;
  v_savunan := case when d.saldiran = d.oyuncu1 then d.oyuncu2 else d.oyuncu1 end;
  select dogru_cevap into v_dogru_cevap from public.questions where id = d.soru_id;
  v_dogru := p_cevap is not null and p_cevap = v_dogru_cevap;
  v_riskli := d.kategori is not distinct from (case when v_savunan = d.oyuncu1 then d.zayif1 else d.zayif2 end)
              and d.kategori is not null;

  if v_dogru then
    v_kaybeden := case when v_riskli then d.saldiran else null end;
  else
    v_kaybeden := v_savunan;
  end if;

  update public.duellolar
     set can1 = can1 - (case when v_kaybeden = oyuncu1 then 1 else 0 end),
         can2 = can2 - (case when v_kaybeden = oyuncu2 then 1 else 0 end),
         dogru1 = dogru1 + (case when v_dogru and v_savunan = oyuncu1 then 1 else 0 end),
         dogru2 = dogru2 + (case when v_dogru and v_savunan = oyuncu2 then 1 else 0 end),
         faz = 'sonuc',
         faz_bitis = now() + make_interval(secs => public.ayar_sayi('duello_sonuc_sn', 3)),
         son_hamle = jsonb_build_object(
           'tur', d.tur, 'saldiran', d.saldiran, 'savunan', v_savunan, 'kategori', d.kategori,
           'soru_id', d.soru_id, 'cevap', p_cevap, 'dogru', v_dogru, 'dogru_cevap', v_dogru_cevap,
           'riskli', v_riskli, 'can_kaybeden', v_kaybeden),
         son_hareket = now()
   where id = p_id;

  insert into public.duello_hamleler (duello_id, tur, saldiran, savunan, kategori, soru_id, cevap, dogru,
                                      riskli, can_kaybeden, zaman_baskisi, savunma_kilidi)
  values (p_id, d.tur, d.saldiran, v_savunan, d.kategori, d.soru_id, p_cevap, v_dogru,
          v_riskli, v_kaybeden, d.zaman_baskisi, d.savunma_kilidi);

  perform public.kategori_istatistik_yaz(v_savunan, d.kategori, v_dogru);
  -- Paket 20 I.2: Düello doğrusu kategori ustalığını besler (eskiden yalnız yüzde tablosu yazılıyordu)
  if v_dogru then perform public.kategori_dogru_arttir(v_savunan, d.kategori); end if;
  if p_cevap is not null then perform public.soru_sayac(d.soru_id, v_dogru); end if;
  if not v_dogru and auth.uid() = v_savunan then perform public.yanlis_kaydet(d.soru_id); end if;
end $function$;

-- I.2 geriye dönük: şimdiye kadarki Düello savunma doğruları ustalığa yazılır (bot filtresi kategori_dogru_arttir'da).
-- Altın soru cevapları geçmişte yalnız son turun jsonb'sinde durduğu için geriye dönük sayılamaz.
do $$
declare r record;
begin
  for r in select dh.savunan, dh.kategori from public.duello_hamleler dh
            where dh.dogru and dh.kategori is not null order by dh.created_at loop
    perform public.kategori_dogru_arttir(r.savunan, r.kategori);
  end loop;
end $$;

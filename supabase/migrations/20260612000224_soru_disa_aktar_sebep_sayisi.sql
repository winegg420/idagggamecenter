-- Paket 20 II.5 — dışa aktarmada bildirim sebepleri SAYIYLA (223'te her sebep 1 görünüyordu; II.7 akış testinde ölçüldü).
CREATE OR REPLACE FUNCTION public.soru_denetim_disa_aktar(p_adet integer DEFAULT NULL::integer, p_parti text DEFAULT NULL::text, p_kuru boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_adet int := coalesce(p_adet, public.ayar_sayi('soru_parti_boyutu', 100)::int);
  v jsonb;
begin
  begin   -- kuru: liste üretilir, "dışa aktarıldı" işareti geri alınır
  with _tara as materialized (select * from public.soru_supheli_tara()),
  _ist as materialized (select * from public.soru_istatistik_tara()),
  son as (
    select distinct on (sd.question_id) sd.question_id, sd.durum, sd.sebep, sd.tarih
      from public.soru_denetim sd order by sd.question_id, sd.tarih desc, sd.id desc
  ),
  bild as (
    select v.question_id, count(*) filter (where not v.adil) sayi,
           (select coalesce(jsonb_object_agg(x.k, x.n), '{}'::jsonb) from (select coalesce(v2.sebep, 'belirtilmedi') k, count(*) n from public.question_votes v2 join public.profiles p2 on p2.id = v2.user_id and not coalesce(p2.is_bot, false) where v2.question_id = v.question_id and not v2.adil group by 1) x) sebepler
      from public.question_votes v join public.profiles p on p.id = v.user_id and not coalesce(p.is_bot, false)
     group by v.question_id
  ),
  isaret as (
    select t.question_id, max(t.agirlik) agirlik,
           jsonb_agg(jsonb_build_object('isaret', t.isaret, 'agirlik', t.agirlik) || case when t.ayrinti = '{}'::jsonb then '{}'::jsonb else jsonb_build_object('ayrinti', t.ayrinti) end) liste
      from _tara t where t.question_id is not null group by t.question_id
  ),
  aday as (
    select q.id, q.soru, q.secenekler, q.dogru_cevap, q.kategori, q.zorluk, q.aktif, q.denetim_durumu, q.surum,
           case when q.denetim_durumu = 'karantina' then 1
                when i2.question_id is not null or coalesce(b.sayi, 0) > 0 then 2
                when i.question_id is not null then 3
                else 4 end oncelik,
           i.agirlik, i.liste, b.sayi, b.sebepler,
           to_jsonb(i2) - 'question_id' - 'kategori' istatistik
      from public.questions q
      left join son s on s.question_id = q.id
      left join isaret i on i.question_id = q.id
      left join _ist i2 on i2.question_id = q.id
      left join bild b on b.question_id = q.id
     where q.denetim_durumu in ('bekliyor', 'karantina')
       and (q.aktif or q.denetim_durumu = 'karantina')
       and not (s.durum is not distinct from 'bekliyor' and s.sebep is not distinct from 'disa_aktarildi')
     order by oncelik, coalesce(i2.agirlik, 0) desc, coalesce(b.sayi, 0) desc, coalesce(i.agirlik, 0) desc, q.created_at
     limit v_adet
  ),
  kayit as (
    insert into public.soru_denetim (question_id, durum, sebep, kaynak, denetleyen)
    select a.id, 'bekliyor', 'disa_aktarildi', p_parti, 'soru:disari' from aday a
    returning question_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'kategori', a.kategori, 'zorluk', a.zorluk, 'aktif', a.aktif, 'denetim_durumu', a.denetim_durumu,
      'surum', a.surum, 'oncelik', a.oncelik, 'soru', a.soru, 'secenekler', a.secenekler,
      'dogru_indeks', a.dogru_cevap, 'dogru_metin', a.secenekler ->> a.dogru_cevap,
      'isaretler', coalesce(a.liste, '[]'::jsonb), 'istatistik', a.istatistik,
      'bildirim', jsonb_build_object('sayi', coalesce(a.sayi, 0), 'sebepler', coalesce(a.sebepler, '{}'::jsonb)),
      'ceviri_en', (select jsonb_build_object('soru', t.soru, 'secenekler', t.secenekler, 'eskidi', t.eskidi)
                      from public.question_translations t where t.question_id = a.id and t.dil = 'en')
    ) order by a.oncelik, a.agirlik desc nulls last), '[]'::jsonb)
    into v
    from aday a
   where exists (select 1 from kayit k where k.question_id = a.id);
  if p_kuru then raise exception using errcode = 'P0K01', message = 'kuru calisma'; end if;
  exception when sqlstate 'P0K01' then null;
  end;
  return v;
end $function$;

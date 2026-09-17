-- Paket 20 · II.5 — denetim hattına kuru (deneme) kipi: sahibi sonucu yazmadan önce raporu görebilsin.
-- İş bir alt işlemde yapılır, rapor alınır, alt işlem geri alınır (hiçbir şey yazılmaz).
drop function if exists public.soru_denetim_ice_aktar(jsonb, text, text);
drop function if exists public.soru_denetim_disa_aktar(integer, text);
CREATE OR REPLACE FUNCTION public.soru_denetim_ice_aktar(p_kayitlar jsonb, p_denetleyen text DEFAULT 'sahip'::text, p_parti text DEFAULT NULL::text, p_kuru boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r jsonb;
  q public.questions%rowtype;
  v_karar text;
  v_sik jsonb;
  v_dogru int;
  v_soru text;
  v_atlanan jsonb := '[]'::jsonb;
  v_ozet jsonb := jsonb_build_object('onayla', 0, 'duzelt', 0, 'kaldir', 0);
  v_eski_karantina boolean;
  v_i int := 0;
begin
  if jsonb_typeof(p_kayitlar) <> 'array' then raise exception 'Kayıtlar dizi olmalı'; end if;
  begin   -- kuru: iş yapılır, rapor alınır, alt işlem geri alınır
  for r in select * from jsonb_array_elements(p_kayitlar) loop
    v_i := v_i + 1;
    begin
      v_karar := r ->> 'karar';
      if (r ->> 'id') is null or (r ->> 'id') !~ '^[0-9a-f-]{36}$' then
        v_atlanan := v_atlanan || jsonb_build_object('sira', v_i, 'id', r ->> 'id', 'sebep', 'geçersiz id'); continue;
      end if;
      select * into q from public.questions where id = (r ->> 'id')::uuid for update;
      if not found then
        v_atlanan := v_atlanan || jsonb_build_object('sira', v_i, 'id', r ->> 'id', 'sebep', 'bilinmeyen id'); continue;
      end if;
      if v_karar is null or v_karar not in ('onayla', 'duzelt', 'kaldir') then
        v_atlanan := v_atlanan || jsonb_build_object('sira', v_i, 'id', q.id, 'sebep', 'karar onayla/duzelt/kaldir olmalı'); continue;
      end if;
      v_eski_karantina := q.denetim_durumu = 'karantina';

      if v_karar = 'onayla' then
        update public.questions set denetim_durumu = 'onaylandi', aktif = (aktif or v_eski_karantina) where id = q.id;
        insert into public.soru_denetim (question_id, durum, sebep, kaynak, denetleyen, not_metni)
        values (q.id, 'onaylandi', 'denetim', coalesce(r ->> 'kaynak', p_parti), p_denetleyen, r ->> 'not');

      elsif v_karar = 'kaldir' then
        update public.questions set denetim_durumu = 'reddedildi', aktif = false where id = q.id;
        insert into public.soru_denetim (question_id, durum, sebep, kaynak, denetleyen, not_metni)
        values (q.id, 'reddedildi', 'denetim', coalesce(r ->> 'kaynak', p_parti), p_denetleyen, r ->> 'not');

      else
        v_soru := coalesce(nullif(btrim(r ->> 'soru'), ''), q.soru);
        v_sik := coalesce(r -> 'secenekler', q.secenekler);
        if jsonb_typeof(v_sik) <> 'array' or jsonb_array_length(v_sik) <> 4
           or exists (select 1 from jsonb_array_elements(v_sik) e where jsonb_typeof(e) <> 'string' or btrim(e #>> '{}') = '') then
          v_atlanan := v_atlanan || jsonb_build_object('sira', v_i, 'id', q.id, 'sebep', 'secenekler tam 4 dolu metin olmalı'); continue;
        end if;
        if r ? 'dogru_cevap' then
          if jsonb_typeof(r -> 'dogru_cevap') <> 'number' or (r ->> 'dogru_cevap') !~ '^[0-3]$' then
            v_atlanan := v_atlanan || jsonb_build_object('sira', v_i, 'id', q.id, 'sebep', 'dogru_cevap 0-3 arası tam sayı olmalı'); continue;
          end if;
          v_dogru := (r ->> 'dogru_cevap')::int;
        else
          v_dogru := q.dogru_cevap;
        end if;
        if v_soru = q.soru and v_sik = q.secenekler and v_dogru = q.dogru_cevap then
          v_atlanan := v_atlanan || jsonb_build_object('sira', v_i, 'id', q.id, 'sebep', 'duzelt ama hiçbir alan değişmemiş (onayla kullan)'); continue;
        end if;

        insert into public.soru_surum (question_id, surum, soru, secenekler, dogru_cevap, degisiklik_notu)
        values (q.id, q.surum, q.soru, q.secenekler, q.dogru_cevap, r ->> 'not');
        update public.questions
           set soru = v_soru, secenekler = v_sik, dogru_cevap = v_dogru::smallint,
               surum = q.surum + 1, denetim_durumu = 'duzeltildi', aktif = (aktif or v_eski_karantina)
         where id = q.id;
        -- Türkçe değişti → çeviri eskidi (yeniden çevrilene kadar o dilde sorulmaz)
        update public.question_translations set eskidi = true, eskidi_at = now() where question_id = q.id and not eskidi;
        insert into public.soru_denetim (question_id, durum, sebep, kaynak, denetleyen, not_metni)
        values (q.id, 'duzeltildi', 'denetim', coalesce(r ->> 'kaynak', p_parti), p_denetleyen, r ->> 'not');
      end if;
      v_ozet := jsonb_set(v_ozet, array[v_karar], to_jsonb((v_ozet ->> v_karar)::int + 1));
    exception when others then
      v_atlanan := v_atlanan || jsonb_build_object('sira', v_i, 'id', r ->> 'id', 'sebep', sqlerrm);
    end;
  end loop;
  if p_kuru then raise exception using errcode = 'P0K01', message = 'kuru calisma'; end if;
  exception when sqlstate 'P0K01' then null;
  end;
  return jsonb_build_object('kuru', p_kuru, 'toplam', v_i, 'islenen', v_ozet, 'atlanan', v_atlanan);
end $function$;

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
           coalesce(jsonb_object_agg(coalesce(v.sebep, 'belirtilmedi'), 1) filter (where not v.adil), '{}'::jsonb) sebepler
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

revoke all on function public.soru_denetim_ice_aktar(jsonb, text, text, boolean) from public, anon, authenticated;
revoke all on function public.soru_denetim_disa_aktar(integer, text, boolean) from public, anon, authenticated;
grant execute on function public.soru_denetim_ice_aktar(jsonb, text, text, boolean), public.soru_denetim_disa_aktar(integer, text, boolean) to service_role;

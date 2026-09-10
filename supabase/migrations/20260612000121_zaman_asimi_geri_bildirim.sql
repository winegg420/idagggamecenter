-- Zaman aşımında doğru cevabı göster
--
-- Canlı testte bulundu: soru cevaplanmadan süre dolunca ekran DOĞRUDAN
-- sonraki soruya atlıyordu; doğru cevap gösterilmiyor, "süre doldu" bile
-- denmiyordu. Öğrenme anı tamamen kayboluyordu.
--
-- mac_soruyu_atla artık atladığı sorunun doğru cevabını döndürüyor.
-- OYUN MANTIĞI DEĞİŞMEDİ: aynı kontroller, aynı güncellemeler, aynı
-- advance_match çağrısı. Yalnız dönüş değeri eklendi ve bu bilgi zaten
-- oyuncu için kapanmış bir soruya ait (submit_match_answer da cevaptan
-- sonra dogru_cevap döndürüyor).

begin;

-- Dönüş tipi değiştiği için önce düşürülmeli
drop function if exists public.mac_soruyu_atla(uuid);

create function public.mac_soruyu_atla(p_match_id uuid)
returns table (dogru_cevap int)
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  v_ben_p1 boolean;
  v_index int;
  v_bas timestamptz;
  v_toplam int;
  v_soru_id uuid;
begin
  -- Hız sınırı: yalnız kullanıcı tetikli çağrılar (bkz. migration 115).
  perform public.hiz_siniri('mac_soruyu_atla', 60, interval '60 seconds');
  select * into m from public.matches where id = p_match_id for update;
  if not found or m.durum <> 'aktif' then return; end if;
  if auth.uid() not in (m.oyuncu1, m.oyuncu2) then return; end if;

  v_ben_p1 := (m.oyuncu1 = auth.uid());
  v_index := case when v_ben_p1 then m.oyuncu1_soru else m.oyuncu2_soru end;
  v_bas := case when v_ben_p1 then m.oyuncu1_baslangic else m.oyuncu2_baslangic end;
  v_toplam := coalesce(array_length(m.soru_ids, 1), 0);

  if v_index >= v_toplam then return; end if;
  -- Yalnız gerçekten süresi dolduysa
  if v_bas is null or now() <= v_bas + interval '17 seconds' then return; end if;

  v_soru_id := m.soru_ids[v_index + 1];

  -- cevap kolonu NOT NULL; -1 = "süre doldu, cevaplanmadı"
  insert into public.match_answers (match_id, user_id, soru_index, cevap, dogru)
  values (p_match_id, auth.uid(), v_index, -1, false)
  on conflict do nothing;

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

  perform public.advance_match(p_match_id);

  -- Soru bu oyuncu için kapandı; doğru cevap artık gösterilebilir
  return query select q.dogru_cevap::int from public.questions q where q.id = v_soru_id;
end;
$$;

revoke execute on function public.mac_soruyu_atla(uuid) from public, anon;
grant execute on function public.mac_soruyu_atla(uuid) to authenticated;

commit;

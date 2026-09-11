-- ============================================================
-- SÜRE DOLUNCA EKRAN DONMASI
--
-- İstemcinin soru sayacı 15 saniyede biter (QuestionCard SURE = 15) ve tam o
-- anda `mac_soruyu_atla` çağrılır. Sunucu ise soruyu ancak 17 saniye dolunca
-- atlıyordu; arada kalan ~2 saniyede RPC hata bile vermiyor, BOŞ dönüyordu.
-- İstemci "atlandı" sanıp kilidi kapalı bırakıyor, soru ne ilerliyor ne de
-- yeniden deneniyordu: ekran "Süre doldu" görüntüsünde donuyordu.
--
-- 17 saniye CEVAP GÖNDERME için konmuş ağ payıdır (submit_match_answer);
-- atlama için gereği yok. Atlama eşiği istemcinin sayacıyla aynı yere,
-- 15 saniyeye çekildi. Cevap yollamanın 17 saniyelik payı DEĞİŞMEDİ: geç
-- gelen dürüst cevap hâlâ kabul edilir, atlama kaydı `on conflict do nothing`
-- olduğu için ikisi çakışmaz (hangisi önce geldiyse o yazılır).
--
-- İstemci tarafında da koruma var: boş dönüş artık "atlanamadı" sayılıp
-- kilit açılıyor ve bir sonraki tikte yeniden deneniyor (MatchPage).
-- ============================================================
create or replace function public.mac_soruyu_atla(p_match_id uuid)
returns table(dogru_cevap integer)
language plpgsql
security definer
set search_path = public
as $fn$
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
    -- Duraklamada saat ileri kaydırılıyor; atlama da beklemeli.
    if m.duraklatildi_at is not null then return; end if;
    v_index := m.aktif_soru;
    v_bas := m.soru_baslangic;
  else
    v_index := case when v_ben_p1 then m.oyuncu1_soru else m.oyuncu2_soru end;
    v_bas := case when v_ben_p1 then m.oyuncu1_baslangic else m.oyuncu2_baslangic end;
  end if;

  if v_index >= v_toplam then return; end if;
  -- Yalnız gerçekten süresi dolduysa (istemci sayacıyla aynı eşik)
  if v_bas is null or now() <= v_bas + interval '15 seconds' then return; end if;

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
$fn$;

revoke all on function public.mac_soruyu_atla(uuid) from public, anon;
grant execute on function public.mac_soruyu_atla(uuid) to authenticated;

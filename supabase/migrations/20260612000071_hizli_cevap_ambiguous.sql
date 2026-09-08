-- ============================================================
-- HIZLI MODDA DOĞRU CEVAP PUAN GETİRMİYORDU
--
-- `submit_hizli_cevap` yalnız DOĞRU cevap verildiğinde çalışan dalda
-- patlıyordu:
--
--   if v_dogru then
--     v_ilk := not exists (
--       select 1 from public.hizli_cevaplar
--       where hizli_mac_id = ... and soru_index = ... and dogru   -- NİTELİKSİZ
--     );
--   end if;
--
-- Fonksiyon `returns table (dogru boolean, ...)` tanımladığı için buradaki
-- `dogru` hem out-parametre hem kolon; PL/pgSQL karar veremiyor:
--   ERROR: column reference "dogru" is ambiguous
--
-- Etkisi: "Hızlı Olan Kazanır" modunda ilk doğru cevabı veren oyuncu +10
-- alamıyordu — yani modun tek puanlama kuralı hiç çalışmıyordu. YANLIŞ cevap
-- verildiğinde bu dala girilmediği için hata görünmüyordu; bu yüzden önceki
-- taramada (yanlış cevapla test edilmişti) temiz çıkmıştı.
--
-- Diğer cevap fonksiyonları (submit_match_answer, submit_group_match_answer,
-- submit_tournament_answer) kontrol edildi: onlarda `dogru` yalnız INSERT
-- kolon listesinde geçiyor, orada belirsizlik oluşmuyor.
-- ============================================================

create or replace function public.submit_hizli_cevap(p_hizli_mac_id uuid, p_cevap smallint)
returns table (dogru boolean, dogru_cevap smallint, ilk boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  hm public.hizli_maclar%rowtype;
  q public.questions%rowtype;
  v_dogru boolean;
  v_ilk boolean := false;
begin
  select * into hm from public.hizli_maclar where id = p_hizli_mac_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if not exists (
    select 1 from public.hizli_oyuncular ho
    where ho.hizli_mac_id = p_hizli_mac_id and ho.user_id = auth.uid()
      and ho.davet_durumu = 'kabul'
  ) then
    raise exception 'Bu maçta değilsin';
  end if;
  if hm.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;
  if now() > hm.soru_baslangic + interval '16 seconds' then
    raise exception 'Süre doldu';
  end if;

  select * into q from public.questions where id = hm.soru_ids[hm.aktif_soru + 1];
  v_dogru := (p_cevap = q.dogru_cevap);

  -- İlk doğru mu? (satır kilidi altında kontrol edilir)
  -- `hc.dogru` NİTELİKLİ: out-parametre ile çakışmasın.
  if v_dogru then
    v_ilk := not exists (
      select 1 from public.hizli_cevaplar hc
      where hc.hizli_mac_id = p_hizli_mac_id
        and hc.soru_index = hm.aktif_soru
        and hc.dogru
    );
  end if;

  insert into public.hizli_cevaplar (hizli_mac_id, user_id, soru_index, cevap, dogru)
  values (p_hizli_mac_id, auth.uid(), hm.aktif_soru, p_cevap, v_dogru);

  if v_ilk then
    update public.hizli_oyuncular ho
       set skor = ho.skor + 10
     where ho.hizli_mac_id = p_hizli_mac_id and ho.user_id = auth.uid();
  end if;

  return query select v_dogru, q.dogru_cevap, v_ilk;
end;
$$;

revoke execute on function public.submit_hizli_cevap(uuid, smallint) from public, anon;
grant execute on function public.submit_hizli_cevap(uuid, smallint) to authenticated;

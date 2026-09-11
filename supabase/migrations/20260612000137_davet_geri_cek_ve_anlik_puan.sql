-- ============================================================
-- 1) DAVET GERİ ÇEKME  2) CEVAP SONRASI ANLIK PUAN
-- ============================================================

-- ------------------------------------------------------------
-- DAVETİ GERİ ÇEK
--
-- Ana sayfadaki "X daveti görmedi — bekleniyor" satırının yanında geri çekme
-- düğmesi var (bkz. gonderdigim_davetler). `mac_iptal` bu iş için uygun
-- değil: o AKTİF maçı iptal etmek için yazıldı ve karşı tarafa "rakibin maçı
-- iptal etti" bildirimi bırakıyor — daveti hiç görmemiş oyuncuya bu anlamsız.
--
-- Burada yalnız HENÜZ CEVAPLANMAMIŞ davet geri alınır. Kayıt silinmez,
-- 'iptal' işaretlenir (geçmiş bozulmasın). Karşı tarafa bırakılmış okunmamış
-- davet bildirimi de temizlenir ki olmayan bir maça tıklamasın.
-- ------------------------------------------------------------
create or replace function public.davet_geri_cek(p_tur text, p_kayit_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  m public.matches%rowtype;
  v_yol text;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  perform public.hiz_siniri('davet_geri_cek', 30, interval '60 seconds');

  if p_tur in ('mac', 'rovans') then
    select * into m from public.matches where id = p_kayit_id for update;
    if not found then raise exception 'Maç bulunamadı'; end if;
    if m.oyuncu1 <> v_me then raise exception 'Bu daveti sen göndermedin'; end if;
    -- Karşı taraf arada kabul etmiş olabilir: maç başladıysa geri alınmaz.
    if m.durum <> 'bekliyor' then raise exception 'Davet artık beklemede değil'; end if;

    update public.matches
       set durum = 'iptal', kazanan = null, bitis = now()
     where id = p_kayit_id;

    v_yol := '/bildim/mac/' || p_kayit_id::text;
    delete from public.bildirimler
     where user_id = m.oyuncu2 and not okundu and yol = v_yol;
    return true;

  elsif p_tur = 'grup' then
    if not exists (
      select 1 from public.group_matches
       where id = p_kayit_id and kurucu = v_me and durum = 'bekliyor'
    ) then
      raise exception 'Davet artık beklemede değil';
    end if;
    update public.group_matches set durum = 'iptal' where id = p_kayit_id;
    v_yol := '/bildim/grup/' || p_kayit_id::text;
    delete from public.bildirimler
     where not okundu and yol = v_yol
       and user_id in (
         select user_id from public.group_match_players
          where group_match_id = p_kayit_id and davet_durumu = 'bekliyor'
       );
    return true;

  elsif p_tur = 'hizli' then
    if not exists (
      select 1 from public.hizli_maclar
       where id = p_kayit_id and kurucu = v_me and durum = 'bekliyor'
    ) then
      raise exception 'Davet artık beklemede değil';
    end if;
    update public.hizli_maclar set durum = 'iptal' where id = p_kayit_id;
    v_yol := '/bildim/hizli/' || p_kayit_id::text;
    delete from public.bildirimler
     where not okundu and yol = v_yol
       and user_id in (
         select user_id from public.hizli_oyuncular
          where hizli_mac_id = p_kayit_id and davet_durumu = 'bekliyor'
       );
    return true;
  end if;

  raise exception 'Bilinmeyen davet türü: %', p_tur;
end;
$fn$;

revoke all on function public.davet_geri_cek(text, uuid) from public, anon;
grant execute on function public.davet_geri_cek(text, uuid) to authenticated;

-- ------------------------------------------------------------
-- CEVAP SONRASI ANLIK PUAN
--
-- Skor tabelası `matches.oyuncuN_skor` sütunlarından çiziliyor; istemci bu
-- sütunları Realtime'dan ya da 2 saniyelik yoklamadan öğreniyordu. Cevap
-- verilip yeni soruya geçilince kendi puanımız bazen bir tur geç görünüyordu
-- ("puanlar gecikmeli geliyor").
--
-- Çözüm: cevap RPC'si kazanılan puanı ve GÜNCEL İKİ SKORU da döndürsün;
-- istemci tabelayı yoklamayı beklemeden günceller. Dönüş tipi değiştiği için
-- önce drop gerekiyor (Postgres return type değişimine izin vermez).
--
-- Gövde migration 134'teki ile aynı; yalnız son `return query` genişledi.
-- ------------------------------------------------------------
drop function if exists public.submit_match_answer(uuid, smallint);

create or replace function public.submit_match_answer(p_match_id uuid, p_cevap smallint)
returns table(dogru boolean, dogru_cevap smallint, puan int, benim_skor int, rakip_skor int)
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
  v_s1 int;
  v_s2 int;
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

  -- Skorlar advance_match'ten sonra okunur: rakip de cevaplamışsa satır
  -- bu arada bir daha güncellenmiş olabilir, istemciye EN SON hâli gitsin.
  select oyuncu1_skor, oyuncu2_skor into v_s1, v_s2
    from public.matches where id = p_match_id;

  return query select
    v_dogru,
    q.dogru_cevap,
    v_puan,
    case when v_ben_p1 then v_s1 else v_s2 end,
    case when v_ben_p1 then v_s2 else v_s1 end;
end;
$fn$;

revoke all on function public.submit_match_answer(uuid, smallint) from public, anon;
grant execute on function public.submit_match_answer(uuid, smallint) to authenticated;

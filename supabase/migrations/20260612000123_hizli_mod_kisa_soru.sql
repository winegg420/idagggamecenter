-- ============================================================
-- HIZLI MOD: soru başına 5 saniye → SORULAR KISA OLMALI
--
-- SORUN
-- Hızlı mod soru başına 5 sn veriyor (60 sn / 12 soru). Ama sorular genel
-- havuzdan `soru_sec` ile çekiliyordu ve orada uzunluk ölçütü yoktu. Uzun bir
-- soru + uzun şıklar gelince oyuncu metni okumaya bile yetişemiyor, süre
-- doluyor. Ölçüm (aktif havuz, 8.765 soru):
--
--   soru metni      : ortalama 41, ortanca 40, p90 56, en uzun 90 karakter
--   şıklar toplamı  : ortalama 50, p90 79, en uzun 130 karakter
--   en ağır örnek   : 61 + 116 = 177 karakter  ← 5 sn'de okunamaz
--
-- ÇÖZÜM
-- `soru_sec`'e isteğe bağlı bir okuma yükü tavanı eklendi: soru metni +
-- şıkların toplam karakter sayısı. Yalnız hızlı mod bu tavanı kullanır
-- (110 karakter); diğer modlar parametreyi hiç vermez ve davranışları
-- birebir aynı kalır.
--
-- 110 NEDEN
-- Havuzun %81'i (7.060 soru) bu tavanın altında ve HER kategoride en az 552
-- uygun soru var — hızlı mod bir oturumda 25 soru çekiyor, yani hiçbir
-- kategoride havuz sıkışmıyor. Daha dar bir tavan (90) havuzu yarıya
-- düşürüyordu; daha geniş olan (130) ise 5 saniyeye sığmayan soruları
-- geri alıyordu.
--
-- GERİ DÜŞÜŞ (fallback)
-- Tavan yüzünden yeterli soru bulunamazsa oyuncuya hata göstermek yerine
-- sırasıyla gevşetilir: önce TAVAN kalkar (kategori tercihi korunsun),
-- sonra kategori, en son dil. Böylece "Bu kategoride soru bulunamadı"
-- hatası bu değişiklik yüzünden hiç çıkmaz.
-- ============================================================

-- soru_sec'e yeni parametre ekleniyor; eski imza kaldırılıyor ki iki ayrı
-- fonksiyon (overload) kalmasın. Yeni parametrenin varsayılanı NULL olduğu
-- için 4 argümanla yapılan mevcut çağrıların hepsi aynen çalışmaya devam eder.
drop function if exists public.soru_sec(text, int, uuid[], text);

create or replace function public.soru_sec(
  p_kategori text,
  p_adet int,
  p_oyuncular uuid[] default '{}'::uuid[],
  p_dil text default null,
  p_max_okuma int default null   -- soru + şıklar toplam karakter tavanı
)
returns uuid[]
language plpgsql
volatile          -- random() kullanıyor; planlayıcı sonucu önbelleklememeli
security definer
set search_path = public
as $$
declare
  v_oyn uuid[] := coalesce(p_oyuncular, '{}'::uuid[]);
  v_adet int := greatest(1, coalesce(p_adet, 1));
  v_kat text := p_kategori;
  v_dil text;
  v_max int := p_max_okuma;
  v_ids uuid[] := '{}'::uuid[];
  v_deneme int;
begin
  v_dil := coalesce(
    nullif(btrim(coalesce(p_dil, '')), ''),
    (select pr.dil from public.profiles pr where pr.id = v_oyn[1]),
    'tr'
  );

  for v_deneme in 1..4 loop
    select coalesce(array_agg(s.id), '{}'::uuid[]) into v_ids
    from (
      select q.id
      from public.questions q
      left join lateral (
        select max(g.gorulen_at) as son
        from public.gorulen_sorular g
        where g.question_id = q.id and g.user_id = any(v_oyn)
      ) gs on true
      where q.aktif
        and (v_kat is null or q.kategori = v_kat)
        and q.dil = v_dil
        and (
          v_max is null
          or length(q.soru)
             + (select coalesce(sum(length(x)), 0)
                  from jsonb_array_elements_text(q.secenekler) x) <= v_max
        )
      order by (gs.son is not null), gs.son asc, random()
      limit v_adet
    ) s;

    exit when coalesce(array_length(v_ids, 1), 0) >= v_adet;

    -- Gevşetme sırası: önce uzunluk tavanı, sonra kategori, en son dil.
    -- Oyuncunun seçtiği kategori, uzunluk tercihinden daha değerlidir.
    if v_max is not null then
      v_max := null;
    elsif v_kat is not null then
      v_kat := null;              -- kategoride yeterli soru yok → karışık
    elsif v_dil <> 'tr' then
      v_dil := 'tr';              -- o dilde havuz yok → Türkçeye düş
    else
      exit;
    end if;
  end loop;

  return v_ids;
end;
$$;

revoke execute on function public.soru_sec(text, int, uuid[], text, int)
  from public, anon, authenticated;

-- ============================================================
-- Hızlı mod artık tavanı kullanıyor. Tek değişiklik soru_sec çağrısı;
-- gerisi (hız sınırı, kota, tek aktif oturum) aynen korundu.
-- ============================================================
create or replace function public.hizli_mod_baslat(p_kategori text default null)
returns table (oturum_id uuid, soru_sayisi int, sure_sn int, soru_sure_sn int)
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Soru başına 5 saniye. Bu tavan o 5 saniyeye sığsın diye var:
  -- soru metni + şıkların toplam karakter sayısı.
  v_max_okuma constant int := 110;
  v_me uuid := auth.uid();
  v_kat text;
  v_ids uuid[];
  v_id uuid;
begin
  -- Hız sınırı: yalnız kullanıcı tetikli çağrılar (bkz. migration 115).
  perform public.hiz_siniri('hizli_mod_baslat', 10, interval '60 seconds');
  if v_me is null then raise exception 'Giriş gerekli'; end if;

  v_kat := nullif(btrim(coalesce(p_kategori, '')), '');
  if v_kat is not null
     and not exists (select 1 from public.questions q where q.aktif and q.kategori = v_kat) then
    raise exception 'Geçersiz kategori';
  end if;

  -- Devam eden oturumu kapat (tek aktif oturum)
  update public.hizli_mod_oturumlar
     set durum = 'bitti', bitis = coalesce(bitis, now())
   where user_id = v_me and durum = 'aktif';

  perform public.mac_kotasi_kontrol();

  -- 60 sn / 5 sn = en çok 12 soru; yedekle birlikte 25 çekilir.
  -- Son parametre: 5 saniyeye sığmayan uzun sorular elenir.
  v_ids := public.soru_sec(v_kat, 25, array[v_me], null, v_max_okuma);
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'Bu kategoride soru bulunamadı';
  end if;

  insert into public.hizli_mod_oturumlar (user_id, kategori, soru_ids)
  values (v_me, v_kat, v_ids)
  returning id into v_id;

  return query select v_id, coalesce(array_length(v_ids, 1), 0), 60, 5;
end;
$$;

revoke execute on function public.hizli_mod_baslat(text) from public, anon;
grant execute on function public.hizli_mod_baslat(text) to authenticated;

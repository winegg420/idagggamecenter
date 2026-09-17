-- ============================================================
-- Paket 24 · A.4 düzeltmesi — KOPUKLUK ANINDA SÜRE ZATEN DOLMUŞSA
--
-- Testte çıktı (migration 229 sonrası): oyuncu cevap fazının SON saniyesinde koparsa
-- kopuk_kalan = 0 hesaplanıyordu. Kopukken faz yine ilerlemiyor (can yanmıyor), ama
-- oyuncu geri döndüğünde elinde 0 saniye kalıyor ve bir saniye içinde cevaplayamadığı
-- için hamle anında yanlış sayılıyordu. "Kaldığı yerden devam" bu durumda çalışmıyordu.
--
-- Düzeltme: dondurulan kalan süreye 3 saniyelik taban konur — dönen oyuncu ekranı
-- görüp tepki verebilsin. İstismar riski yok: bundan yararlanmak için en az
-- duello_kopuk_sn (25 sn) boyunca bağlantısız kalmak gerekir, kazanç 3 saniyedir.
--
-- Migration 229 UYGULANMIŞ durumda; append-only kuralı gereği düzenlenmedi,
-- duello_ilerlet burada yeni sürümüyle yazıldı (tek değişiklik: greatest(..., 3 sn)).
-- ============================================================

insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('duello_kopuk_taban_sn', '3'::jsonb, 'Düello: bağlantı koptuğunda dondurulan kalan süreye konan taban (geri dönen oyuncuya tepki payı)')
on conflict (anahtar) do nothing;

create or replace function public.duello_ilerlet(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  d public.duellolar%rowtype;
  v_kat text;
  v_adim int := 0;
  v_savunan uuid;
  v_kopuk uuid;
  v_bekleyen uuid;
  v_taban interval := make_interval(secs => public.ayar_sayi('duello_kopuk_taban_sn', 3));
begin
  -- ---------- KOPUKLUK KAPISI (Paket 24 · A.4) ----------
  select * into d from public.duellolar where id = p_id;
  if not found or d.durum <> 'aktif' then return; end if;

  v_kopuk := public.duello_kopuk_kim(p_id);

  if v_kopuk is not null then
    if d.kopuk_at is null then
      -- Yeni koptu: o andaki kalan süreyi dondur. Süre zaten dolmuşsa taban kadar ver
      -- (yoksa geri dönen oyuncu ekranı görmeden hamlesini kaybediyordu).
      update public.duellolar
         set kopuk_at = now(),
             kopuk_kalan = greatest(coalesce(d.faz_bitis, now()) - now(), v_taban)
       where id = p_id;
      perform public.duello_sinyal_ver(p_id);
      select * into d from public.duellolar where id = p_id;
    end if;

    if d.kopuk_at < now() - make_interval(secs => public.ayar_sayi('duello_kopuk_bekleme_sn', 45)) then
      -- Dönmedi: bekleyen kazanır. duello_terk ile aynı yol — yeni ödül yolu yok.
      v_bekleyen := case when v_kopuk = d.oyuncu1 then d.oyuncu2 else d.oyuncu1 end;
      perform public.duello_bitir(p_id, v_bekleyen);
      perform public.duello_sinyal_ver(p_id);
      return;
    end if;

    -- FAZ İLERLEMESİ DURSUN: süre kopuk boyunca ileri itilir, hiçbir faz dolmaz.
    update public.duellolar
       set faz_bitis = now() + greatest(coalesce(d.kopuk_kalan, v_taban), v_taban)
     where id = p_id;
    return;
  end if;

  if d.kopuk_at is not null then
    -- Geri döndü: kaldığı yerden, dondurulan süreyle devam
    update public.duellolar
       set kopuk_at = null,
           kopuk_kalan = null,
           faz_bitis = now() + greatest(coalesce(d.kopuk_kalan, v_taban), v_taban),
           son_hareket = now()
     where id = p_id;
    perform public.duello_sinyal_ver(p_id);
  end if;
  -- ---------- /KOPUKLUK KAPISI ----------

  loop
    v_adim := v_adim + 1;
    exit when v_adim > 12;
    select * into d from public.duellolar where id = p_id;
    exit when not found or d.durum <> 'aktif';

    -- Zaman aşımı SON HAREKET'ten sayılır (Paket 24 · A.4.5)
    if d.son_hareket < now() - make_interval(mins => public.ayar_sayi('duello_zaman_asimi_dk', 60)::int) then
      update public.duellolar set durum = 'iptal', bitis = now() where id = p_id;
      perform public.duello_sinyal_ver(p_id);
      exit;
    end if;

    exit when d.faz_bitis is not null and now() < d.faz_bitis
              and not (d.faz = 'cevap');
    if d.faz = 'cevap' then
      exit when now() <= d.faz_bitis + interval '1 second';
    end if;

    if d.faz = 'kategori' then
      v_savunan := case when d.saldiran = d.oyuncu1 then d.oyuncu2 else d.oyuncu1 end;
      select k into v_kat from unnest(public.duello_kategorileri()) k
       where public.duello_kategori_uygun_mu(p_id, d.saldiran, k)
       order by (k is not distinct from (case when v_savunan = d.oyuncu1 then d.zayif1 else d.zayif2 end)), random()
       limit 1;
      perform public.duello_kategori_uygula(p_id, v_kat);
    elsif d.faz = 'hazirlik' then
      update public.duellolar
         set faz = 'cevap',
             faz_bitis = greatest(d.faz_bitis, now()) + make_interval(secs =>
               case when d.zaman_baskisi then public.ayar_sayi('duello_zaman_baskisi_sn', 10)
                    else public.ayar_sayi('duello_cevap_sn', 15) end),
             son_hareket = now()
       where id = p_id;
    elsif d.faz = 'cevap' then
      perform public.duello_cozumle(p_id, null);
    elsif d.faz = 'sonuc' then
      if d.saldiri_sirasi = 0 then
        update public.duellolar
           set saldiri_sirasi = 1, saldiran = oyuncu2, faz = 'kategori', kategori = null, soru_id = null,
               faz_bitis = now() + make_interval(secs => public.ayar_sayi('duello_kategori_sn', 20)),
               son_hareket = now()
         where id = p_id;
      else
        perform public.duello_tur_sonu(p_id);
      end if;
    elsif d.faz = 'altin' then
      perform public.duello_altin_degerlendir(p_id);
    end if;
    perform public.duello_sinyal_ver(p_id);
  end loop;
end;
$fn$;

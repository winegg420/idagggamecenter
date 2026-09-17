-- ============================================================
-- Paket 24 · A.4 — DÜELLODA BAĞLANTI KOPMASI
--
-- ÖLÇÜLEN DURUM: düelloda varlık denetimi HİÇ YOKTU. DuelloPage.jsx (735 satır) içinde
-- last_seen / cevrimici / online geçen tek satır yok. cron.schedule('duello_tik','2 seconds')
-- rakip bağlı olmasa da fazları ilerletiyordu: kategori otomatik seçiliyor, cevap süresi
-- dolunca duello_cozumle(p_id, null) → yanlış sayılıyor, CAN GİDİYOR. Tek çıkış
-- duello_zaman_asimi_dk = 60 idi ve o da created_at'ten sayılıyordu.
--
-- Sonuç: sekmesi kapanan oyuncu geri döndüğünde üç canını birden kaybetmiş oluyordu.
--
-- ÇÖZÜM:
--   1) Rakibin profiles.last_seen'ine bakılır. Botlar HER ZAMAN bağlı sayılır (is_bot
--      sunucuda kalır, istemciye sızmaz; gizli botun nabzı zaten last_seen'i tazeliyor).
--   2) duello_kopuk_sn (25) geçince "kopuk" sayılır — arayüz uyarı + geri sayım gösterir.
--   3) duello_kopuk_bekleme_sn (45) geçerse düello BEKLEYENİN galibiyetiyle biter.
--      60 dakika beklenmez.
--   4) KOPUKKEN FAZ İLERLEMESİ DURUR. Kopukluk anındaki kalan süre dondurulur
--      (kopuk_kalan), rakip dönünce tam o kalan süreyle devam eder. Bu madde olmadan
--      düzeltme zarar verirdi: geri dönen oyuncu canlarını yine kaybederdi.
--   5) duello_zaman_asimi_dk artık created_at yerine son_hareket'ten sayılır.
--   6) Ödül: kopmayla biten düello duello_bitir ile kapanır — duello_terk ile BİREBİR
--      aynı yol. Yeni ödül yolu açılmadı.
-- ============================================================

insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('duello_kopuk_sn', '25'::jsonb, 'Düello: rakip bu süredir görünmüyorsa bağlantısı kopmuş sayılır'),
  ('duello_kopuk_bekleme_sn', '45'::jsonb, 'Düello: kopan rakip bu süre içinde dönmezse bekleyen kazanır')
on conflict (anahtar) do nothing;

-- Kopukluk durumu satırda tutulur (veri silinmez, yalnız kolon eklenir)
alter table public.duellolar add column if not exists kopuk_at timestamptz;
alter table public.duellolar add column if not exists kopuk_kalan interval;

-- ------------------------------------------------------------
-- Kim kopuk? (bot değil + last_seen eski). Yoksa null.
-- ------------------------------------------------------------
create or replace function public.duello_kopuk_kim(p_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $fn$
  select p.id
    from public.duellolar d
    join public.profiles p on p.id in (d.oyuncu1, d.oyuncu2)
   where d.id = p_id
     and d.durum = 'aktif'
     and not coalesce(p.is_bot, false)
     and p.last_seen < now() - make_interval(secs => public.ayar_sayi('duello_kopuk_sn', 25))
   order by p.last_seen
   limit 1;
$fn$;

-- ------------------------------------------------------------
-- Arayüz için hafif çağrı: "Rakibin bağlantısı koptu" + geri sayım.
-- duello_durum 150 satır; onu kopyalayıp bozmak yerine bu ayrı, ucuz RPC eklendi.
-- İstemci duello_durum ile AYNI ANDA (paralel) çağırır, ek gecikme olmaz.
-- is_bot sızmaz: yalnız "kopuk mu" ve "kaç saniye kaldı" döner.
-- ------------------------------------------------------------
create or replace function public.duello_baglanti(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  d public.duellolar%rowtype;
  v_me uuid := auth.uid();
  v_kopuk uuid;
  v_bekleme numeric := public.ayar_sayi('duello_kopuk_bekleme_sn', 45);
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  select * into d from public.duellolar where id = p_id;
  if not found then raise exception 'Düello bulunamadı'; end if;
  if v_me not in (d.oyuncu1, d.oyuncu2) then raise exception 'Bu düelloda değilsin'; end if;

  v_kopuk := public.duello_kopuk_kim(p_id);
  return jsonb_build_object(
    'kopuk', v_kopuk is not null,
    'ben_mi', v_kopuk is not null and v_kopuk = v_me,
    'kalan_sn', case
      when v_kopuk is null or d.kopuk_at is null then null
      else greatest(0, ceil(v_bekleme - extract(epoch from (now() - d.kopuk_at))))::int end,
    'bekleme_sn', v_bekleme::int,
    'sunucu_zamani', now()
  );
end;
$fn$;

revoke all on function public.duello_kopuk_kim(uuid) from public, anon;
revoke all on function public.duello_baglanti(uuid) from public, anon;
grant execute on function public.duello_baglanti(uuid) to authenticated;

-- ------------------------------------------------------------
-- duello_kilitle — çağıranın nabzını tazeler
--
-- NEDEN GEREKLİ: kalp_at() istemciden ~60 sn'de bir çağrılıyor. 25 saniyelik kopukluk
-- eşiği bununla çalışmaz — ekranda oturan oyuncu sürekli "kopuk" görünürdü. duello_durum
-- her ~1,5 sn'de bir buradan geçtiği için nabız doğru yerde tazeleniyor.
-- ------------------------------------------------------------
create or replace function public.duello_kilitle(p_id uuid)
returns public.duellolar
language plpgsql
security definer
set search_path = public
as $fn$
declare d public.duellolar%rowtype;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  select * into d from public.duellolar where id = p_id for update;
  if not found then raise exception 'Düello bulunamadı'; end if;
  if auth.uid() not in (d.oyuncu1, d.oyuncu2) then raise exception 'Bu düelloda değilsin'; end if;

  -- Düelloya bakan oyuncu bağlıdır (Paket 24 · A.4)
  update public.profiles set last_seen = now() where id = auth.uid();

  perform public.duello_ilerlet(p_id);
  select * into d from public.duellolar where id = p_id;
  return d;
end;
$fn$;

-- ------------------------------------------------------------
-- duello_ilerlet — kopukluk kapısı eklendi, geri kalan gövde 205'ten korundu
-- ------------------------------------------------------------
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
begin
  -- ---------- KOPUKLUK KAPISI (Paket 24 · A.4) ----------
  select * into d from public.duellolar where id = p_id;
  if not found or d.durum <> 'aktif' then return; end if;

  v_kopuk := public.duello_kopuk_kim(p_id);

  if v_kopuk is not null then
    if d.kopuk_at is null then
      -- Yeni koptu: o andaki kalan süreyi dondur (geri dönünce aynı süreyle devam)
      update public.duellolar
         set kopuk_at = now(),
             kopuk_kalan = greatest(coalesce(d.faz_bitis, now()) - now(), interval '0 seconds')
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
       set faz_bitis = now() + coalesce(d.kopuk_kalan, interval '5 seconds')
     where id = p_id;
    return;
  end if;

  if d.kopuk_at is not null then
    -- Geri döndü: kaldığı yerden, dondurulan süreyle devam
    update public.duellolar
       set kopuk_at = null,
           kopuk_kalan = null,
           faz_bitis = now() + coalesce(d.kopuk_kalan, interval '5 seconds'),
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

    -- Zaman aşımı artık SON HAREKET'ten sayılır (önce created_at'ten sayılıyordu:
    -- uzun ama canlı bir düello ortasında iptal olabiliyordu).
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

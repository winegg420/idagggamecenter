-- ============================================================
-- Paket 24 · A — DÜELLO ORTAK DAVET/BİLDİRİM ALTYAPISINA BAĞLANIYOR
--
-- Düello kendi içinde kapalı yazılmıştı: kendi davet tablosu (migration 226) var ama
-- diğer modların bağlı olduğu ortak davet/bildirim yoluna hiç bağlanmamıştı. Ölçülen:
--   · bekleyen_davetlerim() / gonderdigim_davetler() / davet_geri_cek() düello türünü bilmiyor
--   · bildirim_yaz başlık tablosunda duello_daveti / duello_kabul yok
--   · duello_davet_et hiç bildirim yazmıyordu — davet edilen kişi haberdar olmuyordu
-- Bu dosya yalnız bu bağlantıları kurar; düellonun kendisi ve 226'daki yapı değişmez.
--
-- AYRICA A.2 — ÇİFTE DAVET KURALI (sahibinin kararı):
--   1) Aynı iki oyuncu arasında FARKLI modlarda davet atılabilir
--   2) Aynı anda en fazla 2 bekleyen davet
--   3) İkinci davet beklemede kalır
--   4) Biri kabul edilip aktif oyun başladıysa diğeri KABUL EDİLEMEZ
--   5) Aynı modda ikinci davet atılamaz (her modun mevcut kontrolü korunur)
-- Bugüne kadar create_challenge ikinci daveti yalnız `matches` içinde engelliyordu;
-- grup/hızlı/düello ayrı tablolarda olduğu için modlar arası denetim hiç yoktu.
-- ============================================================

-- ------------------------------------------------------------
-- 1) ÇAKIŞMA SAYACI — dört kaynağı birden okur
--
-- Hızlı mod dondurulsa bile (Paket 24 · B) hızlı tabloları SAYILMAYA devam eder:
-- devam eden eski kayıtlar varsa çakışma denetimi doğru çalışsın.
-- Dönüş: { bekleyen: int, aktif: bool, modlar: text[], aktif_mod: text|null }
-- ------------------------------------------------------------
create or replace function public.davet_cakismasi(p_ben uuid, p_rakip uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  with kaynak as (
    -- 1v1 meydan okuma / rövanş
    select 'mac'::text mod, (m.durum = 'bekliyor') bekleyen, (m.durum = 'aktif') aktif
      from public.matches m
     where m.durum in ('bekliyor', 'aktif')
       and ((m.oyuncu1 = p_ben and m.oyuncu2 = p_rakip) or (m.oyuncu1 = p_rakip and m.oyuncu2 = p_ben))

    union all

    -- Grup maçı: ikimiz de aynı grupta mıyız?
    select 'grup', (g.durum in ('bekliyor', 'lobi')), (g.durum = 'aktif')
      from public.group_matches g
     where g.durum in ('bekliyor', 'lobi', 'aktif')
       and exists (select 1 from public.group_match_players a
                    where a.group_match_id = g.id and a.user_id = p_ben and a.davet_durumu <> 'red')
       and exists (select 1 from public.group_match_players b
                    where b.group_match_id = g.id and b.user_id = p_rakip and b.davet_durumu <> 'red')

    union all

    -- "Hızlı Olan Kazanır" (dondurulmuş mod — eski kayıtlar için sayılır)
    select 'hizli', (h.durum in ('bekliyor', 'lobi')), (h.durum = 'aktif')
      from public.hizli_maclar h
     where h.durum in ('bekliyor', 'lobi', 'aktif')
       and exists (select 1 from public.hizli_oyuncular a
                    where a.hizli_mac_id = h.id and a.user_id = p_ben and a.davet_durumu <> 'red')
       and exists (select 1 from public.hizli_oyuncular b
                    where b.hizli_mac_id = h.id and b.user_id = p_rakip and b.davet_durumu <> 'red')

    union all

    -- Düello daveti (bekleyen) — kabul edilmişse aktif düello alt sorguda sayılır
    select 'duello', true, false
      from public.duello_davetleri dd
     where dd.durum = 'bekliyor'
       and ((dd.kuran = p_ben and dd.rakip = p_rakip) or (dd.kuran = p_rakip and dd.rakip = p_ben))

    union all

    -- Aktif düello
    select 'duello', false, true
      from public.duellolar d
     where d.durum = 'aktif'
       and ((d.oyuncu1 = p_ben and d.oyuncu2 = p_rakip) or (d.oyuncu1 = p_rakip and d.oyuncu2 = p_ben))
  )
  select jsonb_build_object(
    'bekleyen', coalesce(count(*) filter (where bekleyen), 0)::int,
    'aktif', coalesce(bool_or(aktif), false),
    'modlar', coalesce((select array_agg(distinct k.mod) from kaynak k where k.bekleyen), '{}'::text[]),
    'aktif_mod', (select k.mod from kaynak k where k.aktif limit 1)
  )
  from kaynak;
$fn$;

-- Davet ATARKEN: kural 2 (en fazla 2 bekleyen). Kural 5 her modun kendi kontrolünde.
-- Kural 1 gereği farklı moddaki ikinci davet engellenmez — yalnız üçüncüsü durur.
create or replace function public.davet_siniri_kontrol(p_rakip uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_c jsonb;
  v_sinir int := public.ayar_sayi('davet_bekleyen_sinir', 2)::int;
begin
  if auth.uid() is null or p_rakip is null then return; end if;
  v_c := public.davet_cakismasi(auth.uid(), p_rakip);
  if (v_c->>'bekleyen')::int >= v_sinir then
    raise exception 'Bu oyuncuyla zaten % bekleyen davetin var.', v_sinir;
  end if;
end;
$fn$;

-- Davet KABUL EDİLİRKEN: kural 4 (aktif oyun varsa ikincisi kabul edilemez).
create or replace function public.davet_kabul_kontrol(p_rakip uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_c jsonb;
begin
  if auth.uid() is null or p_rakip is null then return; end if;
  v_c := public.davet_cakismasi(auth.uid(), p_rakip);
  if coalesce((v_c->>'aktif')::boolean, false) then
    raise exception 'Bu oyuncuyla devam eden bir oyunun var, önce onu bitir.';
  end if;
end;
$fn$;

insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('davet_bekleyen_sinir', '2'::jsonb, 'Aynı iki oyuncu arasında aynı anda bekleyebilecek en çok davet sayısı (modlar toplamı)')
on conflict (anahtar) do nothing;

revoke all on function public.davet_cakismasi(uuid, uuid) from public, anon;
revoke all on function public.davet_siniri_kontrol(uuid) from public, anon;
revoke all on function public.davet_kabul_kontrol(uuid) from public, anon;
grant execute on function public.davet_cakismasi(uuid, uuid) to authenticated;
grant execute on function public.davet_siniri_kontrol(uuid) to authenticated;
grant execute on function public.davet_kabul_kontrol(uuid) to authenticated;

-- ------------------------------------------------------------
-- 2) bekleyen_davetlerim() — 'duello' türü eklendi
-- ------------------------------------------------------------
create or replace function public.bekleyen_davetlerim()
returns table (
  tur text,             -- 'mac' | 'rovans' | 'grup' | 'hizli' | 'duello'
  kayit_id uuid,        -- maç / grup maçı / hızlı maç / düello DAVETİ id'si
  davet_eden uuid,
  gorunen_ad text,
  gorunen_avatar text,
  kategori text,
  kisi_sayisi int,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    case when m.rovans then 'rovans' else 'mac' end,
    m.id, m.oyuncu1, p.gorunen_ad, p.gorunen_avatar, m.kategori, 2, m.created_at
  from public.matches m
  join public.profiles p on p.id = m.oyuncu1
  where m.oyuncu2 = auth.uid()
    and m.durum = 'bekliyor'
    and not coalesce(p.is_bot, false)

  union all

  select
    'grup', g.id, g.kurucu, p.gorunen_ad, p.gorunen_avatar, g.kategori,
    g.oyuncu_sayisi, gp.joined_at
  from public.group_match_players gp
  join public.group_matches g on g.id = gp.group_match_id
  join public.profiles p on p.id = g.kurucu
  where gp.user_id = auth.uid()
    and gp.davet_durumu = 'bekliyor'
    and g.durum in ('lobi', 'bekliyor')

  union all

  select
    'hizli', h.id, h.kurucu, p.gorunen_ad, p.gorunen_avatar, h.kategori,
    h.oyuncu_sayisi, ho.joined_at
  from public.hizli_oyuncular ho
  join public.hizli_maclar h on h.id = ho.hizli_mac_id
  join public.profiles p on p.id = h.kurucu
  where ho.user_id = auth.uid()
    and ho.davet_durumu = 'bekliyor'
    and h.durum in ('lobi', 'bekliyor')

  union all

  -- Düello daveti (Paket 24). kayit_id = duello_davetleri.id — cevap RPC'si bunu bekler.
  select
    'duello', dd.id, dd.kuran, p.gorunen_ad, p.gorunen_avatar, null::text, 2, dd.created_at
  from public.duello_davetleri dd
  join public.profiles p on p.id = dd.kuran
  where dd.rakip = auth.uid()
    and dd.durum = 'bekliyor'
    and not coalesce(p.is_bot, false)

  order by 8 desc
  limit 20;
$fn$;

revoke execute on function public.bekleyen_davetlerim() from public, anon;
grant execute on function public.bekleyen_davetlerim() to authenticated;

-- ------------------------------------------------------------
-- 3) gonderdigim_davetler() — 'duello' türü eklendi
-- ------------------------------------------------------------
create or replace function public.gonderdigim_davetler()
returns table(
  tur text,
  kayit_id uuid,
  rakip uuid,
  gorunen_ad text,
  gorunen_avatar text,
  kategori text,
  bekleyen_sayisi int,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    case when m.rovans then 'rovans' else 'mac' end,
    m.id, m.oyuncu2, p.gorunen_ad, p.gorunen_avatar, m.kategori, 1, m.created_at
  from public.matches m
  join public.profiles p on p.id = m.oyuncu2
  where m.oyuncu1 = auth.uid()
    and m.durum = 'bekliyor'
    and not coalesce(p.is_bot, false)

  union all

  select
    'grup', g.id, null::uuid, null::text, null::text, g.kategori,
    (select count(*)::int from public.group_match_players x
      where x.group_match_id = g.id and x.davet_durumu = 'bekliyor'),
    g.created_at
  from public.group_matches g
  where g.kurucu = auth.uid()
    and g.durum in ('lobi', 'bekliyor')
    and exists (
      select 1 from public.group_match_players gp
      join public.profiles pp on pp.id = gp.user_id
      where gp.group_match_id = g.id
        and gp.davet_durumu = 'bekliyor'
        and not coalesce(pp.is_bot, false)
    )

  union all

  select
    'hizli', h.id, null::uuid, null::text, null::text, h.kategori,
    (select count(*)::int from public.hizli_oyuncular x
      where x.hizli_mac_id = h.id and x.davet_durumu = 'bekliyor'),
    h.created_at
  from public.hizli_maclar h
  where h.kurucu = auth.uid()
    and h.durum in ('lobi', 'bekliyor')
    and exists (
      select 1 from public.hizli_oyuncular ho
      join public.profiles pp on pp.id = ho.user_id
      where ho.hizli_mac_id = h.id
        and ho.davet_durumu = 'bekliyor'
        and not coalesce(pp.is_bot, false)
    )

  union all

  -- Düello: ben davet ettim, rakip henüz cevaplamadı (açık bot anında kabul eder, listede görünmez)
  select
    'duello', dd.id, dd.rakip, p.gorunen_ad, p.gorunen_avatar, null::text, 1, dd.created_at
  from public.duello_davetleri dd
  join public.profiles p on p.id = dd.rakip
  where dd.kuran = auth.uid()
    and dd.durum = 'bekliyor'
    and not coalesce(p.is_bot, false)

  order by 8 desc
  limit 20;
$fn$;

revoke execute on function public.gonderdigim_davetler() from public, anon;
grant execute on function public.gonderdigim_davetler() to authenticated;

-- ------------------------------------------------------------
-- 4) davet_geri_cek() — 'duello' türü eklendi
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
  v_rakip uuid;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  perform public.hiz_siniri('davet_geri_cek', 30, interval '60 seconds');

  if p_tur in ('mac', 'rovans') then
    select * into m from public.matches where id = p_kayit_id for update;
    if not found then raise exception 'Maç bulunamadı'; end if;
    if m.oyuncu1 <> v_me then raise exception 'Bu daveti sen göndermedin'; end if;
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

  elsif p_tur = 'duello' then
    -- p_kayit_id = duello_davetleri.id (bekleyen_davetlerim/gonderdigim_davetler ile aynı)
    select rakip into v_rakip from public.duello_davetleri
     where id = p_kayit_id and kuran = v_me and durum = 'bekliyor' for update;
    if v_rakip is null then raise exception 'Davet artık beklemede değil'; end if;

    update public.duello_davetleri
       set durum = 'iptal', yanit_at = now()
     where id = p_kayit_id;

    v_yol := '/bildim/duello';
    delete from public.bildirimler
     where user_id = v_rakip and not okundu and tip = 'duello_daveti' and yol = v_yol;
    return true;
  end if;

  raise exception 'Bilinmeyen davet türü: %', p_tur;
end;
$fn$;

revoke all on function public.davet_geri_cek(text, uuid) from public, anon;
grant execute on function public.davet_geri_cek(text, uuid) to authenticated;

-- ------------------------------------------------------------
-- 5) bildirim_yaz — düello başlıkları (telefon bildirimi metni)
-- ------------------------------------------------------------
create or replace function public.bildirim_yaz(p_user uuid, p_tip text, p_metin text, p_yol text default null)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_bot boolean;
  v_baslik text;
begin
  if p_user is null then return; end if;

  select coalesce(is_bot, false) into v_bot from public.profiles where id = p_user;
  if coalesce(v_bot, false) then return; end if;

  insert into public.bildirimler (user_id, tip, metin, yol)
  values (p_user, p_tip, p_metin, p_yol);

  v_baslik := case p_tip
    when 'mac_daveti'      then '⚔️ Meydan okuma!'
    when 'meydan_kabul'    then '🔥 Meydan okuman kabul edildi!'
    when 'rovans'          then '⚔️ Rövanş isteği'
    when 'grup_daveti'     then '👥 Grup maçı daveti'
    when 'grup_kabul'      then '👥 Grup maçın başlıyor!'
    when 'hizli_daveti'    then '⚡ Hızlı maç daveti'
    when 'duello_daveti'   then '⚔️ Düello daveti'
    when 'duello_kabul'    then '🔥 Düello kabul edildi'
    when 'sira_sende'      then '⏳ Sıra sende!'
    when 'arkadas_istek'   then '🤝 Arkadaşlık isteği'
    when 'arkadas_kabul'   then '🎉 Yeni arkadaş'
    when 'gecildin'        then '⚡ Sıran düştü'
    when 'hafta_sonuc'     then '🏆 Hafta bitti'
    when 'ustalik'         then '🎖️ Ustalık'
    when 'seri'            then '🔥 Serin'
    when 'lige_girdin'     then '🏙️ Ligdesin'
    else 'Quiz Tactics'
  end;

  begin
    perform net.http_post(
      url := 'https://zfpnxzybcpkxsotwdsey.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'x-cron-secret', public.gizli_al('cron_secret'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'user_ids', jsonb_build_array(p_user),
        'baslik', v_baslik,
        'govde', p_metin,
        'url', coalesce(p_yol, '/bildim')
      )
    );
  exception when others then
    null;
  end;
end;
$fn$;

-- ------------------------------------------------------------
-- 6) duello_davet_et — bildirim + çakışma kuralı
--    (226'daki gövde korundu; yalnız iki ekleme yapıldı)
-- ------------------------------------------------------------
create or replace function public.duello_davet_et(p_rakip uuid, p_dereceli boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_davet uuid;
  v_duello uuid;
  v_bot boolean;
  v_ad text;
begin
  perform public.hiz_siniri('duello_davet_et', 30, interval '60 seconds');
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  if p_rakip = v_me then raise exception 'Kendine meydan okuyamazsın'; end if;
  if not exists (select 1 from public.profiles where id = p_rakip) then
    raise exception 'Oyuncu bulunamadı';
  end if;
  if not public.oynanabilir_mi(p_rakip) then
    raise exception 'Yalnız arkadaşlarına ve botlara meydan okuyabilirsin.';
  end if;

  delete from public.duello_davetleri
   where durum = 'bekliyor' and created_at < now() - interval '24 hours';

  if exists (select 1 from public.duellolar
              where durum = 'aktif' and (v_me in (oyuncu1, oyuncu2) or p_rakip in (oyuncu1, oyuncu2))) then
    raise exception 'Devam eden bir düello var';
  end if;
  -- Kural 5: aynı modda ikinci davet yok
  if exists (select 1 from public.duello_davetleri
              where durum = 'bekliyor'
                and ((kuran = v_me and rakip = p_rakip) or (kuran = p_rakip and rakip = v_me))) then
    raise exception 'Bu oyuncuyla bekleyen bir düello davetin zaten var';
  end if;
  -- Kural 2: modlar toplamında en fazla 2 bekleyen davet (Paket 24 · A.2)
  perform public.davet_siniri_kontrol(p_rakip);

  perform public.mac_kotasi_kontrol();

  insert into public.duello_davetleri (kuran, rakip, dereceli)
  values (v_me, p_rakip, coalesce(p_dereceli, true))
  returning id into v_davet;

  select coalesce(is_bot, false) and coalesce(acik_bot, false) into v_bot
    from public.profiles where id = p_rakip;
  if coalesce(v_bot, false) then
    v_duello := public.duello_olustur(v_me, p_rakip, coalesce(p_dereceli, true));
    update public.duello_davetleri
       set durum = 'kabul', duello_id = v_duello, yanit_at = now()
     where id = v_davet;
  else
    -- Davet edilen haberdar olsun (bant + telefon bildirimi). Bot ise bildirim_yaz kendisi susar.
    select gorunen_ad into v_ad from public.profiles where id = v_me;
    perform public.bildirim_yaz(
      p_rakip,
      'duello_daveti',
      coalesce(v_ad, 'Bir oyuncu') || ' seni düelloya çağırdı!',
      '/bildim/duello'
    );
  end if;

  return jsonb_build_object('davet_id', v_davet, 'duello_id', v_duello);
end;
$fn$;

-- ------------------------------------------------------------
-- 7) duello_davet_cevap — kabul bildirimi + aktif oyun kuralı
-- ------------------------------------------------------------
create or replace function public.duello_davet_cevap(p_id uuid, p_kabul boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  d public.duello_davetleri%rowtype;
  v_duello uuid;
  v_ad text;
begin
  perform public.hiz_siniri('duello_davet_cevap', 60, interval '60 seconds');
  if v_me is null then raise exception 'Giriş gerekli'; end if;

  select * into d from public.duello_davetleri where id = p_id for update;
  if not found then raise exception 'Davet bulunamadı'; end if;
  if d.rakip <> v_me then raise exception 'Bu davet sana ait değil'; end if;
  if d.durum <> 'bekliyor' then raise exception 'Davet zaten yanıtlanmış'; end if;

  if not coalesce(p_kabul, false) then
    update public.duello_davetleri set durum = 'red', yanit_at = now() where id = p_id;
    return null;
  end if;

  if exists (select 1 from public.duellolar
              where durum = 'aktif' and (v_me in (oyuncu1, oyuncu2) or d.kuran in (oyuncu1, oyuncu2))) then
    raise exception 'Devam eden bir düello var';
  end if;
  -- Kural 4: aynı rakiple başka bir modda aktif oyun varsa bu davet kabul edilemez
  perform public.davet_kabul_kontrol(d.kuran);
  perform public.mac_kotasi_kontrol();

  v_duello := public.duello_olustur(d.kuran, v_me, d.dereceli);
  update public.duello_davetleri
     set durum = 'kabul', duello_id = v_duello, yanit_at = now()
   where id = p_id;

  -- Daveti gönderen başka sayfadaysa da görsün (BildirimToast "Oyuna git")
  select gorunen_ad into v_ad from public.profiles where id = v_me;
  perform public.bildirim_yaz(
    d.kuran,
    'duello_kabul',
    coalesce(v_ad, 'Rakibin') || ' düello davetini kabul etti - düello başlıyor!',
    '/bildim/duello/' || v_duello::text
  );
  return v_duello;
end;
$fn$;

revoke execute on function public.duello_davet_et(uuid, boolean) from public, anon;
revoke execute on function public.duello_davet_cevap(uuid, boolean) from public, anon;
grant execute on function public.duello_davet_et(uuid, boolean) to authenticated;
grant execute on function public.duello_davet_cevap(uuid, boolean) to authenticated;

-- ------------------------------------------------------------
-- 8) Diğer modların davet yollarına aynı kural (gövdeler korundu, kontrol eklendi)
-- ------------------------------------------------------------
create or replace function public.create_challenge(p_rakip uuid, p_kategori text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  if p_rakip = auth.uid() then raise exception 'Kendine meydan okuyamazsın'; end if;
  if not exists (select 1 from public.profiles where id = p_rakip) then
    raise exception 'Oyuncu bulunamadı';
  end if;
  if not public.oynanabilir_mi(p_rakip) then
    raise exception 'Yalnız arkadaşlarına ve botlara meydan okuyabilirsin.';
  end if;
  -- Kural 5: aynı modda ikinci davet yok (mevcut kontrol, korunur)
  if exists (
    select 1 from public.matches
    where durum in ('bekliyor','aktif')
      and ((oyuncu1 = auth.uid() and oyuncu2 = p_rakip)
        or (oyuncu1 = p_rakip and oyuncu2 = auth.uid()))
  ) then
    raise exception 'Bu oyuncuyla zaten devam eden bir meydan okuman var';
  end if;
  -- Kural 2: modlar toplamı (Paket 24 · A.2)
  perform public.davet_siniri_kontrol(p_rakip);

  perform public.mac_kotasi_kontrol();

  insert into public.matches (oyuncu1, oyuncu2, kategori)
  values (auth.uid(), p_rakip, p_kategori)
  returning id into v_id;
  return v_id;
end;
$fn$;

revoke execute on function public.create_challenge(uuid, text) from public, anon;
grant execute on function public.create_challenge(uuid, text) to authenticated;

-- respond_challenge: kural 4 (gövde 128'den korundu)
create or replace function public.respond_challenge(p_match_id uuid, p_kabul boolean)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  m public.matches%rowtype;
  v_ad text;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if m.oyuncu2 <> auth.uid() then raise exception 'Bu meydan okuma sana gelmedi'; end if;
  if m.durum <> 'bekliyor' then raise exception 'Bu meydan okuma artık beklemede değil'; end if;

  if p_kabul then
    -- Kural 4: aynı rakiple başka bir modda aktif oyun varsa kabul edilemez
    perform public.davet_kabul_kontrol(m.oyuncu1);

    update public.matches
       set durum = 'aktif',
           soru_ids = public.soru_sec(m.kategori, 20, array[m.oyuncu1, m.oyuncu2]),
           aktif_soru = 0,
           soru_baslangic = now(),
           kabul_at = now()
     where id = p_match_id;

    select gorunen_ad into v_ad from public.profiles where id = auth.uid();
    perform public.bildirim_yaz(
      m.oyuncu1,
      'meydan_kabul',
      coalesce(v_ad, 'Rakibin') || ' meydan okumanı kabul etti - maç başlıyor!',
      '/bildim/mac/' || p_match_id::text
    );
  else
    update public.matches set durum = 'reddedildi' where id = p_match_id;
  end if;
end;
$fn$;

revoke execute on function public.respond_challenge(uuid, boolean) from public, anon;
grant execute on function public.respond_challenge(uuid, boolean) to authenticated;

-- create_group_challenge: kural 2 her rakip için ayrı ayrı (gövde 047'den korundu).
-- Kural 4 GRUBA UYGULANMAZ: grup 3-5 kişiliktir, "bu oyuncuyla devam eden oyun" kavramı
-- çok taraflı bir lobide karşılığı olmayan bir engel üretir ve Grup Maçı ödülsüz arkadaş
-- modudur — arkadaşlarıyla oynayanı cezalandıran limit konmaz.
create or replace function public.create_group_challenge(p_rakipler uuid[], p_kategori text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
  v_sayi int;
  v_r uuid;
  v_ad text;
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  v_sayi := coalesce(array_length(p_rakipler, 1), 0);
  if v_sayi not in (2, 3, 4) then
    raise exception 'Grup için 2, 3 veya 4 rakip seçmelisin (toplam 3-5 kişi)';
  end if;
  if auth.uid() = any(p_rakipler) then
    raise exception 'Kendini seçemezsin';
  end if;
  if v_sayi <> (select count(distinct x) from unnest(p_rakipler) x) then
    raise exception 'Aynı oyuncuyu birden fazla seçemezsin';
  end if;
  foreach v_r in array p_rakipler loop
    if not exists (select 1 from public.profiles where id = v_r) then
      raise exception 'Oyuncu bulunamadı';
    end if;
    if not public.oynanabilir_mi(v_r) then
      raise exception 'Gruba yalnız arkadaşlarını ve botlarını çağırabilirsin.';
    end if;
    -- Kural 2: hangi oyuncunun engellediği söylensin (Paket 24 · A.2)
    begin
      perform public.davet_siniri_kontrol(v_r);
    exception when others then
      select gorunen_ad into v_ad from public.profiles where id = v_r;
      raise exception '% ile zaten 2 bekleyen davetin var.', coalesce(v_ad, 'Bir oyuncu');
    end;
  end loop;

  perform public.mac_kotasi_kontrol();

  insert into public.group_matches (kurucu, oyuncu_sayisi, kategori)
  values (auth.uid(), v_sayi + 1, p_kategori)
  returning id into v_id;

  insert into public.group_match_players (group_match_id, user_id, davet_durumu)
  values (v_id, auth.uid(), 'kabul');

  foreach v_r in array p_rakipler loop
    insert into public.group_match_players (group_match_id, user_id, davet_durumu)
    values (v_id, v_r, 'bekliyor');
  end loop;

  return v_id;
end;
$fn$;

revoke execute on function public.create_group_challenge(uuid[], text) from public, anon;
grant execute on function public.create_group_challenge(uuid[], text) to authenticated;

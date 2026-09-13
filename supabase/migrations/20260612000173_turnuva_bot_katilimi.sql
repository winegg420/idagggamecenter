-- ============================================================
-- TURNUVA BOTLARI — 38-66 ARASI, ZAMANA YAYILARAK
--
-- Sahibinin isteği: "Her turnuvaya 38 ile 66 arası farklı sayıda bot
-- katılım yapsın. Botlarımız 'Turnuvaya katıldım' butonuna basmış olarak
-- görünmeli. Bu işlem zamana yayılarak yapılmış ki doğal gözüksün."
--
-- ÖNCEKİ DURUM: `bot_turnuva_katilim_yuzde = 20` → 80 gizli botun ~16'sı
-- ve hepsi TEK SEFERDE (cron günde bir kez, turnuvadan ~30 dk önce).
-- Lobi bir anda doluyordu; hem az hem yapay.
--
-- YENİ DURUM:
--   • Hedef sayı her turnuva için 38-66 arasından DETERMİNİSTİK seçilir
--     (`bot_rasgele(tournament_id)`), yani aynı turnuvada liste yenilemede
--     zıplamaz ama her turnuvada farklıdır.
--   • Her bota, turnuva saatinden geriye doğru açılan yayılma penceresi
--     içinde deterministik bir katılım anı verilir. Dakikada bir çalışan
--     `bot_turnuva_katilim_tik()` yalnız anı GELMİŞ olanları ekler.
--
-- `bot_turnuva_katilim_yuzde` anahtarı SİLİNMEDİ ama ARTIK KULLANILMIYOR;
-- aşağıdaki açıklaması bunu söylüyor.
--
-- `is_bot` istemciye sızmaz: bu değişiklik yalnız `tournament_players`
-- satırı ekler, istemciye giden alanlara dokunmaz.
-- ============================================================

insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('bot_turnuva_katilim_min', '38'::jsonb,
   'Bir turnuvaya katılacak en az bot sayısı (açık + gizli toplam).'),
  ('bot_turnuva_katilim_max', '66'::jsonb,
   'Bir turnuvaya katılacak en çok bot sayısı. Havuzdan büyükse havuza kırpılır.'),
  ('bot_turnuva_katilim_yayilma_dk', '25'::jsonb,
   'Bot katılımlarının yayıldığı dakika. Turnuva saatinden bu kadar önce başlar, turnuva saatinde biter.')
on conflict (anahtar) do update set aciklama = excluded.aciklama;

update public.oyun_ayarlari
   set aciklama = 'KULLANILMIYOR (13 Eyl 2026). Yerine bot_turnuva_katilim_min/max geldi. Geriye dönüş gerekirse diye silinmedi.'
 where anahtar = 'bot_turnuva_katilim_yuzde';

-- ------------------------------------------------------------
-- Turnuvanın başlangıç anı (Europe/Istanbul saatiyle)
-- `oyun_ayarlari`'ndaki turnuva_saat_sabah / _aksam okunur; rakam koda
-- gömülmez.
-- ------------------------------------------------------------
create or replace function public.turnuva_an(p_tournament_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $fn$
  select (t.tarih + coalesce(
            (select (o.deger #>> '{}')::time
               from public.oyun_ayarlari o
              where o.anahtar = 'turnuva_saat_' || t.seans),
            '13:00'::time)
         ) at time zone 'Europe/Istanbul'
    from public.tournaments t
   where t.id = p_tournament_id;
$fn$;

revoke all on function public.turnuva_an(uuid) from public, authenticated, anon;

-- ------------------------------------------------------------
-- Bu turnuvaya kaç bot katılacak — deterministik
-- ------------------------------------------------------------
create or replace function public.turnuva_hedef_bot(p_tournament_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_min int := public.ayar_sayi('bot_turnuva_katilim_min', 38)::int;
  v_max int := public.ayar_sayi('bot_turnuva_katilim_max', 66)::int;
  v_havuz int;
  v_hedef int;
begin
  if v_max < v_min then v_max := v_min; end if;

  select count(*) into v_havuz
    from public.profiles
   where is_bot and coalesce(bot_aktif, true);

  -- Aynı turnuva için hep aynı sayı: liste yenilemede zıplamasın.
  v_hedef := v_min + floor(public.bot_rasgele('turnuva_bot:' || p_tournament_id::text)
                           * (v_max - v_min + 1))::int;
  if v_hedef > v_max then v_hedef := v_max; end if;
  -- Üst sınır havuzu aşamaz.
  if v_hedef > v_havuz then v_hedef := v_havuz; end if;
  return greatest(0, v_hedef);
end;
$fn$;

revoke all on function public.turnuva_hedef_bot(uuid) from public, authenticated, anon;

-- ------------------------------------------------------------
-- Havuz — hedef sayı kadar bot, deterministik sırayla
-- Açık botlar (adında "Bot" geçenler) önce gelir; kalan yer gizli
-- botlardan doldurulur.
-- ------------------------------------------------------------
create or replace function public.turnuva_bot_havuzu(p_tournament_id uuid)
returns table(bot_id uuid)
language sql
stable
security definer
set search_path = public
as $fn$
  select s.id
    from (
      select p.id,
             case when coalesce(p.bot_turu, 'acik') = 'acik' then 0 else 1 end as oncelik,
             public.bot_rasgele(p_tournament_id::text || p.id::text) as sira
        from public.profiles p
       where p.is_bot and coalesce(p.bot_aktif, true)
       order by oncelik, sira
       limit (select public.turnuva_hedef_bot(p_tournament_id))
    ) s;
$fn$;

-- ------------------------------------------------------------
-- Bir botun katılım anı — turnuva saatinden geriye açılan pencerede
-- ------------------------------------------------------------
create or replace function public.turnuva_bot_katilim_ani(p_tournament_id uuid, p_bot uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $fn$
  select public.turnuva_an(p_tournament_id)
       - make_interval(mins => public.ayar_sayi('bot_turnuva_katilim_yayilma_dk', 25)::int)
       + make_interval(secs => (public.bot_rasgele('turnuva_an:' || p_tournament_id::text || p_bot::text)
                                * public.ayar_sayi('bot_turnuva_katilim_yayilma_dk', 25)::int * 60)::int);
$fn$;

revoke all on function public.turnuva_bot_katilim_ani(uuid, uuid) from public, authenticated, anon;

-- ------------------------------------------------------------
-- TİK — dakikada bir çalışır, anı gelmiş botları lobiye ekler
-- ------------------------------------------------------------
create or replace function public.bot_turnuva_katilim_tik()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  t record;
  v_bot uuid;
  v_eklenen int := 0;
begin
  for t in select id from public.tournaments where durum = 'lobi' loop
    for v_bot in select bot_id from public.turnuva_bot_havuzu(t.id) loop
      -- Anı gelmemiş bot beklemeye devam eder: lobi tek seferde dolmaz.
      if now() < public.turnuva_bot_katilim_ani(t.id, v_bot) then
        continue;
      end if;
      insert into public.tournament_players (tournament_id, user_id)
      values (t.id, v_bot)
      on conflict do nothing;
      if found then v_eklenen := v_eklenen + 1; end if;
    end loop;
  end loop;
  return v_eklenen;
end;
$fn$;

revoke all on function public.bot_turnuva_katilim_tik() from public, authenticated, anon;

-- ------------------------------------------------------------
-- Eski giriş noktası korunuyor: artık tik'i çağırıyor.
-- (Günlük cron'lar bozulmasın; yayılmayı dakikalık cron sağlıyor.)
-- ------------------------------------------------------------
create or replace function public.bot_join_tournament(p_seans text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform public.bot_turnuva_katilim_tik();
end;
$fn$;

-- ------------------------------------------------------------
-- Dakikalık cron
-- ------------------------------------------------------------
do $$
begin
  perform cron.unschedule('bildim-bot-turnuva-tik');
exception when others then
  null;   -- yoksa sorun değil
end $$;

select cron.schedule('bildim-bot-turnuva-tik', '* * * * *',
                     'select public.bot_turnuva_katilim_tik()');

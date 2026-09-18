-- Paket 26 A — Güvenlik ve RLS yeniden denetimi.
-- 9 Eyl 2026'daki son denetimden sonra 153 migration eklendi, hiçbiri denetlenmemişti.
-- Ölçüm: 117 public tablo, 394 fonksiyon; bulgular anon anahtarıyla CANLIDA denendi.
--
-- 🔴 1. `soru_dilinde(question_id, dil)` anon'a açıktı ve `dogru_cevap` döndürüyordu.
--        Giriş yapmadan  GET /rest/v1/rpc/soru_dilinde?p_question_id=<id>&select=dogru_cevap
--        her sorunun doğru şıkkını veriyordu. Oyuncu kendi maçının `soru_ids` dizisini
--        okuyabildiği için (20 soru) bütün modlarda tam hile mümkündü.
-- 🔴 2. `turnuva_bot_havuzu` ve `avatar3d_portresiz_botlar` gizli botların id listesini
--        anon'a veriyordu — "is_bot istemciye sızmaz" kuralının ihlali.
-- 🔴 3. `haftayi_kapat` / `lig_haftayi_kapat` anon tarafından çağrılabiliyordu: lig haftası
--        erken kapatılıp yükselme/düşme ve ödüller tetiklenebilirdi.
-- 🟡 4. Parametreyle başkasının durumunu okuyan uçlar (`ayni_cihaz_mi`, `coin_gunluk_kalan`,
--        `davet_*`, `oyuncu_dili`, `oyuncu_seviye_puani`) ve yazan/temizleyen iç uçlar
--        (`gorulen_kaydet`, `lig_uyeligim_kur`, `senkron_mac_temizle`, `pr_cleanup_error_logs`,
--        `avatar3d_bot_portre_kaydet`, `hiz_siniri`) istemciye açıktı.
-- 🟡 5. Her tabloda anon/authenticated'a TRUNCATE yetkisi vardı. TRUNCATE RLS'e TABİ DEĞİLDİR.
-- 🟡 6. tournaments / tournament_players / user_badges / dg_* satırları giriş yapmadan okunuyordu.
-- 🟡 7. `pr_apply_race_result` istemcinin verdiği puanı sınırsız ekliyordu.
--
-- Sebep hepsinde aynı: Supabase'in varsayılan "şemadaki her şeyi anon+authenticated'a ver"
-- yetkisi sonradan eklenen fonksiyonları da kendiliğinden kapsıyor. Burada yetki yüzeyi,
-- istemcinin gerçekten çağırdığı RPC listesiyle (kaynak taranarak çıkarıldı) sınırlanıyor.
-- Hiçbir fonksiyon, tablo ya da satır SİLİNMEDİ; yalnızca yetki daraltıldı.

-- ---------------------------------------------------------------------------
-- 1) Sunucuya ait fonksiyonların çağrı yetkisi alınıyor.
--    Hepsi SECURITY DEFINER; başka definer fonksiyonların içinden çağrıldıklarında
--    sahip (postgres) hakkıyla çalışırlar, yani iç kullanım etkilenmez.
--    grup_mac_uyesi_mi / hizli_mac_uyesi_mi BİLEREK dışarıda bırakıldı: onlar RLS
--    politikası değerlendirilirken ÇAĞIRAN rolle çalışır; yetkileri alınırsa grup ve
--    hızlı maç tabloları okunamaz hâle gelir.
--
--    ÖNEMLİ: yetkiyi yalnız anon/authenticated'dan almak YETMİYOR. PostgreSQL yeni
--    fonksiyonu kendiliğinden PUBLIC sözde rolüne açar (yetki listesinde `=X/postgres`),
--    ölçüldü. Bu yüzden önce PUBLIC'ten alınıyor, sonra sunucu rolleri geri veriliyor —
--    cron işleri postgres, Edge Function'lar service_role ile çalışır.
-- ---------------------------------------------------------------------------
do $$
declare
  v_ad text;
  v_liste text[] := array[
    -- soru/cevap sırrı
    'soru_dilinde','soru_id_coz','soru_baslangic_coz','soru_son_baslangic',
    -- gizli bot kimliği
    'turnuva_bot_havuzu','avatar3d_portresiz_botlar','seviyeye_gore_bot',
    'bot_rasgele','bot_gecikme_sn','bot_eslesme_gecikmesi','bot_portre_yolu_mu',
    -- parametreyle başkasının durumunu okuyan uçlar
    'ayni_cihaz_mi','coin_gunluk_kalan','davet_cakismasi','davet_kabul_kontrol',
    'davet_siniri_kontrol','gorunum_dogrula','oyuncu_dili','oyuncu_seviye_puani',
    -- durum değiştiren / yönetim / cron uçları
    'haftayi_kapat','lig_haftayi_kapat','senkron_mac_temizle','pr_cleanup_error_logs',
    'avatar3d_bot_portre_kaydet','lig_uyeligim_kur','gorulen_kaydet','hiz_siniri',
    'mac_hazir','cift_odul_carpani'
  ];
  r record;
begin
  foreach v_ad in array v_liste loop
    for r in
      select p.oid::regprocedure::text as imza
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = v_ad
    loop
      execute format('revoke execute on function %s from public, anon, authenticated', r.imza);
      execute format('grant execute on function %s to postgres, service_role', r.imza);
    end loop;
  end loop;

  -- Tetikleyici fonksiyonları doğrudan çağrılamaz olsun. Tetikleyici yetkisi tetikleyici
  -- KURULURKEN denetlenir, ateşlenirken değil — çalışan tetikleyiciler etkilenmez.
  for r in
    select p.oid::regprocedure::text as imza
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_type t on t.oid = p.prorettype
     where n.nspname = 'public' and t.typname = 'trigger'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.imza);
    execute format('grant execute on function %s to postgres, service_role', r.imza);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2) TRUNCATE / TRIGGER / REFERENCES yetkileri alınıyor.
--    SELECT/INSERT/UPDATE/DELETE'e DOKUNULMUYOR — uygulama onlarla çalışıyor.
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated', r.relname);
  end loop;
end $$;

-- Bundan sonra açılacak tablolar da aynı kuralla doğsun.
alter default privileges in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Giriş yapmadan okunabilen kişisel veri kapatılıyor.
--    `badges` bilerek açık kalıyor: rozet kataloğu, kişisel veri taşımıyor.
-- ---------------------------------------------------------------------------
drop policy if exists tournaments_select on public.tournaments;
create policy tournaments_select on public.tournaments
  for select to authenticated using (true);

drop policy if exists tournament_players_select on public.tournament_players;
create policy tournament_players_select on public.tournament_players
  for select to authenticated using (true);

drop policy if exists user_badges_select on public.user_badges;
create policy user_badges_select on public.user_badges
  for select to authenticated using (true);

drop policy if exists profiles_select_all on public.dg_profiles;
create policy profiles_select_all on public.dg_profiles
  for select to authenticated using (true);

drop policy if exists ghosts_select_all on public.dg_ghosts;
create policy ghosts_select_all on public.dg_ghosts
  for select to authenticated using (true);

drop policy if exists race_results_select_all on public.dg_race_results;
create policy race_results_select_all on public.dg_race_results
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 4) PatiRun: istemcinin verdiği puana tavan.
--    Meşru en yüksek değer 125 (1. sıra 100 + günlük ilk yarış bonusu 25).
--    Tavan 150; aşan değer kırpılır, oyun akışı bozulmasın diye hata atılmaz.
-- ---------------------------------------------------------------------------
create or replace function public.pr_apply_race_result(p_puan integer, p_won boolean, p_race_date date)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_puan int := least(greatest(coalesce(p_puan, 0), 0), 150);
begin
  perform public.hiz_siniri('pr_apply_race_result', 20, interval '60 seconds');
  update public.pr_users set
    puan = puan + v_puan,
    total_races = total_races + 1,
    total_wins = total_wins + (case when p_won then 1 else 0 end),
    last_race_date = p_race_date,
    rutbe = case
      when puan + v_puan >= 15000 then 'Efsane'
      when puan + v_puan >= 7000 then 'Şampiyon'
      when puan + v_puan >= 3500 then 'Profesyonel'
      when puan + v_puan >= 1500 then 'Yarı Profesyonel'
      when puan + v_puan >= 500 then 'Amatör'
      else 'Çaylak'
    end
  where id = auth.uid();
end;
$function$;

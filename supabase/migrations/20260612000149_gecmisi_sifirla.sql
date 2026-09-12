-- ============================================================
-- OYUN GEÇMİŞİNİ SIFIRLA — temiz sayfa
--
-- Oyun henüz gerçek oyuncu kitlesine açılmadı; tablolardaki her şey test
-- verisi. Gizli bot sistemi (150) ve kademeli lig (151) devreye girmeden
-- önce geçmiş siliniyor: yoksa eski test istatistikleri yeni sistemle
-- karışır (lig grupları eski puanlara göre kurulur, botlar eski maçlarla
-- eşleşmiş görünür).
--
-- SİLİNEN: maç geçmişi ve bağlı kayıtlar · lig puanları/sıralamalar ·
--   maç istatistikleri, kategori ustalıkları, seriler · turnuva geçmişi ·
--   maçtan türeyen rozet/görev/çalışma kayıtları. ("Ezeli rakip" ayrı bir
--   tablo değil, matches üzerinden hesaplanıyor — maçlar silinince o da
--   kendiliğinden sıfırlanıyor.)
--
-- KORUNAN: hesaplar ve profiller (takma ad, avatar, konum, arkadaşlıklar) ·
--   coin bakiyeleri ve coin/satın alma hareketleri (para ödeyen kimse
--   kaybetmesin) · joker envanterleri · sahip olunan eşyalar ·
--   soru havuzu ve soru istatistikleri (zorluk, doğru/cevap sayıları) ·
--   gizlilik ve bildirim izinleri.
--
-- truncate ... cascade BİLEREK kullanılmadı: hangi tablonun boşaldığını
-- görmek ve yanlışlıkla korunacak bir tabloyu süpürmemek için bilinçli
-- sırayla delete yapılıyor. Silinen kayıt sayıları raise notice ile yazılır.
-- ============================================================

do $sifirla$
declare
  v_once jsonb;
  v_sonra jsonb;
  v_n int;
  v_toplam int := 0;
begin
  select jsonb_build_object(
    'matches',        (select count(*) from public.matches),
    'match_answers',  (select count(*) from public.match_answers),
    'group_matches',  (select count(*) from public.group_matches),
    'hizli_maclar',   (select count(*) from public.hizli_maclar),
    'tournaments',    (select count(*) from public.tournaments),
    'lig_arsiv',      (select count(*) from public.lig_arsiv),
    'kategori_dogru', (select count(*) from public.kategori_dogru),
    'puanli_profil',  (select count(*) from public.profiles where coalesce(puan,0) <> 0 or coalesce(puan_hafta,0) <> 0),
    'coin_toplam',    (select coalesce(sum(coin), 0) from public.profiles),
    'joker_envanter', (select count(*) from public.joker_envanter),
    'oyuncu_esyalari',(select count(*) from public.oyuncu_esyalari)
  ) into v_once;
  raise notice 'ONCE: %', v_once;

  -- ---- 1) Maç geçmişi (yapraktan köke) ----
  delete from public.soru_degisimleri;      get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;
  delete from public.joker_kullanimlari;    get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;
  delete from public.match_answers;         get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;
  delete from public.match_jokers;          get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;
  delete from public.match_messages;        get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;
  delete from public.matches;               get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;
  delete from public.matchmaking_queue;     get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;

  delete from public.group_match_answers;   get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;
  delete from public.group_match_jokers;    get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;
  delete from public.group_match_messages;  get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;
  delete from public.group_match_players;   get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;
  delete from public.group_matches;         get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;

  delete from public.hizli_cevaplar;        get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;
  delete from public.hizli_oyuncular;       get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;
  delete from public.hizli_maclar;          get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;

  -- ---- 2) Turnuva geçmişi ----
  delete from public.tournament_answers;    get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;
  delete from public.tournament_players;    get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;
  delete from public.tournaments;           get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;
  delete from public.meydan_katilim;        get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;

  -- ---- 3) Lig arşivi ve sıralama geçmişi ----
  delete from public.lig_arsiv;             get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;
  delete from public.kotuye_kullanim_isaretleri; get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;

  -- ---- 4) Maçtan türeyen istatistikler ----
  delete from public.kategori_dogru;        get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;
  delete from public.yanlis_sorular;        get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;
  delete from public.gorulen_sorular;       get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;
  delete from public.calisma_oturumlari;    get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;
  delete from public.hizli_mod_oturumlar;   get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;
  delete from public.hizli_mod_skorlar;     get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;
  delete from public.quest_progress;        get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;
  delete from public.user_badges;           get diagnostics v_n = row_count; v_toplam := v_toplam + v_n;

  -- ---- 5) Profildeki sayaçlar (kimlik, coin ve eşyalar DOKUNULMAZ) ----
  update public.profiles
     set puan = 0,
         puan_hafta = 0,
         toplam_mac = 0,
         sampiyonluk = 0,
         seri = 0,
         son_seri_tarihi = null,
         seri_gun = 0,
         seri_son_gun = null,
         seri_en_uzun = 0,
         turnuva_taci_at = null
   where coalesce(puan,0) <> 0 or coalesce(puan_hafta,0) <> 0
      or coalesce(toplam_mac,0) <> 0 or coalesce(sampiyonluk,0) <> 0
      or coalesce(seri,0) <> 0 or coalesce(seri_gun,0) <> 0
      or coalesce(seri_en_uzun,0) <> 0
      or son_seri_tarihi is not null or seri_son_gun is not null
      or turnuva_taci_at is not null;
  get diagnostics v_n = row_count;
  raise notice 'Sifirlanan profil sayaci: % satir', v_n;

  select jsonb_build_object(
    'matches',        (select count(*) from public.matches),
    'match_answers',  (select count(*) from public.match_answers),
    'group_matches',  (select count(*) from public.group_matches),
    'hizli_maclar',   (select count(*) from public.hizli_maclar),
    'tournaments',    (select count(*) from public.tournaments),
    'lig_arsiv',      (select count(*) from public.lig_arsiv),
    'kategori_dogru', (select count(*) from public.kategori_dogru),
    'puanli_profil',  (select count(*) from public.profiles where coalesce(puan,0) <> 0 or coalesce(puan_hafta,0) <> 0),
    'coin_toplam',    (select coalesce(sum(coin), 0) from public.profiles),
    'joker_envanter', (select count(*) from public.joker_envanter),
    'oyuncu_esyalari',(select count(*) from public.oyuncu_esyalari)
  ) into v_sonra;
  raise notice 'SONRA: %', v_sonra;
  raise notice 'TOPLAM SILINEN SATIR: %', v_toplam;
end
$sifirla$;

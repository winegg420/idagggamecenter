# BİLDİM — Tek oturum görev listesi

> Bağlam sıkışırsa **önce bu dosyayı oku**, ilk işaretsiz maddeden devam et.
> Görev, tüm kutular dolmadan bitmiş sayılmaz.
> Kurallar: Türkçe; minimal değişiklik; mevcut kodu silme; try-catch; migration'lar 47'den
> başlar. **PUSH YOK, deploy YOK, `supabase db push` YOK.**
> Kapsam: yalnız `bildim/`, `src/` kabuğunun Bildim'e dokunan yerleri, Bildim migration'ları.
> `meyvekes/ boks/ kafatopu/ gladius/ run/ patirun/ driftgp/` ve onların tablo/RPC'lerine dokunma.

## Faz 0 — Hazırlık
- [x] `BILDIM_GOREV.md` oluşturuldu
- [x] CLAUDE.md + PROGRESS.md okundu
- [x] `bildim/` altı (sayfalar, bileşenler, lib) okundu
- [x] `20260612000045_lig_ve_kategori.sql` ve `…046_hesap_silme.sql` okundu

## Faz 1 — Gizlilik + takma ad (`20260612000047_takma_ad_gizlilik.sql`)
- [x] 1.1 `profiles` kolonları: `takma_ad`, `takma_ad_secildi`, `avatar_onayli`, `davet_kodu`, `toplam_mac`, `tercih_kategori`
- [x] 1.2 `takma_ad` için büyük-küçük duyarsız unique index (3–16, harf/rakam/alt çizgi)
- [x] 1.3 Mevcut satırlara `davet_kodu` doldur (8 karakter)
- [x] 1.4 Botlar (`is_bot`): `takma_ad = username`, `takma_ad_secildi = true`, `avatar_onayli = true`
- [x] 1.5 `handle_new_user`: username `'oyuncu_' || 8 hex`, avatar Google'dan ALINMAZ, `davet_kodu` üretilir
- [x] 1.6 `yasakli_kelimeler` tablosu + tohum (küfür/hakaret + admin/bildim/bot/moderator)
- [x] 1.7 RPC `takma_ad_sec(p_ad)` — doğrulama, yasaklı kelime, çakışma hatası, 30 gün kilidi
- [x] 1.8 RPC `avatar_onayla(p_url)`
- [x] 1.9 RPC `profil_al()` — kendi tam profili
- [x] 1.10 RPC `tercih_kategori_kaydet(p_kategori)`
- [x] 1.11 `gorunen_ad()` / `gorunen_avatar()` yardımcıları
- [x] 1.12 TÜM Bildim sıralama/lig/maç/turnuva/grup/hızlı/arkadaş RPC'leri `gorunen_*` döndürür (username/avatar_url dönmez) — taranan RPC listesi PROGRESS'te
- [x] 1.13 `revoke select (username, avatar_url) on public.profiles from anon` (authenticated'a dokunma, `profiles_select` politikası değişmez)
- [x] 1.14 RPC `arkadas_davet_kodu_ile_ekle(p_kod)` + `oyuncu_ara` kaldırılır/kilitlenir
- [x] 1.15 `create_challenge` / `create_group_challenge` / `create_hizli_mac`: hedef yalnız arkadaş ya da bot (sunucuda)
- [x] 1.16 `toplam_mac` maç/turnuva bitişlerinde artar + `matches`'tan geriye dönük doldurulur
- [x] 1.17 `lig_siralama` ve `birlesik_siralama` (Bildim kısmı) `toplam_mac >= 1` filtreler; haftalıkta ayrıca `puan_hafta > 0`
- [x] 1.18 `bildirimler` tablosu + RLS (yalnız sahibi) + `bildirimleri_oku()` RPC
- [x] 1.19 Bildirim olayları: (a) ilk maç → "Artık ligdesin", (b) haftalık ligde geçilme (saatte ≤1), (c) gelen meydan okuma (korunur), (d) Pazartesi haftalık sonuç
- [x] 1.20 `npm run build` temiz + PROGRESS eklendi + commit

## Faz 2 — Genel Kültür kategorisi (`20260612000048_genel_kultur_kategori.sql`)
- [x] 2.1 `genel_kultur` `get_categories`'e eklendi, listede en üstte ('genel'e DOKUNULMADI)
- [x] 2.2 Kategori seçicilerde seçilebilir, etiket "Genel Kültür", ikon 🧠
- [x] 2.3 "Hemen Oyna" `tercih_kategori` ile eşleştirir; 20 sn'de eşleşme yoksa karışık
- [x] 2.4 `npm run build` temiz + PROGRESS eklendi + commit

## Faz 3 — 1.500 doğrulanmış soru
- [ ] 3.0 Mevcut tüm `insert into public.questions` taranıp konu listesi çıkarıldı
- [ ] 3.1 Parti 10 — `20260612000049_soru_parti10_genel_kultur.sql` (500 genel_kultur)
- [ ] 3.2 Parti 10 öz denetim + rapor
- [ ] 3.3 Parti 11 — `20260612000050_soru_parti11_genel_kultur.sql` (400 genel_kultur + 100 karışık)
- [ ] 3.4 Parti 11 öz denetim + rapor
- [ ] 3.5 Parti 12 — `20260612000051_soru_parti12_kategoriler.sql` (500: tarih/bilim/coğrafya/edebiyat/spor/sanat/sinema/müzik/teknoloji)
- [ ] 3.6 Parti 12 öz denetim + rapor
- [ ] 3.7 Her partide: şık karıştırma `created_at >= transaction_timestamp()` ile yalnız o parti
- [ ] 3.8 `npm run build` temiz + PROGRESS eklendi + commit

## Faz 4 — Arayüz (`bildim/`)
- [ ] 4.1 Zorunlu akış: takma ad → avatar → şehir (tamamlanmadan oyun ekranı açılmaz)
- [ ] 4.2 Her yerde `gorunen_ad`/`gorunen_avatar`; `username` yalnız kendi profilinde
- [ ] 4.3 Arkadaşlar: arama kalktı; davet linki paylaş + davet kodu gir
- [ ] 4.4 `/bildim/davet/:kod` rotası (giriş yoksa login → kod hatırlanır → otomatik istek)
- [ ] 4.5 Meydan Oku/Grup/Hızlı: rakip yalnız arkadaş + bot
- [ ] 4.6 Kategori seçicide Genel Kültür en üstte; profilde "varsayılan kategorim"
- [ ] 4.7 Bildirim izni bandı ilk açılışta YOK; ilk maç sonucu ekranında sorulur
- [ ] 4.8 Üst çubukta zil + okunmamış sayısı + bildirim listesi
- [ ] 4.9 Profil: takma ad (30 gün kilidi), avatar onayı, davet kodu, varsayılan kategori, gizlilik açıklaması
- [ ] 4.10 `npm run build` temiz + PROGRESS eklendi + commit

## Faz 5 — Kozmetik: "oyun hissi"
- [ ] 5.1 Tipografi: "Baloo 2" başlık + system-ui gövde
- [ ] 5.2 Ana sayfa hiyerarşisi: tek büyük hero + 2 sütun mod kartları + turnuva bandı + küçük lig özeti
- [ ] 5.3 Inline SVG ikon seti (bağımlılık yok), emoji ikonlar değişti
- [ ] 5.4 Özel rütbe rozetleri
- [ ] 5.5 Hareket: stagger giriş, puan sayacı, cevap kartı tepkisi, ligde kendi satırı
- [ ] 5.6 `prefers-reduced-motion` saygısı
- [ ] 5.7 Renk: koyu + mor vurgu + sıcak ikincil yalnız ödül/puan; kontrast ≥4.5; hedef ≥44px
- [ ] 5.8 390px mobil gözden geçirme; alt sekme çubuğu net
- [ ] 5.9 Eski CSS sınıfları silinmedi; yeni sınıflar eklendi
- [ ] 5.10 `npm run build` temiz + PROGRESS eklendi + commit

## Faz 6 — Kapanış
- [ ] 6.1 `npm run build` temiz
- [ ] 6.2 Bu dosyadaki tüm kutular dolu
- [ ] 6.3 PROGRESS.md tarih başlıklı özet (kararlar + gerekçeler + değişen dosyalar + çalıştırma sırası 047→048→049→050→051 + manuel işler)
- [ ] 6.4 Son commit

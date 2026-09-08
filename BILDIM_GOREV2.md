# BİLDİM — Görev 2: Joker ekonomisi + Seri + Rövanş + Ustalık + Hızlı Mod

> Bağlam sıkışırsa **önce bu dosyayı oku**, ilk işaretsiz maddeden devam et.
> Tüm kutular dolmadan görev bitmez.
> Kurallar: Türkçe; minimal değişiklik; mevcut kodu silme; try-catch; migration'lar 052'den.
> **PUSH / deploy / `db push` YOK.** Kapsam: yalnız Bildim.
> Tüm joker/satın alma/ödül kararları SUNUCUDA (security definer RPC).

## Faz 0 — Hazırlık
- [x] `BILDIM_GOREV2.md` oluşturuldu
- [x] CLAUDE.md, PROGRESS.md, BILDIM_GOREV.md okundu
- [x] `bildim/` altı okundu
- [x] Migration 045–051 okundu (özellikle mevcut `use_joker` / `match_jokers`)

## Faz 1 — Veritabanı

### 1A — `20260612000052_joker_ekonomisi.sql`
- [x] 1.1 `joker_envanter(user_id, tur, adet)`
- [x] 1.2 `joker_islemleri(user_id, tur, delta, kaynak, ref, created_at)` — denetim izi
- [x] 1.3 `reklam_odulleri(user_id, gun, sayac)`
- [x] 1.4 `satin_almalar(user_id, urun_id, play_token unique, durum, created_at)`
- [x] 1.5 RPC `joker_kullan(p_mac_tur, p_mac_id, p_soru_index, p_tur)` — maç kuralı + envanter + `elli` için silinecek 2 şık indeksi sunucudan
- [x] 1.6 RPC `reklam_odulu_al(p_reklam_ref)` — günlük tavan 5
- [x] 1.7 RPC `joker_ekle` — yalnız service_role/Edge Function
- [x] 1.8 RPC `envanterim()`
- [x] 1.9 Maç kuralları: lig maçlarında maç başına ≤2 joker, arkadaş maçlarında sınırsız, turnuva finalinde joker kapalı
- [x] 1.10 Ücretsiz `elli`: her maçta 1, birikmez
- [x] 1.11 RLS: yeni tablolar select yalnız sahibi; yazma revoke, RPC ile

### 1B — `20260612000053_seri_rovans_ustalik.sql`
- [x] 1.12 `profiles.seri_gun`, `seri_son_gun`, `seri_en_uzun`
- [x] 1.13 `seri_guncelle()` — maç bitiş akışına bağlı (trigger)
- [x] 1.14 pg_cron 00:05 TSİ `seri_kontrol()` — koruma harca ya da sıfırla + bildirim
- [x] 1.15 `rovans_iste(p_mac_id)` — son 24 saatte kaybedilen maç, aynı kategori
- [x] 1.16 `ezeli_rakip()` — en çok karşılaşılan oyuncu + skor (görünen ad/avatar)
- [x] 1.17 `kategori_dogru(user_id, kategori, dogru_sayisi)` + tüm cevap yollarında +1
- [x] 1.18 `ustalik_seviyelerim()` + seviye atlayınca bildirim/rozet

### 1C — `20260612000054_hizli_mod.sql`
- [x] 1.19 `hizli_mod_oturumlar` + `hizli_mod_skorlar`
- [x] 1.20 `hizli_mod_baslat(p_kategori)` — 60 sn, görülmemiş sorular
- [x] 1.21 `hizli_mod_cevap(...)` — sunucuda süre kontrolü (5 sn/soru)
- [x] 1.22 `hizli_mod_bitir()`
- [x] 1.23 `hizli_mod_siralama(p_kapsam)` — şehir/ülke/dünya, haftalık
- [x] 1.24 Lig puanına GİRMEZ

### 1D — Edge Function
- [x] 1.25 `supabase/functions/satin_alma_dogrula` — Play Developer API `purchases.products.get`, token tekrarı reddi, `PLAY_SERVICE_ACCOUNT` yoksa açık hata (sahte onay yok)

- [x] 1.26 `npm run build` temiz + PROGRESS + commit

## Faz 2 — Arayüz
- [x] 2.1 Soru ekranı joker çubuğu (3 buton + adet rozeti, ücretsiz `elli` işaretli, animasyonlu şık silme, pasifse neden)
- [x] 2.2 Joker Dükkânı sayfası (envanter, video ödülü sayacı, Play paketleri, gizlilik/iade notu)
- [x] 2.3 Maç sonucu: kullanılan jokerler, kaybettiyse büyük Rövanş butonu, seri güncellemesi
- [x] 2.4 Ana sayfa hero: seri sayacı + koruma durumu; "Ezeli rakibin" kartı
- [x] 2.5 Profil: kategori ustalığı ızgarası, en uzun seri, joker istatistikleri
- [x] 2.6 Hızlı Mod: ana sayfa kartı + oyun ekranı (5 sn halka, 60 sn çubuk) + skor/sıralama + kategori seçici
- [x] 2.7 Bildirimler: seri uyarısı (20:00), ustalık atlama, rövanş isteği
- [x] 2.8 `npm run build` temiz + PROGRESS + commit

## Faz 3 — Test + kapanış
- [ ] 3.1 Sunucu kuralı kanıtı: aynı maçta 3. joker reddedilir
- [ ] 3.2 Günde 6. reklam ödülü reddedilir
- [ ] 3.3 Aynı Play token iki kez kabul edilmez
- [ ] 3.4 Seri koruma yalnız 1 gün kapatır
- [ ] 3.5 Turnuva finalinde joker reddedilir
- [ ] 3.6 Testler dosya olarak repoda + çalıştırıldı
- [ ] 3.7 `npm run build` temiz; bu dosyadaki tüm kutular dolu
- [ ] 3.8 PROGRESS.md: kararlar, değişen dosyalar, çalıştırma sırası (052→053→054), Edge Function deploy + secret'lar, Play ürün kimlikleri, Bubblewrap Play Billing bayrağı
- [ ] 3.9 Son commit

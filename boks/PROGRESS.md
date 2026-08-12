# Gölge Boks — Modül İlerleme Kaydı

## 2026-08-12 — Modülün ilk tam sürümü (sıfırdan uçtan uca)

Hub'a **8. oyun** olarak eklendi: `boks/` (rota `/boks/*`, DB öneki `boks_`, ana sayfada
"Gece Antrenmanı" kimliğiyle kart).

### Yapılanlar

**1) Takip motoru**
- `kamera.js`: TEK kamera akışı (960×540 ideal, 60 fps ideal) + rVFC kare döngüsü; el ve poz
  takibi aynı akışa abone olur. *Karar:* iki modül kendi `getUserMedia`'sını açsaydı çift kod
  çözme + bazı cihazlarda "kamera meşgul" hatası olurdu.
- `takip-worker.js` / `takip-cekirdek.js`: Meyve Kes'in worker altyapısının **izole kopyası**
  (meyvekes/ klasörüne dokunulmadı), iki eklemeyle: kare boyutu parametresi ve `asgariAralik`
  (kısma). Poz worker'ı ~30 Hz'e kısılır ve 384 px kareyle beslenir; el tam hızda, 480 px.
- `posetakip.js`: `PoseLandmarker lite` + **kapsam** üretimi (üst gövde / kollar / kalça /
  bacaklar) — adaptif analiz kapsamının kaynağı.

**2) `yumrukTanima.js` — 6 numara sınıflandırma**
- Kol başına durum makinesi: bekle → itme → **darbe** → toparla.
- Sınıflandırma girdileri: derinlik ilerlemesi (ileri), yanal yol, yukarı yol, dirsek açılması.
- Ön/arka el kimliği duruştan gelir → 1..6; **solak modda numaralandırma aynalanır**.
- Gerçek zamanlı gard izleme (her karede) + vuruş anında karşı elin durumu ayrı sayaçta.
- Postür yalnız kalça görünüyorsa üretilir.

**3) `oyun.js` — 4 mod + faz makinesi**
- isinma(18 sn ilk / 8 sn ara) → round → mola → … → bitti.
- Serbest / Koç (gerçek kombinasyon havuzları, zorlukla uzar) / Savunma (telegraph + kaçış-blok
  değerlendirmesi) / Ritim (BPM'e senkron pad + zamanlama bonusu).
- Combo eğrisi: 3-5 ×1.2, 6-9 ×1.5, 10-14 ×1.8, 15+ ×2.2; şiddet çarpanı 0.8-1.3.
- Round başına ham olay sayaçları (`bosIstatistik`) — analiz motorunun tek kaynağı.
- MET tabanlı kalori, anlık tempo, yorgunluk/efor/postür uyarıları, nefes ritmi.

**4) Görsel/ses**
- `render.js`: "Gece Antrenmanı" paleti, mitt pedleri (numara + kalan süre yayı), **darbe halkası**
  (renk/genişlik şiddete göre kırmızı→camgöbeği), AR eldiven (boks/MMA, renk seçimli), gard
  göstergesi, kol zinciri, nefes ve "geçen seferki tempon" şeridi.
- `ses.js`: WebAudio efektleri (gong, deri teması, combo, beat…) + **sesli koç** (tr-TR TTS),
  iki kişilik için ayrı replik setleri.

**5) Antrenör Modu**
- `antrenorAnalizi.js`: 8 boyutlu stil vektörü, 8 arketip (Rus amatör okulu, peek-a-boo, Meksika
  baskı, kontra, düşük gard, kickboks, muaythai, klasik), round/oturum/kariyer raporu, 12 maddelik
  **zayıflık kataloğu** (her biri ölçüt + teknik tavsiye), koçluk karşılaştırması, zorluk önerisi.
- `dovusculKutuphanesi.js`: **248 dövüşçü** (122 boks · 101 MMA/UFC · 25 kickboks/muaythai),
  ağırlıklı mesafeyle eşleştirme + duruş uyumu bonusu.

**6) Veri katmanı ve DB**
- `20260612000044_boks_temel.sql`: 8 tablo, RLS, 5 RPC. `boks_oturum_kaydet` tek çağrıda oturum +
  roundlar + kariyer + streak + skor + sezon + zayıflık takibi + rozetleri atomik yazar; sunucuda
  makul-sınır denetimi yapar.
- `lib/depo.js`: tercih senkronu, **çevrimdışı kuyruk**, kariyer önbelleği, program ilerlemesi.

**7) Büyüme özellikleri**
- Story paylaşım kartı (1080×1920 canvas) + en iyi combo klibi (MediaRecorder, kütüphanesiz),
  günlük streak, 18 rozet, 3 kürasyonlu program (7/14/30 gün), aylık sezon ligi, seviye testi,
  teknik rehberi sayfası, alan-güvenliği kontrol listesi.

### Alınan Kararlar ve Nedenleri

- **Isınma "round başına":** ilk round öncesi 18 sn tam ısınma, sonraki roundlarda 8 sn hazırlık.
  Mola zaten dinlendiriyor; her round önüne 18 sn koymak akışı gereksiz uzatıyordu.
- **Mod bazlı leaderboard:** Serbest/Koç/Savunma/Ritim puan ölçekleri farklı; tek listede
  birleştirmek adaletsiz olurdu. Sezon sekmesi tüm modların puanını toplar.
- **Seviye testi sıralamaya yazılmaz** (`zorluk='test'` skor/sezon güncellemesini atlar).
- **Klip için MediaRecorder:** GIF encoder kütüphanesi eklemek yerine tarayıcının yerel WebM
  kaydı kullanıldı; combo ≥ 5 olduğunda 4 sn kaydeder, daha iyi combo gelirse yeniler.
- **Font:** afiş fontu Google Fonts `@import` ile; çevrimdışında sessizce Impact/Arial Narrow'a
  düşer (offline mod bozulmaz).

### Doğrulama

- `node boks/_test/motor-test.mjs` → **72/72 geçti** (sınıflandırma, güney pençe aynalama, gard,
  faz makinesi ×4 zorluk, puanlama/combo, koç dizisi, savunma kaçış/blok, kalori, analiz kapsam
  kuralı, dövüşçü eşleştirme, rozetler, uçtan uca poz akışı).
- `npm run build` → başarılı; `BoksApp` chunk'ı 140 kB (48 kB gzip), ayrı chunk (diğer oyunlar
  etkilenmiyor).

### Sıradaki İşler

- Gerçek cihazda kamera testi: iPhone/Android'de iki modelin birlikte fps davranışı, HUD teşhis
  rozetindeki `poz/el Hz` değerleri (⚠ ana-thread yedeğine düşülüp düşülmediği).
- Migration Supabase Dashboard'dan uygulanmalı (CLI `db push` bu projede 403 veriyor).
- Haftalık özet push bildirimi (`send-push` Edge Function'a `boks` kancası) — hub geneli görev.
- Hub birleşik sıralamasına `boks_skorlar.en_iyi` eklenmesi (ayrı görev olarak planlandı).

# DriftGP — Tasarım Brief'i (Claude Code için)

**Slogan:** DriftGP — Arcade Racing
**Hedef:** Piyasaya çıkacak kalitede, mobil-öncelikli 3D yarış oyunu
**Geliştirici:** Claude Code (otonom, faz faz, her fazdan sonra kendi kendini test edip düzeltecek)

---

## 1. VİZYON

Telefonu yan (landscape) tutarak oynanan, F1 start ışıklarıyla başlayan, drift mekanikli, 6 kişilik gerçek zamanlı multiplayer pist yarışı oyunu. Kalite hedefi: PatiRun projesinden bariz şekilde daha profesyonel, gerçek bir yarış oyunu (Asphalt 8/9, Need for Speed serisi) hissi.

**KRİTİK KURAL — Marka isimleri:** Hiçbir gerçek otomotiv marka adı, logosu veya birebir kasa tasarımı kullanılmayacak. Tüm araba isimleri kurgudur (aşağıdaki listede). İstatistikler (hız, ivme) gerçek dünya araçlarından esinlenir ama görsel/isim tamamen özgün olmalı. Bu telif/marka hakkı ihlalini önlemek için zorunludur.

---

## 2. TEKNOLOJİ STACK

- **Frontend:** React + Vite + TypeScript
- **3D Engine:** React Three Fiber (Three.js)
- **Backend/Realtime:** Supabase (Realtime channels, Auth — Google OAuth, Database)
- **Deploy:** Vercel
- **3D Asset Kaynağı:** Kenney.nl (CC0 lisanslı, Racing Kit / Racing Pack / Car Kit) — temel geometri buradan alınıp PBR malzeme (parlak boya, cam yansıması, krom jant) ile görsel kalite yükseltilecek
- **Fizik:** Basit ama tutarlı arcade fizik (cannon-es veya rapier gibi bir R3F-uyumlu fizik motoru değerlendirilecek — Fable 5 en uygununu seçip gerekçelendirsin)

---

## 3. OYUN MODU

- **Sadece pist yarışları** (açık şehir/serbest sürüş YOK)
- F1 tarzı start işareti: 5 kırmızı ışık sırayla yanar, hepsi söner, yarış başlar
- Tur bazlı yarış (pist başına tur sayısı ayarlanabilir, varsayılan 3 tur)
- Bitiş sırası + süre tablosu (leaderboard) yarış sonunda gösterilir

---

## 4. KAMERA & KONTROLLER

- **Kamera:** 3. şahıs, arkadan takip (chase camera), hıza göre hafif FOV artışı (hız hissi için)
- **Direksiyon:** Telefonu fiziksel eğerek (gyro/tilt) — cihaz eğim sensörü kullanılacak, kalibrasyon ekranı (oyuncu telefonu düz tutup "sıfırla" diyebilmeli)
- **Gaz:** Otomatik (sürekli ileri) VEYA ekranın sağ tarafına basılı tutma — Fable 5 ikisini de deneyip UX açısından daha iyi olanı seçsin, varsayılan: otomatik gaz + fren için ekranın alt kısmına dokunma
- **Drift butonu:** Ekranda sabit, büyük, kolay erişilebilir bir buton — basılı tutulunca drift moduna girer (Need for Speed'deki Space tuşu mantığı)
- **Nitro/turbo:** Drift sonunda biriken enerjiyle ayrı bir nitro butonu (opsiyonel, Fable 5 kendi tasarım kararını verebilir)

---

## 5. ARABA LİSTESİ (30 Araç)

Her arabanın kendine özgü: top speed, 0-100 ivme süresi, drift kabiliyeti (grip/handling), motor sesi kategorisi olacak. Aşağıdaki tablo gerçek dünya performans verilerinden esinlenerek hazırlanmıştır (isimler kurgu).

| # | Kategori | Kurgu İsim | 0-100 km/s | Top Speed | Ses Profili |
|---|---|---|---|---|---|
| 1 | Hyper | Chiron Ghost | 2.4 sn | 420 km/s | V16 gürleme |
| 2 | Hyper | Jesko Storm | 2.5 sn | 480 km/s | V8 twin-turbo |
| 3 | Süper | SF Rosso | 2.5 sn | 340 km/s | V8 hibrit uğultu |
| 4 | Süper | Huracán Toro | 2.9 sn | 325 km/s | V10 tiz gürleme |
| 5 | Süper | Turbo Wolf | 2.7 sn | 330 km/s | Flat-6 turbo |
| 6 | Süper | McClaw 720 | 2.9 sn | 340 km/s | V8 twin-turbo |
| 7 | Spor | GTR Kaplan | 2.9 sn | 315 km/s | V6 twin-turbo |
| 8 | Spor | Corvette Şahin | 2.5 sn | 330 km/s | V8 Amerikan gürleme |
| 9 | Spor | Supra Kartal | 4.1 sn | 250 km/s | Düz-6 turbo |
| 10 | Kas | Demon Reaper | 1.7 sn | 315 km/s | V8 supercharged |
| 11 | Kas | Mustang Vahşi | 4.8 sn | 260 km/s | V8 Amerikan |
| 12 | Kas | Camaro Boğa | 4.0 sn | 290 km/s | V8 |
| 13 | Sedan | M-Wolf 4 | 3.5 sn | 290 km/s | Düz-6 turbo |
| 14 | Sedan | RS Şimşek | 3.6 sn | 305 km/s | V8 twin-turbo |
| 15 | Elektrikli | Volt Plaid | 2.1 sn | 320 km/s | Elektrik motor uğultusu |
| 16 | Elektrikli | Taycan Şimşek | 2.2 sn | 305 km/s | Elektrik motor uğultusu |
| 17 | Elektrikli | Rivian Yaban | 3.0 sn | 200 km/s | Elektrik motor uğultusu |
| 18 | Arazi | Wrangler Kaya | 7.0 sn | 160 km/s | V6 kaba |
| 19 | Arazi | Defender Fırtına | 6.0 sn | 210 km/s | V8 |
| 20 | Kompakt | Civic Ok | 5.4 sn | 275 km/s | 4 silindir turbo |
| 21 | Elektrikli Pickup | Cyber Kaya | 2.7 sn | 210 km/s | Elektrik motor uğultusu |
| 22 | Polis | Devriye X | 4.9 sn | 240 km/s | V8, siren efekti |
| 23 | Ambulans | Acil Şahin | 5.5 sn | 200 km/s | V8, siren efekti |
| 24 | Taksi | Sarı Kartal | 8.0 sn | 195 km/s | 4 silindir standart |
| 25 | Roadster | Rüzgar MX | 6.5 sn | 210 km/s | 4 silindir spor |
| 26 | Sedan Spor | Alfa Kartal | 3.8 sn | 285 km/s | V6 İtalyan |
| 27 | Lüks GT | Gölge Aston | 3.9 sn | 300 km/s | V12 |
| 28 | Kompakt | Mini Şimşek | 6.1 sn | 230 km/s | 4 silindir turbo |
| 29 | Rally | Orman Kurdu | 4.6 sn | 255 km/s | Boxer-4 turbo |
| 30 | Flagship Hyper | Toro Nihai | 2.5 sn | 350 km/s | V12 hibrit |

**Not:** Polis/Ambulans/Taksi araçları "özel konsept" olarak eğlence amaçlı dahil edilmiştir, gerçekçi acil durum aracı davranışı simüle etmez — sadece görsel tema farkı.

---

## 6. ARABA SEÇME EKRANI

- Kart görünümü (Forza/Asphalt tarzı): araba görseli, isim, kategori rozeti, top speed, 0-100 süresi net şekilde gösterilir
- Filtre/sıralama: kategoriye göre, hıza göre
- Kilit sistemi: bazı arabalar XP/rank ile açılabilir (Fable 5 dengeli bir kilit açma eğrisi tasarlasın)

---

## 7. KİŞİSELLEŞTİRME SİSTEMİ

Her başlıkta minimum 2-3 farklı görsel varyant olacak. Oyuncular özelleştirdikleri arabayı kaydedip o haliyle yarışabilecek.

| # | Kategori | Varyant Sayısı |
|---|---|---|
| 1 | Kaporta rengi | Sınırsız (renk seçici) + metalik/mat/parlak |
| 2 | Jant tasarımı | 3 model |
| 3 | Lastik deseni | 3 tip (yol/drift/yarış) |
| 4 | Egzoz | 3 tip |
| 5 | Ön tampon/splitter | 2 |
| 6 | Arka spoiler | 3 |
| 7 | Yan etek | 2 |
| 8 | Kaput | 2 (standart/karbon) |
| 9 | Cam filmi tonu | 3 |
| 10 | Far/arka lamba rengi | 3 |
| 11 | Vinil/dekal | 3 |
| 12 | Nitro/turbo efekt rengi | 3 |
| 13 | Gösterge paneli teması (UI) | 2 |

---

## 8. MULTİPLAYER MİMARİSİ

- **Eş zamanlı oyuncu sayısı:** 6 kişi/oda
- **Kullanıcı listesi:** Kayıtlı tüm kullanıcılar bir listede görünür, listeden direkt oda davetiyesi gönderilebilir
- **Matchmaking:** Tanımadık oyuncularla otomatik eşleşme sistemi (rastgele oda bulma/oluşturma)
- **Realtime senkronizasyon:** Supabase Realtime channels ile pozisyon/hız/drift durumu senkronize edilecek
- **Bağlantı kopma senaryosu:** Fable 5, bir oyuncunun bağlantısı koptuğunda diğer 5 kişinin yarışının etkilenmemesini sağlayacak mantığı tasarlasın

---

## 9. İLERLEME SİSTEMİ

- PatiRun'daki gibi **XP + rozet + rank** sistemi
- Yarış sonu XP kazanımı: sıralama, drift puanı, tamamlama süresine göre
- Rank ilerledikçe yeni araba/özelleştirme parçası kilidi açılır
- Rozet örnekleri: "İlk Zafer", "Drift Ustası", "10 Yarış Tamamla" vb. (Fable 5 tam listeyi oluşturabilir)

---

## 10. HARİTALAR / PİSTLER

Minimum 4 farklı tematik pist:
1. **Şehir Pisti** — gece şehir silüeti, ışıklı binalar
2. **Volkanik Pist** — patlayan volkan, akan lav efektleri (yüksek kaliteli partikül sistemi — PatiRun'daki gibi düşük kalite OLMAYACAK)
3. **Kıyı/Sahil Pisti** — açık hava, deniz manzarası
4. **Orman/Dağ Pisti** — rally tarzı, ağaçlık arazi

Her pist F1 start ışıklarıyla başlar, tur sayısı ayarlanabilir.

---

## 11. GÖRSEL KALİTE HEDEFLERİ

- Çevre objeleri (bina, ağaç, volkan, lav) PatiRun'dan **belirgin şekilde** daha detaylı ve kaliteli olacak
- Işıklandırma: dinamik gölgeler, gece sahnelerinde neon/şehir ışığı yansımaları
- Partikül efektleri: lav akışı, drift dumanı, nitro alevi, toz/kir sıçraması
- Giriş ekranı ve XP/rozet gösterimi profesyonel UI/UX standardında (basit/amatör görünüm kabul edilmez)

---

## 12. SES TASARIMI

- Kategoriye göre 3 ana motor sesi profili: V8/V10 gürleme, elektrikli motor uğultusu, 4 silindir turbo
- Drift sesi (lastik cızırtısı), çarpışma sesi, nitro sesi ayrı ayrı
- Polis/ambulans arabalarında siren efekti (opsiyonel açma/kapama)

---

## 13. GELİŞTİRME FAZLARI (Fable 5 için)

Fable 5 her fazı bitirdikten sonra kendi kendini test edip, bulduğu sorunları çözmeden bir sonraki faza GEÇMEYECEK.

**Faz 1 — Temel Altyapı**
- Proje kurulumu (Vite + R3F + TS + Supabase bağlantısı)
- Tek araba, tek pist, temel sürüş fiziği (gyro kontrolü + drift butonu)
- Test: Araba sorunsuz sürülebiliyor mu, gyro kalibrasyonu çalışıyor mu

**Faz 2 — Araba Sistemi**
- 30 araba, farklı istatistiklerle (hız/ivme/drift kabiliyeti)
- Araba seçme ekranı (kart görünümü, istatistik gösterimi)
- Test: Her araba gerçekten farklı hissediyor mu, istatistikler doğru yansıyor mu

**Faz 3 — Kişiselleştirme**
- 13 özelleştirme kategorisi, çoklu varyant sistemi
- Kayıt/kaydetme (Supabase'e kişiselleştirme verisi)
- Test: Tüm parçalar doğru render ediliyor mu, kayıt sonrası veri kalıcı mı

**Faz 4 — Pist ve Ortam**
- 4 tematik pist, F1 start sistemi, tur sayacı
- Görsel efektler (volkan/lav, partikül sistemleri)
- Test: Performans (FPS) mobilde kabul edilebilir mi, çarpışma/duvar sınırları çalışıyor mu

**Faz 5 — Multiplayer**
- Supabase Realtime entegrasyonu, 6 kişilik oda sistemi
- Kullanıcı listesi + davet sistemi
- Matchmaking (rastgele eşleşme)
- Test: 6 kişi aynı anda senkronize sürebiliyor mu, bağlantı kopması durumları test edilmeli

**Faz 6 — İlerleme Sistemi**
- XP/rozet/rank mantığı, kilit açma sistemi
- Giriş ekranı, profil/istatistik ekranı
- Test: XP doğru hesaplanıyor mu, kilitler doğru açılıyor mu

**Faz 7 — Cilalama (Polish) ve QA**
- Ses entegrasyonu
- UI/UX son rötuşlar
- Tüm fonksiyonların uçtan uca testi
- Test: Tam bir yarış senaryosu (giriş → araba seç → özelleştir → oda kur/katıl → yarış → sonuç ekranı) sorunsuz tamamlanabiliyor mu

---

## 14. PROGRESS.md PROTOKOLÜ

Mevcut global `~/.claude/CLAUDE.md` kuralına uygun olarak, her fazda `PROGRESS.md` güncellenecek: hangi faz tamamlandı, hangi testler yapıldı, hangi sorunlar bulunup çözüldü.

---

## 15. AÇIK KALAN KARARLAR (Fable 5 kendi inisiyatifiyle doldurabilir)

- Fizik motoru seçimi (cannon-es / rapier / custom)
- Gaz kontrolü detayı (otomatik vs dokunmatik)
- Rozet listesi tam detayları
- Kilit açma eğrisi (hangi araba kaç XP'de açılır)
- Nitro/turbo mekaniği detayları

Bu kararlar için kullanıcıya sorulmayacak, Fable 5 profesyonel oyun geliştirme pratiklerine göre en mantıklı seçimi yapıp `PROGRESS.md`'ye gerekçesini not edecek.

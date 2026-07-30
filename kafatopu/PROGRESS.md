# Kafa Topu — Modül İlerleme Günlüğü

> Özet günlük. **Ayrıntılı oturum-oturum geçmiş** repo kökü `PROGRESS.md`'de (2026-07-15 → 07-17, ~20 oturum).

## Modül durumu

- **Oynanış:** 1v1 & 2v2, ranked (ELO, taban 1000) + hızlı maç, özel oda/davet, antrenman botu (rakip seçimli). Ligler: Bronz/Gümüş/Altın/Platin/Elmas.
- **Fizik:** Matter.js, saha 1000x560, Head Ball hissi (yerçekimi 2.0, zıplama tepe ~140px). Zıplama/uçma bug'ları kök-nedenden çözüldü (deterministik yerdeMi()).
- **Multiplayer:** host-otoriter, 20Hz durum yayını, interpolasyon, kopma telafisi (hükmen). Skor: iki-taraflı onay + `FOR UPDATE` (sahtecilik kapalı, migration `20260612000037`).
- **Foto kafalar:** İda + Baran + Aykut + Emirhan + Adenis — arka plan silme + karikatürize (v1: posterize+kontur) araç zinciri (`scripts/kafatopu-karikatur.mjs`). manifest odak/yarıçap ile daire kırpma.
- **Mobil/iOS:** native touch (çoklu parmak), webkit fullscreen (yalnız destekleyen cihazda), wake lock, alpha:false, statik sahne bake + **kafa sprite bake** (kök-neden kasma düzeltmeleri), uyarlanabilir kalite merdiveni (çizim süresine göre), fit-to-viewport/tam ekran, dokunmatik tuş ergonomisi (kullanıcı onaylı düzen).

## Migration'lar (repo kökü)

- `20260612000035_kafatopu_temel.sql` — profiller/kuyruk/maclar/mac_oyunculari + eşleşme/ELO RPC'leri
- `20260612000036_kafatopu_odalar.sql` — özel oda/davet
- `20260612000037_kafatopu_skor_onay.sql` — iki-taraflı skor onayı (sahtecilik kapatma)

## Test

`node kafatopu/_test/motor-test.mjs` → 27 test (son çalıştırma: 27/27 ✓). ELO JS eşleniği SQL ile senkron tutulur.
`node kafatopu/_test/cizim-test.mjs` → 13 iddia (13/13 ✓). Çizim yolunun iPhone performans
kök nedenlerini kilitler: kare başına clip() / büyük ölçek-küçültme / canvas tahsisi sıfır olmalı.

## Hub taşıması (2026-07-22)

idaGG Game Center'a entegre; ELO puanı birleşik sıralamaya (`birlesik_siralama()`) katılır. Ayrıntı kök `PROGRESS.md`.

## Kalan / manuel

- Gerçek 2 cihazla online 1v1/2v2 + kopma senaryosu testi (kullanıcıda).

## 2026-07-24 — Misafir tarafı takılma + girdi gecikmesi

- `net/interpolasyon.js`: sabit 120 ms tampon → **jitter'a adaptif** (70-260 ms; yukarı hızlı,
  aşağı yavaş uyum). Paket gecikirse son iki paketin hızıyla **90 ms'ye kadar ekstrapolasyon**
  (donma/zıplama yerine akış). Tek paket durumunda snap'in kopyası döner (tüketici mutasyonu
  orijinali bozmasın).
- `app/pages/MacPage.jsx`: misafirde **girdi gecikmesi maskeleme** — kendi kafan tuşa anında tepki
  verir; yalnız görsel yatay ofset, her karede `0.94^kare` sönümlenir, ±1.1 kafa yarıçapı ile
  sınırlı. Otorite host'ta kalır (skor/fizik değişmedi), sapma birikmez.
- Motor testleri 27/27 ✓ (regresyon yok). Gerçek 2 cihaz testi kullanıcıda.

---

## 24 Temmuz 2026 — 2 yeni foto kafa + görsel kasma düzeltmesi

`emirali` (Emir Ali) ve `bedo` (Bedo) `public/heads/manifest.json`'a eklendi. Görseller 2250×3000 / ~3 MB idi (yavaş operatörde kasma) → 825×1100 JPEG, ~120 KB (~25× küçük). Tam foto oldukları (şeffaflık yok, daireye kırpılıyor) için JPEG güvenli; manifest `.jpg`'ye güncellendi. Host-otoriter senkron modeli değişmedi (erken başlama sorunu bu oyunda yok).

---

## 25 Temmuz 2026 — Ağ hız sınırına pay bırakıldı

`AG.DURUM_HZ_MS` / `AG.GIRDI_HZ_MS` 50 ms (=20 msg/sn) idi; Supabase istemci sınırı
`eventsPerSecond: 20` ile TAM örtüşüyordu. Kare jitter'ı iki gönderimi aynı saniye penceresine
sıkıştırdığında sunucu mesajı düşürüyor (misafirin girdisi ya da bir durum karesi kayboluyor →
seyrek "senkron bozulması"). 56 ms'e (~17.8/sn) çekildi, %11 pay bırakıldı; misafir
interpolasyon gecikmesi (120 ms) bu aralığı zaten yutuyor. Motor testleri 27/27 ✓.

Host-otoriter model gereği maç başlangıcı zaten senkron: geri sayım host simülasyonundan gelir,
misafir kendi saatiyle başlangıç hesaplamaz (bu oyunda "erken başlama" bug'ı yok).

---

## 26 Temmuz 2026 — iPhone kasması: kalan kök nedenler kapatıldı

Statik sahne pişirmesi (24 Tem) arka planı çözmüştü ama **kare başına kalan iş** hâlâ
Safari'nin iki en pahalı yolundan geçiyordu. Ölçüm (`_test/cizim-test.mjs`, canvas mock'u):

| | eski | yeni |
|---|---|---|
| kare başına `clip()` | 2 (1v1) / 4 (2v2) | **0** |
| kare başına büyük ölçek-küçültmeli `drawImage` | 2 / 4 | **0** |
| kare başına canvas komutu (foto kafa) | 132 | 112 |
| kare başına canvas komutu (kurgusal kafa) | 178 | 125 |

**1. Kafa sprite pişirmesi** (`engine/kafaCizim.js`) — asıl kalem.
Kafa her karede daire `clip()` + 1100 px PNG'den ~150 px'e `drawImage` ile çiziliyordu
(kurgusal kafalarda bunun yerine ~80 path komutu). Safari'de non-rect clip maske katmanı
ayırıp GPU komut kuyruğunu boşaltıyor — oyuncu başına, kare başına. Artık kafa
`(kafaId, takım, bakış, yarıçap, cihaz ölçeği)` anahtarıyla küçük bir tuvale **bir kez**
pişiriliyor; kare başına tek `drawImage` kalıyor. Aura'lar nabız attığı için canlı çiziliyor.
`SPRITE_PAY = 1.45` — saç/sakal kafa dairesinin dışına taştığı için pay bırakıldı.

**2. Düz arka plan modu** (`engine/render.js`) — `duzArkaplanAyarla(true)` ile 3 parallax
katmanı + kaplama tek opak tuvale pişer: kare başına tam ekran blit **4 → 1**.

**3. Uyarlanabilir kalite merdiveni** (`app/pages/MacPage.jsx`) — eski ölçüt yalnız rAF
hızına bakıyordu; 120Hz ProMotion'da rAF 120'de kalıp çizim 16 ms'i aşabiliyordu, yani
zayıf durum hiç görülmüyordu. Artık **çizim süresinin kendisi** ölçülüyor. Adımlar:
1 → parallax kapalı, 2/3 → çözünürlük %85 / %70. 1200 ms'lik pencere, üst üste **iki** kötü
pencere şartı (sekmeye dönüş gibi tek hıçkırık kaliteyi düşürmesin). Düşük Güç Modu rAF'i
30Hz'e kilitlediği için kare hızı düşükken de yalnız çizim payı anlamlıysa (>6 ms) adım iner.

**4. Gereksiz canvas yeniden tahsisi** — iOS Safari adres çubuğu/klavye hareketinde
`visualViewport resize`'ı sürekli tetikliyor; `boyutlandir()` her seferinde `canvas.width`'e
**aynı** değeri atıyordu. Aynı değeri atamak bile arka tamponu sıfırlıyor (kare kaybı).
Ölçü değişmediyse artık çıkılıyor.

**5. Kare başına `clearRect` kaldırıldı** — arka plan (pişirilmiş ya da doğrudan yol) her
koşulda opak olarak tüm ekranı kaplıyor; kanıtlanabilir kaplama için en arka katmana ve
doğrudan çizim yoluna opak taban eklendi. Bir tam ekran işlemi eksildi.

**6. iPhone'da boşa tam ekran denemesi** — iPhone Safari (video dışı) fullscreen API'sini
desteklemez; `requestFullscreen`/`webkitRequestFullscreen` yokken **her dokunuşta** boşa
promise + `orientation.lock` denemesi yapılıyordu. Destek yoksa dinleyici artık bağlanmıyor.

**7. Bellek** — cihaz çözünürlüğündeki pişirikler ~25 MB tutabiliyor (iOS'ta bellek
baskısı = sekme kasması/yeniden yüklenmesi). Maçtan çıkışta `pisirikBosalt()` +
`kafaOnbellegiBosalt()` ile hemen bırakılıyor; sonraki maçta geri sayım sırasında pişiyor.
Yeniden pişirmede de eski tuvaller `width/height = 0` ile serbest bırakılıyor.

**Test:** yeni `_test/cizim-test.mjs` (13 iddia) kök nedenleri kilitliyor — kare başına
clip/büyük-ölçek/canvas-tahsisi sıfır olmalı. `_test/motor-test.mjs` 27/27 ✓, build ✓.
Fizik, skor, ELO ve ağ mantığına dokunulmadı.

**Günlük düzeltmesi (24 Tem kaydı):** `emirali`/`bedo` görselleri JPEG'e çevrilmemiş, PNG
kalmış (570×760, 255-325 KB); manifest de `.png` gösteriyor. Küçültme yapılmış, format
değişikliği yapılmamış. Kafa sprite bake'i geldiği için kaynak boyutu artık kare başına
maliyete girmiyor (yalnız ilk pişirmede okunuyor), o yüzden dosyalara dokunulmadı.

---

## 30 Temmuz 2026 — Yeni kafa "ege" + bot zorluk dengesi

**Yeni foto kafa `ege`:** ham 2250×3000 / 4.4 MB fotoğraf, emirali/bedo hattından geçirildi
(rembg `u2net_human_seg` + alpha matting → en büyük bağlı bileşen → alfa sertleştirme →
760 px, PNG optimize) → **282 KB**. Manifest odak değerleri ölçülerek belirlendi:
`odakX 0.48 / odakY 0.42 / yaricap 0.46`. (İlk verilen `0.50/0.36/0.34` daire içinde çeneyi
kesiyordu — `kafaCizim.js` kırpma matematiği simüle edilerek doğrulandı.)

**Bot zayıflatması (`engine/bot.js`):** bot pratikte yenilmiyordu; kök neden insanüstü tepki
(120 ms) + kale ağzında **koşulsuz** temizleme vuruşu. Yeni `BOT` bloğu: `TEPKI_MS 205`,
`HATA 44`, `VURUS_MESAFE ×0.84`, `TAHMIN_KATSAYI 1.8`, `VURUS_SANS 0.45`, `ACIL_SANS 0.82`,
`ZIPLA_SANS 0.72` (karar anında kilitlenir), `GUC_SANS 0.008`, ve yeni `DALGINLIK_SANS 0.08 /
DALGINLIK_MS 380` (kısa süre hiç girdi üretmez). Tüm zorluk tek blokta — ileride zorluk
seçici eklenecekse buradan parametrelenir.

**Ölçüm:** eski bot vs yeni bot 20 maç 1v1 → **20.4 - 8.3**. `motor-test.mjs` 27/27 ✓, build ✓.

# BİLDİM — "AI yapımı" görünümünü kırma paketi (görev listesi)

Kapsam: yalnız `bildim/` + paylaşılan giriş sayfası ve manifest.
Ayrıntılı ölçümler: `PROGRESS.md` → "2026-09-09 (3. tur)".

- [x] **1. Palet — mor tamamen kalktı**
      Gece lacivert (#0B1220 → #131C31) + altın (#F2B23C), mercan (#E8543F),
      başarı (#2FBF71), bilgi (#4A9DD9). `grep -ri "8b5cf6|7c4dff|a78bfa|6d28d9|..."`
      → **0 sonuç**. Gradient 184 → 22 satır (**%88 azalma**); renkli glow yalnız
      birincil eylem butonunda. theme-color + iki manifest #0B1220.
- [x] **2. Emojiler silindi, özel ikon seti geldi**
      `Ikon.jsx` **41 çizgi ikon** (2px kontur, currentColor, 24px kutu),
      `KategoriIkon.jsx` **12 dolgu kategori ikonu** (kendi renginde plakada).
      Emoji satırı 309 → 15; kalan 15: 5 kod yorumu, 2 ülke bayrağı (bilgi),
      8 maç içi tepki satırı (kullanıcı içeriği — kalması isteniyordu).
- [x] **3. Açıklama metinleri silindi**
      Mod kartlarındaki 6 slogan ("Arkadaşını yen", "60 saniye", "3-5 kişi",
      "Son kalan kazanır", "Güçlen", "Sıranı gör") + 5 yardımcı cümle kaldırıldı
      ya da kısaltıldı. Buton metinleri kısaldı ("Lobiye katıl", "Meydan oku",
      "Hemen oyna", "Rövanş iste").
- [x] **4. Kart kalıbı kırıldı**
      Hero kenarlıksız/tam genişlik; mod ızgarası dengesiz (ilk ve son kart
      çift genişlikte, diğerleri 1.45:1 küçük kart, boşluk 8px); turnuva yatay
      bant (sayaç solda, buton sağda); lig özeti üç sütunluk ince bant; günlük
      görevler katlanmış tek satır. Dikey boşluklar ~%30 azaldı.
- [x] **5. Arka plan dokusu**
      Nokta deseni yerine 135° ince köşegen çizgi (opaklık 0.03), aşağı doğru
      maskeli sönüm; üstte tek altın radyal ışık, altta koyulaşma. Görsel dosya yok.
- [x] **6. Logo — çizilmiş wordmark**
      `Logo.jsx`: kalın harfler + altın, eğik "!" + altta ince altın çizgi.
      Üst çubukta ve giriş ekranında kullanılıyor.
- [x] **7. Maskot yeniden çizildi**
      Yuvarlak-şirin baykuş yerine köşeli/geometrik kuş: lacivert gövde,
      altın gaga ve boynuzlar, gözler iki daire. Üç poz korundu.
      Varsayılan boyut 96 → 64 (odak değil aksan).
- [x] **8. Ses**
      `ses.js` genişletildi: dokunuş kliki, doğru/yanlış, son 5 sn tik,
      süre doldu, maç kazandın arpeji, rütbe atlama. Üst çubukta aç/kapa
      düğmesi (`SesDugmesi.jsx`), tercih localStorage, varsayılan AÇIK,
      AudioContext ilk dokunuşta try-catch ile açılıyor.
- [x] **9. Detay temizliği**
      Yarıçap karışık (kart 12px, buton 10px, rozet tam yuvarlak); gölgeler düz
      siyah/düşük opaklık; başlık fontu yalnız hero + mod adlarında; büyük harf
      yalnız küçük etiketlerde.

## Doğrulama (Chrome, derlenmiş CSS)
- 360 / 390 / 412 / 768 / 1280 px: **yatay taşma yok**, 44px altı dokunma
  hedefi **yok**.
- Kontrast (WCAG AA ≥ 4.5): gövde 7.83 · küçük etiket 6.23 · puan 9.99 ·
  başlık 16.35 · lig etiketi 5.20 · liste detayı 6.54 · turnuva etiketi 5.20.

## Kapanış
- [x] Build temiz
- [x] commit + PUSH

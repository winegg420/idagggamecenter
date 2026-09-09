# BİLDİM — REVİZE PAKETİ #3 (görev listesi)

Canlı test tarihi: 9 Eylül 2026. Kapsam: yalnız `bildim/` + paylaşılan giriş sayfası.
Ayrıntılı doğrulama sonuçları: `PROGRESS.md` → "2026-09-09 — Revize Paketi #3".

## Kullanıcı bildirimleri (paket dışı, aynı turda)
- [x] A. Mobilde bildirim ziline basınca panel yarım açılıyor
      → panel `createPortal` ile body'ye taşındı, `position: fixed`, z-index 1201
- [x] B. Maçta son 5 saniyede ses yok
      → `bildim/lib/ses.js` (WebAudio); tik / doğru / yanlış / süre doldu sesleri
        + Profil'de aç-kapa
- [x] C. Twitter (X) / Facebook girişini aktif et — **kod hazır, panel anahtarı kapalı**
      → canlı uçta doğrulandı: twitter 400, facebook 400, google 302.
        Supabase panelinden açılması gerekiyor (bkz. PROGRESS "Kalan iş").
- [x] D. Misafir girişini aktif et — **kod hazır, panel anahtarı kapalı**
      → `signInAnonymously()` düğmesi eklendi; canlı uç
        `422 anonymous_provider_disabled` döndürüyor, panelden açılmalı.

## Revize paketi #3
- [x] 1. Hızlı Olan Kazanır'da insan hiç kazanamıyor
      → gecikme (maç, soru, bot) için sabitlendi + zorluk pencereleri + kavrama payı.
        Simülasyon: en zorlu senaryoda 17.1/20 (eski: 4.1/20). GEÇTİ.
- [x] 2. "Joker yok" yazıyor ama maçta joker çubuğu var
      → (a) seçildi: çubuk bu modda gizlendi, metin aynen kaldı.
- [x] 3. Turnuva lobisi ölü görünüyor
      → `turnuva_lobi_botlari()` + 10 dk'lık cron; 90 dk kala 3 bot (doğrulandı).
- [x] 4. Hızlı Mod'da süre bitişi sert
      → `SureDolduGecis` perdesi (0.8 sn); 1v1, grup ve hızlı maç bitişine de eklendi.
- [x] 5. Bekleyen davetler birikiyor, temizlenmiyor
      → `eski_davetleri_temizle()` + saatlik cron + sayfa açılışı; son 5 davet +
        "Tümünü iptal et". Canlıda 3 eski davet temizlendi.
- [x] 6. Sıralamada kendi satırı yazımı
      → `SenRozeti` bileşeni; 11 yerde metin birleştirmesi kaldırıldı.

## Kapanış
- [x] Build temiz (`npm run build` — hata yok)
- [x] Migration canlıya uygulandı (`20260612000074_bot_zorluk_lobi_davet.sql`)
- [x] PROGRESS.md doğrulama sonuçları
- [x] commit + push

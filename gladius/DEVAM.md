# GLADIUS — DEVAM REHBERİ (yarım kalan işler + nasıl devam edilir)

> Bu dosya tek başına yeterli özet. Yeni bir oturumda önce bunu, sonra PROGRESS.md +
> GLADIUS_TASARIM.md + SANAT_VARLIKLARI.md okunmalı. Kod GitHub'da güvende
> (repo: **winegg420/Bildim-**, dal: **main**, commit: **062b750**).

---

## 1) ŞU AN NE DURUMDA (BİTEN)
Bildim içinde izole `/gladius` modülü — GitHub'da + Vercel'de **canlı** (production).
**Tek-oyunculu (bot'lu) oyun iki modda baştan sona oynanıyor:**
- **Battle Royale:** karakter/silah/kalkan seç → "HAZIR OL" borazanı →
  maymun istilası → boğa hücumu → zincirli aslanlar (daralan alan) → gladyatör düellosu
  → ateş çemberi → son ayakta kalan → zafer ekranı (rozet/lig/istatistik + "Tekrar Oyna").
- **Deathmatch:** tehditsiz sınırsız dövüş + Altın Dakika (çift hasar) + rastgele alev + kill streak.
- **Ortak:** itemler (can/hız/silah/kalkan/zırh/güç), kill feed, kan/ceset izleri,
  WebAudio ses efektleri, 15 gladyatör, yerel rozet/lig/istatistik (localStorage).
- **Sprite altyapısı hazır:** `assets/img/`'e doğru adla PNG koyunca otomatik kullanılır;
  yoksa kod-çizim yedeği (şu an tümü kod-çizim).

---

## 2) YARIM / YAPILMAMIŞ İŞLER (öncelik sırasıyla)

### A. SANAT — EN KRİTİK (İda görsel üretecek)
- `SANAT_VARLIKLARI.md`'deki PNG'leri üret → `gladius/assets/img/` içine koy.
  Öncelik: **arena.png → aslan/boga/maymun.png → gladyator_*.png → silah/kalkan/item ikonları.**
- Gerçek ses dosyaları: `assets/ses/` + `engine/ses.js`'i dosya çalacak şekilde güncelle
  (şu an WebAudio sentezi).

### B. BEKLEYEN ÖZELLİKLER (kod — DB/dış kaynak gerekmez, hemen yapılabilir)
- **Günlük görev/seri arayüzü** (`lib/istatistik.js`'te `gunlukSeri`/`sonGiris` alanları hazır).
- **Hızlı iletişim** (emoji + hazır Gladius mesajları) — arena içi baloncuk.
- **Sıralama/Ligler ekranı** (şu an `StubPage`) → kayıtlı istatistik + rozet koleksiyonu göster.
- **Arkadaşlar ekranı** (`StubPage`) → Bildim arkadaş/davet altyapısı.
- **Ayarlar ekranı** (`StubPage`) → ses aç/kapa, bildirim.
- **Karakter kişiselleştirme genişletme** (miğfer, amblem, zırh rengi, pelerin, dövme —
  GLADIUS_TASARIM 3.2.2 / 3.2.2.1).
- **Maç öncesi stilize sinematik** (GLADIUS_TASARIM 3.5.1).

### C. ÇOK-OYUNCULU (BÜYÜK — dış kaynak gerekli)
- **PatiRun** (`github.com/winegg420/PatiRun`) `roomClient.ts` + `interpolation.ts`
  referansıyla **presence+broadcast** net katmanı (aynı anda birden fazla gerçek oyuncu).
- Matchmaking (Hızlı Eşleşme + Oda Kur), 1 dk reconnect, senkron başlangıç (GLADIUS_TASARIM 3.11/3.12).
- Lag compensation / server-rewind vuruş doğrulama (3.10).

### D. VERİTABANI + SUNUCU DOĞRULAMA (ONAY GEREKTİRİR)
- `supabase/migrations/20260612000034_gl_temel.sql` var ama **DB'ye uygulanmadı.**
  `npx supabase db push` → `gl_` tabloları (leaderboard/profil/günlük kalıcılığı).
- Sonra `lib/secim.js` + `lib/istatistik.js`'i `gl_profil_al`/`gl_profil_kaydet` ile buluta senkronla.
- **Süper admin yetkileri** (pelerin/2x saldırı/güçlü kalkan/canlandırma — 3.2.6): sunucu
  taraflı doğrulama gerektirir → DB'den sonra.

---

## 3) ONAY GEREKEN (RİSKLİ) İŞLEMLER
- ⏳ **`npx supabase db push`** — canlı veritabanına gl_ tablolarını uygular. HENÜZ YAPILMADI.
- ✅ **`git push` (Vercel deploy)** — YAPILDI (commit 062b750).

---

## 4) NASIL DEVAM EDERİM (pratik)
1. **Kod GitHub'da güvende.** Başka makinede/sonra:
   ```
   git clone https://github.com/winegg420/Bildim-.git   # (veya mevcut klasörde: git pull)
   cd Bildim-
   npm install
   npm run dev
   ```
2. **Test (giriş gerekmez):**
   - Arena: `http://localhost:5173/gladius/_test/motor-test.html`
   - Karakter/silah yakın çekim: `http://localhost:5173/gladius/_test/onizleme-test.html`
   - (Sekmeye tıkla ki animasyon aksın — tarayıcı arka planda duraklatır.)
3. **Gerçek oyun:** `http://localhost:5173/gladius` (Bildim Gmail girişi arkasında) veya canlı sitede `/gladius`.
4. **Bana devam ettirmek için** şu tek cümle yeter:
   > "gladius/DEVAM.md ve PROGRESS.md'yi oku, [şu madde] ile devam et."
   Örn: "…, 2.B'deki Sıralama/Ligler ekranını yap" veya "assets/img/'e arena.png koydum, entegre et."

---

## 5) DOSYA HARİTASI
- `gladius/CLAUDE.md` — modül kuralları · `GLADIUS_TASARIM.md` — tam oyun spec'i (dokunma, referans)
- `gladius/PROGRESS.md` — karar/iş günlüğü (her oturumda güncellenir)
- `gladius/SANAT_VARLIKLARI.md` — sprite listesi + dosya adları + AI promptları
- `gladius/DEVAM.md` — bu dosya
- `gladius/app/` — React sayfaları (Menu, ModeSelect, Character, Arena, Stub) + GladiusApp + styles
- `gladius/engine/` — motor, durum, dovus, tehditler, karakterCizim, itemCizim, render, ses, girdi
- `gladius/lib/` — host (Bildim köprüsü), secim, istatistik, varliklar (sprite yükleyici)
- `gladius/shared/` — sabitler, denge, karakterler, itemler
- `gladius/assets/img/` — sprite PNG'leri (buraya konur)
- `supabase/migrations/20260612000034_gl_temel.sql` — gl_ tabloları (uygulanmadı)
- Bildim'e tek dokunuş: `src/App.jsx` içindeki `/gladius/*` lazy rotası

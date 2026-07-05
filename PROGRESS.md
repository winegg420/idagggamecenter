# Bildim! — Proje İlerleme Kaydı

## 2026-07-05 — 3 Revizyon + Ana Sayfa Yeniden Tasarımı

### 1) Grup Maçı 5 kişiye çıkarıldı
- **Migration:** `20260612000031_grup_5_kisi.sql`
- `group_matches.oyuncu_sayisi` kısıtı `(3,4)` → `(3,4,5)` olarak güncellendi (constraint drop/add).
- `create_group_challenge`: rakip sayısı kontrolü `not in (2,3)` → `not in (2,3,4)` (4 rakip + kurucu = 5).
- Frontend `ChallengesPage.jsx`: kişi seçimi `[3,4]` → `[3,4,5]`, başlık "3-5 kişi".
- RLS/realtime/puanlama mantığına dokunulmadı (ödül zaten `10 * oyuncu_sayisi` ile ölçekleniyor).

### 2) Yeni mod: "Hızlı Olan Kazanır"
- **Migration:** `20260612000032_hizli_olan_kazanir.sql`
- Grup Maçı deseninin kopyası; ayrı tablo/fonksiyon seti: `hizli_maclar`, `hizli_oyuncular`, `hizli_cevaplar`.
- Sabit 5 kişi. **Sadece ilk doğru cevabı veren +10 puan alır.** Joker/sohbet yok.
- **Yarış durumu (race):** `submit_hizli_cevap` içinde `hizli_maclar` satırı `FOR UPDATE` ile kilitlenip, o soru indexine daha önce doğru kayıt var mı diye kontrol edilir (client'a güvenilmez).
- RPC'ler: `create_hizli_mac`, `respond_hizli_davet`, `get_hizli_soru`, `submit_hizli_cevap`, `advance_hizli_mac` (hepsi security definer, sadece `authenticated`).
- RLS `_select_own` politikaları grup ile birebir; insert/update/delete revoke.
- Realtime: `hizli_maclar` + `hizli_oyuncular` publication'a eklendi.
- Push bildirimi trigger'ı: `notify_new_hizli_davet` (grup deseninin kopyası).
- `bot_oyna()` genişletildi (bölüm 10-13): botlar hızlı maçları kabul eder, başlatır, cevaplar (ilk doğru kontrolüyle) ve ilerletir. Botlar da `FOR UPDATE ... skip locked` ile serileşir.
- Frontend: `src/pages/HizliMacPage.jsx` (GroupMatchPage kopyası, sohbet/joker çıkarıldı, "İlk sen bildin! +10" geri bildirimi). `App.jsx` route `/hizli-mac/:id`. `ChallengesPage.jsx`'e kurulum kartı + gelen/aktif/beklenen/biten listeleri.

### 3) 500 yeni soru
- **Migration:** `20260612000033_soru_parti9_500.sql`
- Kategoriler: tarih, bilim, coğrafya, edebiyat, spor, sanat + yeni kategoriler **sinema, müzik, teknoloji** ve karışık/genel.
- **Karar:** `soru` kolonu UNIQUE olduğu için mevcut havuzla çakışanlar (~61) migration'ı bozmasın diye `on conflict (soru) do nothing` eklendi; çakışanları telafi için ek benzersiz sorular kondu → **net ~500 yeni benzersiz soru**.
- Doğru şık 0'a sabit kalmasın diye migration sonunda `created_at >= transaction_timestamp()` ile SADECE bu partinin şıkları karıştırıldı (yeni sorular hiçbir aktif maçta olmadığı için güvenli).

### 4) Ana sayfa "A-sınıfı oyun paneli" tasarımı
- `src/pages/Home.jsx` yeniden düzenlendi (tüm mevcut mantık korundu): zengin **hero paneli** (rütbe halkalı avatar, XP/rütbe ilerleme çubuğu, puan, seri), **oyun modları grid'i** (Hemen Oyna / Meydan Oku / Hızlı Olan Kazanır / Grup / Turnuva), bölüm başlıkları, podyumlu lider tablosu.
- `src/styles.css`'e kapsamlı yeni stiller eklendi (gradient/glow'lu mod kartları, hero panel, xp-bar, bölüm başlıkları). Mevcut sınıflara dokunulmadı.

### Notlar / Test edilecekler
- Migration'lar Supabase'e push edilmeli (repo push = otomatik Vercel prod deploy, DB migration Supabase tarafında ayrı uygulanır).
- Test: Hızlı Olan Kazanır'da aynı anda 2 oyuncu doğru cevap → sadece ilki +10 almalı. 5 kişilik grup kurulabilmeli. Ana sayfa mod kartları doğru sayfalara gitmeli.
- Build doğrulandı (`npm run build` başarılı).

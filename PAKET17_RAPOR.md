# Paket 17 — Taç/pelerin onayı · iki ölü sistem · gardırop dondurma (17 Eyl 2026, Opus 5)

| Bölüm | Durum | Commit |
|---|---|---|
| A — taç + pelerin onaylandı | ✅ canlıda | `376f453` (birleşme), `6042c32`, A-2 |
| B — push kimseye gitmiyor | (sürüyor) | |
| C — lig arşivi boş | (sürüyor) | |
| D — eski gardırop dondurma | (sürüyor) | |

---

## A — Taç ve pelerin

- `paket16-tac-pelerin` dalı `main`'e birleştirildi (`376f453`, yalnız `meydanAvatar.js` + 2 görsel). Dal GitHub'dan silindi. Build hatasız.
- `PAKET16_RAPOR.md` C: "karar bekliyor" → "onaylandı, canlıda".
- **Canlı doğrulama:** canlı paket `https://quiztactics.vercel.app/assets/dunya-BRUhwwKX.js` içinde `MeydanPelerin` / `MeydanTac` var (canlı parçalar tek tek indirilip arandı). Canlı meydana girmek oturum istiyor — şifre giremediğim için görüntü, **aynı commit'in üretim derlemesinden** (`olcum/meydan-test`, sahte oturum) alındı: `gorsel/paket17/a-tac-pelerin-uretim-arkadan.jpg`, `a-tac-pelerin-uretim-onden.jpg` (insan, kaplan, robot; klasik ve kısa pelerin).

### 152 ↔ 167 çağrı farkı — kapandı
Aynı üretim derlemesi, aynı kamera (İstiklal ucu), aynı oyuncu sayısı (27 karakter: 20 tam + 7 hafif), iki sahne kurulumu. Kozmetikler gizlenerek çağrı yeniden sayıldı:

| Kurulum | Toplam çağrı | Görünür kozmetik klonu | Kozmetik klonları gizli | Taç/pelerin gizli |
|---|---:|---:|---:|---:|
| 3A-2 (`cepheOlc`: oyuncular tohumdan görünüm alır) | **167** | 27 (sapka 8 · atkı 9 · gözlük 2 · kuyruk 8) | **142** | — |
| Paket 16 C ölçümü (herkese `avatar3d` taç + pelerin) | **154** | 10 (atkı 1 · gözlük 1 · kuyruk 8) | 144 (= 142 + taç/pelerin 2) | **152** |

- **Sebep: kamera/LOD değil, sahnenin kurulumu.** İki kurulumun kozmetiksiz tabanı aynı: **142**.
- 3A-2'de oyuncular görünüm kaydı olmadan geliyor → `tohumdanGorunum` her birine rastgele şapka/atkı/gözlük veriyor. Meydandaki kozmetikler **karakter başına klon mesh** (her biri 1 çağrı); 27 klonun 25'i kadrajda → 142 + 25 = 167.
- Paket 16 C ölçümünde herkese `avatar3d` görünümü verildi (baş = taç) → rastgele kozmetikler düştü → 10 klon → 152; taç/pelerinle 154.
- **Düzeneğe güven:** sayılar birebir toplanıyor (142 + 25 = 167; 142 + 10 = 152; +2 = 154). Karşılaştırmalar **aynı sahne kurulumuyla** yapıldığı sürece geçerli; kurulum değişirse taban değişir. İleriki ölçümlerde sahne kurulumu rapora yazılmalı.
- **Yan bulgu:** kozmetik klonları görünür bir maliyet — 20 tam karakterde 25 çağrı. Taç/pelerinin paylaşımlı InstancedMesh deseni diğer kozmetiklere de uygulanırsa bu 25 çağrı ~5'e iner (bu pakette yapılmadı; karakter.js/kozmetik.js kapsam dışı).

---

## B — Push bildirimleri kimseye gitmiyordu

### B.1 Zincir (baştan sona ölçüldü)

| Halka | Ölçüm | Sonuç |
|---|---|---|
| Service worker kaydı | `src/main.jsx` her açılışta `/sw.js` kaydediyor; canlı `quiztactics.vercel.app/sw.js` 200, kayıt kodu canlı pakette var | ✅ çalışıyor (hata `.catch(() => {})` ile yutuluyordu → artık konsola yazılıyor) |
| `sw.js` işleyicileri | `push` (JSON → `showNotification`) ve `notificationclick` (pencereyi odakla / aç) var | ✅ |
| VAPID eşleşmesi | İstemci anahtarı (`push.js`) ile gerçek Chrome'da FCM aboneliği alındı → sunucudan `send-push` → **`{"basarili":1}`** ve bildirim tarayıcıda göründü. Anahtarlar eşleşmeseydi FCM 403 döner, `basarisiz: 1` olurdu | ✅ eşleşiyor |
| Kayıt RPC'si | `save_push_subscription` security definer, yalnız `authenticated` EXECUTE; `authenticated` rolü + kurucu kimliğiyle çağrıldı → satır düştü | ✅ |
| **İzin kartının görüldüğü yer** | `BildirimIzniSor` yalnız **1v1 Normal Maç sonuç ekranında** (`MatchPage`). Veri: ilk maçını bitiren **15** gerçek oyuncudan (`lige_girdin` bildirimi) yalnız **5**'i `matches` tablosunda maç bitirmiş; diğerleri Düello / Hızlı Mod oynamış — kartı **hiç görmemiş** | ❌ **kopma 1** |
| **Kartın hata yönetimi** | `catch { /* kullanıcı reddetti */ }` + `finally { kapat() }`: her hata yutuluyor **ve** "bir daha sorma" işareti yine konuyordu → tek teknik hata oyuncuyu kalıcı olarak bildirimsiz bırakıyor, hiçbir yerde görünmüyor | ❌ **kopma 2** |
| iPhone Safari sekmesi | Apple web push'u yalnız ana ekrana eklenmiş uygulamaya veriyor; `PushManager` yok → `pushDestekleniyor()` false → kart da Profil'deki düğme de **hiç çıkmıyor**, oyuncuya neden olduğu söylenmiyor | ❌ **kopma 3** (platform kısıtı; oyuncu bazında ölçülemedi — istemci telemetrisi yok) |
| Profil › Bildirimler düğmesi | Hata `hataMesaji` ile gösteriliyor | ✅ (tek düzgün giriş, ama oyuncunun gidip bulması gerekiyor) |

Canlıda 5 oyuncunun her birinin kartta ne yaptığı (reddetti / kapattı / hata aldı) ölçülemez: kopma 2 yüzünden hiçbir iz kalmamış.

### B.2 Düzeltmeler
- `BildirimIzniSor`: "bir daha sorma" işareti yalnız **oyuncu "Şimdi değil" derse, izni reddederse ya da abonelik başarılı olursa**; teknik hata `console.error` + kartta mesaj, tekrar denenebilir. Başarıda "Bildirimler açık".
- Kart artık **Düello** ve **Hızlı Mod** sonuç ekranlarında da (Normal Maç'ta zaten vardı).
- iPhone Safari sekmesinde kart yerine bir kez "ana ekrana ekle, oradan aç" ipucu (TR + EN).
- `bildirimleriKapat`: sunucu silme hatası artık konsola yazılıyor.
- **Aynı hata başka yerlerde:** ağ çağrısını saran ve hatayı sessizce yutan **21** yer bulundu (tarama betiği `.tmp/p17/sessiz.mjs`). Hepsine davranışı değiştirmeden `console.warn("[Bildim] <rpc> başarısız:", …)` eklendi: `BildirimZili` (bildirimleri_oku), `DavetBandi` (bekleyen_davetlerim), `EzeliRakip`, `MacSonuDokum` (auth.getUser), `MacSonuEklentisi` (seri_durumum), `RakipAra` (kuyruktan_cik), `SesliSohbet`, `UstalikIzgarasi`, `YanlisSatiri`, `harita/coklu.js` (removeChannel), `ChallengesPage` (eski_davetleri_temizle), `Home` ×3, `MatchPage` (advance_match), `ProfilePage` (yanlis_bankam), `AuthContext` ×3 (profilim, arkadas_davet_kodu_ile_ekle, kalp_at), `main.jsx` (sw kaydı). Tarama sonrası kalan: 0.

### B.3 Doğrulama (Playwright, gerçek Chrome, gerçek FCM)
1. Maç sonucu sınama sayfasında `BildirimIzniSor` (gerçek bileşen + gerçek `push.js`; yalnız Supabase istemcisi çağrıyı kaydeden sahte) → kart göründü → izin verildi → "Bildirimleri aç" → **"Bildirimler açık"**; bileşen `save_push_subscription`'ı gerçek abonelik bilgisiyle çağırdı.
2. Aynı abonelik canlı veritabanına **`save_push_subscription` üzerinden** (`authenticated` rolü, kurucu kimliği) yazıldı → `push_subscriptions`'ta 1 satır.
3. `push_gonder` → canlı `send-push` → `{"basarili":1,"basarisiz":0}` → service worker bildirimi gösterdi: "🧪 Quiz Tactics push sınaması".
4. Test aboneliği silindi → tablo yine **0**.

Görseller: `gorsel/paket17/b-1-izin-karti.jpg`, `b-2-abone-olundu.jpg`, `b-3-bildirim-geldi.jpg`.

**Bilinen sınır:** canlı sitede gerçek oturumla deneme yapılmadı (şifre giremem); zincirin her halkası ayrı ayrı canlı bileşenlerle denendi. iPhone'da gerçek cihaz testi yok. Abone sayısının artması için oyuncuların kartı yeniden görmesi gerekiyor: eski koddaki "bir daha sorma" işareti hata yüzünden konmuş olabilecek tarayıcılarda kart çıkmaz — onlar için giriş Profil › Bildirimler.

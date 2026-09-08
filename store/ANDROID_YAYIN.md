# Bildim! — Android (TWA) yayın rehberi

Bu dosya, Bildim!'i Google Play'e **Trusted Web Activity (TWA)** olarak
göndermek için gereken her adımı içerir. Web tarafındaki hazırlık bitti;
aşağıdakiler senin makinende çalıştırılacak komutlar ve Play Console'da
senin yapman gereken işlerdir.

## Web tarafında hazır olanlar
| Dosya | Ne işe yarıyor |
|---|---|
| `public/bildim.webmanifest` | Bildim'e özel manifest (`start_url=/bildim`, portrait, tema `#7c4dff`) |
| `public/bildim-icon-512.png` | Uygulama ikonu (maskot baykuş Bilge) |
| `public/bildim-icon-maskable-512.png` | Maskeli ikon (Android adaptif ikon güvenli alanı) |
| `public/bildim-icon-192.png` | Küçük ikon |
| `public/.well-known/assetlinks.json` | Digital Asset Links — **parmak izi eklenmeli** |

> Hub'ın kendi `manifest.webmanifest` dosyasına dokunulmadı; Bildim ayrı
> manifest kullanır, böylece diğer oyunlar etkilenmez.

---

## 1) Bubblewrap kurulumu

```bash
npm i -g @bubblewrap/cli
```

İlk çalıştırmada JDK ve Android SDK'yı kendisi indirmeyi önerir, kabul et.

## 2) Projeyi başlat

```bash
mkdir -p ~/bildim-twa && cd ~/bildim-twa
bubblewrap init --manifest https://idagg-game-center.vercel.app/bildim.webmanifest
```

Soracağı değerler:

| Soru | Cevap |
|---|---|
| Domain | `idagg-game-center.vercel.app` |
| Application name | `Bildim! — Bilgi Yarışması` |
| Short name | `Bildim!` |
| Application ID (package) | `com.idagg.bildim` |
| Start URL | `/bildim` |
| Display mode | `standalone` |
| Orientation | `portrait` |
| Status bar color | `#0b0918` |
| Splash screen color | `#0b0918` |
| Include support for Play Billing | **Yes** (joker paketleri için) |
| Signing key | yeni oluştur (aşağı bak) |

Play Billing'i sonradan açmak için:

```bash
bubblewrap init --manifest <url> --enablePlayBilling
```

## 3) İmza anahtarı — KAYBEDERSEN UYGULAMAYI GÜNCELLEYEMEZSİN

```bash
keytool -genkeypair -v \
  -keystore ~/bildim-release.keystore \
  -alias bildim \
  -keyalg RSA -keysize 2048 -validity 10000
```

- Parolayı ve `.keystore` dosyasını **iki ayrı yerde** yedekle
  (şifre yöneticisi + çevrimdışı disk). Git'e **koyma**.
- Play Console'da "Play App Signing"i açarsan Google da bir kopya tutar,
  yine de upload anahtarını sen saklamalısın.

Parmak izini al:

```bash
keytool -list -v -keystore ~/bildim-release.keystore -alias bildim | grep SHA256
```

Çıkan `AA:BB:CC:...` değerini `public/.well-known/assetlinks.json` içindeki
`BURAYA_IMZA_ANAHTARININ_SHA256_PARMAK_IZI_YAZILACAK` yerine yaz, deploy et.
Doğrulama:

```
https://idagg-game-center.vercel.app/.well-known/assetlinks.json
```

> Play App Signing kullanıyorsan Play Console → Setup → App integrity
> ekranındaki **App signing key certificate** SHA-256'sını da aynı diziye ekle.
> Aksi halde mağazadan inen sürümde adres çubuğu görünür.

## 4) Derle

```bash
bubblewrap build
```

Çıktılar: `app-release-bundle.aab` (Play'e yüklenecek) ve `app-release-signed.apk`
(cihazda test için).

Yerel test:

```bash
adb install app-release-signed.apk
```

Adres çubuğu görünüyorsa assetlinks doğrulanmamıştır — parmak izini kontrol et.

## 5) Güncelleme

Web tarafı her deploy'da otomatik güncellenir; APK yalnız manifest/ikon/paket
ayarları değişirse yeniden derlenir:

```bash
bubblewrap update && bubblewrap build
```

---

## Play Console'da senin yapman gerekenler

1. **Uygulama oluştur** — ad `Bildim! — Bilgi Yarışması`, tür Oyun,
   kategori **Bilgi Yarışması (Trivia)**, ücretsiz.
2. **Mağaza kaydı** — metinler `store/MAGAZA_METINLERI.md` dosyasında hazır.
3. **Ekran görüntüleri** — `store/EKRAN_GORUNTULERI.md` listesindeki 8 ekran.
4. **Özellik grafiği** — `store/ozellik-grafigi.svg` (1024×500) PNG'ye çevrilip
   yüklenecek.
5. **İçerik derecelendirme** — anket cevapları `store/ICERIK_DERECELENDIRME.md`.
6. **Gizlilik politikası URL'si** — `https://idagg-game-center.vercel.app/bildim/gizlilik`
7. **Play Billing ürünleri** — `store/URUNLER.md` içindeki ürün kimliklerini
   Play Console → Monetize → In-app products altında birebir oluştur.
8. **AdSense/H5 Games Ads** — `VITE_H5_ADS_CLIENT` ortam değişkenine AdSense
   yayıncı kimliğini (`ca-pub-...`) gir. Boş kaldığı sürece reklam gösterilmez
   ve sahte ödül verilmez.
9. **Veri güvenliği formu** — toplanan veri: e-posta (hesap), takma ad, oyun
   istatistikleri. Üçüncü tarafla paylaşım: reklam kimliği (AdSense).

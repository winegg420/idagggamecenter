# Gladius Battle Royale — CLAUDE.md

## Proje Açıklaması

Gladius Battle Royale, Bildim projesinin içine eklenen bağımsız, kendi kendine yeten bir oyun modülüdür. Aynı Bildim reposunda, aynı Supabase projesinde barınır ve Bildim'in mevcut Gmail login oturumunu kullanır, ama oyun mantığı, verisi ve arayüzü Bildim'in quiz oyunuyla hiçbir şekilde karışmaz. Kod tamamen bu `gladius/` klasöründe izole tutulur; amaç, projenin her an bağımsız bir repoya taşınabilecek kadar ayrık kalmasıdır. İki oyun modu içerir: "Battle Royale Modu" (son ayakta kalan kazanır, aşamalı tehditler içerir) ve "Deathmatch" (sınırsız saldırı, serbest format).

## Genel Çalışma Kuralları

- Her zaman Türkçe yanıt ver.
- Adım adım, sade bir dille açıkla.
- Değişiklik yapmadan önce ne yapacağını açıkla, onay bekle.
- Mevcut kodu silme veya bozma, minimal değişiklik yap.
- Dosya silme/yeniden yazma yerine düzenlemeyi tercih et.
- Tüm API çağrılarında try-catch ve hata yönetimi kullan.
- Emin olmadığın bir şey varsa tahmin etme, sor — istisna: görsel/deneyim/oyun tasarımı detaylarında (Bölüm 0 istisnası, GLADIUS_TASARIM.md dosyasında tanımlı) sormadan profesyonel yargıyla ilerlenebilir.
- Bir hatayı düzelttikten sonra aynı hatayı başka dosyalarda da kontrol et.
- İşlem bittikten sonra kendi kendini test et, sonucu özetle, benden bir şey kontrol etmemi isteme.
- Kritik kontroller (hasar, eleme, cooldown, admin yetkisi) sunucu tarafında doğrulanacak, istemciye güvenilmeyecek.

## Tasarım Dosyasına Referans

Detaylı oyun tasarımı, mekanikler ve kararlar için **GLADIUS_TASARIM.md** dosyasına bak. Bu dosyaya (GLADIUS_TASARIM.md'ye) dokunma — sadece referans ver, içeriğini değiştirme.

## Kurulum

Bildim'in mevcut Supabase bağlantısı/anahtarları kullanılacak, ayrı bir `.env` gerekmiyor. Proje ilerledikçe Gladius'a özel bir ortam değişkeni ihtiyacı çıkarsa, o zaman eklenecek.

## Veritabanı Tablo Öneki

Tüm yeni Supabase tabloları **`gl_`** önekiyle isimlendirilecek (aksi belirtilmezse) — örnek: `gl_rooms`, `gl_players`, `gl_matches`.

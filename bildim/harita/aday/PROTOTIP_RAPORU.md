# Quaternius hazır insan prototipi

**Tarih:** 18 Eylül 2026  
**Rota:** `/bildim/insan-prototip` (hub) · `/insan-prototip` (Quiz Tactics bağımsız derleme)

## Uygulanan

- Quaternius Universal Base Characters Standard erkek gövdesi oyuna alındı.
- Kaynak gövdenin 12.566 üçgenlik ana mesh'i `meshoptimizer` ile 5.900
  üçgene indirildi. Uzun ve topuz saç da 1.300'er üçgene sadeleştirildi;
  yüz, göz/kaş ve seçili saçla bütün seçenekler en fazla **8.953 üçgen**.
- 2048 px gövde ve saç dokuları mobil yük için 1024 px'e indirildi.
- Üreticinin CC0 Universal Animation Library paketinden yalnız `Idle`, `Walk`,
  `Jog` ve `Dance` klipleri ayrıldı. 7,62 MB tam hareket paketi yerine seçili
  klipler 645 KB glTF + BIN olarak sunuluyor.
- Kaynak hareketlerdeki kemik konum ve ölçek kanalları çıkarıldı; yalnız kemik
  dönüşleri kullanılıyor. Böylece farklı bind pozu nedeniyle oluşan uzuv uzaması
  giderildi.
- Dört ten tonu, kısa/uzun/topuz saç ve duruş/yürüme/koşu/dans kontrolleri var.
- Ceket gövdenin skinned yüzeyinde bölgesel malzeme olarak çalışıyor; hareket
  sırasında bedenden ayrılmıyor.
- Gözlük `Head`, kıvrımlı ve tokalı pelerin `spine_03` kemiğine bağlı. İkisi de
  hareketlerle birlikte taşınıyor.
- Kaynak lisans metinleri dağıtılan dosyaların yanında tutuluyor.
- Prototip giriş gerektirmeden açılıyor ve mevcut oyuncu avatarını değiştirmiyor.

## Bütçe

| Ölçü | Sonuç |
| --- | ---: |
| Toplam üçgen | 8.953 |
| Model + dokular + 3 saç + 4 hareket | 9,09 MiB |
| Prototip JS | 9,67 kB (4,11 kB gzip) |
| Prototip CSS | 3,00 kB (1,11 kB gzip) |
| Yeni npm paketi | 0 |

## Görsel ve işlevsel kontrol

- Model ön ve yan açıdan OrbitControls ile döndürüldü.
- Yürüme, koşu ve dans ayrı ayrı oynatıldı; anatomik oran korunuyor.
- Kısa, uzun ve topuz saç değişimi doğrulandı.
- Gözlük yüzle, pelerin omurga ve omuz tokalarıyla birlikte hareket ediyor.
- Masaüstü dar pencere düzeni ve 760 px altı tek sütun düzeni tanımlı.
- Tarayıcı konsolunda model yükleme ya da animasyon hatası yok.

## Sınır

Bu bir karşılaştırma prototipidir. Meydanın mevcut `insan` varlığının, oyuncu
kayıtlarının veya satın alınmış kozmetiklerinin yerine geçmez. Canlı oyuncu
sistemine taşıma kararı görsel onaydan sonra ayrıca verilmelidir.

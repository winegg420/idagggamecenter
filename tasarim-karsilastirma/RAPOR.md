# Apple tasarım denemesi — öncesi / sonrası

Dal: `tasarim/apple-design` · `main`'e dokunulmadı, canlıya çıkmadı,
veritabanına ve oyun mantığına tek satır dokunulmadı.

Uygulanan skill: [emilkowalski/skills → apple-design](https://github.com/emilkowalski/skills/tree/main/skills/apple-design)
(WWDC *Designing Fluid Interfaces*, *The Details of UI Typography*,
*Principles of Great Design*).

Bütün görsel değişiklik tek dosyada: **`bildim/styles/apple.css`**.
Eski `tema.css` ve `styles.css` silinmedi, hiçbir sınıf adı kaldırılmadı.
`src/main.jsx`'teki tek `import` satırını silmek eski **Şenlik**
tasarımını olduğu gibi geri getirir.

Ekran görüntüleri: 390 px genişlik (telefon), aynı test hesabı, aynı
anlık oyun durumu — "önce" ve "sonra" arka arkaya çekildi.

---

## Ekran ekran ne değişti

| Ekran | Görüntü | Tek cümlede |
|---|---|---|
| Giriş | `giris-*.png` | Beş eylem eşit ağırlıktaydı; artık bir birincil eylem dolu, gerisi geri çekildi. |
| Ana sayfa | `ana-sayfa-*.png` | Üç yinelenen kapı (Dereceli Maç, Joker Dükkânı, Lig) ve Şehir/Ülke/Dünya şeridi kalktı; ekranın tek birincil eylemi "Hemen oyna". |
| Rakip arama | `rakip-arama-*.png` | Arka plandaki ana sayfa sadeleştiği için bekleme ekranı da sakinleşti. |
| Maç | `mac-*.png` | Alttaki yedi tepki düğmesi + sohbet düğmesi tek düğmenin arkasındaki panele indi; ekranın tek işi soruyu cevaplamak. |
| Soru kartı | `mac-*.png` içinde | Kalın renkli çerçeveler yerine hairline + dolgu; ücretsiz 50:50 kutusu okunur hâle geldi. |
| Lig | `lig-*.png` | Segmented control, nötr zemin, tabular rakamlar. |
| Arkadaşlar | `arkadaslar-*.png` | Kabartmalı kartlar yerine sakin liste satırları. |
| Dükkân | `dukkan-*.png` | Paket kartları düzleşti, fiyat çipleri tek vurgu rengine döndü. |
| Profil | `profil-*.png` | Yüzen kart yığını daraldı; tema düğmesi üst bardan buraya taşındı. |
| Turnuva | `turnuva-*.png` | Lobi listesindeki hizalama bozukluğu düzeldi (adlar avatarın yanında, eylem sağ kenarda). |
| Alt sekme çubuğu | her görüntüde | 7 sekme → 5; opak şerit yerine saydam malzeme, içerik altından akıyor. |

---

## Sadeleşme ölçümü

Aynı anda ekranda görünen, tıklanabilir ve gerçekten görünür öğe sayısı
(390 px; `button:not([disabled]), a[href], [role=button], input, select,
textarea`; genişliği/yüksekliği 0 olanlar sayılmadı):

| Ekran | Önce | Sonra | Fark |
|---|---:|---:|---:|
| Giriş | 7 | 7 | 0 |
| Ana sayfa | 27 | 19 | **−30 %** |
| Maç | 19 | 11 | **−42 %** |
| Rakip arama | 13 | 9 | −31 % |
| Lig | 20 | 16 | −20 % |
| Arkadaşlar | 18 | 14 | −22 % |
| Dükkân | 24 | 20 | −17 % |
| Profil | 38 | 35 | −8 % |
| Turnuva (21 kişilik lobi) | 56 | 52 | −7 % |

Girişte sayı değişmedi — orada sorun öğe *sayısı* değil, hiyerarşi
yokluğuydu: beş beyaz kutu yerine bir dolu düğme + dört sessiz seçenek.

Turnuva ve profildeki düşüş küçük; ikisi de doğası gereği liste ekranı
(21 lobi oyuncusu, 17 rozet). Oradaki kazanç sayıda değil görsel
gürültüde.

### Bir maça başlamak kaç dokunuş?

| | Önce | Sonra |
|---|---:|---:|
| Ana sayfadan bir maça girmek | **1 dokunuş** | **1 dokunuş** |
| Beklemeyi atlayıp hemen eşleşmek | 2 dokunuş | 2 dokunuş |

Akış kısalmadı — zaten en kısaydı. Değişen şey **kaç farklı yolun aynı
anda görünmesi**: ana ekranda oyuna başlatan yol 7'den 6'ya indi ve
bunlardan biri (Hemen oyna) artık tek başına birincil eylem; kalanlar
"Başka nasıl oynanır" başlığı altında bir kademe geride. Eskiden
"Hemen oyna" ile "Dereceli Maç" **aynı çağrıyı yapan** iki ayrı düğmeydi;
ikincisi kaldırıldı.

---

## Erişilebilirlik ve sağlamlık denetimi

Playwright ile, 390 px, oturum açık, altı ekranda:

- **Kontrast ihlali: 0.** Küçük metinde ≥ 4.5, 24 px+ / 19 px+ kalın
  metinde ≥ 3.0 (yarı saydam metin zeminle karıştırılarak ölçüldü).
- **Yatay kaydırma: yok** — altı ekranda da
  `scrollWidth > clientWidth + 1` → `false`.
- **Konsol hatası: 0.**
- **`prefers-reduced-motion: reduce`**: geçiş süreleri `0s`, oyun
  çalışıyor. Hareket kapanınca geri bildirim kaybolmuyor; ölçek yerine
  ton değişimi kalıyor (skill §14'ün istediği davranış).
- **`prefers-reduced-transparency`** ve **`prefers-contrast: more`** için
  ayrı kurallar yazıldı: cam yüzeyler opaklaşır, kenarlar belirginleşir.
- Oyun akışı otomatik testle doğrulandı: giriş → maç → soru cevaplama →
  maç bitişi → coin değişimi.

Ham çıktı: `denetim-sonra.json`.

---

## Skill'den uygulanamayanlar ve nedenleri

1. **Gerçek yay fiziği (§3, §4, §5).** Yay eğrilerini CSS `linear()` ile
   önceden hesaplayıp uyguladım; hareketin *şekli* doğru (kritik
   sönümleme, damping 1.0 / response 0.4). Ama CSS geçişi **kesilebilir
   değil**: kullanıcı hareket eden bir şeyi yakalayıp ters çeviremez,
   parmağın hızı yaya devredilemez. Skill bunu "en önemli ilke" diyor.
   Doğrusu için JS yay kütüphanesi (Motion) gerekiyordu; **yeni paket
   yasağı** nedeniyle yapılmadı.
2. **Jest takibi (§2, §6, §9).** 1:1 sürükleme, momentum projeksiyonu,
   lastik kenar. Uygulamada sürüklenebilir hiçbir yüzey yok: ne alttan
   açılan sheet, ne kaydırarak kapatma, ne carousel. Bunlar *mevcut
   tasarımı çevirmek* değil **yeni etkileşim icat etmek** olurdu; görev
   kapsamı dışında bırakıldı.
3. **iOS'un gruplandırılmış liste düzeni (§12).** Profildeki sekiz ayrı
   yüzen kart tek bir gruplandırılmış listeye dönüşmeliydi; bu
   işaretleme değişikliği ister. CSS'le alınabilecek en yakın hâlle
   (gölge yok, dar aralık) yetinildi.
4. **Ses/dokunsal uyum (§13).** Uygulamada ses ve `navigator.vibrate`
   zaten var; üçünün **aynı karede** tetiklendiği ölçülüp ayarlanmadı.
5. **View transitions.** Sayfalar arası paylaşılan öğe geçişi
   kurulmadı — rota yapısına dokunmak gerekiyordu.

---

## Dürüst değerlendirme: bu dil bir bilgi yarışmasına uyuyor mu?

**Kısmen. Yapıya evet, tona hayır.**

**Uyan taraf — korunmasını önerdiğim kısım:**

- **Sadelik ilkesi sorunun tam ilacı.** "Kullanıcılar siteyi karışık
  buluyor" şikâyeti bir renk sorunu değil, bir *seçenek sayısı*
  sorunuydu: ana ekranda 27 tıklanabilir öğe, aynı maçı başlatan iki
  ayrı düğme, alt çubukta yedi sekme. Bunlar düzeldi ve bu kazanç
  tasarım dilinden bağımsız.
- **Maç ekranı gerçekten kazandı.** Soru sorulurken sekiz sosyal
  düğmenin altta durması bir hataydı; tek düğmeye inmesi oyunu
  odaklıyor.
- **Tipografi ve kontrast net biçimde iyileşti.** Sistem yazı tipi +
  boyuta özel tracking, Baloo 2'nin geniş harf aralığından daha okunur;
  kontrast ihlali sıfıra indi.

**Uymayan taraf:**

- **Renk enerjisi gitti.** Turuncu/altın palet, kabartmalı düğmeler ve
  "bas–ez" hissi bir *oyun* dilidir; Apple'ın nötr grisi bir *araç*
  dilidir. Şu hâliyle ekran bir bilgi yarışmasından çok bir banka
  uygulamasına benziyor. Doğru cevabın yeşili, seri ateşi, konfeti,
  rütbe atlama kutlaması — bunlar oyunun ödül döngüsü ve nötr palet
  onları zayıflatıyor.
- **Apple'ın kendi kuralı bunu söylüyor.** §16.8: "Hangi duyguyu
  hissettirmek istediğine karar ver ve her kararda onu pekiştir." Bu
  oyunda hedef duygu *sakinlik* değil *heyecan*; skill'i olduğu gibi
  uygulamak yanlış duyguyu pekiştiriyor.
- **Kesilebilir yay olmadan "akıcılık" yarım kalıyor.** Skill'in asıl
  vaadi (§3) uygulanamadığı için elde kalan büyük ölçüde *görünüş*:
  saydam kroma, hairline, sistem yazı tipi. Güzeller ama skill'in esas
  katkısı değiller.

**Önerim:** bu dalı olduğu gibi `main`'e almayın. Alınmaya değer üç şey
var ve üçü de tasarım dilinden bağımsız uygulanabilir:

1. **Sadeleştirmeler** — 7→5 sekme, yinelenen kapıların kapatılması,
   maç ekranındaki tepki paneli. Doğrudan Şenlik diline taşınabilir.
2. **Tipografi disiplini** — boyuta özel tracking/leading, tabular
   rakamlar.
3. **Erişilebilirlik katmanı** — hareket, saydamlık ve kontrast
   tercihleri.

Renk ve malzemede ise Şenlik'i koruyup yalnız **aynı anda kullanılan
renk sayısını** düşürmeyi öneririm. Sorun turuncunun kendisi değil;
turuncu + altın + mor + yeşilin aynı ekranda yarışması.

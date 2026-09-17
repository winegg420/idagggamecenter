# Quiz Tactics hazır insan modeli araştırması

**Tarih:** 18 Eylül 2026  
**Kapsam:** Yalnız `bildim/` içindeki Quiz Tactics meydan insan avatarı

## Sonuç

İnsan avatarı için seçilen kaynak **Quaternius — Universal Base Characters
[Standard]** paketidir.

- Resmî sayfa: <https://quaternius.com/packs/universalbasecharacters.html>
- Resmî indirme: <https://quaternius.itch.io/universal-base-characters>
- Lisans: paketin itch.io sayfasında **CC0 1.0 Universal** olarak belirtilir;
  ticari oyunda ücretsiz kullanılabilir.
- Formatlar: glTF, FBX, OBJ ve Blend.
- Ücretsiz Standard paket: kadın ve erkek temel gövde ile beş saç modeli.
- Humanoid iskelet: mevcut hareketlerin yeniden hedeflenmesine uygundur.
- Ten ve göz renkleri malzeme üzerinden çeşitlendirilebilir.

Bu paket doğrudan depoya eklenmedi. Önce tek bir insan üzerinde uyarlama ve
performans prototipi yapılmalı; sonuç onaylandıktan sonra kaynak dosyalar oyuna
alınmalıdır.

## Mevcut insanın görsel incelemesi

İncelenen ana kareler:

- `gorsel/paket23/sonra/insan_idle_on.png`
- `gorsel/paket23/sonra/insan_idle_yan.png`
- `gorsel/paket23/sonra/insan_idle_yuz34.png`
- `gorsel/paket23/once/insan_idle_on.png`

Mevcut insanın başı gövdeye göre fazla büyük ve küresel, saç tek parça kabuk
gibi, yüz ayrıntısı düz atlas görüntüsü veriyor. Omuz, el, bacak ve ayakkabı
oranları aynı görsel dilde birleşmiyor. Bu nedenle avatar uzaktan okunuyor fakat
yakın gardırop ve profil görünümünde hazır bir oyun karakteri kalitesine
ulaşmıyor.

`public/meydan/deneme/karakter_insan.glb` ölçümü:

| Ölçü | Değer |
| --- | ---: |
| Dosya | 603.360 bayt |
| Üçgen | 9.322 |
| Mesh | 6 |
| Malzeme | 1 |
| İskelet | 1 |
| Hareket | Idle, Run, Walk, Selam |

## Aday karşılaştırması

| Paket | Güçlü yanı | Quiz Tactics açısından sorun | Karar |
| --- | --- | --- | --- |
| Quaternius Universal Base Characters | Doğal stilize oranlar, kadın/erkek, saç ve ten çeşitleri, humanoid rig, glTF | Ortalama 13 bin üçgen; sadeleştirme ve hareket yeniden hedefleme ister | **Seçildi** |
| KayKit Adventurers | CC0, 5 karakter, 25+ aksesuar, düşük poligon, tek atlas | Fantezi/zindan kıyafetleri modern meydan ve gardırop kimliğine uymuyor | Yedek hareket/aksesuar kaynağı olabilir |
| Kenney Blocky Characters | CC0, çok hafif, hareketli glTF | Blok/Minecraft görünümü hedeflenen kaliteli insan avatarından uzak | Elendi |

KayKit resmî kaynakları:

- <https://kaylousberg.itch.io/kaykit-adventurers>
- <https://kaylousberg.itch.io/kaykit-character-animations>

Kenney resmî kaynak:

- <https://kenney.nl/assets/blocky-characters>

## Entegrasyon prototipi ölçütleri

1. Standard paketteki bir temel gövde GLB olarak alınır.
2. Görünür kalite korunarak gövde + saç toplamı en fazla yaklaşık **9 bin
   üçgene** indirilir.
3. Model mevcut 1,80 m ölçeğe ve Quiz Tactics koordinat düzenine getirilir.
4. Mevcut `Idle`, `Walk`, `Run` ve `Selam` hareketleri yeni humanoid iskelete
   yeniden hedeflenir.
5. Mevcut 15 kozmetik yuvası korunur; en az gözlük, saç, gövde kıyafeti,
   ayakkabı ve sırt parçası üzerinde oturma testi yapılır.
6. Ten rengi yeni bir karakter kimliği açmadan malzeme paletiyle değiştirilir.
7. Meydan, gardırop ve portre görünümünde kırpılma; koşu ve selam sırasında
   parça kayması; orta seviye telefonda kare süresi ölçülür.
8. Prototip onaylanmadan mevcut `insan` varlığı değiştirilmez.

## Neden önce tek prototip

Quaternius görsel hedefe uyuyor fakat paket iskeleti mevcut Mixamo tabanlı
iskeletle aynı değil. Bütün karakterleri bir anda taşımak hareket, kozmetik ve
mobil performans sorunlarını çoğaltır. Tek kadın veya erkek gövdeyle yapılan
prototip; kalite, üçgen bütçesi ve 15 yuvanın uyumunu düşük maliyetle kanıtlar.

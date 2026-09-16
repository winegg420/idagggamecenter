# AŞAMA 2 İÇİN BÜTÇE NOTU — İstiklal Sokağı yapılmadan ÖNCE okunacak

> Aşama 2 promptu yazılırken bu bölüm olduğu gibi içine konacak.
> Kaynak: Aşama 1C ölçümleri (`public/meydan/deneme/*.olcum.json` + `ASAMA_1C_RAPOR.md`), kalem kalem.
> Bu dosya Aşama 1D'de (16 Eyl 2026) depoya yazıldı; **Aşama 2 işlerine başlanmadı.** Bölüm D (prop optimizasyonu)
> 1D'de yapıldı — güncel çevre sayıları `ASAMA_1D_RAPOR.md`'de.

## 1. Çevre bütçesi gerçekte nereye gidiyor

Toplam 67.758 üçgen (rapor: 67.890, tabela dahil). Karakterler bu sayıya
**dahil değil** — ayrı kalem (275.160).

> **Tablo nasıl okunacak — önemli:** "Etkin" sütunu `renderer.info.triangles`
> değeridir ve **gölge geçişini ayrı bir çizim olarak sayar.** Gölge atan bir
> nesnenin geometrisi iki kez rasterize edilir: bir kez kameraya, bir kez gölge
> haritasına. Yani bina mesh'i **4.804 üçgen**, gölge geçişi **+4.804**, etkin
> yük **9.608**. Bu, binanın 9.608 üçgenlik bir mesh olduğu anlamına GELMEZ.

| Kalem | Adet | Mesh üçgeni | Gölge geçişi | **Etkin** | Pay |
|---|---:|---:|---:|---:|---:|
| **Ağaç tacı** | 24 | 11.280 | +11.280 | **22.560** | **33 %** |
| Bank | 10 | 9.720 | — | 9.720 | 14 % |
| **Bina** | 1 | 4.804 | +4.804 | **9.608** | **14 %** |
| Saksı | 16 | 8.448 | — | 8.448 | 12 % |
| Lamba | 12 | 6.000 | — | 6.000 | 9 % |
| Ağaç gövdesi | 24 | 2.880 | +2.880 | 5.760 | 9 % |
| Zemin | 1 | 3.058 | — | 3.058 | 5 % |
| Kedi | 3 | 1.956 | — | 1.956 | 3 % |
| Bordür | 1 | 648 | — | 648 | 1 % |

### Beklenmedik sonuç
**Bütçeyi bina değil AĞAÇLAR yiyor.** Ağaç tacı + gövde = **28.320 üçgen
(%42)**. Bina yalnız %14. Yani "10 dükkân bütçeyi patlatır" endişesi doğru
ama **yanlış kalemi** işaret ediyor.

İkinci sürpriz: **bir bank 972 üçgen.** Oyuncunun hiç yakından bakmadığı bir
prop, binanın beşte biri kadar geometri harcıyor. Lamba 500, saksı 528 —
hepsi gereğinden ağır.

## 2. Aynı yoğunlukla İstiklal Sokağı yapılırsa

```
Prop + kedi + bordür (bina ve zemin hariç) ...... 55.092
Sokak zemini (3× büyük, tahmin) .................. 5.000
Binalara kalan .................................. 19.908
```

| Bina tipi | Maliyet | Sığan bina |
|---|---:|---:|
| Gölge atan, tam detay | 9.608 | **2** |
| Gölge atmayan, tam detay | 4.804 | **4** |

**10 dükkân değil, 2 dükkân sığıyor.** Sorun düşündüğümüzden büyük ve çözümü
binada değil, prop tarafında.

## 4. Üç katmanlı bina LOD — şart

| Katman | Mesafe | İçerik | Gölge |
|---|---|---|---|
| **LOD0** | yakın | tam cephe: tabela, tente, balkon parmaklığı, pencere çerçevesi, kapı girintisi | evet |
| **LOD1** | orta | balkon/parmaklık/çerçeve sadeleşir; detay atlas dokusuna taşınır | basitleşir veya kapanır |
| **LOD2** | uzak | yalın kütle + siluet; küçük prop yok | hayır |

## 5. Seçici gölge kuralı
Her bina gölge atmaz. Gölge atanlar: oyuncuya yakın binalar ve büyük siluet
oluşturan kütleler. Uzak cephelerin küçük detayları asla.

## 6. Modüler bina — 10 unique bina YAPILMAYACAK
Ortak parça havuzu: pencere, balkon, tente, kapı, çatı, tabela çerçevesi,
kat silmesi, korniş. Bina = bu parçaların farklı dizilimi.
**Görsel çeşitlilik renk + tabela + cephe düzeni + modül kombinasyonundan
gelir**, sıfırdan modelden değil. Tek atlas, tek malzeme kuralı geçerli.

## 7. FRUSTUM CULLING TEK BAŞINA GÜVENİLMEZ
Kamera kesmesi Aşama 1C'de 102 çağrıyı 59'a düşürdü — gerçek ve değerli.
Ama:
- İstiklal gibi **uzun bir sokakta kamera yönüne göre 6-8 cephe aynı anda
  görüş alanına girer**
- Görüş alanında olup **uzakta küçük görünen bina hâlâ tam detay mesh ise**
  GPU maliyeti devam eder — culling bunu çözmez, LOD çözer

Culling + LOD + seçici gölge + instancing **birlikte** tasarlanacak.

---

## 7B. İKİ AYRI BÜTÇE — karıştırma

`80.000 üçgen` sınırı **haritanın toplam geometrisi değil**, aynı anda
**görünen** geometridir. İkisi farklı şey, farklı sorunu ölçer:

| | Ne ölçer | Sınır | Nasıl ölçülür |
|---|---|---|---|
| **A. En kötü durum görünür çevre** | O karede rasterize edilen üçgen — **performans kriteri budur** | **≤80.000 etkin üçgen** (gölge geçişi dahil) | `renderer.info.render.triangles`, en çok cephenin göründüğü kamera açısında |
| **B. Haritanın toplam varlığı** | Diskten inen ve VRAM'de duran benzersiz geometri — **yükleme süresi ve bellek kriteri** | aşağıda | dosya boyutu + benzersiz üçgen toplamı |

İstiklal'in görüş alanı dışında kalan, kesilmiş ya da LOD2'ye düşmüş
geometrisinin **VRAM ve indirme maliyeti vardır** ama o karede rasterize
edilmez. Büyük haritada performans kriteri her zaman
**o anda görünür üçgen + çizim çağrısı + kare süresi**'dir.

### B için mevcut durum (ölçüldü) ve Aşama 2 sınırı
```
                         ŞU AN (1C)        AŞAMA 2 SINIRI
GLB dosyaları            1,91 MB           ≤ 6 MB
Doku (atlas + temas)     0,93 MB           ≤ 1,5 MB (tek 1024² atlas korunur)
Benzersiz üçgen (disk)   28.628            ≤ 90.000
```
Modüler bina parçaları (§6) B bütçesini de korur: 10 farklı bina modeli yerine
~12 ortak parça, kombinasyonla çeşitlilik.

---

## 8. SERT KAPI — 10 dükkân üretilmeden ÖNCE

> **10 dükkânın hiçbiri üretilmeyecek** — önce en kötü durum sahnesi kurulacak:
>
> - **6 görünür bina cephesi** (LOD0/LOD1/LOD2 karışık)
> - **25 karakter**
> - **Planlanan sokak prop yoğunluğu** (ağaç, lamba, bank, saksı, tabela, tente)
> - LOD, seçici gölge, frustum culling ve instancing **aktif**
> - Kamera sokağın ucundan boydan boya bakacak — en çok cephenin göründüğü açı
>
> Bu sahnede ölç: **çizim çağrısı · görünen üçgen · kare süresi.**
>
> | Sınır | Değer |
> |---|---|
> | Çizim çağrısı | ≤220 |
> | **Görünen** üçgen (§7B/A) | ≤420.000 toplam · çevre payı ≤80.000 |
> | **Kare süresi (masaüstü)** | **≤4,0 ms** |
> | fps | 60 (tek başına yeterli DEĞİL, aşağıya bak) |
>
> ### Neden fps tek başına yetmez
> Tarayıcı VSync'e kilitlidir: sahne 3 ms de sürse 15 ms de sürse HUD 60 fps
> yazar. fps, tavana çarpana kadar hiçbir şey söylemez — çarptığı an da iş
> işten geçmiştir. **Asıl gösterge kare süresidir.**
>
> ### 4,0 ms nereden geliyor
> Mevcut ölçüm: **2,14 ms** (Geniş) · **2,22 ms** (Oyun), 1920×918, masaüstü
> tümleşik AMD Radeon. Ölçüm `gl.finish()` ile alınıyor — yani **CPU + GPU
> dahil gerçek kare süresi**, yalnız JS süresi değil. Doğru şeyi ölçüyor.
>
> 4,0 ms = mevcudun yaklaşık **2 katı**. Sokak sahnesi bugünkü test
> sahnesinden ağır olacağı için pay bırakıyoruz, ama iki katından fazlasına
> izin vermiyoruz.
>
> **Uyarı:** 4,0 ms masaüstü için bir **vekil sınırdır**, telefon ölçümü
> değildir. Orta sınıf bir telefon tümleşik masaüstü GPU'sundan belirgin
> ölçüde yavaştır ve bu oran cihaza göre değişir — tahmin yazma. Sokak
> sahnesi ayakta kalınca **gerçek Android cihazda ölçüm yapılacak**; o ölçüm
> alınana kadar telefon satırına `ölçülmedi` yazılacak.
>
> **Bütçe aşılıyorsa 10 binanın üretimine BAŞLAMA** — önce bina hattını
> optimize et ve testi tekrarla.

Sebep: sokağı bitirip sonra optimize etmek, sokağı baştan yapmak demektir.
6 bina ile en kötü gerçek oyun görüntüsünü simüle edip mimariyi önce doğrularız.

# CLAUDE.md — Quizador Meydanı (`bildim/harita/`)

3B çok oyunculu buluşma alanı. Oyuncu kendi avatarıyla yürür, o an meydanda
olanları canlı görür, emoji atar, mod binalarına girerek o moda geçer.
Onaylanmış görsel referans: repo kökünde `QUIZADOR_MEYDAN_REFERANS.html`
(sahne oradan **birebir** taşındı — yeniden tasarlama). Görev metni:
`QUIZADOR_MEYDAN_GOREV.md`.

## Dosyalar

| Dosya | Sorumluluk |
|---|---|
| `HaritaSayfasi.jsx` | Yalnız React yaşam döngüsü + HUD. three.js'e dokunmaz. |
| `dunya.js` | Saf three.js: sahne, ışık, karakterler, emoji balonu, çarpışma, kamera, `yokEt()`. Dünya manifestten (Taksim). |
| `cevre.js` | **2B:** manifest alanlarından GLB proplar (InstancedMesh), atlaslı zemin, boyalı binalar, sokak kedileri. |
| `karakter/` | **2B:** ortak karakter sistemi (karakter, kozmetik, ifade, pet, vfx, temas, meydanAvatar) — deneme sayfası da bunu kullanır. |
| `kontrol.js` | Ekran topuzu + WASD/yön tuşları → `{ix, iz}`. |
| `coklu.js` | Supabase Realtime `meydan` kanalı: presence (kim burada) + broadcast `poz` / `emoji`. |
| `renk.js` | `user.id`'den deterministik avatar rengi (profilde renk kolonu yok, eklenmedi). |
| `harita.css` | HUD; tüm sınıflar `.bd-harita-` önekli. |
| `yerlesim.json` | **Aşama 2A:** Taksim haritasının TEK doğruluk kaynağı (bölge, parsel, nokta, alan, tramvay, arka plan). Elle düzenlenir. |
| `yerlesimDunya.js` | Manifestten greybox dünya kurar; konum HESAPLAMAZ. Yönlü kutu çarpışması + birleşik sınır + kapı önü ipucu. |
| `olcum/greybox.*` | Greybox ölçüm sayfası (üretim derlemesi, yerel; canlıya çıkmaz). |
| `bogaz.js` | **3A-1:** Boğaz vadisi (teraslar, deniz, karşı kıyı, stilize köprü) — manifest `arkaplan`'dan; CevreArkaplan mesh'ine girer (ek çağrı yok). Kamera ufku görmediği için deniz PLATONUN ALTINDA; dış zemin vadide delinir. |
| `cephe.js` | **3A-1:** modüler cephe sistemi — parça havuzu (`VARYANT`), `binaGeometrisi(parsel, H, lod)`, `CepheSistemi` (3 LOD, bina başına 1 çağrı, gölgeyi kütle vekili atar). Reçete `parsel.cephe`, LOD eşikleri `kurallar.cephe_lod`. Node'da da çalışır. **Reçete/ayak izi değişince `npm run cephe-ao`** (gömülü AO: `public/meydan/deneme/cephe_ao.bin`). Kapı/tabela/tente/aplik YALNIZ girilebilirde. |
| `yerlesimCoz.js` | **3A-2:** `manifestCoz(ham)` — manifesti çözen TEK yer: bölge `kaydir` ötelemesi (parsel, nokta, alan, tramvay, sınır) + sınır parçalarını bölgeden türetme. `dunya.js`, `yerlesimDunya.js`, `cephe_ao.mjs` hep bundan geçer. |
| `yapilar.js` | **3A-2:** özel yapılar (`parsel.yapi` / `nokta.yapi`): `metro`, `akm`, `cami`, `anit`, `lise`, + `sokakDevami` (İstiklal'in ucundaki siluet). cephe.js kalıbı: aynı atlas/malzeme, ton × AO, 3 LOD, yapı başına 1 çağrı. Parametreler manifestte (`akm`, `cami`, `anit` blokları). |
| `olcumSayaci.js` + `OlcumGostergesi.jsx` | **2C-A:** canlı haritada `?olcum=1` göstergesi (cihazda hatırlanır, `?olcum=0` kapatır). `CPU` = yalnız gönderim (sürekli); `CPU+GPU` = kare + `gl.finish` (yalnız düğmeyle). İki sayıyı karıştırma. |
| `olcum/meydan-test/katman2c.js` | **2C-B:** katman katman ölçüm (`katmanKos`, `propDetay`, `cozunurlukEgrisi`); rapor `ASAMA_2C_RAPOR.md`. |

Bağlantı: `src/App.jsx` (`/bildim/harita`) ve `src/BildimApp.jsx` (`/harita`)
**lazy** route; `Layout.jsx`'te "Harita" sekmesi. Harita'ya girmeyen oyuncu
three.js indirmez — `three.module-*.js` ayrı chunk'tır (driftgp ile paylaşılır).

## Kurallar
- **Tek harita Taksim (2B):** harita seçimi (`?harita=`) ve Paket 13 dünyası (göl, köprü, 7 bina) kaldırıldı. **Balıkçı/su iptal — geri getirilmez.** `avatar.js` silinmez (portre.js, onizleme.js kullanır).
- **Taksim yerleşimi koda gömülmez:** bina/nokta/alan konumu `yerlesim.json`'da değişir, `yerlesimDunya.js`'te değil.
- **Bölge kuralı (3A-2):** her parsel/nokta/alan `bolge` taşır (`bolgeler[*].id`); eksik/bilinmeyen bölge konsola hata. Bir bölgeyi taşımak = `bolgeler[*].kaydir: [dx, dz]` — zemin, kaldırım, bina, çarpışma, sınır, prop birlikte kayar. Tek tek konum düzeltme. Sınır parçaları bölgeden türetilir (ikinci kopya yazma).
- **Cumhuriyet Anıtı heykelleri SİLUET kalır:** duruş, pelerin hattı, kütle oranı var; yüz detayı (göz, burun, ağız, saç) **hiçbir LOD'da çizilmez**. Ürün sahibi kararı — optimizasyon ya da "daha güzel olur" gerekçesiyle bile değiştirilmez.
- **Yapı geometrisi değişince:** `npm run cephe-ao` (AO + `public/meydan/deneme/yapi_*.glb`) → `npm run muayene -- yapi_akm yapi_cami yapi_anit yapi_lise`; hedef 0 aday, düzeltme geometride (üstveriyle susturma yok).
- **Kozmetik/karakter geometrisi değişince:** `node bildim/harita/varlik/uret.mjs` → `npm run muayene`; kozmetiklerde hedef 0 aday. Düzeltme **geometride** yapılır — `acik_kenar_izinli` / `yassi_olabilir` / `kozmetik_izinli` beyanları aday susturmak için kullanılmaz, yalnız gerçekten kasıtlı ve gerekçesi yazılı durumlar içindir.

## MUAYENE RAPORLAMA KURALI (Paket 21 §G)

Bir muayene sonucu **hiçbir yerde tek başına "0 aday" diye yazılamaz.** Her rapor
(sohbet özeti, PAKET*_RAPOR.md, PROGRESS.md, commit mesajı) şu dördünü birlikte taşır:

1. **Hangi testler, hangi eşiklerle çalıştı.** Eşikler `muayene/ustveri/_esikler.json`'dadır
   ve sayı olarak yazılır ("oturma: yaslanma ≤ 0,8 cm ve temas ≥ %15, arama 2 cm").
2. **Neler muayene edildi ve neler EDİLMEDİ.** Seçimli koşuda atlanan varlıklar adıyla sayılır.
   "Tam koşu" demek yetmez; kaç varlık + kaç kart portresi ölçüldüğü yazılır.
3. **Hiç kapsanmayanlar.** Harita yerleşimi (Boğaz, cepheler, yapılar) ayrı komutla denetlenir;
   oyun içi ışık, gölge ve animasyon muayenede hiç ölçülmez.
4. **Muayenenin ÖLÇEMEDİKLERİ — her seferinde tekrar edilir:** estetik, oran, stil, renk uyumu.
   Muayene "çirkin mi" sorusunu yanıtlamaz; yalnız ölçülebilir geometri kusurlarını (boşluk,
   delik, kâğıt incelik, kadraj, kesişim, simetri) bulur. **0 aday = "bu testlerden geçti",
   "güzel oldu" DEĞİL.** Görsel yargı sahibinindir; muayene onun yerine geçmez.

**Paket 23 §F.4 eki:** "0 aday" bir **kalite kapısı değildir, geometrik tutarlılık kapısıdır.** Estetik, oran,
stil uyumu ve "inandırıcı mı" sorusu göz kararıdır; muayene bunu hiçbir zaman ölçmeyecek. Rapor "düzeldi" demekle
bitmez, görselle biter.

`npm run muayene` bu bloğu koşunun sonunda kendisi basar ve `cikti/ozet.json › kapsam`
alanına yazar — rapora oradan aynen geçirilir. Kural neden var: Paket 21'de sahibi vitrinde
boynuna bağlı pelerin, havada taç, altı delik şapka görürken muayene "0 aday · 0 susturulan"
diyordu; sebep testlerin azlığıydı ama rapor bunu göstermiyordu, "temiz" gibi okunuyordu.
- **Veritabanı değişikliği yok.** Konum kalıcı tutulmaz; presence + broadcast.
- Başka oyun modülünden import yok; yalnız `src/` kabuğu + `bildim/lib`.
- Bina listesi/renkleri `dunya.js › BINALAR` — mod renkleriyle aynı, değiştirme.
- Tüm Supabase çağrıları try-catch; kanal kopsa da sahne çalışır ("bağlantı yok").
- Sekme gizliyken (`document.hidden`) RAF render atlanır ve konum yayını durur.

## Bilinmesi gereken tuzaklar
- **three r128 → 0.185:** yeni sürümde ışıklar fiziksel birim; referanstaki
  yoğunluklar `π` ile çarpıldı, yoksa sahne karanlık çıkar.
- **"İlk paket" NaN tuzağı (`coklu.js`):** `sonPoz` "gönderilmedi" için NaN
  tutulur; `Math.abs(x - NaN) > 0.01` **her zaman false**. Değişiklik kontrolünden
  önce `Number.isFinite` ile ayrıca bakılır — yoksa hiç konum gitmez.
- **Otomasyon/arka plan sekmesi:** Chrome RAF'ı durdurur, sayfa "hazırlanıyor"
  perdesinde kalır (ilk kare gelmedi). Ürün hatası değil.
- `.app` sarmalayıcısı içindeyiz ama sayfa `position: fixed; z-index: 70` ile
  tam ekran; `useOyunModu(true)` sekme çubuğunu/davet bandını gizler.
- Yeni hesabın ilk-giriş tanıtımı (`Tanitim`, z-index 210) haritanın
  üstünde çıkar; bir kez kapatılır, harita hatası değil.

## Test
`.tmp/harita-test/` (git dışı) uygulamanın gerçek modüllerini React'siz
yükler; `?kim=a` / `?kim=b` iki ayrı anonim oyuncu, `?dusuk=1` düşük donanım.
`window.__test.tick(dt, n)` kareleri elle ilerletir (gizli sekmede RAF yok),
`__test.girdi = {ix, iz}` yürütür, `__test.emoji("🔥")`, `__test.yik()/kur()`.
Dev sunucu açıkken: `http://localhost:5173/.tmp/harita-test/index.html?kim=a`.

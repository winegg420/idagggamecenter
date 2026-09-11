# GÖREV: Harita ekranı açılmıyor (siyah ekran)

## Belirti (canlı sitede doğrulandı — quizador.pages.dev/harita)
Sayfa açılıyor, HUD çalışıyor, ama **3B sahne hiç görünmüyor**. Ekran
`.bd-harita` sınıfının koyu lacivert zemininde (`#0e1726`) kalıyor.
Bazen "sahne hazırlanıyor…" katmanı sonsuza kadar duruyor, bazen kayboluyor
ama arkası boş.

## Tarayıcıdan ölçtüğüm kanıtlar
- **`requestAnimationFrame` saniyede 0 kez çağrılıyor** → çizim döngüsü durmuş.
  (Ölçüm: `rAF`'ı sarmalayıp 1 saniye saydım, sonuç 0.)
- Canvas DOM'da var, boyutu doğru (1536×735 CSS / 1920×918 iç), `display:block`,
  `opacity:1`, üstünü kapatan başka eleman yok.
- WebGL destekleniyor (`getContext('webgl2')` başarılı).
- three.js yüklenmiş: `HaritaSayfasi-*.js` chunk'ı 531 KB olarak indi.
- **Konsolda hiçbir hata yok** — sessizce ölüyor.
- Sayfadan çıkıp tekrar girince de düzelmiyor; ikinci girişte "sahne
  hazırlanıyor…" hiç kaybolmadı.
- Çok oyunculu kısım ÇALIŞIYOR: üstte "1 kişi burada" yazıyor, yani
  `meydanBaglan` bağlanmış. Yani effect gövdesi en azından bir kez çalışmış.

## En güçlü şüphe
`bildim/harita/HaritaSayfasi.jsx:209` — effect bağımlılıkları:

```js
}, [user?.id, Boolean(profile)]);
```

ve effect başında:

```js
if (!kapsayici || !user || !profile) return undefined;
```

`profile` bir an `null` olursa (oturum tazeleme, ağ hatası, `profilim`
çağrısının başarısız dönmesi) `Boolean(profile)` `true → false` olur:
temizleme fonksiyonu çalışır (`aktif = false`, `cancelAnimationFrame`,
`dunya.yokEt()`), effect yeniden kurulurken erken `return` eder ve
**sahne bir daha asla kurulmaz**. Canvas DOM'da kalır ama boş.

Not: `src/context/AuthContext.jsx` içinde `refreshProfile` iki kez çağrılıyor
(`getSession().then()` + `onAuthStateChange` — `INITIAL_SESSION` olayı yüzünden).
Bu, `profile`'ın kısa süre `null` olma ihtimalini artırıyor.

**Bunu varsayma — önce yerel dev sunucusunda doğrula.**

## Doğrulama adımı (önce bunu yap)
`HaritaSayfasi.jsx` içindeki effect'in başına ve temizleme fonksiyonuna geçici
log koy:

```js
console.log("[Meydan] effect kuruluyor", { user: !!user, profile: !!profile });
// temizlemede:
console.log("[Meydan] temizleniyor");
```

Dev sunucusunda `/harita` aç ve sırayı izle. Beklenen hatalı desen:
`kuruluyor → temizleniyor → (bir daha kuruluyor yok)`.

## İSTENEN DÜZELTMELER

### 1. Sahne, profile yüzünden yıkılmasın
Effect yalnızca **gerçekten gerektiğinde** yeniden kurulmalı. `profile`
sahnenin kurulumu için değil, yalnız **avatarın adı ve rengi** için gerekli.

Öneri:
- Effect bağımlılığını sadeleştir: sahne `user?.id` varken bir kez kurulsun.
- `ad` ve renk gibi profil bilgileri effect içinde `ref` üzerinden okunsun;
  değiştiğinde sahneyi yıkmak yerine **yalnız avatarın etiketini güncelle**.
- `profile` henüz gelmemişse sahneyi yine de kur, avatarı geçici "Oyuncu"
  adıyla göster, profil gelince adı güncelle.

Böylece profil bir an `null` olsa bile sahne ayakta kalır.

### 2. Sessiz ölümü bitir
Çizim döngüsü `cizim` fonksiyonunun tamamı `try/catch` içine alınsın:

```js
const cizim = (t) => {
  if (!aktif) return;
  raf = requestAnimationFrame(cizim);
  try {
    ...mevcut gövde...
  } catch (e) {
    console.error("[Meydan] kare hatasi:", e);
    aktif = false;
    cancelAnimationFrame(raf);
    setHata("Sahne çizilemedi");   // kullanıcıya görünür mesaj
  }
};
```

Şu an bir kare hatası tüm sahneyi sessizce öldürüyor ve kullanıcı siyah ekran
görüyor. En azından ne olduğunu görelim.

### 3. Yükleme katmanı sonsuza kadar kalmasın
`setYukleniyor(false)` yalnız ilk kare çizilince çağrılıyor. İlk kare hiç
gelmezse katman sonsuza kadar duruyor. Ek olarak:
- Effect kurulduktan **8 saniye** sonra hâlâ `yukleniyor` ise katmanı kaldır ve
  yerine hata kutusu göster: "Sahne yüklenemedi — tekrar dene" + yeniden
  deneme düğmesi (sahneyi yeniden kurar).

### 4. WebGL yoksa dürüst mesaj
Sahne kurulmadan önce WebGL desteğini kontrol et. Yoksa 3B sahne yerine
"Cihazın 3B grafik desteklemiyor" mesajı ve "Oyuna dön" düğmesi göster.
(Şu an bu durumda da siyah ekran çıkar.)

### 5. `.bd-harita` zemini
`harita.css:11` — `background: #0e1726`. Sahne yüklenene kadar bu koyu lacivert
görünüyor ve oyunun açık temasıyla çelişiyor. Gökyüzü rengine çevir
(`#BFE8FF`), böylece sahne gelmeden önce de doğru görünür.

## KURALLAR
- Mevcut kodu silme/bozma, minimal değişiklik.
- Oyun mantığı, RPC, migration YOK.
- Türkçe yaz.
- Tüm Supabase çağrılarında try-catch.
- Durma, onay isteme; bitince tek özet ver.

## DOĞRULAMA (kendin yap)
1. `npm run build` hatasız.
2. Dev sunucusunda `/harita` aç → sahne **görünüyor**: gökyüzü, çim, meydan,
   havuz, 7 bina, ağaçlar. Avatar yürüyor.
3. Konsolda şu tek satırı çalıştır, **0'dan büyük** olmalı:
```js
let n=0;const o=requestAnimationFrame.bind(window);
window.requestAnimationFrame=f=>{n++;return o(f)};
setTimeout(()=>{window.requestAnimationFrame=o;console.log('FPS:',n)},1000);
```
4. Haritadan çık, gir, tekrar çık → her seferinde sahne geliyor, canvas sayısı
   1'de kalıyor, bellek artmıyor.
5. Sayfayı yenilemeden oturum tazelenirse (bekle veya `refreshProfile` tetikle)
   sahne yıkılmıyor.
6. 390px genişlikte HUD taşmıyor.

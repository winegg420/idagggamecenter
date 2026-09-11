# GÖREV: Quizador Meydanı — 3B çok oyunculu buluşma alanı

## Ne yapıyoruz
Oyuna **"Harita"** adında yeni bir bölüm ekliyoruz. Oyuncu bu düğmeye basınca
3B bir meydana ışınlanır: kendi avatarıyla yürür, o anda meydanda olan diğer
oyuncuları **canlı** görür, birbirlerine emoji atarlar, oyun modlarının
binalarına girerek o moda geçerler.

**Onaylanmış görsel referans: `QUIZADOR_MEYDAN_REFERANS.html`** (bu prompt ile
birlikte verildi — proje köküne koy, tarayıcıda aç, gez, kodunu oku).
Sahnenin tamamı (zemin, meydan, havuz, binalar, ağaçlar, banklar, lambalar,
avatar, kamera, kontrol, emoji) çalışır halde o dosyanın içinde. **Yeniden
tasarlama — o dosyadaki sahneyi al, React bileşenine taşı.**

---

## MİMARİ KARARLARI (tartışma, uygula)

1. **Yeni izole modül:** `bildim/harita/` klasörü. İçinden başka oyun
   modüllerine import yok. Repo kuralları geçerli (bkz. kök `CLAUDE.md`).
2. **three.js düz kullanılacak** (React Three Fiber değil) — referans dosya
   düz three.js ile yazıldı, birebir taşınsın. `npm install three`.
3. **Lazy route.** Sahne **sadece** oyuncu Harita'ya girince indirilecek:
   `React.lazy(() => import("../harita/HaritaSayfasi.jsx"))`. Harita'ya hiç
   girmeyen oyuncu tek byte three.js indirmesin. Build sonrası ayrı chunk
   oluştuğunu doğrula.
4. **Veritabanı değişikliği YOK.** Konum kalıcı tutulmayacak; Supabase
   Realtime `presence` + `broadcast` yeterli. **Migration yazma.**
5. Mevcut hiçbir ekran, RPC, puanlama, joker mantığı değişmeyecek.

---

## FAZ 1 — İskelet

- `npm install three`
- `bildim/harita/HaritaSayfasi.jsx` — tam ekran bir `<canvas>` ve boş sahne.
- Rota: `bildim` mod rotalarına `/harita` ekle (lazy).
- Giriş noktası: alt sekme çubuğuna **Harita** sekmesi ekle
  (`bildim/components/Layout.jsx`). Sekme sayısı 5'ten 6'ya çıkıyor — ikon ve
  etiket boyutlarını daralt, taşma olmasın.
- Sayfa açılınca yükleniyor ekranı (referanstaki gibi), sahne hazır olunca kalk.
- `npm run build` → yeni chunk var mı kontrol et.

## FAZ 2 — Dünyayı kur

Referans dosyadaki sahne kurulumunu birebir taşı: ışıklar, çim ve yamalar,
kaldırım taşı meydan + desenler, havuz (kaide, su, sütun, jetler, dalga),
7 bina (gövde, çatı, kapı, kemer, pencereler, saksılar, tabela), yollar,
banklar, lambalar, ağaçlar, çalılar, bulutlar, engel listesi.

Sahne kurulumunu `bildim/harita/dunya.js` içine ayır — `HaritaSayfasi.jsx`
sadece React yaşam döngüsünü ve HUD'u yönetsin.

Bina listesi (renkleri mevcut mod renklerimizle aynı, değiştirme):

| Bina | Duvar | Çatı | Gideceği rota |
|---|---|---|---|
| Meydan Oku | `#FF5B4A` | `#C03225` | `/meydan` |
| Hızlı Mod | `#FFB020` | `#C98A22` | `/hizli-mod` |
| Grup Maçı | `#4A9DD9` | `#2B6BA3` | `/meydan` |
| Turnuva | `#A855F7` | `#6D21B0` | `/turnuva` |
| Dükkân | `#EC4899` | `#A81B62` | `/joker` |
| Lig | `#2FBF71` | `#137A45` | `/siralama` |
| Hatalarım | `#20A4A0` | `#0F6B68` | `/calisma` |

## FAZ 3 — Oyuncu kontrolü

- Avatar, yürüme animasyonu, yumuşak dönüş — referanstaki gibi.
- Kontrol: ekran topuzu (dokunmatik) + WASD / yön tuşları.
- Çarpışma: engel listesi + havuz merkezi + harita sınırı (referanstaki
  `carpismaDuzelt`).
- Kamera oyuncuyu yumuşak takip etsin.
- `prefers-reduced-motion: reduce` ise kamera lerp'i ve süs animasyonları
  (jet, dalga, bulut) kapansın; oyuncu hareketi kalsın.

## FAZ 4 — Binalara giriş

Oyuncu bir binaya 8 birimden yakınsa altta ipucu çıkar (bina adı + alt başlık).
İpucuna dokununca `navigate(y(rota))` ile o moda gider. Rotalar `bildim/lib/yol.js`
üzerinden üretilsin, elle yazma.

## FAZ 5 — Çok oyunculu (asıl iş)

Supabase Realtime, tek kanal: `meydan`.

**Katılım:** `channel.subscribe()` sonrası `channel.track({ id, ad, renk, sac })`
ile presence'a gir. `presence` state'i kimlerin meydanda olduğunu verir —
üstteki "N kişi burada" hapı bu sayıyı gösterir.

**Konum:** `broadcast` ile, **saniyede en fazla 8 kez**, yalnız konum değiştiyse:
```
channel.send({ type:'broadcast', event:'poz', payload:{ id, x, z, y:donus } })
```
Gelen konumlar doğrudan uygulanmasın — hedef olarak tutulup her karede
**ara değerle yumuşatılsın** (lerp), yoksa hareket kesik görünür.

**Emoji:** ayrı broadcast olayı `emoji`, payload `{ id, e }`.

**Kurallar:**
- Kendi id'inden gelen mesajı yok say.
- Presence'tan çıkan oyuncunun avatarını sahneden kaldır ve `dispose()` et.
- Sayfadan ayrılırken `supabase.removeChannel(kanal)`, `cancelAnimationFrame`,
  ve tüm geometry/material `dispose()` — sızıntı bırakma.
- Sekme arka plana geçince broadcast'i durdur, geri gelince devam et
  (`visibilitychange`).
- Aynı anda 40'tan fazla oyuncu varsa yalnız en yakın 40'ı çiz.
- **Tüm çağrılarda try-catch.** Realtime kopsa bile sahne çalışmaya devam
  etsin; oyuncu tek başına dolaşabilsin, üstte "bağlantı yok" uyarısı çıksın.

**Avatar görünümü** oyuncunun profilinden gelsin (renk/isim). Profilde renk
alanı yoksa `user.id`'den deterministik bir renk üret — yeni kolon ekleme.

## FAZ 6 — Emoji ve isim etiketleri

- 6 emoji düğmesi (👋 😂 🔥 🤔 🎉 ⚔️), referanstaki balon animasyonu.
- Her avatarın üstünde isim etiketi (canvas sprite).
- Emoji hız sınırı: oyuncu başına 2 saniyede 1.

## FAZ 7 — Performans ve mobil

- `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`.
- Düşük donanımda (`navigator.hardwareConcurrency <= 4`) gölgeleri kapat,
  ağaç ve çalı sayısını yarıya indir.
- Sahneyi sayfa gizliyken render etme (`document.hidden` → RAF'ı atla).
- Hedef: orta seviye Android'de 30 FPS altına düşmemek.
- Telefonda dikey ekranda HUD taşmasın; topuz sağ altta, emoji sol altta.

---

## KURALLAR
- Türkçe yaz (kod, yorum, commit).
- Mevcut kodu silme/bozma. Yalnız yeni klasör + `Layout.jsx`'e bir sekme +
  rota dosyasına bir satır.
- Migration YOK, RPC YOK, puanlama değişikliği YOK.
- Tüm Supabase çağrılarında try-catch.
- `main`'e push etme, deploy etme — bitince bana bildir.
- FAZ 1'den FAZ 7'ye kadar **durmadan** yap, onay isteme.

## DOĞRULAMA (kendin yap)
1. `npm run build` → hata yok, harita ayrı chunk olarak çıkıyor.
2. Harita'ya girmeden gezilen sayfalarda three.js yüklenmiyor (Network sekmesi).
3. İki tarayıcı sekmesinde iki farklı hesapla gir → iki avatar birbirini
   görüyor, hareket akıcı, emoji karşı tarafta görünüyor.
4. Haritadan çıkıp girince avatar çoğalmıyor, bellek artmıyor.
5. 390px genişlikte HUD taşmıyor, topuz çalışıyor.
6. Konsolda hata yok.

Bitince tek kısa özet: eklenen dosyalar, chunk boyutu, çok oyunculu test
sonucu, ölçülen FPS.

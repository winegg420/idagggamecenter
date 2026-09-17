# Aşama 2D — Sınır, optimizasyon, çeviri dağıtımı + ödüller (17 Eyl 2026)

| Bölüm | Durum | Commit | Migration |
|---|---|---|---|
| A — karakter sınırı 8 → 20 | ✅ canlıda | `f39ae2d` | 211 (uygulandı) |
| B — statik temas gölgesi pişirme | ✅ canlıda; görsel kayıp yok; **masaüstünde süre kazancı yok** | `bd5ce0e` | — |
| C — çeviri hattı dağıtımı | ⚠️ **dağıtıldı**, ama kuru çalıştırma yapılamadı: `ANTHROPIC_API_KEY` secret'ı yok | (panel) | — |
| D — Hızlı Mod tavanı + turnuva +10 | ✅ tavan canlıda; turnuva: **karar, değişiklik yok** | `04932f5` | 212 (uygulandı) |
| E — lig çerçeveleri + turnuva giysisi | ✅ canlıda | `3e86e7d` | 213 (uygulandı) |

---

## 1. A — Karakter sınırı

- `oyun_ayarlari.meydan_uc_boyutlu_sinir`: **8 → 20** (migration 211, canlıya uygulandı).
- İstemci değeri her harita açılışında `oyun_ayarlari`'ndan okur. Kod değişikliği gerekmedi. Sayfayı yeniden yükleyen oyuncuda 20 geçerli olur.
- Geri alma tek satır (migration dosyasında da yazılı):
  ```sql
  update public.oyun_ayarlari set deger = '8'::jsonb where anahtar = 'meydan_uc_boyutlu_sinir';
  ```

> ### ⚠️ Zayıf cihaz hatırlatması
> Karar, **Galaxy S24 FE** ölçümüne dayanıyor. Bu 2024 model, güçlü bir telefon; **ortalama oyuncunun cihazı değil**.
> **Yayından önce** 3–4 yıllık, orta-alt segment bir Android telefonda ölçüm yapılmalı:
> `/harita?olcum=1` → İstiklal ucuna yürü → "CPU+GPU ölç".
> Sınır 25'e çıkarılacaksa o ölçüm şart.

---

## 2. B — Temas gölgesi optimizasyonu

### Seçilen yöntem: statik gölgeleri zemin shader'ına pişirme (seçenek 1'in bir çeşidi)

- **Hangi gölgeler statik:** Yalnız ağaç (90) ve bank (14) temas gölgesiydi. Lamba ve saksının temas gölgesi zaten yoktu.
- **Maske:** Bu 104 gölge, sayfa açılışında bir kez **dünya koordinatlı maske dokusuna** (513×785 px, metre başına 6 px) çiziliyor.
- **Karıştırma:** Zemin malzemesinin fragment shader'ında (klon; propların paylaşılan malzemesine dokunulmadı) karıştırılıyor.
- **Neden atlas pişirme değil:** Zemin UV'leri karo atlasına ait, atlasa gölge çizmek bütün karoları etkilerdi. Dünya-XZ maske ek UV gerektirmiyor.
- **Neden seçenek 2 değil:** Saydam olmayan katman yumuşak kenarı veremez.
- **Neden seçenek 3 değil:** Güneş gölgesine bırakmak, ağaç ve bank altındaki yumuşak koyuluğu kaldırırdı; görsel kayıp olurdu.
- **Birebir karışım:** Saydam düzlemin çerçeve arabelleğindeki harmanlaması kopyalandı: ton eşleme → sRGB, sisten önce, alfa × 0,55, üst üste binmede source-over.
- **Ek maliyet:** Çağrı yok, saydam katman yok, harmanlama yok. Zemin pikseli başına bir doku örneği.

### Ölçüm (en kötü açı, İstiklal ucu, 25 oyuncu + 2 bot + 8 kedi, sınır 20, 1536×791, DPR 1, 120 ısınma + 300 örnek, 3 yükleme)

| | önce | sonra |
|---|---:|---:|
| Çağrı | 129 | 129 |
| Görünen üçgen | 396.830 | 396.622 |
| CPU+GPU medyan (yükleme 1 / 2 / 3) | 3,9 / 5,1 / 5,0 ms | 3,9 / 5,5 / 5,4 ms |
| CPU+GPU p95 | 4,8 / 6,2 / 6,2 ms | 5,0 / 6,3 / 6,3 ms |
| CPU (render.render) medyan | 3,3 / 4,5 / 4,2 ms | 3,3 / 4,8 / 4,7 ms |
| **Dinamik temas gölgesi** | **139** | **35** (25 oyuncu + 2 bot + 8 kedi) |

Ham veriler: `olcum/sonuc-2d/2d-once.json`, `2d-sonra.json`. Betik: `katman2c.js › pisirmeOlc()`.

### Sonuç — beklenen kazanç YOK, sebebi ölçüldü

- **Çağrı sayısı değişmedi.** Temas gölgeleri zaten tek InstancedMesh, yani tek çağrıydı.
- **Süre değişmedi.** Önce/sonra farkı yüklemeler arası saçılmanın içinde; yükleme 2–3'te bile sonra biraz yüksek.
- **Birinci sebep:** En kötü açıda (İstiklal) **hiç ağaç ya da bank yok**. Pişirilen 104 gölge o kamerada zaten ekran dışındaydı; GPU onları kırpıyordu. Aşırı çizim (overdraw) yapmıyorlardı.
- **İkinci sebep:** 2C'nin kendi verisi hipotezi desteklemiyordu. `propDetay` tablosunda **"yalnız lamba"** ve **"yalnız saksı"** satırlarında temas gölgesi **gizliydi**, ama aynı ~2 ms basamağı yine oluştu. Basamağı temas gölgesi tetiklemiyor.
- **Değişiklik yine de tutuldu:**
  - Görsel fark yok: ortalama piksel farkı 0,06/255. 30'dan büyük fark gösteren piksel oranı %0,2; bunlar animasyon kaynaklı.
  - Plaza açılarında 104 saydam düzlem artık çizilmiyor.
  - Dolum sınırlı telefonlarda plazada fayda sağlaması muhtemel, ama **masaüstünde ölçülmedi**. Telefonda `?olcum=1` ile plaza açısında doğrulanmalı.

**Görsel karşılaştırma** (üst önce, alt sonra):
- plaza yakın, bank gölgeleri: `gorsel/2d/b-once-sonra-yakin.jpg`
- en kötü açı: `gorsel/2d/b-once-sonra-enkotu.jpg`

---

## 3. C — Çeviri hattı dağıtımı

- **Dağıtım yolu:** `npx supabase functions deploy` yine **403** verdi (CLI belirteci başka hesaba ait). Dağıtım Supabase paneli (Code sekmesi) üzerinden yapıldı.
- **Üzerine yazmadan önce:** Canlı `index.ts` karşılaştırıldı. Commit `e9cbdb2` ile birebir aynıydı; tek fark başlık yorumundaki eski adın "Quiz Square" olmasıydı.
- **Yüklenen dosyalar:** `index.ts` ve `kalite.ts` depoyla karakter karakter aynı yapıldı; yeni `ceviri.ts` eklendi. Üç dosya da depoyla eşit doğrulandı.
- **Doğrulama:** "Deploy updates" çalıştı. Fonksiyon "a few seconds ago" güncellendi ve değişiklik rozetleri kalktı. Yeni koda istek atıldı: `{"mod":"ceviri", …, "kuru":true}` yeni hattın yanıtını döndü, yani yeni kod çalışıyor.

### ⚠️ Kuru çalıştırma yapılamadı: `ANTHROPIC_API_KEY` tanımlı değil

- **Gerçek yanıt:**
  ```
  POST {"mod":"ceviri","dil":"en","adet":10,"kuru":true} → 500 {"hata":"ANTHROPIC_API_KEY tanımlı değil"}
  ```
- **Secrets sayfası:** Yalnız `CRON_SECRET`, `VAPID_PUBLIC_KEY` ve `VAPID_PRIVATE_KEY` var. **Anthropic anahtarı yok.**
- **Eksik kalanlar:** Bu yüzden geri kontrol istatistiği, `ceviri_atlanan` dağılımı ve sözlük örneği ("Düello" → "Duel") **ölçülemedi**.
  - Sözlük istemde var ve testle doğrulandı: `ceviri-test.mjs › "Düello → Duel"`.
  - Modelin istemdeki sözlüğü gerçekten uyguladığı görülmedi.
- **Sahibinin yapması gereken (anahtarı yalnız sahibi bilir):** Panel → Edge Functions → Secrets → `ANTHROPIC_API_KEY` ekle. Sonra kuru çalıştırma:
  `POST /functions/v1/generate-questions` · header `x-cron-secret` · gövde `{"mod":"ceviri","dil":"en","adet":10,"kuru":true}`

### Not — "cron kapalı" tespiti yanlış: cron AÇIK, ama her çağrı başarısız

- **Cron işi:** Depoda soru üretimi için `cron.schedule` satırı yok, ama canlı veritabanında **`bildim-soru-uret` işi var ve aktif** (`30 * * * *`, saatte bir). İş panelden ya da elle kurulmuş olmalı.
- **`net._http_response` kayıtları:** Son çağrılar `500 {"hata":"ANTHROPIC_API_KEY tanımlı değil"}` dönüyor. Son kayıt 17 Eyl 06:30 UTC.
- **Etki:** Havuza son soru **11 Eylül**'de eklendi. Havuz o günden beri büyümüyor.
- **Bu pakette cron'a dokunulmadı** (ne açıldı ne kapatıldı). Anahtar eklenirse saatlik üretim **kendiliğinden başlar** ve her parti çeviri hattından geçer.
  - Plan FREE: Edge Function duvar saati sınırı 150 sn.
  - Üretim + çeviri + geri kontrol bu sınıra yaklaşabilir. `ceviri_sure_siniri_sn` (100) aşılırsa çeviri o çağrıda ertelenir ve `ceviri_uyari_raporu()`'nda görünür.

---

## 4. D — İki küçük ayar

### D.1 Hızlı Mod soru tavanı — uygulandı

- **Ayar:** `oyun_ayarlari.hizli_mod_soru_tavani = 9` (migration 212).
- **`hizli_mod_cevap`:** `aktif_soru >= least(soru sayısı, tavan)` olunca oturum biter; kalan süre kullanılmaz.
- **`hizli_mod_soru`:** Tavan dolmuşsa yeni soru vermez.
- **`hizli_mod_baslat`:** Dönen `soru_sayisi` tavanla sınırlanır.
- **İstemci:** Bitiş perdesi tavanla bittiyse "Süre doldu!" yerine **"Sorular tamamlandı!"** yazıyor (TR + EN).
- **Sınama:** Kurucu hesapla, geri alınan işlem içinde başlat → 9 kez soru + cevap çalıştırıldı. `bitti` **9. cevapta** true geldi, `soru_sayisi` 9 döndü.

### D.2 Turnuva "katılan +10" — **KARAR: DEĞİŞİKLİK YOK**

- Mevcut lig puanı korunuyor: 150 / 80 / 40 / 4–10. sıra 20 / diğer katılan 10.
- Gerekçe: Dereceye giren zaten katılım değerinin üstünde puan alıyor. Üstüne +10 eklemek 10. ile 11. arasında uçurum yaratır (30 ↔ 10).
- Kod değişikliği yok. Bekleyen iş listesinden düşürüldü.

---

## 5. E — Ödüller

### Lig çerçeveleri

| | |
|---|---|
| **Tablo** | `lig_cerceveleri(user_id, lig ∈ gumus/altin/elmas/efsane, kazanildi, kaynak)` — ayrı tablo, RLS kapalı |
| **Kazanma** | `lig_haftayi_kapat()` içinde lig atlayan oyuncuya `lig_cerceve_ver(user, yeni lig, 'lig_yukselme')` |
| **Kalıcılık** | Düşürme yolu çerçeveye dokunmuyor, silen kod yok |
| **Seçim** | `lig_cerceve_sec(lig \| null)` — yalnız kazanılan çerçeve; seçilmemişse en yüksek çerçeve otomatik takılı |
| **Saklama** | Seçili çerçeve `profiles.gorunum.lig_cerceve`. Görünüm doğrulayıcıları bilinmeyen anahtarı attığı için elle yazılamaz |
| **Satış** | Satın alma yolu yok (eşya tablolarında değil) |
| **Geriye dönük** | Şu anki lig + `lig_uyelik` geçmişindeki en yüksek lig: **271 çerçeve** (gümüş 120, altın 83, elmas 49, efsane 19). **Gizli botlar dahil**; aksi hâlde "çerçevesi olmayan yüksek ligli oyuncu = bot" diye ayırt edilebilirlerdi |

**Neden eşya tablolarına (`avatar3d_parcalar` / `esyalar`) oturtulmadı:**
1. Çerçeve bir giysi yuvası değil. Gardırop listesi istemcide sabit (`envanter.js › PARCALAR`) ve `avatar3d_dogrula` yuva beyaz listesiyle çalışıyor.
2. **Canlıda `kozmetik_bedava_test = true`.** Eşya satın alma RPC'si bu anahtarla ödül eşyasını da bedava açıyordu. Çerçeve oraya konsaydı "satılmaz" kuralı delinirdi.
3. Kazanma kaynağı lig kapanışı, dükkân değil.

**Görünürlük:**
- **Düz avatar:** `AvatarCerceve` seçili lig çerçevesini nadirlik halkasının **yerine** çiziyor. İç renk halkası + beyaz ara + dış ton; Efsane'de yavaş parıltı var, `prefers-reduced-motion`'da kapalı.
  - Başka oyuncuların çerçevesi toplu RPC `oyuncu_lig_cerceveleri` ile okunuyor (görünüm kaydı istemciye kapalı).
  - Kullanıldığı ekranlar: Ana sayfa, Profil, Lig sıralaması + podyum, Maç üst şeridi, Turnuva, Oyuncu kartı.
  - **Görünmediği ekranlar:** düz `<Avatar>` kullananlar (Arkadaşlar, Meydan Oku listesi, Grup/Hızlı maç listeleri). Oralara yaymak ayrı iş.
- **Meydan (3B):** İsim etiketinin kenarı lig renkleriyle çiziliyor.
  - Görünüm presence ile zaten taşındığı için ağa ek alan eklenmedi.
  - Seçim değişince yalnız etiket yenileniyor.
  - Gövdeye çerçeve konmadı; "karakter gövdesine dokunma" kuralı gereği.
- **Seçici:** Profil sayfasında "Lig çerçevelerim" kartı. Kazanılmayan ligler kilitli, "🔒 lig atla" yazıyor.
- **Görseller:** `gorsel/2d/e-cerceve-profil.jpg`, `gorsel/2d/e-cerceve-meydan.jpg` (sahte veriyle yerel düzenek).

### Turnuva ilk 3 giysisi

| | |
|---|---|
| **Tablo** | `turnuva_giysi_odulu(hafta → parca_id)`; `turnuva_haftalik_giysi()` bu haftanın satırını, yoksa en sonuncuyu döner |
| **Dağıtım** | `turnuva_odullerini_dagit` içinde ilk 3'e `avatar3d_odul_ver(…, 'turnuva')`. Sunucuda, security definer; mevcut coin, lig puanı ve rozet mantığına dokunulmadı |
| **Tekrar** | Zaten sahipse eşya verilmez; `turnuva_giysi_tekrar_coin` kadar ek coin (**varsayılan 0** = yalnız mevcut derece coin'i; SQL ile artırılabilir) |
| **Satılmaz** | Tabloya giren parça tetikleyiciyle `coin_fiyat null` + `etkinlik` yapılıyor. Gardırop onu "Satılmaz" diye kilitli gösteriyor |
| **Haftalık değişim** | `insert into public.turnuva_giysi_odulu (hafta, parca_id) values ('2026-09-21', 'bas_tac');` |
| **Bu hafta** | `sirt_pelerin` (Pelerin) |

**Sınama (geri alınan işlem):**
- Son biten turnuvanın dağıtımı yeniden çalıştırıldı: ilk 3'ün üçü de Pelerin aldı.
- İkinci çalıştırmada satır sayısı değişmedi (tekrar verilmedi) ve hata çıkmadı.
- Bronz kurucu hesap `lig_cerceve_sec('efsane')` → "Bu çerçeveyi henüz kazanmadın".
- `avatar3d_satin_al('sirt_pelerin')` → "yalnız ödül olarak kazanılır".

**Yan düzeltme (satılmaz kuralı):**
- `avatar3d_satin_al` artık etkinlik ve ödül eşyasını **`kozmetik_bedava_test` açıkken de** reddediyor. Gardıropta bu eşyalar satın alma çubuğundan çıkarıldı.
- Önceden test anahtarı Taç ve Pelerin'i herkese bedava açıyordu. Bu, CLAUDE.md'deki "etkinlik eşyaları satılmaz" kuralına aykırıydı.

### Brifle uyuşmayan noktalar (karar sahibinde)

1. **Turnuva haftalık değil**, günde 7 kez yapılıyor. "Haftalık ödül" = o hafta yapılan **bütün** turnuvaların ilk 3'ü aynı giysiyi alır, diye yorumlandı.
2. **"Uzay Kıyafeti" diye bir eşya yok.** Tek satılmaz 3B giysiler Taç ve Pelerin. Yeni giysi modeli üretmek bu paketin dışında (karakter gövdesi ve varlık işi).
3. **Meydan Taç ve Pelerin'i çizmiyor** (`meydanAvatar` yalnız kep, bere ve gözlüğü çiziyor). Kazanılan giysi gardıropta ve portrede görünür, meydanda henüz görünmez.
4. **Eski 2D ödüller** (kazanana `spk_04` Taç, ilk 3'e `efk_02`) olduğu gibi duruyor.

---

## DUR

Kedi, tramvay, İstiklal cephesi ve karakter gövdesi işine girilmedi. Soru üretim cron'una dokunulmadı.

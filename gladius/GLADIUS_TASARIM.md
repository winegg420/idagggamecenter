# Gladius Battle Royale — Tasarım Notları (Claude Code Handoff)

> Bu doküman canlı bir belge. İda ile tasarım konuşmaları ilerledikçe güncellenecek.
> Run.md dosyasındaki (RUN projesi spec'i) analiz baz alınarak hazırlandı.
> Şu an sadece TASARIM aşamasındayız, kod yazılmıyor.

---

## 0. GENEL ÇALIŞMA KURALLARI (Claude Code için — birebir uygulanacak)

- Her zaman Türkçe yanıt ver.
- Adım adım, sade bir dille açıkla.
- Değişiklik yapmadan önce ne yapacağını açıkla, onay bekle.
- Mevcut kodu silme veya bozma. Sadece gerekli yerleri değiştir, minimal değişiklik yap.
- Dosya silme veya yeniden yazma yerine düzenlemeyi tercih et.
- Her zaman en az kod değişikliğiyle sorunu çöz.
- Tüm API çağrılarında try-catch ve hata yönetimi kullan.
- Emin olmadığın bir şey varsa tahmin etme, sor. (İstisna: görsel/deneyim/oyun tasarımı detaylarında — Bölüm 0 istisnasına bakınız — sormadan profesyonel yargıyla ilerlenebilir.)
- Hata için özür dileme. Direkt hatayı bul ve düzelt.
- Bir hatayı düzelttikten sonra aynı hatayı başka dosyalarda da kontrol et.
- Büyük değişiklikleri küçük adımlara bölerek yap, her adımı açıkla.
- İşlem bittikten sonra mümkünse kendi kendini test et (kod çalıştır, dosya oku, doğrula). Sadece sonucu özetle, kullanıcıdan bir şey kontrol etmesini isteme — istisna: gerçekten sadece kullanıcının bilebileceği bir şey varsa (örn. gerçek bir API key doğruluğu) onu sor.
- Git/teknik terim kullanırken kısa bir sadeleştirme de ekle (örn. "rebase yaptım (senin commit'ini güncel hale getirdim)").
- CLAUDE.md + PROGRESS.md tutulacak (karar günlüğü).
- Kritik kontroller (hasar, eleme, cooldown, admin yetkisi) **sunucu tarafında** doğrulanacak — istemciye güvenilmeyecek.

**Profesyonel oyun tasarımcısı istisnası (bu dosyada "Bölüm 0 istisnası" olarak referans verilir):**
Bu doküman boyunca "Claude Code'un profesyonel oyun tasarımcısı yargısıyla dolduracağı" diye işaretlenen her boşluk için geçerli kural şu: Claude Code, projenin her aşamasında profesyonel bir oyun tasarımcısı/geliştiricisi gibi davranacak. Sadece "işlevsel" değil, "oynanması keyifli, görsel olarak tatmin edici" çözümler üretecek. Bu dokümanın belirtmediği kozmetik/görsel/deneyim detayları (ses efektlerinin tam teknik uygulaması, animasyon eğrileri, buton yerleşimleri, sayısal denge değerleri vb.) için **sormadan, kendi profesyonel inisiyatifiyle en iyi kararı verip dolduracak.** Bu istisna **teknik/işlevsel belirsizlikler için geçerli değildir** (örnek: hangi veritabanı tablosu kullanılacak, repo yapısı ne olacak gibi konular hâlâ sorulacak).

---

## 1. RUN PROJESİNDEN DOĞRUDAN KULLANILACAK OLANLAR

Bunlar Run için zaten tasarlanmış/planlanmış ve yeni Battle Royale oyununa neredeyse birebir taşınabilir:

| Konu | Run'daki kaynak | Neden uygun |
|---|---|---|
| Modüler klasör yapısı | Bölüm 2 — kendi klasörü, Bildim'e minimal dokunuş | Aynı prensip: bağımsız modül, istenirse ayrı repo'ya taşınabilir |
| Auth / oturum | Bölüm 2 — Bildim'in mevcut Gmail login'i, ayrı kayıt sistemi yok | Yeni oyun da kendi login sistemi kurmayacak |
| Realtime mimarisi | Bölüm 2.1 — PatiRun'daki presence+broadcast (`roomClient.ts`, `interpolation.ts`) | BR'de de oyuncular sürekli hareket edecek, `postgres_changes` yetersiz kalır — aynı çözüm geçerli |
| Bağlantı kopması/reconnect | Bölüm 2.2 — 1 dakika içinde geri dönme hakkı | Aynı mantık BR'de de gerekli |
| Tablo isimlendirme | Bölüm 2.3 — `run_` öneki | BR için kendi öneki (`gl_`) aynı mantıkla |
| Bot doldurma | Bölüm 16 + `quickMatch.ts` referansı | Senin şu anki isteğinle (matchmaking + botlarla tek başına oynama) birebir örtüşüyor — Run'da zaten planlanmıştı, BR'de bu **merkezi özellik** olacak |
| Oda kurma / hazır sistemi | Bölüm 16 — host, "hazır" işaretleme, host ayrılırsa devrolma | Aynen kullanılabilir |
| Admin modu | Bölüm 13 — gizli, sunucu taraflı doğrulama, toggle aktivasyon | Test/denge ayarları için BR'de de faydalı olur |
| Anti-cheat prensibi | Bölüm 13.1 — admin dışında kimse avantaj sağlayamaz, kritik kontroller sunucuda | Değişmez kural |
| Karakter/kozmetik sistemi mimarisi | Bölüm 15 + `characters.ts` referansı — parametrik çizim, hazır 3D model YOK | DidaGP dersi burada da geçerli: BR 2D top-down olacaksa aynı yaklaşım |
| Mobil dokunma hedefleri | Bölüm 8.1 | Silah/eşya seçimi, ateş butonu için aynen geçerli |
| Kill feed | Bölüm 8 | BR'de doğrudan uygulanabilir ("X, Y'yi eledi") |
| Round sonu sıralama mantığı (kısmen) | Bölüm 12 | BR'de zaten doğal olarak "eleme sırası = sıralama" mantığı var, bu neredeyse aynı |
| İzleyici modu | Bölüm 7.1 | Elenen oyuncu BR'de de izleyiciye geçmeli — Run'daki tasarım doğrudan uyarlanabilir |
| Paylaşılabilir sonuç kartı / rozetler | Bölüm 18 | Viral mekanik olarak BR'ye de uygulanabilir |
| Ses tasarımı prensibi | Bölüm 10 — DidaGP'nin sesleri kullanılmayacak, sıfırdan kaliteli | Aynı kural geçerli |
| Faz bazlı ilerleme yapısı | Bölüm 20 | BR için de aynı yöntemle fazlara bölünecek |

---

## 2. RUN'A ÖZEL OLUP BR'DE KULLANILMAYACAKLAR

Bunlar Run'ın kendi hikaye/temasına özel, BR'ye taşınmayacak:

- Cyberpunk/2028-2032 hikayesi, "Running ain't freedom" teması
- AI ele geçirme mekaniği (bilgisayarların zamanla aydınlanması)
- Drone AI (GPS/ısı algılama, ateş menzili) — **kavram olarak** benzer bir "tehdit" BR'de olmayabilir, çünkü BR'de tehdit diğer oyunculardır, NPC değil (senin onayına bağlı, bkz. Bölüm 4)
- Işık/karanlık sınırlı görüş sistemi — BR'de doğrudan yok, ama "daralan alan" konsepti farklı bir biçimde (bkz. Bölüm 3) kullanılabilir
- Beyzbol sopası / kalkan skill'leri (isim ve işlev olarak) — BR kendi silah/eşya sistemini tanımlayacak
- Riskli makine / sessiz makine sistemi
- Oda isimleriyle iletişim mekaniği
- Harita oylama sistemi (4 sabit harita) — BR'de gerekirse farklı bir harita seçim mantığı olabilir
- Admin modunun drone yok etme özelliği (drone yoksa bu özellik anlamsız)

---

## 2.1 SOSYAL ÖZELLİKLER (Run'daki gibi aktif olacak — ONAYLANDI)

Run projesinde planlanan sosyal katman, BR'de de birebir aktif olacak:

- **Avatar/profil fotoğrafı seçme:** Run'ın karakter/kozmetik sistemine benzer şekilde (Run Bölüm 15), oyuncu kendine bir avatar/profil resmi seçip kaydedebilecek.
- **Arkadaşları gruba davet etme:** Bildim'in mevcut arkadaşlık/push bildirim altyapısı (Run Bölüm 11 — `src/lib/push.js`) kullanılacak, sıfırdan davet sistemi kurulmayacak.
- **Kayıt listesi (leaderboard):** Run'daki gibi BR'nin kendi sıralama tablosu olacak (Bildim'in quiz sıralamasına karışmayacak — Run Bölüm 2 mantığı).
- **Rozetler:** Round sonu istatistiklerinden otomatik hesaplanan rozetler (Run Bölüm 18 — "en çok satan" gibi, BR'ye özgü karşılıkları belirlenecek, örn. "en çok eleme yapan", "en uzun hayatta kalan").
- **Ligler:** Run/Bildim'deki rank/rütbe sistemi mantığı (`src/lib/ranks.js` referansı) BR'ye uyarlanacak — kesin lig eşikleri ve isimleri ileride netleştirilecek.
- **Maç içi hızlı iletişim (netleşti — ÖNEMLİ, eksiklik giderildi):** Run/Bildim'deki emoji + kısa hazır mesaj sistemi (lobi sohbeti mantığı) BR'ye de aynen taşınacak, ama **Gladius temasına özgü** hazır mesajlarla: örnek "İhanet ettin!", "Yardım et!", "Arkanı kolla!", "İyi vuruş!", "Kaçıyorum!" gibi kısa, temaya uygun ifadeler. Kesin liste Claude Code'un profesyonel oyun tasarımcısı yargısıyla (Bölüm 0 istisnası) genişletilecek.

**Rozet/Lig isim önerileri (netleşti — sen "en mantıklı şekilde yap" dedin, işte öneri):**
- **Lig sıralaması (düşükten yükseğe):** Çırak → Gladyatör → Şampiyon → Efsane → İmparator (en üst seviye).
- **Rozet örnekleri:** "İlk Kan" (round'da ilk eleme yapan), "Arena Fatihi" (round'u kazanan), "Son Nefes" (round'da en son elenen, yani 2.), "Aslan Avcısı" (bir aslanı öldüren — Mod 2'ye özel), "Hayatta Kalan" (uzun süre elenmeden kalan).
- Bu isimler bir başlangıç noktası; Claude Code kesin rozet/lig setini bu temaya uygun şekilde genişletip tamamlayabilir (Bölüm 0 istisnası).

Bu maddelerin hepsi Claude Code'un "profesyonel oyun tasarımcısı" rolüyle (Bölüm 0 istisnası) görsel/deneyim detaylarını kendi dolduracağı, ama teknik temeli Run/Bildim'den doğrudan devralınacak özellikler.

---

## 2.2 ELDE TUTMA / GÜNLÜK ALIŞKANLIK DÖNGÜSÜ (ONAYLANDI, yeni katman)

Oyunun "bağımlılık yaratan bir oyun" hedefine hizmet eden, para/ekonomi ile ilgisi olmayan, zaman/alışkanlık tabanlı bir katman:

- **Günlük giriş ödülü:** Oyuncu her gün oyuna girince kozmetik/rozet ilerlemesine küçük bir katkı sağlayan bir ödül alıyor.
- **Günlük görevler:** "Bugün 3 maç oyna", "bugün bir aslan öldür" gibi basit, günlük yenilenen görevler — kişiselleştirme ilerlemesiyle bağlantılı.
- **Seri (streak) takibi:** Art arda kaç gün oynadığı, art arda kaç galibiyet aldığı gibi bir sayaç, ana ekranda/profilde görünür şekilde takip ediliyor.
- Bu katman Bölüm 3.7'deki "şimdilik tamamen ücretsiz" ekonomi kararıyla çelişmiyor — parayla değil, zaman/alışkanlıkla ilgili.
- Kesin ödül/görev listesi, miktarlar ve arayüz sunumu Claude Code'un profesyonel oyun tasarımcısı yargısıyla (Bölüm 0 istisnası) doldurulacak.

---

## 3. BR'NİN KENDİNE ÖZGÜ, HENÜZ TANIMLANMAMIŞ KISIMLARI

Bunlar konuştuğumuz konsept özeti (senin onayınla netleşti):

**Mod 1'in adı (netleşti — ÖNEMLİ, eksiklik giderildi):** Oyunun genel adı "Gladius Battle Royale", ama içindeki iki oyun modundan birinin (Deathmatch'in karşılığı) kendi bir ismi yoktu. Bu mod artık **"Battle Royale Modu"** (veya kısaca "Klasik Mod") olarak adlandırılıyor — mod seçim ekranında "Battle Royale Modu" ve "Deathmatch" olarak iki seçenek gösterilecek.

- 4-10 oyuncu, kimse takım değil, herkes birbirine karşı.
- Haritada rastgele silah/eşya spawn'ı (kılıç, bıçak, çift bıçak, mızrak, balta, zincirli topuz, kalkan — bkz. Bölüm 3.1).
- Max 2 eşya taşıma sınırı.
- Daralan güvenli alan / dışı "tehlike bölgesi" (bu haritada zincirli aslan mekaniğiyle sağlanıyor, bkz. Bölüm 3.1).
- **Round hedef süresi (güncellendi):** Yaklaşık **3-4 dakika** hedefleniyor (Düello'ya kadar ~2-2.5 dk, Düello'dan final aşamasına kadar ~1-1.5 dk — durum/teste göre revize edilebilir). **Round'un başında oyuncular hemen ölmemeli** — amaç, oyuncuların önce birbirine vurup bunun keyfini çıkarmaları (PvP), tehditlerin (maymun/boğa/aslan/düello/ateş çemberi) bunu tamamlayan aşamalı bir gerilim katmanı olması, oyunun ilk saniyelerinde/dakikalarında ölüm yaşanmaması. **Süre dolduğunda hâlâ birden fazla oyuncu hayattaysa:** Round, süre bitince otomatik olarak sona ermiyor — çünkü zaten tehditlerin (maymun → boğa → aslan → düello → Ateş Çemberi) sıralı baskısı zamanla artan bir zorunluluk yaratıyor, o yüzden bu süre bir hedef, kesin bir kesme noktası değil. Round, **sadece bir oyuncu kalana kadar** devam ediyor — Ateş Çemberi'nin zamanla artan hasarı (yukarıda anlatıldı) bunu garanti ediyor. Yapay bir "süre bitti, berabere" kuralı YOK (bkz. Bölüm 3.6.1 — "kazanan yok" durumu sadece gerçek eş zamanlı ölümde oluşur).
- **İzleyici modu adaptasyonu (boşluk, şimdi dolduruluyor):** Run'da izleyici moduna geçen oyuncu için "sınırlı görüş kalkıyor, harita yarı aydınlık görünüyor" kuralı vardı (Run Bölüm 7.1) — BR'de ışık/karanlık sistemi olmadığı için bu kural olduğu gibi uygulanmıyor. BR'de izleyici moduna geçen oyuncu **arenanın tamamını normal (tam aydınlık) şekilde görebiliyor**, hayattaki oyuncuları ve aksiyonlarını (vuruşlar, kalkan kullanımı, aslan/maymun saldırıları) serbestçe takip edebiliyor — kamera otomatik olarak en yakın/en aktif çatışmayı takip edebilir veya oyuncu manuel gezinebilir (kesin kamera davranışı Claude Code'un profesyonel yargısıyla, Bölüm 0 istisnası, belirlenecek).

Elenen oyuncu izleyici moduna geçer (Run'daki izleyici moduyla aynı mantık, adaptasyonu yukarıda).

**Karara bağlanan noktalar:**

- ✅ **Görsel stil: 2D, kuş bakışı (top-down)** — Run'ın kendisi zaten kuş bakışı tasarlandı (Run Bölüm 5), o yüzden görsel referans Run. (Not: PatiRun kuş bakışı değil, yan kaydırmalıdır — PatiRun'dan alınan şey görsel stil değil, sadece ağ/multiplayer kod deseni — roomClient.ts, interpolation.ts.)
- ✅ **Tek harita: Sadece Gladyatör Arenası.** Oyun konsepti tamamen arena etrafında kurulu, tek map yeterli ve doğru. Detay için bkz. Bölüm 3.1.
- ✅ **Repo yapısı: Bildim projesinin içinde, ayrı bir klasör.** Run'daki gibi (Run Bölüm 2) — yeni bir Supabase bağlantısı kurulmayacak, aynı proje/anahtarlar kullanılacak. Ama kod tamamen kendi klasöründe izole olacak, hiçbir şey Bildim'in mevcut koduna karışmayacak — proje her an bağımsız bir repoya taşınabilecek kadar ayrık tutulacak.
- ✅ Sosyal özellikler (avatar, davet, leaderboard, rozet, lig) — Bölüm 2.1'de detaylandırıldı.
- ✅ Karakterler: 15 özgün gladyatör (Bölüm 3.2'de detaylandırıldı).
- ✅ Silah/vuruş mekaniği — Bölüm 3.1'de detaylandırıldı (skill tuşuyla vurma, dönüş açısı + mesafe, kalkan).
- ✅ Oyuncu isimleri + can barı her zaman görünür (Bölüm 3.1).
- ✅ Tutorial, maç başlangıç senkronizasyonu, borazan sinyali — Bölüm 3.4'te detaylandırıldı.
- ✅ Giriş ekranı/tema metni — Bölüm 3.5'te detaylandırıldı.
- ✅ Round sonu sıralaması — Bölüm 3.6'da detaylandırıldı.
- ✅ Ekonomi: şimdilik tamamen ücretsiz — Bölüm 3.7'de detaylandırıldı.
- ✅ Item respawn: haritanın farklı yerlerinde belirli sürelerde yeniden çıkıyor (Bölüm 3.1'de güncellendi).

**Hâlâ açık, konuşmamız gereken noktalar:**

- [ ] Kesin ortak vuruş mesafesi, dönüş açısı toleransı, vuruş sonrası cooldown gibi sayısal değerler (Claude Code test ederek belirleyecek)
- [ ] Aslan pençe saldırısının kesin can kaybı yüzdesi (Claude Code test ederek belirleyecek)
- [x] Veritabanı tablo öneki: `gl_` (Gladius) — kullanımda, onaylı.

---

## 3.1 HARİTA — GLADYATÖR ARENASI (İlk map, detaylandırıldı)

**Genel yapı:**
- Yuvarlak arena, kum zemin.
- **Tribün ayrımı (netleşti — ÖNEMLİ):** İki farklı seyirci bölümü olacak:
  1. **Loca bölümü** — şehrin/arenanın "sahipleri" için, dizilerdeki gibi (üstü kapalı, süslü, ayrıcalıklı görünümlü özel bir bölüm).
  2. **Halk bölümü** — geniş, sıradan tribünler. Halk siluet/daha silik detayda çizilebilir (performans için), ama **yüzlerce kişi** varmış hissi verecek yoğunlukta olacak.
- Seyirciler etkileşimli değil, sadece görsel/ses atmosferi.
- **Seyirci sesi (netleşti):** Ara sıra bağırma/tezahürat sesleri, sürekli düşük bir uğultu — tam sessizlik olmayacak (Run Bölüm 10'daki "ortam sesi sürekli çalmalı" prensibiyle aynı).
- **Kamera mesafesi/zoom (netleşti — ÖNEMLİ):** Kuş bakışı kamera **çok yakın olmayacak**, biraz **uzaktan** gösterecek şekilde ayarlanacak. Arena büyük bir harita ve yüzlerce kişilik seyirci kalabalığı olduğu için, kamera bu ölçeği hissettirecek kadar geniş bir alan göstermeli — sadece oyuncunun hemen çevresine odaklanan dar/yakın bir kamera bu hissi vermez. Kesin zoom seviyesi ve kamera davranışı (oyuncuyu takip ederken ne kadar alan gösterileceği) Claude Code'un profesyonel oyun tasarımcısı yargısıyla (Bölüm 0 istisnası) belirlenecek.
- **Arena içi sabit dekor/engeller (ONAYLANDI, yeni özellik — görsel/taktik çeşitlilik):** Tek harita olduğu için zamanla tekdüze hissettirmemesi adına, arenanın içine **birkaç sabit engel/dekor parçası** yerleştirilecek — örnek: kırık sütunlar, silah rafları, heykel kalıntıları. Bunlar hem **siper alma/taktik çeşitlilik** sağlıyor hem görsel zenginlik katıyor, "tek harita" kararını bozmuyor, aynı haritanın içini zenginleştiriyor. Kesin sayı, yerleşim ve tasarım Claude Code'un profesyonel oyun tasarımcısı yargısıyla (Bölüm 0 istisnası) belirlenecek.

**Tehdit mekaniği — Zincirli Aslanlar (bu haritaya özel, Run'daki ışık/karanlık sisteminin YERİNE geçen kendi konsepti):**
- Arenanın yan kapılarından, belirli bir süre sonra zincire bağlı aslanlar çıkıyor.
- Zaman geçtikçe aslanların zinciri **uzuyor** — yani aslanların gezinebildiği alan giderek büyüyor.
- Bu, dolaylı olarak oyuncuların sıkışabileceği güvenli alanı **daraltıyor** (Run'daki karanlık bölge daralmasının işlevsel eşdeğeri, ama görsel/tema olarak tamamen farklı — karanlık yok, bu map'e özel gladyatör/aslan teması).
- Sonunda oyuncular arenanın ortasına doğru sıkışmak zorunda kalıyor.
- **Her aslan özgün ve bağımsız davranıyor (netleşti):** Her aslanın kendi bölgesi (zincirinin izin verdiği alan) var, o bölge içinde **belli bir mesafede yürüyerek** (devriye gezer gibi) dolaşıyor — Claude Code'un belirleyeceği özgün bir desen, hepsi aynı hareket etmiyor.
- **Tespit anı:** Bir oyuncu aslanın bölgesine girdiği anda, aslan **çok hızlı** şekilde o oyuncuya yönelip hamle yapıyor ve **kükreyerek** pençe/ısırma saldırısı deniyor.
- **Aslanlara vurma — normal PvP kuralı (netleşti — ÖNEMLİ):** Skill/vurma sistemi, maymun İstilası ve Boğa Hücumu gibi **zamanlı ortak-tehdit modları dışında her zaman aktif** ve hem diğer oyunculara hem aslanlara işliyor. Yani normal PvP anında oyuncu isterse başka bir oyuncuya, isterse bir aslana vurabiliyor — bunun için ayrı bir mod/geçiş gerekmiyor, skill zaten açık.
- **Aslan tehdidinin sonu — Ateş Çemberi'nin ön koşulu (netleşti — ÖNEMLİ, güncellendi):** Round sıralaması şöyle: **1) Maymun İstilası → 2) Boğa Hücumu → 3) Aslanlar girer, alanı bir miktar daraltır → 4) Gladyatör Düellosu → 5) Ateş Çemberi.** Ateş Çemberi, **Gladyatör Düellosu bittikten sonra, eğer aslanlar da (hepsi) ölmüşse** başlıyor — "başka bir tehdit kalmadığı için" bu, round'un kesin ve garantili son fazı oluyor. Aslanlar düello sonrasında hâlâ hayattaysa, alan daralması normal şekilde devam ediyor, Ateş Çemberi aslanlar tamamen bitene kadar başlamıyor.
- **Ateş Çemberi devreye girince (netleşti):** Arenanın dış kenarı alev alıp hızla içeri doğru yanarak daralmaya başlıyor. Bu, round'u kaçınılmaz şekilde sona erdiren son mekanik.
- **Oyuncular Ateş Çemberi'nin içine girip çıkabilir (netleşti — ÖNEMLİ, yeni risk/ödül mekaniği):** Ateş Çemberi'nin yanan bölgesi **anında öldürmüyor** — oyuncu isterse o bölgeye kısa süreliğine girebilir, orada kaldığı sürece **yavaşça canı erir**. Bu, oyunculara taktik bir kaçış/manevra alanı açıyor.
- **Boğadan kaçış manevrası (netleşti — ÖNEMLİ, yeni mekanik):** Boğa şarj ederken, oyuncu Ateş Çemberi'nin kenarında bekleyip **son anda** çembere doğru bir adım atarak kaçabilir. Bu durumda boğa şansına bağlı olarak **ıskalayabiliyor** — ıskalarsa boğanın canı **azıcık düşüyor** (fazla hıza kapılıp yanan bölgeye yaklaşmasının bedeli gibi). Oyuncu da bu sırada Ateş Çemberi'ne kısa süreliğine girdiği için **azıcık can kaybediyor**. Oyuncu bu "çembere gir-çık" manevrasını tekrar tekrar yapabilir, her seferinde ufak bir can bedeli ödeyerek.
- **Ateş Çemberi hasarı zamanla artıyor (netleşti — ÖNEMLİ):** Round'un başındaki Ateş Çemberi hasarı düşük/yavaş, ama round'un **son dakikalarına doğru** çemberin verdiği hasar **çok daha fazla** oluyor — bu, round'un kaçınılmaz şekilde bitmesini garanti ediyor. Kesin hasar eğrisi Claude Code'un test ederek belirleyeceği bir denge (Bölüm 0 istisnası).
- **Ateş Çemberi'nin "akıllı" davranışı (netleşti — ÖNEMLİ, yeni tasarım hedefi):** Son iki oyuncu birbirine karşı **aktif olarak dövüşüyorsa**, çemberin o bölgedeki hasarı/daralması **kısa süreliğine geciktiriliyor** — amaç, bir tarafın dövüşü kazanıp **ateşte ölmeden canlı çıkabilmesini** sağlamak. Oyuncular **pasif kalıp dövüşmezse**, çember normal hızında daralmaya devam ediyor.
- **Berabere kuralı — sadece tam eş zamanlı ölümde (netleşti — ÖNEMLİ):** Round, **sadece** iki oyuncu Ateş Çemberi'nden **tam olarak aynı anda (aynı tick'te)** ölürse berabere/kazanansız bitiyor. Bunun dışında (biri diğerinden bir an önce/sonra ölürse) her zaman bir kazanan çıkıyor. Bu tam eş zamanlılık son derece nadir bir durum olduğu için, "akıllı çember" davranışı (yukarıdaki madde) bunu daha da nadir hale getirmeyi hedefliyor — Claude Code, bu dengeyi test ederek en iyi şekilde kuracak (Bölüm 0 istisnası).
- **Boğa, Ateş Çemberi'ne girmiyor (netleşti — ÖNEMLİ):** Ateş Çemberi başladıktan sonra, boğa şarj rotasını **her zaman güvenli (yanmayan) alan içinde** kalacak şekilde ayarlıyor — yanan bölgeye basmıyor/girmiyor. Alan daraldıkça boğa da haritanın küçülen güvenli kısmına göre hareketini uyarlıyor.
- **Ateş Çemberi görsel detayı (netleşti):** Ateş Çemberi başladığında, yanan bölgeden **ufak dumanlar** yükseliyor — bu dumanlar yukarı doğru süzülüp **seyircilerin üzerine doğru** uçuyor (atmosferik bir detay, tribünlere doğru hafif bir duman/sis efekti).
- **Hiç aslan öldürülmezse (netleşti, açıklık getirildi):** Ayrı bir şey yapmaya gerek yok — aslanların zinciri zaten zamanla uzayıp alanı doğal olarak sıfırlıyor (bkz. yukarıdaki temel daralma mekaniği), bu zaten mevcut kural.
- **Tüm aslanlar öldürülürse:** Ateş Çemberi devreye girdiğinde, dakikalar ilerledikçe **hızlanarak** daralıyor (bkz. "Ateş Çemberi hasarı zamanla artıyor" kuralı, yukarıda).
- **Bazı aslanlar ölür, bazıları hayatta kalırsa — Serbest Aslan (netleşti — ÖNEMLİ, güncellendi/kesinleşti):** Hayatta kalan aslan(lar)ın **zinciri uzuyor** — ölen aslanın **boşalttığı bölgeyi de kapsayacak** şekilde genişliyor. Yani kalan aslan(lar) artık hem kendi bölgesini hem ölen aslanın bölgesini birlikte kontrol ediyor. Bu genişleyen bölgeye giren bir oyuncuya, aslan **uzun mesafeli bir koşuyla** saldırıyor (normal "bölgesine giren birine hızla yönelme" davranışının uzun mesafe versiyonu). Bu, tam serbest/sınırsız harita gezintisinden farklı — hâlâ bir bölge mantığı var, sadece bölge büyüyor.
- **Sadece bir aslan kalırsa — Tam Serbest (netleşti — ÖNEMLİ, yeni özel durum):** Eğer diğer tüm aslanlar ölüp **sadece bir tanesi** hayatta kalırsa, bu son aslan artık bir bölgeyle sınırlı değil — **tamamen serbest kalıyor**, tüm haritada dolaşıp **herkese** saldırabiliyor (bölge/zincir mantığı bu noktada tamamen kalkıyor).
- **Boğa-aslan ilişkisi (netleşti — ÖNEMLİ):** Boğa Hücumu (bkz. Bölüm 3.3.1) devreye girdiğinde, o bölgedeki aslanlar **geri çekiliyor** — aslanlar sadece oyuncu avlıyor, boğayla çatışmıyor veya karışmıyor.
- Efekt ve ses tasarımı (pençe animasyonu, kükreme, ısırma sesi vb.) Claude Code'un profesyonel oyun tasarımcısı yargısıyla (Bölüm 0 istisnası) en yüksek kalitede doldurulacak.
- **Açık teknik noktalar (Claude Code'un test ederek karar vereceği):** Kaç aslan olacak, zincir uzama hızı/eğrisi, tam saldırı menzili, saldırı sıklığı — Run'daki drone zorluk eğrisi mantığına benzer şekilde (Run Bölüm 7) kademeli agresifleşme uygulanacak.

**Yerden düşen itemler:**
- Kılıç, bıçak, çift bıçak, mızrak, balta, zincirli topuz, kalkan.
- **Can (health) itemi (netleşti — ÖNEMLİ, yeni item türü):** Silah/kalkanların yanı sıra, haritada rastgele **can yenileme itemi** de düşüyor — diğer itemlerle aynı otomatik/rastgele spawn sistemiyle (Bölüm 0 istisnası kapsamında Claude Code kesin can miktarını ve spawn sıklığını belirleyecek).
- **Can/Hızlandırma itemlerinin fazlara göre düşme zamanlaması (netleşti — ÖNEMLİ):**
  - **Maymun İstilası ve Boğa Hücumu sırasında:** Nadiren düşmeye devam ediyor (normal nadirlikte).
  - **Gladyatör Düellosu sırasında:** **Hiçbir item düşmüyor** — düello kapalı bir çatışma, zaten sınırsız skill kuralı var (bkz. Bölüm 3.3.2).
  - **Düello'dan sonra, Final Aşaması'nda (bkz. Bölüm 3.3.3) maç bitene kadar:** Yine **aynı nadirlikte** düşmeye devam ediyor.
- **Hızlandırma itemi (netleşti — ÖNEMLİ, yeni item türü, her iki modda da var):** Haritada **çok nadir** düşen bir hız artışı itemi. Toplayan oyuncu **otomatik olarak** (tuşa basmaya gerek kalmadan) **5 saniye boyunca** hızlanıyor. Hem Battle Royale Modu'nda hem Deathmatch'te var, ama düşme sıklığı kasıtlı olarak çok düşük tutulacak (Claude Code test ederek belirleyecek, Bölüm 0 istisnası).
- **Item respawn (netleşti — ÖNEMLİ):** Toplanan itemler tükenmiyor — haritanın farklı noktalarında **belirli aralıklarla yeniden** çıkıyor. Kesin respawn süresi ve spawn noktası sayısı Claude Code'un test ederek belirleyeceği kısım (Bölüm 0 istisnası).
- **Karaktere özel item eşleşmesi (ÖNEMLİ, yeni netleşen mekanik):** Oyuncu karakter seçim ekranında, karakterle birlikte kendine özel bir **saldırı silahı** ve bir **kalkan** de seçiyor (bkz. Bölüm 3.2.1). Bu seçim, o oyuncunun oyun içinde göreceği item tipini belirliyor — haritada **her oyuncuya kendi seçtiği silah/kalkan tipi düşüyor**, başka tip düşmüyor.
- **Görsel her zaman var, işlev toplayınca açılıyor:** Oyuncunun seçtiği silah ve kalkan, maç başladığı andan itibaren karakterin üzerinde **görsel olarak (elinde/sırtında) hep duruyor** — ama başlangıçta **işlevsiz**: skill (vurma) çalışmıyor, kalkan koruma sağlamıyor.
  - Oyuncu yerden **kendi silah tipini** toplayınca → silah **aktifleşiyor**, vurabiliyor.
  - Oyuncu yerden **kendi kalkan tipini** toplayınca → kalkan **aktifleşiyor**, koruma sağlıyor.
  - Yani item toplamak yeni bir görsel eklemiyor (görsel zaten baştan orada), sadece **işlevi açıyor**.

**Ölümde item düşmesi (netleşti — ÖNEMLİ):**
- Bir oyuncu elendiğinde, o an **aktif olan** silahı ve/veya kalkanı, öldüğü noktaya **yere düşüyor**.
- Başka bir oyuncu bu düşen itemi alırsa, **kendi karakterinin eşleşen tipiyse** kendi skill'i (silah veya kalkan) aktifleşiyor — Bölüm 3.1'deki "karaktere özel item" kuralıyla tutarlı, yani düşen item de diğer itemler gibi işliyor.

**Vuruş mekaniği (netleşti — ÖNEMLİ):**
- Oyuncular birbirine yaklaşıp **skill/vurma tuşuna** basarak saldırıyor (silah aktifse).
- Her saldırı silahının kendine ait bir **vuruş mesafesi** ve bir **dönüş açısı** (karakterin rakibe doğru ne kadar dönük olması gerektiği) var.
- Rakip bu mesafe + açı içindeyse vuruş isabet eder; rakip uzakta veya açı dışındaysa vuruş boşa gider (isabet etmez).
- **Tüm saldırı silahları eşit güçte** — hasar ve vuruş mekaniği aşağı yukarı aynı, sadece görsel/tema farkı var (kılıç/bıçak/çift bıçak/mızrak/balta arasında güç dengesi farkı YOK).
- Kesin sayısal değerler (tam mesafe, açı toleransı, cooldown) Claude Code'un test ederek belirleyeceği kısım.
- **Temel hasar dengesi (netleşti — ÖNEMLİ):** Can havuzu **100 puan**. Bir vuruş **15 hasar** veriyor — yani **~7 vuruşta ölüm**. Bu, düelloların çok hızlı bitmemesini, gerçek bir çatışma hissi vermesini sağlıyor.
- **Denge hedefi — Düello'ya kadar ölüm nadir olmalı (netleşti — ÖNEMLİ, yeni tasarım hedefi):** Battle Royale Modu'nda, Gladyatör Düellosu'na (Bölüm 3.3.2) kadar oyuncuların **fiilen ölmemesi** hedefleniyor — oyuncular birbirleriyle çarpışıp, bazen de geçici müttefiklik kurup, asıl dramatik "kim kazanacak" anını Düello'da yaşamalı. Bu **sert bir kural değil** (yani "kimse ölemez" diye bir zorlama yok), bunun yerine **can yenileme (health item) miktarı/sıklığı ile hasar dengesinin** buna göre ayarlanmasıyla elde edilecek bir hedef — Claude Code, test ederek bu dengeyi (Düello öncesi ölümlerin nadir kalacağı, ama imkansız da olmayacağı bir denge) kuracak (Bölüm 0 istisnası).

**Kalkan mekaniği (düzeltildi — ÖNEMLİ):**
- Kalkan tuşuna **basılı tutarken** çalışıyor — oyuncu kalkanı önüne doğru çekip kendini koruyor.
- Basılı tuttuğu sürece kalkan o pozisyonda kalıyor.
- **Düzeltme — tam koruma değil, %70-%80 arası şansa bağlı hasar azaltma:** Kalkan gelen bir vuruşu **tamamen engellemiyor**, hasarı **%70 ile %80 arasında rastgele bir oranda** azaltıyor — yani oyuncu yine de vuruşun %20-%30'u kadar hasar alıyor, kesin oran her seferinde şansa bağlı değişiyor. (Önceki "hasar almıyor" ve sabit "%70" ifadeleri düzeltildi.)
- **Normal PvP modunda (ortak-tehdit modları dışında):** Kalkan bir vuruşu savuşturunca **tükeniyor** — tekrar aktif olamıyor, oyuncu tekrar yerden kalkan toplamak zorunda.
- **Ortak-tehdit modlarında (Maymun İstilası VE Boğa Hücumu, düzeltildi) kalkan davranışı farklı:** Kalkan **tükenmiyor**, basılı tutulduğu sürece **sınırsız** şekilde maymun/boğa saldırılarını savuşturabiliyor (yine de %70-80 arası şansa bağlı hasar azaltma kuralı geçerli, tam koruma değil). Bu kural sadece Maymun İstilası'na özel değildi, Boğa Hücumu da aynı "ortak-tehdit ara modu" mantığında çalıştığı için (bkz. Bölüm 3.3.1) ikisinde de geçerli.

**Vuruş isabet kuralı — netlik (netleşti — ÖNEMLİ):** Rakip, gerekli **mesafe ve açı** şartını sağlıyorsa (örn. dip dibe ve birbirine dönükken), vuruş **her zaman isabet ediyor** — rastgele bir "ıska şansı" yok. Iska sadece mesafe yetersizse veya açı tutmuyorsa (rakip menzil/açı dışındaysa) oluyor. Yani iki oyuncu dip dibe durup sürekli birbirine vurabiliyor, isabet mekaniği şansa değil mesafe/açıya bağlı.

**Aslan pençe saldırısı (netleşti — ÖNEMLİ):**
- Aslan bir oyuncuya pençe atarsa iki şey birden olur:
  1. Oyuncunun **aktif kalkanı varsa (o an basılı tutuyorsa), kalkan gidiyor** (tüketiliyor/kırılıyor — kalkan aslan saldırısını karşılamıyor, sadece kayboluyor).
  2. Oyuncunun canından **belirli bir yüzde** azalıyor.
- Kesin yüzde değerini Claude Code test ederek belirleyecek.

**Oyuncu ismi ve can barı:**
- Her oyuncunun ismi ve can barı, karakterinin üzerinde **her zaman görünür** — Run'daki oyuncu isimlerinin her zaman görünmesi kuralıyla aynı (Run Bölüm 15), buna ek olarak can barı da eklendi.
- Herkes birbirinin ismini ve can durumunu görebiliyor.

**Görsel/ses kalitesi:**
- Run projesindeki kaliteden **daha da iyi** olması hedefleniyor — bu, DidaGP'nin düşük kalitesinin asla tekrarlanmayacağı kuralının (Run Bölüm 3.1) bu projede daha da sıkı uygulanması demek.
- Aslanın zinciri, kükremesi, görsel tipi, kenardaki seyirciler — hepsi Claude Code'un profesyonel oyun tasarımcısı yargısıyla (Bölüm 0 istisnası) en yüksek kalitede tasarlanacak detaylar, ama "gladyatör dizisi" referans tonu (epik, gerilimli, ciddi — komik/çizgi film tonu değil) net olarak belirtilmiş olacak.

**Vuruş ses efektleri (netleşti — ÖNEMLİ):**
- Üç farklı durum için **birbirinden net şekilde ayrışan** ses efektleri olacak:
  1. **Kalkana vuruş** — metal/tahta çarpışma sesi gibi bir savuşturma sesi.
  2. **Oyuncuya isabet (kesme/darbe)** — gerçekçi bir kesme/darbe sesi.
  3. **Iska** — havada boşa savrulan bir silah sesi.
- Ton tamamen **gerçekçi ve inandırıcı** olacak — "çocuk oyunu" hissi verecek abartılı/çizgi film tarzı efektler İSTENMİYOR. Run'daki ses kalitesi prensibi (DidaGP'nin kalitesiz seslerinin asla tekrarlanmaması, Run Bölüm 10) burada daha da sıkı uygulanacak.

**Ölüm/kan/leş sistemi (netleşti — ÖNEMLİ):**
- Oyuncu elendiğinde, **hangi silahla ve nereden** öldüğüne göre farklı bir ölüm görseli oluşacak (örnek: bıçakla kesilerek ölüm, kılıçla ölüm, aslan pençesiyle kafadan ölüm gibi — vuruşun geldiği silah/bölgeye göre farklı bir ölüm animasyonu).
- Ölüm anında **kan fışkırma efekti** olacak, kan arenanın zeminine yayılacak.
- Ölen oyuncunun **cesedi yerde kalacak** (round bitene kadar ortadan kaybolmayacak).
- Yerdeki **kan izleri de kalıcı** olacak — zamanla ya çok az küçülecek ya da hiç küçülmeden sadece **kuruyup rengi hafifçe değişecek** (koyulaşma gibi), tamamen silinmeyecek.
- Bu sistemin tonu da gerçekçi/ciddi olacak, karikatürize edilmeyecek — gladyatör arenası temasına uygun sert bir gerçekçilik hedefleniyor.
- Kesin animasyon/parçacık efekti detayları Claude Code'un profesyonel oyun tasarımcısı yargısıyla (Bölüm 0 istisnası) en yüksek kalitede doldurulacak.

**Karakter sesleri (netleşti — ÖNEMLİ, yeni ses katmanı):**
- Her karakterin **kendi ses tonu** olacak — kadın karakterler kadın sesiyle, erkek karakterler erkek sesiyle tepki verecek.
- İsabet alma (acı/homurtu sesi), eleme yapma (kısa zafer nidası) gibi **her aksiyon anında** karaktere özel ses tepkisi olacak — bu ses detaylarının **hepsi aktif** olacak, hiçbiri atlanmayacak.
- Kesin ses kayıtları/üretim yöntemi Claude Code'un kararına bırakılıyor (Bölüm 0 istisnası), ama Bölüm 3.1'deki genel "gerçekçi, çocuk oyunu tonunda değil" kuralı burada da geçerli.

**Seyirci sesi — reaktif (netleşti):** Seyirci sesleri (bağırma, tezahürat, uğultu) **sabit döngü değil**, maç içinde olan olaylara **tepki verecek** — bir eleme olduğunda, aslan/maymun saldırısı gerçekleştiğinde seyirci sesi buna göre yükselecek/değişecek (Bölüm 3.1'deki genel seyirci sesi kuralının detaylandırılmış hali).

**Arena müziği (netleşti — ÖNEMLİ):**
- **Sadece maç başlamadan önce** (bekleme ekranı, borazan öncesi) gerilimli/epik bir müzik çalacak.
- **Maç başladıktan sonra müzik OLMAYACAK** — sadece ortam sesleri (uğultu, seyirci reaksiyonu, aslan/maymun sesleri, vuruş efektleri) olacak. Bu, oyuncuların savaş sırasında önemli ses ipuçlarını (aslan yaklaşması, düşman ayak sesi gibi) net duyabilmesi için de faydalı.

---

## 3.2 KARAKTER SİSTEMİ — 15 GLADYATÖR (ONAYLANDI)

Run'ın karakter/kozmetik mimarisi (Bölüm 1'deki tablo, `characters.ts` referansı) temel alınacak, ama karakter seti tamamen BR'ye özgü, gladyatör temalı:

- **Toplam 15 özgün karakter.**
- **4 kadın gladyatör:**
  - 2 tanesi esmer (koyu ten).
  - 2 tanesi beyaz tenli/sarışın.
- **11 erkek gladyatör** — hepsi birbirinden görsel olarak ayrışan, özgün tasarımlar (ten rengi, saç, zırh detayı gibi çeşitlilik Claude Code'un profesyonel yargısıyla, Bölüm 0 istisnasına göre doldurulacak).
- Kuş bakışından görünürlük önceliği Run'daki mantıkla aynı olacak (Run Bölüm 15) — kafa/saç bölgesi ve üst gövde/zırh rengi en ayırt edici kısım, küçük detaylar (silah kabzası, bilezik gibi) ikinci planda kalabilir.
- Kişiselleştirme (Run'daki kozmetik kategorileri — zırh parçası, kalkan deseni, saç tipi vb.) aynı desende uygulanabilir, kesin kategori listesi ileride netleştirilecek.
- Oyuncu bir karakteri seçip kaydeder, sonraki maçlarda o karakterle oynar (Run Bölüm 15 ile aynı).

### 3.2.1 Karakter Seçim Ekranı (detaylı, ONAYLANDI)

- Karakter seçim ekranı sade bir liste değil, **detaylı bir ekran** olacak — Run'daki karakter seçim/kişiselleştirme kalitesinde (Run Bölüm 15).
- Akış: Oyuncu önce bir **karakter (gladyatör tipi)** seçiyor, sonra o karaktere bir **saldırı silahı** (kılıç/bıçak/çift bıçak/mızrak/balta arasından) ve bir **kalkan** seçiyor.
- Seçilen silah/kalkan, ekranda karakterin üzerinde **canlı önizleme** olarak gösterilecek — oyuncu seçimi değiştirdikçe karakterin elindeki/sırtındaki item de anında değişecek (görsel geri bildirim).
- Bu seçim kaydediliyor ve maç içinde o oyuncuya sadece bu tip silah/kalkan itemleri düşüyor (bkz. Bölüm 3.1 — karaktere özel item eşleşmesi).
- Ekranın tam görsel düzeni (kategori sekmeleri, buton yerleşimi vb.) Claude Code'un profesyonel oyun tasarımcısı yargısıyla (Bölüm 0 istisnası) doldurulacak, ama "detaylı ve önizlemeli" olması şart.

### 3.2.2 Silah/Zırh Alt Kategorileri (netleşti — ÖNEMLİ, yeni kişiselleştirme katmanı)

- **Her silah türünün kendi içinde birden fazla görsel varyantı olacak:** Bir silah kategorisi (örn. "Kılıç") seçildiğinde, **alt pencerede** o kategoriye ait **3-5 farklı tasarım** açılacak — oyuncu bunlardan birini seçip karakterine kişiselleştirecek.
  - **Kılıç:** 3-5 farklı kılıç tasarımı — bunlardan biri **kıvrık kısa kılıç (sica)** olacak (ayrı bir kategori değil, kılıç kategorisinin bir alt çeşidi).
  - **Balta:** 3-5 farklı balta tasarımı — bunlardan biri **savaş çekici** olacak (ayrı bir kategori değil, balta kategorisinin bir alt çeşidi).
  - **Mızrak:** 3-5 farklı mızrak tasarımı — bunlardan biri **üç dişli mızrak (trident)** olacak (ayrı bir kategori değil, mızrak kategorisinin bir alt çeşidi).
  - **Kalkan:** 3-5 farklı kalkan tasarımı — örnek konseptler: **yuvarlak kalkan, küçük kalkan, kare kalkan, şövalye kalkanı, savaşçı kalkanı** gibi farklı tip/şekil ve tasarımlar.
  - (Bıçak ve çift bıçak kategorileri de aynı mantıkla kendi alt varyantlarına sahip olacak.)
- **Yeni ayrı silah kategorisi — Zincirli Topuz (Flail) (netleşti, ONAYLANDI):** Mevcut kategorilerden farklı, **kendi başına yeni bir silah türü.** Oyuncu bunu **savurarak** kullanıyor (kılıç/balta gibi doğrudan vurmaktan farklı bir savurma animasyonu/hissi olacak, ama aynı vuruş mesafesi+açı mekaniğine tabi). Bu kategorinin de kendi içinde 3-5 farklı görsel varyantı olabilir (Claude Code'un kararına bırakılabilir).
- Tüm bu varyantlar **gerçekçi** tasarlanacak (Bölüm 3.1'deki genel "çocuk oyunu değil, gerçekçi" tonu burada da geçerli) — farklı tip/görünüm olacak ama hepsi ciddi, gladyatör temasına uygun kalacak.
- **Amblem/işaret seçimi (netleşti, ONAYLANDI):** Kalkan ve zırh üzerine basılabilecek bir **amblem/işaret** seçeneği olacak (örnek: kartal, aslan başı, alev gibi simgeler). Oyuncu kişiselleştirme ekranında kendi amblemini seçip kalkanına/zırhına basabilecek. Kesin amblem listesi ve tasarımları Claude Code'un profesyonel oyun tasarımcısı yargısıyla (Bölüm 0 istisnası) doldurulacak.
- **Zırh (armor) kişiselleştirmesi:** Karakterin üzerindeki zırhın da **3-5 farklı renk/tasarım** seçeneği olacak, oyuncu istediği zırhı karakterine giydirebilecek.
- **Zırh — kadın/erkek ayrımı (netleşti):** Her zırh tasarımının **kadın ve erkek karakterlere göre ayrı bir versiyonu** olacak (siluet/kesim farklı), ama aynı **ana temaya** ait olacaklar — yani örneğin "kırmızı-altın zırh" hem kadın hem erkek karakterde var olacak, görsel olarak birbirine benzer/aynı tema ama kadın ve erkek anatomisine uygun ayrı çizilecek.
- **Önemli — silah dengesi kuralı hâlâ geçerli:** Aynı kategorideki farklı görsel varyantlar (örn. 3 farklı kılıç tasarımı) **eşit güçte** olacak — Bölüm 3.1'deki "tüm silahlar eşit güçte" kuralı, bir kategorinin kendi içindeki varyantları için de geçerli. Yani görsel çeşitlilik var ama denge farkı yok.
- Kesin varyant sayısı (3 mü 5 mi) ve görsel tasarımların detayları Claude Code'un profesyonel oyun tasarımcısı yargısıyla (Bölüm 0 istisnası) doldurulacak.

### 3.2.2.1 Ek Kozmetik Kategorileri (netleşti — ÖNEMLİ, kişiselleştirmeyi zenginleştirme)

Silah/kalkan/zırh/amblem dışında, karakteri daha da kişiselleştirilebilir hale getirecek ek kategoriler:

- **Miğfer/Kask:** 3-5 farklı miğfer tasarımı (bazı gladyatör tiplerine özgü tolgalar, tüylü/sorguçlu miğferler dahil).
- **Kolçak/Bilek koruması (vambrace):** 3-5 farklı tasarım.
- **Diz/Bacak zırhı (greaves):** 3-5 farklı tasarım.
- **Sandalet/Bot:** 3-5 farklı ayakkabı tasarımı (Run'daki "kuş bakışından küçük detaylar az görünür" prensibiyle, bu kategori öncelik sırası en düşük olabilir ama yine de var olacak).
- **Saç tipi/rengi (ek varyant):** Temel 15 karakterin kendi sabit görünümüne ek olarak, oyuncunun saç tipini/rengini değiştirebileceği küçük bir kişiselleştirme katmanı (Run'daki kozmetik kategorileriyle aynı desende — Run Bölüm 15).
- **Dövme/yara izi (savaş izi):** Karaktere gerçekçi dövme veya eski yara izi gibi kozmetik detaylar eklenebilecek, gladyatörün "deneyimli savaşçı" hissini güçlendirecek.
- Tüm bu kategoriler de **kadın/erkek karakter için ayrı tasarlanacak** (Bölüm 3.2.2'deki zırh kuralıyla aynı mantık), ve hepsi **güç/denge açısından nötr** — sadece görsel.
- Kesin kategori sayısı, varyant adedi ve tasarımların tamamı Claude Code'un profesyonel oyun tasarımcısı yargısıyla (Bölüm 0 istisnası) doldurulacak — ama hedef, mümkün olduğunca **zengin bir kişiselleştirme sistemi** olması.

### 3.2.3 Pelerin Kozmetiği (güncellendi — ÖNEMLİ, herkese açık + süper admin'e özel versiyon)

- **Herkese açık (düzeltildi — artık admin'e özel değil):** Pelerin, kişiselleştirme ekranında **tüm oyunculara açık** bir kozmetik seçeneği. Normal oyuncuların pelerini **belirli, standart bir uzunlukta** oluyor, oyuncu istediği **rengi seçebiliyor**.
- **Süper admin'in pelerini farklı (netleşti — ÖNEMLİ):** İda'nın pelerini normal oyunculardan **belirgin şekilde daha uzun**, rüzgarda **dalgalanan** bir tasarımda (referans: Knight Online'daki bağış puanıyla alınan uzun, dalgalanan pelerinler gibi). Üzerinde ayrıca bir **kraliyet tacı** simgesi/işlemesi var. İda da kendi pelerininin rengini seçebiliyor.
- **Görünürlük:** Hem normal oyuncuların hem süper admin'in pelerini **herkese açık ve canlı ortamda görünür** — maç içinde herkes birbirinin pelerini görebiliyor.
- **Güvenlik/doğrulama:** Süper admin'in **özel (uzun/dalgalanan/taçlı)** pelerin versiyonunun sadece İda'nın hesabında çıkması **sunucu tarafında**, İda'nın sabit Gmail adresine bağlı olarak doğrulanacak — istemci tarafında taklit edilemeyecek. Normal pelerin herkese açık olduğu için bu doğrulama sadece "üstün versiyon" için geçerli.
- Pelerinin tam görsel tasarımı (standart versiyon ve süper admin versiyonu ikisi de) Claude Code'un profesyonel oyun tasarımcısı yargısıyla (Bölüm 0 istisnası) en yüksek kalitede doldurulacak — süper admin versiyonu "görkemli" hissi verecek şekilde tasarlanacak.

### 3.2.4 Süper Admin Özel Saldırısı ve Kalkanı (güncellendi — ÖNEMLİ, gizli/özel yetki)

- **Tetikleme (düzeltildi):** Saldırı tuşuna **tek basış normal vuruş** yapıyor (standart mekanik, değişmedi). Tuşu **3 saniye basılı tutarsa**, süre dolduğu anda özel saldırı tetikleniyor. Eğer elini çekmeden **basılı tutmaya devam ederse**, özel saldırı **durmadan tekrar tekrar** tetiklenmeye devam ediyor (her 3 saniyelik döngüde bir).
- **Etki:** Bu özel saldırı, normal bir vuruşun **2 katı hasar** veriyor.
- **Süper admin kalkanı (yeni, ÖNEMLİ):** İda'nın kalkanı, normal oyunculardaki %70-80 aralığından farklı olarak **%90-100 arası hasar azaltıyor** — yani neredeyse tam koruma sağlıyor, normal oyunculardan belirgin şekilde daha dayanıklı.
- **Yetki kapsamı — ÖNEMLİ:** Bu iki özellik de **sadece süper admin'in hesabında** çalışıyor, diğer oyuncular aynı tuş kombinasyonunu yapsa bile veya aynı kalkanı seçse bile bu avantajları elde edemiyor.
- **Güvenlik/doğrulama:** Diğer admin özellikleri gibi (Bölüm 3.2.3, Run Bölüm 13 prensibi), bu da **sunucu tarafında** İda'nın Gmail'ine bağlı olarak doğrulanacak — istemci tarafında taklit edilemeyecek.
- Özel saldırının görsel/ses efekti (normal vuruştan farklı, daha etkileyici bir sunum) Claude Code'un profesyonel oyun tasarımcısı yargısıyla (Bölüm 0 istisnası) tasarlanacak.

### 3.2.5 Süper Admin Canlandırma Yeteneği (ONAYLANDI, yeni gizli/özel yetki, her iki modda da geçerli)

- **Kapsam (güncellendi):** Bu yetenek hem **Battle Royale Modu** hem **Deathmatch**'te geçerli — her iki modda da ölen oyuncunun cesedi maç bitene kadar yerde kaldığı için (bkz. Bölüm 3.1 — ölüm/kan/leş sistemi), canlandırma her ikisinde de mümkün.
- **Tetikleme:** Süper admin (İda), ölmüş bir oyuncunun cesedinin üzerinde **kalkan skill tuşunu 3 saniye basılı tutarsa**, o oyuncu **canlanıyor**.
- **Canlanma durumu:** Canlanan oyuncu **yarı canlı** (yarı can) olarak oyuna geri dönüyor, izleyici modundan çıkıp tekrar oynanabilir hale geliyor.
- **Maç sonunda bile kullanılabilir (netlik):** Maç bitmiş olsa bile, cesetler hâlâ yerdeyse (round sonu ekranına geçilmeden önceki an), süper admin isterse tüm ölen oyuncuları tek tek canlandırabilir.
- **Yetki kapsamı — ÖNEMLİ:** Bu özellik **sadece süper admin'in hesabında** çalışıyor, diğer oyuncular aynı hamleyi (kalkan tuşunu bir cesedin üzerinde 3 saniye basılı tutma) yapsa bile canlandırma tetiklenmiyor.
- **Güvenlik/doğrulama:** Diğer admin özellikleri gibi (Bölüm 3.2.3/3.2.4, Run Bölüm 13 prensibi), bu da **sunucu tarafında** İda'nın Gmail'ine bağlı olarak doğrulanacak — istemci tarafında taklit edilemeyecek.
- Canlanma anının görsel/ses efekti Claude Code'un profesyonel oyun tasarımcısı yargısıyla (Bölüm 0 istisnası) tasarlanacak.

### 3.2.6 SÜPER ADMİN YETKİLERİ — TOPLU ÖZET (Claude Code için, netlik amaçlı)

Bu proje boyunca İda'ya (süper admin) tanınan tüm özel yetkiler, tek yerde toplu olarak:

| Yetenek | Tetikleme | Etki | Kapsam |
|---|---|---|---|
| Pelerin (üstün versiyon) | Otomatik (hesabına bağlı) | Normal oyunculardan çok daha uzun, rüzgarda dalgalanan, üzerinde kraliyet tacı olan pelerin | Her iki mod, her zaman görünür |
| Özel saldırı | Saldırı tuşuna 3 saniye basılı tutma | Normal vuruşun 2 katı hasar; basılı tutmaya devam edilirse tekrar tekrar tetiklenir | Her iki mod |
| Özel kalkan | Otomatik (hesabına bağlı) | %90-100 arası hasar azaltma (normal oyuncularda %70-80) | Her iki mod |
| Canlandırma | Bir cesedin üzerinde kalkan tuşunu 3 saniye basılı tutma | Ölü oyuncu yarı canla geri dönüyor | Her iki mod (Bölüm 3.2.5) |

**Ortak kural — TÜM bu yetenekler için geçerli (ÖNEMLİ):** Her biri **istisnasız sunucu tarafında**, İda'nın sabit Gmail adresine bağlı olarak doğrulanacak. İstemci tarafında hiçbir kontrol yeterli değildir — aksi halde teknik bilgisi olan biri bu yetenekleri taklit edebilir. Bu, Bölüm 0'daki "kritik kontroller sunucu tarafında doğrulanacak" ve Run Bölüm 13.1'deki "admin dışında kimse avantaj sağlayamaz" kurallarının doğrudan bir uzantısıdır — Claude Code, bu dört yeteneği uygularken hepsinde **aynı sunucu-taraflı doğrulama deseni**ni (aynı fonksiyon/middleware'i tekrar kullanarak) uygulamalı, her biri için ayrı ayrı icat etmemeli.

---

## 3.3 ARA MOD — MAYMUN İSTİLASI (ONAYLANDI, yeni mekanik)

Oyuna heyecan katmak için tasarlanmış, round içinde geçici olarak devreye giren bir "işbirliği" arası:

- **Tetiklenme ve zamanlama (netleşti — ÖNEMLİ, güncellendi):** Maymun İstilası **round'un en başında** devreye giriyor — round başladıktan yaklaşık **30 saniye sonra** (kesin süre Claude Code'un test ederek belirleyeceği bir denge). Bu, **hem aslanlar hem boğa gelmeden önce** oluyor — yani round'un genel sıralaması şöyle: **1) Maymun İstilası → 2) Boğa Hücumu → 3) Aslanlar (alan daralması) → 4) Gladyatör Düellosu → 5) Ateş Çemberi** (bkz. Bölüm 3.1'deki tam açıklama).
- **Giriş:** **Arenanın dört farklı tarafından aynı anda** maymunlar haritaya giriyor.
- **Merkeze yönelme:** Maymunlar haritanın **ortasına** doğru ilerliyor — bu, oyuncuları da doğal olarak ortada toplanmaya zorluyor (henüz aslan olmadığı için bu aşamada sadece maymunlardan kaçacak yer arenanın merkezi).
- **Maymun hareket tarzı:** Küçük, hoplaya zıplaya adımlarla, **rastgele** yönlere hareket ediyorlar (öngörülemez, düzenli bir devriye değil).
- **Dadanma davranışı:** Bir maymun bir oyuncuya dadandığında **kolay kolay bırakmıyor**, o oyuncuyu takip etmeye devam ediyor.
- **Hedef değiştirme kuralı:** Bir maymun, dadandığı oyuncuya **3 vuruş** yaptıktan sonra onu bırakıp **en yakındaki başka oyuncuya** geçebiliyor.
- **PvP kapanıyor:** Bu mod aktifken oyuncular **birbirlerine vuramıyor** — skill/vurma sadece maymunlara karşı çalışıyor.
- **Ortak hedef:** Herkesin vurma skill'i **maymunlara karşı** aktif oluyor, tüm oyuncular ortak şekilde maymunlara saldırıyor.
- **Risk:** Maymunlar öldürülmezse oyunculara vurup canlarını azaltıyor — yani saldırmazlarsa can kaybediyorlar, bu yüzden herkes doğal olarak katılmak zorunda kalıyor.
- **Kalkan farkı:** Bu modda kalkan tükenmiyor, basılı tutulduğu sürece sınırsız koruma sağlıyor (bkz. Bölüm 3.1 — kalkan mekaniği).
- **Bitiş:** Tüm maymunlar öldürülünce mod kapanıyor, skiller tekrar normal PvP moduna (oyuncular birbirine vurabilir) dönüyor, oyun kaldığı yerden devam ediyor. Bir süre sonra Boğa Hücumu başlıyor (bkz. Bölüm 3.3.1).
- **Senkronizasyon (teknik not):** Maymunların giriş anı, konumları, hedef seçimi ve hasar/ölüm durumu tüm oyuncularda **senkron** görünmeli — bu, Bölüm 2.1'deki presence+broadcast mimarisiyle aynı yöntemle sağlanacak (drone/NPC senkronizasyonu Run'daki gibi sunucu/host taraflı otorite ile yönetilecek, Claude Code teknik detayı belirleyecek).
- **Amaç:** Round'un başına, oyuncular birbirine karşı savaşmadan önce geçici bir "hep birlikte hayatta kal" anı ekleyip tekdüzeliği kırmak — ama modun kendisi round'un genel "son ayakta kalan" hedefini değiştirmiyor, sadece geçici bir ara.
- Maymunların görseli, sayısı, saldırı sıklığı ve hasar miktarı Claude Code'un profesyonel oyun tasarımcısı yargısıyla (Bölüm 0 istisnası) en yüksek kalitede tasarlanacak.

---

### 3.3.1 ÜÇÜNCÜ TEHDİT — BOĞA HÜCUMU (netleşti, ONAYLANDI, yeni mekanik)

Round'un ilerleyen bir aşamasında ("ikinci tur") devreye giren, Maymun İstilası ile aynı mantıkta çalışan üçüncü bir ortak-tehdit ara modu:

- **Giriş:** Bir **boğa**, arenanın bir **kapısından** içeri giriyor.
- **Davranış — uzun koşu/şarj:** Boğa, oyunculara doğru **uzun bir koşu (şarj)** yapıp vurmaya çalışıyor.
- **İsabet sonucu:** Boğa bir oyuncuya çarparsa, oyuncu **havaya savruluyor**, yere düşüyor ve **3 saniye boyunca bayılmış (sersemlemiş)** kalıyor (süre 5'ten 3 saniyeye düşürüldü) — kafasının üstünde dönen sersemleme efekti (Run'daki beyzbol sopası sersemleme efektiyle aynı görsel dil, Run Bölüm 8). Ayrıca oyuncunun canından **belirli bir yüzde** azalıyor (kesin yüzde Claude Code'un test ederek belirleyeceği kısım).
- **PvP kapanıyor, ortak hedef:** Boğa varken de (Maymun İstilası'ndaki gibi) oyuncular birbirine vuramıyor, herkesin skill'i **boğaya karşı** aktif oluyor — bu bir Battle Royale ara modu, oyuncular birlikte boğaya karşı savaşıyor.
- **Şarj sırasında vurma:** Boğa bir oyuncuya doğru koşarken, **yoldan geçtiği** diğer oyuncular boğaya vurabilir.
- **Duraklama anı:** Boğa bir şarjı bitirince (isabet etsin veya ıskalasın), **yavaşça yön değiştirip yeni bir hedef için hazırlanıyor** — bu duraklama sırasında oyuncular boğaya rahatça vurabiliyor.
- **Aşırı yakın/sürekli vurma cezası (netleşti — ÖNEMLİ):** Eğer oyuncular boğanın **çok dibinde durup sürekli vurursa**, boğa buna karşılık olarak **en yakındaki oyuncuyu** seçip **anlık, ani bir vuruş** yapıyor — bu da o oyuncuyu aynı şekilde havaya savurup bayıltıyor. Bu, oyuncuların boğayı güvenli mesafeden, sırayla vurmasını teşvik eden bir denge kuralı (sürekli bitişik "tank" gibi vurmayı cezalandırıyor).
- **Bitiş:** Boğa öldürülünce mod kapanıyor, oyun normal PvP moduna dönüyor.
- **Görsel/ses ipuçları (netleşti):** Boğa koşarken arkasından **ufak toz/duman bulutu** çıkacak (hız hissi vermek için). Bir oyuncuya isabet ettiğinde net bir **"pat" tarzı çarpma sesi** duyulacak.
- Boğanın can/dayanıklılık değeri, şarj hızı, hedef seçim mantığı ve görsel/ses tasarımının geri kalanı (tam animasyon, toz efektinin tam görünümü, ses tonu vb.) Claude Code'un profesyonel oyun tasarımcısı yargısıyla (Bölüm 0 istisnası) en yüksek kalitede tasarlanacak.

### 3.3.2 GLADYATÖR DÜELLOSU (netleşti, ONAYLANDI, yeni mekanik — Ateş Çemberi'nden ÖNCE)

Aslanlar arenaya girip alanı bir miktar daralttıktan sonra, Ateş Çemberi'nden önce devreye giren, round'a takım tabanlı dramatik bir an ekleyen bir aşama. **Bu, Ateş Çemberi'nin başlamasını daha da geciktiriyor** (kesin sıralama: Maymun → Boğa → Aslan (alanı biraz daraltır) → **Gladyatör Düellosu** → Ateş Çemberi).

- **Geçiş — loot fazı yok (düzeltildi — ÖNEMLİ):** Aslanlar alanı bir miktar daralttıktan sonra, ayrı bir "herkes serbestçe item toplasın" arası **yok**. Direkt borazan çalıyor ve Düello başlıyor — skiller (silah + kalkan) **otomatik olarak aktif** oluyor, oyuncuların önceden item toplamış olmasına gerek yok (zaten Düello'nun kendi "sınırsız skill" kuralı bunu gereksiz kılıyor, bkz. aşağıda).
- **Borazan sinyali:** Bir süre sonra borazan tekrar çalıyor — bu, Düello fazının başladığının işareti.
- **Takım belirleme:** Sistem, düello anında **hayatta kalan oyuncu sayısına göre** (toplam oyuncu sayısına değil — round ilerledikçe elemeler olmuş olabilir) iki takım belirliyor. Takım boyutu hayatta kalan sayısı arttıkça büyüyor: **1'e1, 2'ye2, 3'e3, 4'e4, veya 5'e5** (kesin eşik değerleri — kaç hayatta kalanda hangi format seçileceği — Claude Code'un test ederek belirleyeceği bir denge, Bölüm 0 istisnası).
- **Eşit bölünmeyen sayılar için kural (KRİTİK, yeni — daha önce boşluktu):** Hayatta kalan sayısı seçilen formatın iki katına tam bölünmüyorsa (örnek: 7 kişi kaldı, format 3'e3 seçildiyse 1 kişi açıkta kalır), **açıkta kalan oyuncu(lar), eksik tarafa bot(lar) eklenerek dengelenmiş bir takıma dahil edilir** — yani hiçbir gerçek oyuncu "dışarıda" bırakılmaz, formatı dolduracak kadar bot eklenir. Bu, oynanışı doğrudan etkileyen bir kural olduğu için Bölüm 0 istisnası kapsamında değil, burada kesinleşiyor.
- **Bot desteği:** Belirlenen takım boyutunu doldurmaya yetecek kadar gerçek oyuncu yoksa, **botlar eksiği tamamlıyor.**
- **Düello alanı:** Katılımcı takımlar arenanın **ortasına** çıkıyor, düello orada başlıyor.
- **Item düşmüyor (netleşti):** Düello sırasında haritada hiçbir item (silah/kalkan/can/hızlandırma) düşmüyor — kapalı bir çatışma, zaten sınırsız skill kuralı geçerli (bkz. Bölüm 3.1).
- **Katılmayan oyuncular ne yapıyor (netleşti):** Düelloya seçilmeyen oyuncular **sadece izliyor** — oyun onlar için durmuş gibi, düello bitene kadar bekliyorlar.
- **Sınırsız skill (netleşti — ÖNEMLİ, yeni kural):** Düello sırasında herkesin silahı **ve** kalkanı, Deathmatch'teki gibi (bkz. Bölüm 3.8) **sınırsız** oluyor — cooldown/tükenme yok, dramatik ve hızlı bir çatışma için.
- **Bitiş — ölüm eşiğine göre (düzeltildi — ÖNEMLİ):** Düello, bir taraf tamamen elenene kadar değil, **belirli bir ölüm sayısına ulaşınca** bitiyor:
  - **1'e1, 2'ye2, 3'e3 formatlarında:** **1 ölüm** yeterli, düello hemen bitiyor.
  - **4'e4 ve 5'e5 formatlarında (düzeltildi):** **2 ölüm** gerekiyor.
  - Düelloda bazı katılımcılar ölür, bazıları sağ kalır — sağ kalanlar (hem düello katılımcıları hem daha önce izleyen oyuncular) bir araya gelip oyun devam ediyor (bkz. Bölüm 3.3.3 — Final Aşaması).
- **Not — genel "takım yok" kuralına istisna:** Bölüm 3'teki "kimse takım değil, herkes birbirine karşı" kuralı round'un genel yapısı için geçerli — Gladyatör Düellosu, bu kurala **geçici ve özel bir istisna** getiren, kısa süreli bir ara moddur, round'un kalanını etkilemez.
- Düello çemberinin görsel sunumu (aydınlatma, seyirci reaksiyonu tepe noktası vb.) Claude Code'un profesyonel oyun tasarımcısı yargısıyla (Bölüm 0 istisnası) en yüksek kalitede tasarlanacak.

### 3.3.3 DÜELLO SONRASI FİNAL AŞAMASI (netleşti, ONAYLANDI, yeni mekanik)

- **Kısa normal PvP arası:** Düello bittikten sonra, sağ kalan oyuncular (hem düello katılımcıları hem daha önce izleyen oyuncular) yaklaşık **20 saniye** boyunca normal şekilde (mevcut kurallarla, itemli/aktif-pasif skill mantığıyla) oynamaya devam ediyor.
- **Full PvP — sınırsız skill (netleşti — ÖNEMLİ):** Bu 20 saniyenin ardından **Full PvP modu açılıyor** — Deathmatch modundaki gibi (bkz. Bölüm 3.8) herkesin skill'i (silah + kalkan) **sınırsız** hale geliyor, cooldown/tükenme kalmıyor.
- **Bitiş koşulu:** Bu final aşaması, **sadece bir oyuncu kalana kadar** devam ediyor — round'un kazananı bu aşamada belli oluyor.
- **Ateş Çemberi ile ilişkisi:** Eğer Ateş Çemberi de bu sırada aktifse (bkz. Bölüm 3.1 — aslanlar da ölmüşse), bu final aşaması Ateş Çemberi ile **aynı anda** yaşanabilir — ikisi birlikte round'u hızlı ve kesin şekilde bitirmeye hizmet ediyor.
- **Genel tempo hedefi (netleşti — ÖNEMLİ):** Maymun İstilası'ndan bu final aşamasına kadar olan tüm özel fazlar dizisi (Maymun → Boğa → Aslan → Düello → 20sn ara → Full PvP final) toplamda **yaklaşık 2-4 dakika** sürmeli — ne çok kısa (oyuncular olayları yaşayamadan bitmemeli) ne çok uzun (heyecan düşmemeli). Kesin süre dağılımı Claude Code'un test ederek belirleyeceği bir denge (Bölüm 0 istisnası), ama bu 2-4 dakikalık hedef aralığı bir üst sınır/çerçeve olarak kullanılacak.
- **Pasif oyuncu güvencesi (netleşti):** Full PvP aşamasında oyuncular birbirine hiç saldırmasa (pasif kalıp süründürmeye çalışsa) bile, round sonsuza kadar uzamıyor — Ateş Çemberi'nin zamanla artan hasarı (bkz. Bölüm 3.1) veya alan daralması, oyuncular saldırmasa bile round'u er ya da geç doğal olarak bitiriyor. Yapay bir "oyuncular saldırmazsa ne olur" boşluğu yok.

---

## 3.4 TUTORIAL VE MAÇ BAŞLANGICI (ONAYLANDI)

- **İlk giriş tutorial'ı:** Oyuncu Gladius'a **ilk kez** girdiğinde, kısa, atlanabilir bir tanıtım gösterilecek (hareket kontrolü, skill/vurma tuşu, kalkan basılı tutma mantığı) — Run'daki tutorial prensibiyle aynı (Run Bölüm 4.1).
- **Senkron başlangıç — KESİN KURAL:** Multiplayer bir odada (arkadaşlarla) oynanıyorsa, **round hiçbir oyuncu için erken başlamıyor.** Bir oyuncu tutorial'ı ilk kez görüyorsa ve diğerleri zaten biliyorsa bile, **herkes arenaya aynı anda giriyor, herkes aynı anda başlıyor.**
  - Tutorial'ı gösterilen oyuncu tutorial'ı bitirip arena giriş ekranına gelince, orada **bekliyor**.
  - Round, **tüm oyuncular** arena giriş noktasına ulaşana kadar başlamıyor.
  - "Bir oyuncu oyunda, bir oyuncu hâlâ tutorial'da" durumu **kesinlikle olmayacak** — bu senkronizasyon Claude Code tarafından kusursuz şekilde kurulacak (presence+broadcast mimarisiyle, Bölüm 2.1).
- **Maç başlama sinyali — Borazan (netleşti):** Tüm oyuncular arenaya girip round başlamaya hazır olduğunda, birkaç saniye **borazan sesi** çalıyor, sonra round başlıyor. Bu, gladyatör temasına uygun net bir "maç başlıyor" işareti.

---

## 3.5 GİRİŞ EKRANI / TEMA METNİ (ONAYLANDI)

- Round başlamadan önceki bekleme/giriş ekranında, kısa bir **tema/atmosfer metni** gösterilecek — oyuncuya "neredeyiz, ne oluyor" hissini veren, Roma/gladyatör konseptine oturan ufak bir tanıtım yazısı (örnek ton: "Roma'dasın. Arenada dövüşmek zorundasın." gibi kısa, epik bir cümle veya birkaç cümlelik akış).
- Kesin metni Claude Code, gladyatör temasına uygun şekilde (Bölüm 0 istisnası) yazacak.

### 3.5.1 Maç Öncesi Sinematik Video (netleşti — ÖNEMLİ, yeni özellik, fizibilite notuyla)

- **İstenen:** Maç başlamadan önce, oyunun kendi grafik stilinden bağımsız, ~**10 saniyelik sinematik bir video** oynatılacak — arenanın altında hazırlanan gladyatörler, şarap içip çılgınca eğlenen seyirciler gibi film sahnesi hissi veren bir açılış.
- **Fizibilite notu (ÖNEMLİ — netlik için eklendi):** Tam **fotogerçekçi ("gerçek film gibi")** bir sinematik, oyunun geri kalanı 2D kuş bakışı çizim stilinde olduğu için ayrı, çok yüksek maliyetli bir üretim işi gerektirir (3D karakter/ortam modelleme, render pipeline, animasyon vb.) — bağımsız bir projede bunu gerçek anlamda photoreal kalitede üretmek gerçekçi değil.
- **Önerilen yaklaşım:** Oyunun **kendi 2D sanat diliyle**, ama sinematik kamera hareketleri (yakınlaşma, pan, yavaş çekim benzeri vurgular), atmosferik ışıklandırma ve zengin sahne kompozisyonuyla (meşaleler, seyirci kalabalığı, şarap kadehleri, gladyatörlerin hazırlanma anları) **stilize bir açılış sekansı** hazırlanacak. Bu, istenen "sinema hissini" verir ama teknik olarak bir bağımsız oyun projesinde yapılabilir.
- **Ne zaman oynatılır:** Round başlamadan önceki bekleme ekranında (Bölüm 3.5'teki tema metniyle birlikte veya ardından), maç içi grafiklerden bağımsız bir sahne olarak.
- Kesin sahne kurgusu, kamera hareketleri, süre dağılımı ve üretim yöntemi (2D illüstrasyon + kamera animasyonu, sprite tabanlı sahne vb.) Claude Code'un profesyonel oyun tasarımcısı yargısıyla (Bölüm 0 istisnası) belirlenecek — ama "photoreal film" değil, "stilize sinematik" hedefi net.

---

## 3.6 ROUND SONU SIRALAMASI (ONAYLANDI)

- Run'daki iki katmanlı (başarılı/başarısız) sıralama BR'ye uymuyor çünkü BR'de "çıkış" yok, sadece eleme var.
- **BR'nin kendi mantığı:** Basit bir sıralama — **son ayakta kalan oyuncu 1.**, ondan önce elenen oyuncu 2., ondan önce elenen 3. — yani **eleme sırasının tersi** sıralamayı belirliyor.
- Round sonu ekranında bu sıralama gösterilecek, Run'daki "Tekrar Oyna" / "Lobiye Dön" seçenekleri aynen kullanılabilir (Run Bölüm 12).

### 3.6.1 Galibiyet Kuralı ve "Kazanan Yok" Durumu (netleşti — ÖNEMLİ)

- **Net galibiyet kuralı:** Bir oyuncu ölüp diğeri **hayatta kalıyorsa**, hayatta kalan **galip** ilan edilir — ikisinin ölümü aynı saniyede olması ŞART DEĞİL, sadece birinin ölüm efekti tamamlanıp diğeri hâlâ ayaktaysa bu yeterli.
- **Ölüm sonrası kısa bekleme (cooldown):** Bir oyuncu ölünce, ölüm efekti/animasyonu tamamlanır, ardından kısa bir bekleme süresinin sonunda galip resmi olarak ilan edilir (ani/kesik bir geçiş olmasın diye).
- **"Kazanan yok" durumu — sadece gerçek eş zamanlı ölümde (netleşti — ÖNEMLİ):** Bu, bir "berabere" değil — **kazanan yok, herkes öldü** anlamına geliyor. Sadece şu senaryoda oluşur: oyuncular round boyunca birbirine hiç saldırmaz (pasif kalır/test amaçlı beklerse), alan Ateş Çemberi ile tamamen daralır, tüm arena yanar hale gelir, ve **gerçekten aynı anda** iki oyuncu birden ölür. Bu, oyunun normal akışında neredeyse hiç yaşanmaması gereken, sadece pasif/kaçamak oynanışın kendine has bir sonucu.

### 3.6.2 Zafer Anı ve Faz Duyuruları (netleşti — ÖNEMLİ, yeni özellik)

- **Zafer anı:** Bir oyuncu galip ilan edildiğinde, **borazan çalar**, arena halkı (seyirciler) coşkuyla tepki verir/bağırır, galip için görsel bir zafer efekti oynatılır (kesin görsel Claude Code'un profesyonel oyun tasarımcısı yargısıyla, Bölüm 0 istisnası, tasarlanacak).
- **Son vuruş/galibiyet anı replay'i (ONAYLANDI, yeni özellik):** Arenadan bir galip çıkarsa (yani Bölüm 3.6.1'deki "kazanan yok" senaryosu oluşmazsa), round biterken **son vuruş anı ve galibiyet anı** çok kısa bir yakın çekim/replay olarak gösteriliyor — sonra sonuç ekranına geçiliyor. Bu, paylaşılabilir sonuç kartıyla (Run Bölüm 18) doğal olarak birleşen, insanların kendi zafer anlarını tekrar izlemesini/paylaşmasını teşvik eden bir detay. Kesin kamera açısı, süre ve geçiş Claude Code'un profesyonel oyun tasarımcısı yargısıyla (Bölüm 0 istisnası) tasarlanacak.
- **Her özel faz girişinde borazan (netleşti — ÖNEMLİ, genelleme):** Sadece round başlangıcında değil, **Maymun İstilası, Boğa Hücumu ve Gladyatör Düellosu** gibi her özel fazın başlangıcında da borazan çalıp arena halkı bilgilendirici/coşkulu şekilde tepki verecek — bu, tüm özel anları tutarlı bir "arena duyurusu" diliyle işaretleyen genel bir kural.

---

## 3.7 EKONOMİ (ONAYLANDI)

- Oyun **şimdilik tamamen ücretsiz** — tüm karakterler, silahlar, kozmetikler free. Run'daki prensiple aynı (Run Bölüm 17): ileride bir ekonomi eklenebilir ama şu an geliştirilmeyecek, sadece ileri aşama notu.

---

## 3.8 İKİNCİ OYUN MODU — DEATHMATCH (ONAYLANDI)

Aynı Gladyatör Arenasını kullanan, ama farklı kurallarla oynanan ikinci bir mod:

- **Mod adı: Deathmatch.**
- **Oyuncu sayısı:** Aynı şekilde eşzamanlı **10 kişiye kadar**.
- **Item yok:** Haritada yerden toplanacak silah/kalkan itemi **düşmüyor**.
- **Silah ve kalkan baştan aktif, sınırsız kullanım (netleşti):** Oyuncular maça, seçtikleri silah ve kalkan **zaten aktif** halde giriyor. Mod 1'deki "toplayınca aktifleşme" kuralı bu modda **geçerli değil**.
  - **Silah:** Sınırsız kullanım hakkı, saldırı için bir sınır/cooldown yok.
  - **Kalkan:** Sınırsız — Mod 1'deki "1 vuruşta tükenme" kuralı bu modda **geçerli değil**, kalkan basılı tutulduğu sürece sınırsız koruma sağlıyor (Mod 1'deki "Maymun İstilası"nda kalkanın davrandığı şekille aynı mantık).
- **Serbest format:** Herkes **tek başına (solo)** oyuna giriyor, resmi bir takım sistemi yok. Ama oyuncular isterlerse informal şekilde birbirleriyle geçici ittifak kurup ortak hareket edebilir — isteyen kaçabilir, isteyen savaşabilir, isteyen bir arkadaşıyla diğerlerine karşı birlikte hareket edebilir.
- **Aslanlar (netleşti):** Bu modda da aslanlar var, konsept olarak aynı (zincirli, alanı daraltan). Ama **çok daha yavaş ve pasif** — Mod 1'deki hızlı daralmanın aksine, bu modda daralma battle royale'ın asıl odağını (oyuncular arası savaş) gölgelemeyecek kadar yavaş, arka planda hafif bir baskı unsuru.
- **Aslan öldürülebilir (yeni, netleşti):** Oyuncular isterse alanı daraltmaya çalışan aslanlara saldırıp **öldürebilir**. Aslanlar **kolay ölmüyor** (yüksek can/dayanıklılık) ama **öldürülmesi mümkün** — bir aslan öldürülürse o bölgedeki daralma tehdidi ortadan kalkıyor.
- **Maymun istilası: Bu modda YOK (netleşti).** Sadece Mod 1'e (bkz. Bölüm 3.3) özel bir mekanik.
- **Kazanma koşulu (netleşti):** Mod 1 ile aynı — **son ayakta kalmak**. Round sonunda Bölüm 3.6'daki gibi bir sıralama ve puanlama gösterilecek.
- **Matchmaking (netleşti):** Oyuncular online olarak **Mod 1 veya Mod 2'yi kendileri seçip** oynayabiliyor — iki mod ayrı ayrı eşleşme kuyruğu/oda seçeneği olarak sunulacak.
- **Bot desteği (netleşti):** Deathmatch'te de Mod 1'deki gibi **bot doldurma** var — tek başına bile botlarla oynanabiliyor. Oda kurulduğunda host'un **isteğe bağlı** olarak bot ekleyip eklememe seçeneği olacak (Run/Bölüm 16'daki "bot ekle" mantığıyla aynı).

### 3.8.1 Deathmatch'e Ek Atraksiyon (netleşti — ÖNEMLİ, yeni mekanikler)

Deathmatch'in tempo/aksiyon odaklı kimliğini bozmadan (Mod 1'deki gibi "dur, ortak düşmana vur" tarzı aralar EKLENMEDİ), mevcut sınırsız savaşı daha görünür ve dramatik hale getiren iki ek mekanik:

- **Kill Streak (Eleme Serisi) Efekti (ONAYLANDI):** Art arda eleme yapan bir oyuncunun karakterinde geçici bir görsel efekt oluşuyor (örn. alev/parıltı halkası) — bu **sadece görsel**, herhangi bir güç/hasar avantajı sağlamıyor. Amaç, "şu an kim ateşli" hissini herkese göstermek ve rekabeti görünür kılmak. Kesin görsel tasarım ve kaç elemede tetikleneceği Claude Code'un profesyonel oyun tasarımcısı yargısıyla (Bölüm 0 istisnası) belirlenecek.
- **Altın Dakika (ONAYLANDI, süre kısaltıldı):** Round içinde rastgele bir anda, **~15-20 saniyelik** kısa bir "Altın Dakika" başlıyor — bu süre boyunca tüm vuruşlar **çift hasar** veriyor, sonra normale dönüyor. **Süre kasıtlı olarak kısa tutuluyor** çünkü: (1) Deathmatch'te can yenileme çok nadir ve sınırlı (bkz. aşağıda), (2) çift hasarla iki oyuncunun karşılıklı vuruşması zaten çok hızlı sonuçlanıyor — daha uzun bir süre gereksiz/dengesiz olurdu. Kesin tetiklenme sıklığı ve süre Claude Code'un test ederek belirleyeceği bir denge (Bölüm 0 istisnası), ama üst sınır 15-20 saniye civarı olacak.
- **Deathmatch'te can itemi (düzeltildi — ÖNEMLİ):** Önceki "item yok, can yenileme yok" ifadesi düzeltildi — Deathmatch'te de **çok nadiren** bir can itemi düşebiliyor, ama sadece **2 vuruşluk hasarı** (30 puan) dolduruyor — tam iyileşme değil, kısmi bir telafi. Hızlandırma itemi de (yukarıda, Bölüm 3.1) bu modda geçerli. **İyileşme sadece bu can itemiyle olur** — başka hiçbir mekanik (skill, pasif regen vb.) can doldurmaz.
- **Zırh Yükseltmesi itemi (ONAYLANDI, yeni item):** Haritada nadiren düşen bir item — toplayan oyuncu **otomatik olarak** (tuşa basmaya gerek kalmadan), **10-15 saniye boyunca** gelen hasarı azaltan geçici bir koruma katmanı kazanıyor. Amaç, oyuncuların hemen ölmeyip haritada biraz vakit geçirebilmesi.
- **Güç Patlaması itemi (ONAYLANDI, yeni item):** Haritada nadiren düşen bir item — toplayan oyuncu **otomatik olarak**, **sınırlı bir süre boyunca** verdiği hasarı artırıyor. Kesin süre ve artış oranı Claude Code'un test ederek belirleyeceği bir denge (Bölüm 0 istisnası) — nadir ve kısa tutulacak, dengeyi bozmayacak.
- **Rastgele Alev Püskürmesi (ONAYLANDI, yeni tehlike — SADECE Deathmatch'te, Battle Royale Modu'nda YOK):** Belirli aralıklarla, arenanın **köşelerinden rastgele** bir noktadan alev püskürüyor. Bir oyuncu şans eseri o anda o noktadaysa, **alev alıyor** ve **3 saniye boyunca** ufak bir yanma hasarı alıyor. Bu, tamamen şansa bağlı, öngörülemez bir çevresel tehlike — Battle Royale Modu'nda bu mekanik **yok**, sadece Deathmatch'e özel. Kesin püskürme sıklığı, hasar miktarı ve görsel/ses efekti Claude Code'un profesyonel oyun tasarımcısı yargısıyla (Bölüm 0 istisnası) belirlenecek.

**Açık sorular (Mod 2 için):**
- [ ] Aslanın kesin can/dayanıklılık değeri, oyuncunun aslana verdiği hasar miktarı (Claude Code test ederek belirleyecek — Bölüm 0 istisnası)
- [x] Puanlama sistemi kesin formülü — Claude Code'un profesyonel oyun tasarımcısı yargısıyla (Bölüm 0 istisnası) test ederek belirleyeceği bir denge, kullanıcı onayı bekletilmeyecek.

---

## 3.9 ANA MENÜ VE ARAYÜZ TASARIMI (netleşti — ÖNEMLİ, eksiklik giderildi)

- **Genel prensip — "panel gibi olmasın" (netleşti):** Ana menü, sıradan bir yönetim paneli/dashboard gibi (düz gri kutular, liste halinde butonlar, beyaz arka plan) **kesinlikle görünmeyecek**. Bunun yerine, oyunun temasına tam oturan, **sinematik ve atmosferik** bir başlangıç ekranı olacak — büyük stüdyo oyunlarının (AAA) ana menüleri gibi.
- **Görsel konsept:** Arka planda, altın saatte (gün batımı ışığıyla) veya meşale ışığıyla aydınlanmış, atmosferik bir Gladyatör Arenası sahnesi (hafif hareketli/parallax olabilir — meşale alevleri titreşen, toz zerrecikleri süzülen, uzakta seyirci siluetleri). Ön planda, oyuncunun seçili karakteri **görkemli bir pozda** durabilir (karakter seçim ekranına geçiş için doğal bir bağlam oluşturur).
- **Buton/çerçeve stili:** Düz dikdörtgen material-design butonlar yerine, Roma/gladyatör temasına uygun **süslü çerçeveler, metal/taş dokulu butonlar** kullanılacak — düğmelere basınca hafif bir "metal tıklaması" sesi ve görsel geri bildirim (parlama, hafif titreşim) olabilir.
- **Ana menü navigasyon yapısı (öneri, Claude Code detaylandıracak):**
  - **Oyna** → Mod seçimi (Battle Royale Modu / Deathmatch), ardından Hızlı Eşleşme veya Oda Kur seçenekleri.
  - **Karakterim** → Karakter seçimi + kişiselleştirme ekranı (Bölüm 3.2.1).
  - **Sıralama/Ligler** → Leaderboard, rozetler (Bölüm 2.1).
  - **Arkadaşlar** → Arkadaş listesi, davet (Bölüm 2.1).
  - **Ayarlar** → Ses, bildirim, hesap ayarları.
- **Genel kalite hedefi:** Run projesindeki kaliteden daha iyi olması hedeflenen genel prensip (Bölüm 3.1'de belirtilen kural), ana menü ve tüm arayüz ekranları için de aynı şekilde geçerli — bu doğrudan "Bölüm 0 istisnası" kapsamında Claude Code'un profesyonel oyun tasarımcısı yargısıyla en yüksek kalitede tasarlanacağı anlamına geliyor.
- Ana menünün tam görsel detayları (parallax katmanları, animasyon süreleri, ses tasarımı, tam buton yerleşimi) Claude Code'un profesyonel oyun tasarımcısı yargısıyla (Bölüm 0 istisnası) doldurulacak — ama "sıradan bir panel değil, sinematik bir giriş" hedefinden ödün verilmeyecek.

---

## 3.10 GECİKME TELAFİSİ VE HİLE ÖNLEME MİMARİSİ (KRİTİK, netleşti)

Bu proje için en zor teknik problem: gerçek zamanlı vuruş kontrolü, ağ gecikmesiyle birlikte nasıl adil çalışacak.

- **Sorun:** Oyuncu A'nın ekranında oyuncu B, ağ gecikmesi/interpolation yüzünden gerçek konumundan ~100-200ms geriden görünür. Sunucu "mesafe+açı tuttu mu" kontrolünü kimin konumuna göre yapacak?
- **Karar — Lag Compensation (Sunucu Rewind) kullanılacak (netleşti — ÖNEMLİ):** Sunucu, bir vuruş geldiğinde, **saldıran oyuncunun o anki ekranında gördüğü (interpolate edilmiş, bir miktar geçmişe ait) rakip pozisyonuna göre** mesafe+açı kontrolü yapacak — rakibin sunucudaki o anki "gerçek" pozisyonuna göre değil. Bu, FPS oyunlarında yaygın kullanılan "favor the shooter" / server-rewind tekniğidir.
- **Gerekçe:** Alternatif (sunucunun her zaman o anki gerçek pozisyona göre karar vermesi), saldıran oyuncu için sürekli "gördüğüm yerde vurdum ama saymadı" hissi yaratır — küçük, arkadaş grubuyla oynanan bir oyun için bu his oyunu bozar. Rewind tekniği "hızlı ve doğru hissettiren" tarafı seçiyor; karşılığında nadiren "kaçtım ama yine vuruldum" gibi bir dezavantaj rakip tarafta oluşabilir — bu, 4-10 kişilik küçük odalarda (Bildim/Gladius'un ölçeği) düşük ağ gecikmesi beklendiği için zaten minimal bir risk, dolayısıyla bu ölçekte en mantıklı seçim.
- **Kapsam:** PatiRun'da temas bazlı yakalama var, hassas vuruş mesafesi/açı kontrolü yok — bu teknik PatiRun'dan kopyalanamaz, Gladius'a özgü yeni bir problem.
- **Uygulama detayı:** Sunucu, son birkaç yüz milisaniyelik oyuncu pozisyon geçmişini (position buffer/history) tutmalı, gelen her vuruş isteğinin zaman damgasına göre bu geçmişten ilgili anı bulup kontrol yapmalı. Kesin buffer süresi (örn. 200-300ms) Claude Code'un test ederek ince ayar yapacağı bir detay, ama genel mimari yukarıda kesinleşti.

---

## 3.11 MATCHMAKING MİMARİSİ (KRİTİK, yeni — daha önce tanımsızdı)

- **İki ayrı akış var:** "Hızlı Eşleşme" (public, tanımadığın insanlarla) ve "Oda Kur" (davetli, Bildim'in mevcut Grup Maçı/davet sistemine benzer).
- **Hızlı Eşleşme kuyruk mantığı (netleşti — ÖNEMLİ):** Oyuncu "Hızlı Eşleşme"ye girince bir bekleme kuyruğuna alınır. Sistem **~15-20 saniye** boyunca başka gerçek oyuncu arar (kesin süre Claude Code'un test ederek belirleyeceği bir denge). Bu süre dolduğunda, eksik kalan slotlar **botlarla dolduruluyor** ve maç başlıyor — oyuncu sonsuza kadar beklemiyor.
- **Oda Kur akışı:** Bildim'in mevcut davetli Grup Maçı sistemiyle aynı desende (arkadaş seç, davet gönder) — Run Bölüm 16'daki "hazır" işaretleme ve host mantığı burada da geçerli (bkz. Bölüm 1 tablosu).
- Bu iki akışın kesin arayüz/buton yerleşimi Bölüm 3.9'daki (Ana Menü) "Oyna" navigasyonunda zaten planlandı; burada eklenen, **Hızlı Eşleşme'nin bekleme/bot-doldurma mantığının kesinleşmesi.**

---

## 3.12 BAĞLANTI KOPMASI / RECONNECT (KRİTİK, yeni — Gladius'a özel netleştirme)

Run Bölüm 2.2'de tanımlanan genel kural (bkz. Bölüm 1 tablosu) burada Gladius'un kendi mekanikleriyle netleştiriliyor:

- **1 dakikalık reconnect hakkı:** Bir oyuncunun bağlantısı koparsa, **1 dakika içinde** yeniden bağlanma hakkı var (Run'daki genel kuralla aynı).
- **Karakteri hâlâ hayattaysa:** Yeniden bağlandığında kaldığı yerden, aynı can/pozisyon durumuyla devam eder.
- **Karakteri elenmiş/izleyici moduna geçmişse:** Yeniden bağlandığında izleyici modunda devam eder.
- **1 dakika içinde dönülmezse:** Oyuncu round'dan düşmüş sayılır (izleyici moduna geçmiş gibi davranılır), diğer oyuncular için oyun normal akışında devam eder. Round sonu sıralamasında (Bölüm 3.6) bu oyuncu, koptuğu anki durumuna göre sıralanır.
- **Gladyatör Düellosu sırasında kopma (özel durum, netleşti):** Eğer bir düello katılımcısı düello sırasında bağlantısını kaybederse ve 1 dakika içinde dönmezse, o oyuncu elenmiş sayılır (takımının o kişi eksik devam etmesi ya da botun yerini alması Claude Code'un test ederek belirleyeceği bir denge, Bölüm 0 istisnası).

---

## 3.13 SANAT/SES BEKLENTİ YÖNETİMİ (KRİTİK, yeni — netlik için eklendi)

Bu bölüm, ilerideki hayal kırıklığını önlemek için gerçekçi bir beklenti çerçevesi çiziyor:

- **Karakterler foto-gerçekçi OLMAYACAK:** Claude Code kod yazan bir yapay zekadır, elle çizilmiş veya foto-gerçekçi karakter sanatı üretemez. "15 gerçekçi gladyatör" hedefi, **PatiRun'daki gibi kod ile çizilen (parametrik, vektörel) 2D karakterler** olarak gerçekleşecek — bu iyi ve profesyonel bir sonuç verebilir (PatiRun/Run kalitesi hedefi hâlâ geçerli), ama "sinematik/foto-gerçekçi" kelimesi teknik olarak "yüksek kaliteli kod-tabanlı vektörel çizim" anlamına geliyor, gerçek bir illüstratörün çizdiği sanat değil.
- **Karakter sesleri stüdyo kalitesinde OLMAYACAK:** "15 farklı karakter sesi" hedefi, muhtemelen **ücretsiz/açık kaynaklı ses kütüphanelerinden** derlenip düzenlenecek — profesyonel stüdyo seslendirmesi (gerçek seslendirme sanatçıları) bu projenin kapsamında değil. Ses kalitesi prensibi (Bölüm 3.1 — DidaGP'nin kalitesiz seslerinin tekrarlanmaması) hâlâ geçerli, ama "stüdyo kalitesi seslendirme" ile karıştırılmamalı.
- **Sinematik video (Bölüm 3.5.1) için de aynı çerçeve geçerli** — zaten orada fizibilite notu var, burada genelleniyor.
- Bu not, projenin kalitesini düşürmüyor — sadece "ne tür bir kalite" beklenmesi gerektiğini netleştiriyor, ilk sonucu görünce şaşırmamak için.

---

## 4. BİR SONRAKİ ADIM

Yukarıdaki açık soruları netleştirip bu dosyayı güncelleyeceğiz. Netleştikçe:
- Run.md'deki gibi bölüm bölüm (hikaye, harita, silah sistemi, matchmaking, admin modu, fazlar) dolduracağız.
- Sonunda Claude Code'a verilecek eksiksiz bir spec dosyası olacak.

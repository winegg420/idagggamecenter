# YAKALA BENİ — PROGRESS

## Proje Özeti
Fun Run tarzı, mobil öncelikli, 3D, gerçek zamanlı çok oyunculu web yarış oyunu.
Stack: React + Vite + TS, React Three Fiber + drei, Zustand, Supabase (ücretsiz plan), Vercel.

## Önemli Kararlar
- (2026-07-03) Hareket modeli: karakter otomatik ileri koşar; joystick X = yanal hareket, joystick yukarı itme = zıplama. Tünel/köprü ayrı mekanik değil, pist geometrisi (alt yol / üst yol).
- (2026-07-03) Pist modeli: CatmullRom eğrisi (merkez hat) + yanal offset (s, x, y koordinat sistemi). Fizik saf fonksiyonlarla (test edilebilir).
- (2026-07-03) Supabase env eksikse: yapılandırma ekranı gösterilir; DEV modda yerel test kullanıcısıyla bypass (sadece geliştirme için, misafir modu değil).
- (2026-07-03) Hedef yarış süresi ~75 sn: pist uzunluğu / taban hız buna göre (900 birim / 12 b-sn).

## Yapılanlar
- (2026-07-03) Proje iskeleti kuruldu: Vite react-ts, three/R3F/drei/zustand/supabase-js, vitest.
- (2026-07-03) FAZ 1 TAMAM: auth katmanı (Google OAuth kodu + DEV bypass), Orman pisti (rampa/tünel/köprü/checkpoint), joystick+klavye, koşu/zıplama, F1 ışıkları, bitiş+sonuç ekranı. 34 test geçti.
- (2026-07-03) FAZ 2 TAMAM: 5 skill + altın (rollSkill catch-up ağırlıklı, golden ~%0.4 taban), kutu sistemi + tek slot envanter, engel/kalkan/yıldırım/knockback etkileri, botlar (kolay 0.90/orta 0.96/zor 1.0 hız çarpanı + tepki gecikmesi), slipstream %4, checkpoint sıra bildirimi. 53 test geçti, build temiz.
- Karar: AFK sayacı yalnızca gerçek dokunuşla sıfırlanır; bot/ağ girdileri `input.active` bayrağıyla canlı sayılır.
- Not: bundle ~1.1MB (three.js) — Faz 6'da code-splitting yapılacak.
- (2026-07-03) FAZ 3 TAMAM: RoomClient (Supabase Realtime presence+broadcast), oda kur/katıl/kod/WhatsApp daveti (?oda=KOD otomatik katılım), lobi (dans/emoji/hızlı ifade/serbest chat+küfür filtresi), harita oylaması (çoğunluk/eşitlikte rastgele), takım seçimi, MpRaceScreen (client-side prediction + entity interpolation 150ms tampon + 10Hz pozisyon limiti), reconnect overlay + stale=donuk karakter, AFK motor içinde. SQL şeması supabase/migrations/001_schema.sql (RLS'li). 72 test geçti.
- (2026-07-03) FAZ 4 TAMAM: Volkan + Gökyüzü + gizli "Şeker Diyarı" haritaları (hepsi 60-90sn, tünel/köprü/rampa/checkpoint testli), gece/gündüz tema, 20 parametrik karakter (CharacterModel.tsx — asset yok, tamamı geometrik), 9 kozmetik slotu + 16 renk, karakter XP (seviye 5+ altın hale), WebAudio prosedürel ses motoru (skill/karakter ah-of sesleri/müzik döngüsü), gizli kısayol = sağ kenar şeridi hız çarpanı 1.3 (maçların %12'sinde açık), 50 yarışta gizli harita + sürpriz bildirimi. 82 test geçti.
- (2026-07-03) FAZ 5 TAMAM: hızlı maç (realtime kuyruk kanalı, 12sn eşleşme, en kıdemli host olur, eksikler host-yürütümlü senkron botlarla dolar, kimse yoksa yerel bot yarışı), puan+günlük bonus+rütbe (apply_race_result RPC), 15 rozet (evaluateBadges saf+testli), profil (istatistik/rozet/karakter seviyeleri/maç geçmişi son 20), sıralamalar (genel/arkadaş/haftalık/aylık), arkadaş sistemi (ara/ekle/kabul/çıkar/engelle) + online presence kanalı + arkadaş-online toast'ı, hayalet yarış (GhostRecorder/Player 5Hz, localStorage + best_times), rütbe avatar çerçeveleri (CSS frame-*). 92 test geçti.
- Not: her katılımcı kendi races satırını yazar (MP'de koordinasyonsuz, RLS-güvenli; veri tekrarı kabul edildi).
- Dikkat: PowerShell ile dosya içi replace YAPMA — UTF-8 bozuluyor (mojibake). Dosya düzenlemelerinde her zaman Edit/Write araçlarını kullan.
- Mimari karar: Supabase ücretsiz planda sürekli sunucu fizik döngüsü yok → her istemci kendi koşucusunda otorite, pozisyonlar plausibility sınırlı, sonuç doğrulama edge function ile (Faz 5/6). Skill'ler hedefin istemcisinde uygulanır (kalkan manuel savunma yerelde çözülür).

- (2026-07-03) FAZ 6 TAMAM: foto-finiş replay (son 4sn, 0.5x yavaş çekim, yan kamera), podyum ekranı (konfeti + kazanan dansı + "Hava At" alay butonu), mizahi kategoriler (buildResults), paylaşılabilir sonuç kartı (canvas PNG + Web Share/indirme), revanş (MP: aynı odayla lobiye dön / tekli: yeniden başlat), prosedürel menü+yarış müziği ekran geçişlerine bağlı, tutorial (ilk yarışta tek seferlik) + 14 özgün yükleme ipucu, ayarlar modalı (müzik/efekt/titreşim/grafik), otomatik grafik kalitesi (3sn FPS penceresi → dpr), cache busting (version.json + vercel.json header'ları + 5dk sürüm kontrolü), hata loglama (window.onerror → error_logs, oturum başına maks 5), anti-ışınlanma kırpması (setRemoteState), code splitting (three ayrı chunk: index 458KB / three 725KB). 92 test + build + preview duman testi geçti.
- TÜM FAZLAR TAMAMLANDI. Deploy kullanıcı hesabı gerektiriyor (vercel login) — README'de adımlar var.
- (2026-07-03) Supabase bağlandı: kullanıcı .env bilgilerini verdi; "URL" olarak publishable key gönderilmişti, gerçek URL anon key JWT'sindeki ref'ten çıkarıldı (https://tssrjxeoszseazkicybo.supabase.co) ve doğrulandı (auth health + users/rooms/races/badges tabloları HTTP 200). Değişen dosyalar: .env (yeni), .gitignore (.env kuralı).
- (2026-07-03) Oyun adı "YARIŞ" → "Yakala Beni" olarak güncellendi (kullanıcı onayıyla). Değişen dosyalar: index.html (sekme başlığı), src/screens/AuthScreen.tsx (logo x2), src/screens/MenuScreen.tsx (logo), src/lib/shareCard.ts (kart başlığı + paylaşım başlığı), src/net/roomClient.ts (WhatsApp davet metni), README.md (başlık). Build temiz. Bilinen sorun yok.
- (2026-07-03) DEPLOY TAMAMLANDI: Vercel CLI kuruldu (kullanıcı zaten girişliydi: idagureli-4647), proje "yakala-beni" olarak bağlandı, VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY production+preview'a eklendi, production deploy başarılı. Canlı URL: https://yakala-beni.vercel.app — duman testi geçti (site 200, version.json 200, başlık doğru). Değişen dosyalar: .gitignore (.env.example istisnası Vercel'in eklediği .env* kuralının altına taşındı; .vercel/ ve .env.local Vercel CLI tarafından eklendi).
- Bekleyen: canlı URL'in (https://yakala-beni.vercel.app) Supabase Authentication → URL Configuration'a eklenmesi (kullanıcı adımı) — eklenmezse Google girişi localhost'a yönlendirir. Sonrasında telefonla gerçek çok oyunculu test.
- (2026-07-03) HATA DÜZELTME — Google girişi sonrası takılma: access_token URL hash'inde kalıyor, oturum kurulmuyordu. Kök neden: onAuthStateChange callback'i İÇİNDE await ile Supabase sorgusu (fetchUsername) — supabase-js v2 iç kilidi (Navigator LockManager) tutulurken postgrest sorgusu aynı kilidi bekleyip DEADLOCK yaratıyor. Düzeltme: (1) callback senkron yapıldı, DB sorgusu setTimeout(0) ile kilit dışına ertelendi; (2) createClient'a açık auth ayarları (detectSessionInUrl/persistSession/autoRefreshToken/flowType:implicit); (3) emniyet ağı: getSession null dönerse hash'teki tokenlarla auth.setSession ile elle oturum kurma; (4) kalan token hash'i history.replaceState ile temizleme; (5) init'e tek-sefer koruması (dinleyici çoğalmasın). Değişen dosyalar: src/lib/supabase.ts, src/stores/authStore.ts. 92 test + build geçti, production'a deploy edildi. KURAL: onAuthStateChange içinde asla await'li Supabase çağrısı yapma.
- (2026-07-03) HATA DÜZELTME — "String contains non ISO-8859-1 code point" (Google girişi sonrası ilk fetch'te): kök neden KOD DEĞİL, Vercel env değişkenleriydi. PowerShell'de `echo "..." | vercel env add` borusu her iki değerin (VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY) başına UTF-8 BOM (U+FEFF) eklemiş; bu değer apikey/Authorization header'ına girince tarayıcı fetch'i reddediyordu. Deploy edilmiş bundle'da baytlar (EF BB BF) doğrulandı. Düzeltme: 4 env kaydı silindi, Git Bash `printf '%s'` ile BOM'suz yeniden eklendi, yeniden deploy edildi, yeni bundle'da BOM olmadığı bayt düzeyinde doğrulandı. Kod değişikliği YOK. Kullanıcının "Google isminde Türkçe İ" tahmini doğrulanamadı — token/isim header'a girmiyor. KURAL: Vercel env eklerken PowerShell echo borusu KULLANMA; Git Bash printf kullan.
- (2026-07-03) DEĞİŞİKLİK — Kamera yan görünüme alındı (kullanıcı isteği 1/2): arkadan takip yerine Fun Run tarzı yandan görünüm; kamera pist merkez hattının sağında (yanal +13, yükseklik ~3.4), koşucu ekranda soldan sağa akar, oyuncunun yanal hareketi derinlik olarak görünür. Sadece src/scenes/RaceScene.tsx kamera bloğu değişti (~10 satır); karakter/harita/kontrol/replay aynen. 92 test + build geçti, deploy edildi. Bekleyen istek 2/2: karakter modellerinin görsel kalitesini artırma — kullanıcı kamerayı onayladıktan sonra başlanacak.

- (2026-07-03) BÜYÜK REVİZYON — 3D'DEN 2D'YE GEÇİŞ TAMAMLANDI (kullanıcı brief'i):
  - Aşama 0: Karakter ekranı hatası kök sebepleri: (1) 3D önizleme kamerasında lookAt eksik → kafa kadraj dışı; (2) flex column + overflow ekranlarda çocukların shrink:1 ile ezilmesi → scroll yok, "alt boş/kesik". CSS düzeltmesi lobi/profil/karakter (commit df5a000).
  - Motor kararı: DÜZ CANVAS 2D (Pixi değil) — sıfır bağımlılık, bundle 1.4MB→517KB, tam kontrol.
  - Yeni: src/game/track2d/ (düz zemin, blok/bar sabit engeller, hava kısayol koridoru), src/render2d/characterSprites.ts (20 karakterin katmanlı SVG'si, 5 poz, kozmetik uyumlu), src/render2d/raceRenderer.ts (paralaks + pist + efektler), src/components/GameCanvas2D.tsx (rAF döngüsü: girdi/fizik/olay/ses/HUD/replay/FPS-kalite).
  - Fizik ekleri: duck (eğilme, joystick aşağı), sabit engel çarpışması (kalkan korumaz), kısayol y-bandı. Skill/puan/catch-up MANTIĞI DEĞİŞMEDİ.
  - Ekranlar: RaceScreen/MpRaceScreen GameCanvas2D'ye, CharacterScreen/Lobi/Podyum SVG sprite'a geçti. three/@react-three kaldırıldı, scenes/ ve game/track/ silindi (git geçmişinde duruyor: 831333a = son 3D hali).
  - Kritik ders: ayrık fizikte (30-60fps) zıplama zamanlaması — y>1.1'e ~2.4 birimde ulaşılır, JUMP_LEAD 4.2 olmalı (3.2 bir kare geç kalıyor).
  - 98 test geçti (92→98, yeni 2D testleri: sabit engel, duck, hava kısayolu, harita çakışma payları), build temiz, https://yakala-beni.vercel.app 'e deploy edildi (commit 0cb1e09).

- (2026-07-03) HATA DÜZELTME — koşucular üst üste biniyordu: 2D renderer'da derinlik ekseni yoktu; aynı s'teki koşucular (start çizgisi dahil) aynı piksele çiziliyordu. Çözüm: raceRenderer'a koşucu başına sabit sahte-derinlik şeridi (oyuncu en ön, arkadan öne çizim, gölge/hale aynı ofsetle, hayalet en arkada). Sadece görsel — fizik/sıralama/ağ değişmedi. Lobi/karakter listesi/podyum kontrol edildi: flex+gap, sorun yok. Değişen dosya: src/render2d/raceRenderer.ts (commit 56212e0). Deploy edildi.

- (2026-07-03) FUN RUN TÜR HİSSİ UYARLAMASI (commit a01daf7, deploy edildi): (1) joystick kaldırıldı → ayrık butonlar (ZIPLA sağ/dokun, EĞİL bas-tut, SKILL sol) — tür standardı; (2) tempo: BASE_SPEED 13.5, zıplama arkı sertleşti (9.2/-26), pad 14.5; (3) HUD'a üst yarışçı ilerleme çubuğu (emoji noktalar, oyuncu büyük); (4) çarpma/yıldırım/knockback tam ekran renk flaşı + sarsıntı; (5) harita başına +5 engel (aksiyon ~3sn'de bir). Skill mantığı (catch-up/altın/puan) DEĞİŞMEDİ; marka öğesi kopyalanmadı. 98 test + build temiz.
- Ders: zıplama fiziği değişince zamanlama pencereleri yeniden hesaplanmalı — JUMP_LEAD 4.2 yeni arkta da güvenli pencere içinde (2.96-6.6 birim), testler geçti.

- (2026-07-03) 4 GÖREV + TÜR EKSTRALARI (hepsi deploy edildi, 104/104 test):
  - Görev 1 (908b4f4): yatay ekran zorunluluğu — portrait'te CSS uyarı katmanı, tek kişilikte fizik duraklar (AFK koruması), MP'de akar; ilk dokunuşta best-effort fullscreen+landscape kilidi.
  - Görev 2 (0abf746): buton redesign — radyal degrade/iç parlama/gölge, SVG şevron + ZIPLA/EĞİL etiketleri, 108/78/96px, skill boş=gri dolu=kırmızı parlamalı.
  - Görev 3 (1683c93): skill kutuları — nabız halesi, degrade kutu + altın kurdele, konturlu ?, dönen ışıltılar, salınım.
  - Görev 4 (961c940): üst/alt yol çatalları — platform fiziği (inis/kenar düşüşü/eğil-bırak/havada eğil=hızlı iniş; pad platformda tetiklenmez, iniş koşulu prevY>plat+eps yoksa drop anında geri yakalanıyor), 4 haritada çatal (Gökyüzü 2), üst=güvenli-kutusuz alt=engelli-kutulu, renderer platform+direkler+giriş oku.
  - Ekstra (a054c0d): iniş toz partikülleri, sıra değişiminde ses + HUD pop.
  - Ders: fast-fall sadece vy<=0'da uygulanmalı (yükselişi iptal etmesin).

- (2026-07-03) HATA/ÖZELLİK TURU (kullanıcı raporu, 10 madde — hepsi ayrı commit, 113/113 test, deploy edildi):
  - KRİTİK 1 (c339b68): maç sonu kilitlenmesi — orientation.lock yarış sonrası HİÇ açılmıyordu → App'te yarış-dışı ekranlarda unlock+exitFullscreen; sonuç/podyum ekranları kaydırılabilir (center+overflow butonları kesiyordu).
  - KRİTİK 2 (3996d5b): liderken saldırı skill butonu ölü — knockback/yıldırım hedefi yoksa false dönüyordu → pickAttackTarget (önde yoksa arkadaki en yakın) + başarısız basışta ses. Madde 7 (yıldırım) bu düzeltmeyle doğrulandı.
  - HATA 4 (5878fdd): hayalet sadece Hayalet Yarış modunda (menüde anahtar, botsuz); normal maçta görünmez.
  - HATA 3+EKSİK 5 (5d71838): kozmetik seçenekleri giydirilmiş mini önizleme görselleri; uzun kollu üstlerde kollar giysi rengini alır (kıyafet gerçekten giyilmiş okunur).
  - ÖZELLİK 6+8 (b84e7e3): MIKNATIS skill'i (öndeki TÜMÜNÜ 12 birim çeker, liderken arkadakileri iter, kalkan korur, MP alan yayını) + çekim sesi; tüm skill'lerin sesi var.
  - ÖZELLİK 9 (d5142fa): kişisel finiş fanfarı (çizgiyi geçtiğin an).
  - ÖZELLİK 10 (bc4e9ee): DUVAR mekaniği — 4 haritada tırmanılabilir duvar (zıplama spam'i ile), botlar tırmanır, tuğla görsel + ipucu okları.
  - SÜREÇ: CLAUDE.md oluşturuldu (self-test protokolü dahil); fullMatch.test.ts TAM MAÇ SİMÜLASYONU eklendi (4 haritada uçtan uca otomatik maç).

- (2026-07-03) MADDE 11-14 (hepsi ayrı commit, 116/116 test, deploy edildi):
  - 11 (db38543): SU/YÜZME parkuru — Orman deresi (.655-.695) + Gökyüzü gölü (.51-.55): yüzme SVG pozu, gövde suda gömülü + dalga salınımı, hız ×0.88, suda eğilme yok, sıçrama sesi; su bölgeleri pad/duvar/engel içermez (testli).
  - 12 (e0e8d6c): giriş ekranı özgün redesign — gökyüzü-çimen degrade, bulutlar, damalı bayrak şeridi, eğik çift renkli logo, koşan 4 karakterli alt şerit + hız çizgileri, beyaz pill Google butonu.
  - 13 (1fe678f): maç sonu emoji/hazır sohbet (eksikti) — MP sonuç ekranında 8 emoji + 5 ifade + baloncuklar; tek kişilikte gizli.
  - 14 (823c5e3): podyum hareket menüsü — Dans/Hava At/Selam/Kahkaha; podyumdaki oyuncu kendi karakterine hareket yaptırır, MP sohbete duyurulur. (Sessiz düzeltme: podyum blok yükseklikleri yanlış eşleniyordu.)

- (2026-07-03) AKSİYON YOĞUNLUĞU AYARI (4 ayrı commit, 118/118 test, deploy):
  - a0b21d7: kutu sıraları 5→9 + her sıra 3'lü dizi + respawn 2.5-6sn. Simülasyon darboğazı yakaladı: tek kutu 5 koşucuya yetmiyordu (maç başına 9 kullanım) — 3'lü diziyle eşik ≥15'e çıktı.
  - 86903c4: yıldırım 14→22, mıknatıs 12→20 ağırlık (aksiyon payı %23→%37.5); ALTIN NADİRLİĞİ AYNI (testle <%1); denge testi 0.2 eşiğine güncellendi (bilinçli tasarım).
  - 929fca7: bot skill gecikmeleri kısaldı (orta 0.8-2sn).
  - 528596d: menzil denetimi — hedefleme zaten sınırsız, değişiklik gerekmedi; fullMatch'e kalıcı yoğunluk eşikleri eklendi (≥15 kullanım, ≥3 yıldırım+mıknatıs, ≥3 aktif bot, oyuncu ≥4 kutu).

- (2026-07-04) 6 MADDELİK TUR (hepsi ayrı commit, 124/124 test, build temiz, deploy edildi + canlı bundle'da doğrulandı):
  - MADDE 6 / KÖK SEBEP (93c9c0f): "yıldırım çıkmıyor" raporu — drop tablosu DOĞRUYDU (ağırlık 22; canlı bundle'da bayt düzeyinde doğrulandı, filtre/blok yok). Asıl sorun GÖRSEL: yıldırım isabetinde şimşek hiç çizilmiyordu, hedef ekran dışındaysa oyuncu hiçbir şey görmüyordu = "çıkmıyor" algısı. Eklendi: gökten çatallı şimşek + çarpma flaşı + elektrik kıvılcımları + kafadan duman + stun titremesi; ekran dışı hedefte şimşek kenara kenetlenir. Regresyon: her sırada yıldırım payı >%15 testi + fullMatch'te "kutudan çıktı VE isabet etti" testi.
  - MADDE 2 (ee6f084): duvar 3.2→5.4 birim (ekranın ~üçte biri), tırmanış ~5-6 basış; renderer PHYSICS.WALL_HEIGHT'tan çizer; WALL_HEIGHT>=5 testi.
  - MADDE 5 (1ab8463): düz engel skill'i KAPAN oldu — basan 1.4 sn tam kilitlenir (TRAP_HOLD_DURATION), açık/kapalı ayı kapanı görseli + kenetlenme kıvılcımı + metalik klik. Sabit blok/bar parkur öğeleri değişmedi. obstacleHit olayına trap bayrağı (MP yayını etkilenmedi).
  - MADDE 4 (9e1e14f): su 3 seviyeli (0/-1.15/-2.3): suda ZIPLA=yukarı, EĞİL yeni basışı=dal (basılı tutmak tek basış); her su bölümünün dibinde 3'lü kutu dizisi, dip kutusu sadece dipten alınır; botlar eli boşsa dalar; su bitince otomatik kıyıya tırmanma; su altı kabarcıkları. RunnerState'e waterLevel+swimDuckHeld eklendi.
  - MADDE 3 (8ab1214): orman ağaçları profesyonelleşti — katmanlı yapraklar (alt koyu üst açık), degrade gövde, yer gölgesi, çam/yayvan varyantları, arkada ikinci soluk ağaç sırası (paralaks 0.28).
  - MADDE 1 (e3f5ebd): OYUNCULAR ekranı (menü 🌐 + lobide "Listeden Davet") — tüm kayıtlı kullanıcılar puan sıralı + arama + online yeşil nokta (online üstte). Online oyuncuya "Davet Et": oda yoksa arka planda kurulur, davet 'online' presence kanalından broadcast ile hedefe gider (YENİ TABLO GEREKMEDİ). Alıcıda her ekranda banner (yarışta bastırılır, 30 sn'de düşer): Katıl→odaya gir+lobi. ÇEVRİMDIŞI kullanıcılar listelenir ama davet edilemez (realtime davet ancak online alıcıya ulaşır — bilinçli tasarım).
  - Karar: davet DB tablosu yerine realtime broadcast — Supabase şema değişikliği/migration istemez, oda zaten kısa ömürlü.
  - Dikkat: skillInfo'daki "obstacle" id'si korundu (yalnızca ad/emoji/etki değişti) — puan/catch-up/altın mantığına DOKUNULMADI.

- (2026-07-04) PODYUM + KOZMETİK + MEKANİK TURU (10 ayrı commit, 128/128 test, TARAYICIDA GÖRSEL SELF-TEST yapıldı, deploy edildi):
  - PODYUM KÖK SEBEP (eb5e993): hareketler "çalışmıyor" değildi — emote'lar için ayrı vücut pozu hiç yoktu (hepsi koşu/idle pozu + 92px'te okunmayan CSS kıpırtısı), kazananın otomatik dansı "Dans" seçimiyle birebir aynıydı, hareket 2.6 sn'de iptal oluyordu. Düzeltme: sprite üreticiye wave/flex/laugh GERÇEK pozları (armF/armB ayrı kol açıları), kazanan varsayılanı hafif zıplama, süre 4 sn, podyumda kendi kozmetiklerin görünür.
  - +3 HAREKET (dcbedbd): Helikopter (dönüş), Takla (geriye tam tur), Uyku (yatay+nefes) — toplam 7. Konuşma balonları: Selam 👋, Kahkaha 🤣, Hava At 😏, Uyku 💤 (çizgi roman balonu, pop+salınım).
  - GÖRSEL SELF-TEST (ceca623): tarayıcıda 7 hareket + 4 kozmetik kombosu tek tek İZLENDİ. Bulunanlar: kaldırılan kol kafanın arkasında kayboluyordu (emote'ta ön kol artık en üstte çizilir), SVG rotate yönü ters hesaplanmıştı (selam 170°, flex 128° gözle doğrulandı), kollar kısa/okunmazdı (armLong + uçta el). main.tsx'e DEV-only __dev store kancası (test için).
  - KOZMETİK REVİZYON (8ddbd75): üst giyim gövdeyi TAM örtmüyordu (rx41<42) + 'bot'/'terlik' HİÇ ÇİZİLMİYORDU (spor'a düşüyordu) → her üst giyim türüne bariz kimlik (takım=klapa+kravat+gömlek, uzay=panel+tüp, ceket=fermuar+cepler...), bot=konçlu çizme, terlik=parmak arası, spor=beyaz taban+bağcık; şapka 1.24x, gözlük 1.28x, kolye 1.2x, saç 1.15x büyütüldü (grow sarmalayıcı).
  - MIKNATIS (edf6a9f): gerçek mıknatıs — öndekiler GERİ, arkadakiler ÖNE çekilir (lider kullanırsa arkadakiler ona gelir). MP ahead-only filtresi kaldırıldı.
  - YILDIRIM AOE + DOKUNULMAZLIK (4485df3): yıldırım dokunulmaz olmayan HERKESİ çarpar; çarpılan kararır/kavrulur (canvas filter) + kafadan duman + titreme. invulnUntil: yıldırım/kapan yiyen, etki + 2 sn dokunulmaz (yanıp söner, hiçbir saldırı/kapan işlemez) — zincir kilitlenme imkânsız.
  - KAPAN KANI (sessiz commit): çeneler kapanınca ayaktan 6 koyu kırmızı damla sıçrar (parçacıklara rgb alanı).
  - KUTU DAĞITIMI (27ab0d4): yan yana 3'lü diziden aynı skill üst üste çıkmaz (recentDrops ±5.5 birim/8 sn, 3 reroll; ALTIN ZAR BOZULMAZ).
  - FOTO-FİNİŞ KALDIRILDI (2048109): yarış bitince doğrudan podyum.
  - TAM EKRAN + YATAY (a8a4883): kök sebep 1 — fullscreenTried bayrağı tam ekranı sayfa ömründe TEK SEFER deniyordu → artık tam ekranda değilsek her buton basışında (1.2 sn aralıkla) denenir. Kök sebep 2 — yarış bitince kilit hemen açılıyordu, oto-döndürmesi kapalı telefonda ekran dikeye zıplıyordu → yatay kilit sonuç/podyum/lobi boyunca KORUNUR, menüde açılır.

- (2026-07-04 #2) BÜYÜK ÖZELLİK TURU (12 commit, 128/128 test, deploy + canlı bundle doğrulandı):
  - BUTONLAR (küçültme): ZIPLA/EĞİL 108/78→72/56 px + hafif şeffaflık — harita görünür.
  - SKILL AKIŞI: sağ üstte "X ⚡ Y" isabet satırları (yıldırım/knockback/mıknatıs/altın/kapan/savuşturma; kapan olayına kuran `by` alanı eklendi), 4 sn'de söner.
  - BLOK ZIPLAMASI: bloka çarpan yavaşlarken kutunun ÜZERİNDEN sendeleyerek hoplar (vy=7.5). Kapan görsel senkronu: kapalı kapan duvar saatine değil koşucunun GERÇEK stun durumuna göre çizilir.
  - TÜM SKILL VFX: boost (alev halkası + ardıl görüntü + alev partikülleri), kalkan (enerji halkası + dönen yaylar + ışıltılar), knockback (çarpma yıldızı + şok dalgaları), mıknatıs (mor alan dalgaları + çekim okları), altın (ışın patlaması + taç + buz kristalleri + soğuk buhar). Genel fx sistemi koşucuyu izler.
  - 6 OYUNCU: MAX_PLAYERS 6, tekli 5 bot, hızlı maç/oda dolgusu 6'ya; puan formülü zaten n-ölçekli (dokunulmadı). Hızlı maç lobisi 4→8 sn: harita oylamasına süre (oylama lobide zaten vardı — çoğunluk/eşitlikte rastgele).
  - YENİ HARİTA: "Ejderha Yanardağı 🐉" (id: ejderha, herkese açık 4. harita) — mor gök + obsidyen kuleler + katmanlı alevler + korlar ('alev' dekor stili), İKİ duvarlı en zorlu parkur, 940 birim.
  - AVATARLAR: src/lib/avatars.ts — 20 özgün parodi kahraman (Kaptan Simit, Süper Tembel, Yarasa Amca...) kare SVG foto. Profilde kare çerçeve + seçici ızgara; menü/oyuncular/sıralamada görünür. DB: migrations/002_avatar.sql (users.avatar_id) — KULLANICI SUPABASE'DE ÇALIŞTIRMALI; kolon yokken select('*') + localStorage fallback ile çalışır.
  - KULLANICI ADI: menüde ✏️ → yeni ad (3-16), users tablosuna yazılır, çakışmada hata.
  - Görsel self-test: avatar ızgarası 20/20 decode edildi; Chrome penceresi küçük olduğundan piksel testi yapılamadı (DOM düzeyi doğrulandı).

- (2026-07-04 #3) PATİRUN + BÜYÜK MEKANİK TURU (7 commit, 130/130 test, tarayıcıda headless-render görsel doğrulama, GitHub push + deploy):
  - GITHUB: remote = https://github.com/winegg420/PatiRun (boş repo olarak bulundu, tüm commit geçmişi push edildi, uzak HEAD == yerel HEAD doğrulandı; .env push EDİLMEDİ, sadece .env.example).
  - İSİM: Yakala Beni → PatiRun (sekme, giriş logosu PATİ RUN, menü 🐾 PATİRUN, sonuç kartı, WhatsApp daveti, README, CLAUDE.md).
  - SU YENİDEN (9901dc4): 4.2 birim DERİN su; 3 sabit seviye kalktı → hız tabanlı: EĞİL spam = dalış itkileri, ZIPLA spam = yükselme; yüzeyi ≥5.5 hızla kesince YUNUS FIRLAMASI (sudan havaya çıkış, karaya hız kesmeden iniş); kutular EN DİPTE (-3.8); bırakınca kaldırma kuvvetiyle süzülme; botlar dalar/fırlar.
  - KARA YÜKSELTİSİ (01c5f5a): "duvar" kavramı düzeltildi → zemin PROFİLİ (groundAt): yamaç sonrası zemin 50 birim boyunca 3.0'da KALIR, tırmanan yukarıda koşar, sonda kenardan düşer. Tüm pist öğeleri + çarpışmalar YEREL zemine göreceli. DİKEY KAMERA: dalışta aşağı, yükseltide yukarı. Görsel: toprak plato + yamaç yüzü + tırmanma okları; derin su görseli (kararan sütun, kum dip, ışık hüzmeleri).
  - TÖKEZLEME (3cc484c): bloka çarpan 0.55 sn öne devrilip toparlanır + toz + ünlem + sarsıntı (fizik hoplamasıyla birleşik).
  - SKILL DETAY (9a202fe): hitConfirm isabet çınlaması (kendi saldırın tutunca), knockback/altın ekran dışı göstergesi, kapan kurulum sesi+halka efekti, savuşturmada savunanın kalkanı parlar.
  - GÖRSEL TEST BULGUSU (940d249): geri sayımda engine.time negatif → tüm efekt bayrakları startta yanlış aktifti; 0 tabanına kenetlendi. (Headless doğrulama: yamaç önü/üstü + derin su kareleri motor+renderer'ı sayfada elle çizerek incelendi — pencere gizliyken rAF çalışmadığından canlı oynanış otomasyonla izlenemedi.)
  - NOT: pencere gizliyken (document.hidden) rAF durur — tarayıcı otomasyon testinde yarış fiziği ilerlemez; headless çizim yaklaşımı kullan.

- (2026-07-04 #4) OTOMATİK BOT DOLGUSU (7975380): özel oda dahil HER maç başlatmada eksik yerler 6'ya kadar botla dolar (host yürütür); hayalet yarış bilinçli botsuz. Push + deploy edildi.

- (2026-07-04 #5) MENÜ REDESIGN + FİNİŞ DÜZELTMESİ (2 commit, 132/132 test, gözle doğrulandı, push+deploy):
  - FİNİŞ (58dfc61): "eşit bitiriyorlar ve hep ben birinciyim" kök sebepleri: (1) slipstream lastik-bant gibi finişe kadar eşitliyordu → pistin son %15'inde kapalı (SLIPSTREAM_CUTOFF_FRAC); (2) botlar sabit çarpanla hep oyuncudan yavaştı → her bot hızını ARALIKTAN çeker (kolay 0.86-0.94, orta 0.92-1.02, zor 0.97-1.06), üst sınır >1: botlar kazanabilir. Skill-drop catch-up + puanlamaya dokunulmadı.
  - MENÜ (832105c): panel görünümü bitti — gökyüzü/çimen arka plan, damalı şerit, bulutlar, seçili karakter koşu animasyonuyla logo yanında vitrin (tıkla→karakterler), 3D oyun butonları, altta koşan karakter şeridi; alt ekranlar (oda/zorluk/harita) aynı tema. RunnerStrip AuthScreen'den export edilip paylaşıldı.

- (2026-07-04 #6) BUTON + HEDEF SEÇİMİ (b68b6c0, 134/134 test, tarayıcıda gözle doğrulandı, push+deploy):
  - EĞİL butonu 56→72px (ZIPLA ile aynı) — küçük kalınca basılamıyordu; şevron 20→28px, bottom hizalı, çakışma yok.
  - HEDEF SEÇİMİ (Fun Run tarzı): tek hedefli skill'de (şu an sadece Geri Fırlatma/knockback, `targeted` bayrağı) skill butonuna basılı tut → hedef çipleri (emoji+isim) çıkar, ~46px kaydırma = 1 kişi, varsayılan seçim otomatikle aynı (öndeki en yakın), bırakınca seçilene atılır. applySkill'e `preferredTargetId` (geçersizse otomatiğe düşer), engine.useSkill(id, targetId), progress'e `name`. Çok hedefli skill'ler (yıldırım/mıknatıs/altın) tek dokunuşla anında. MP: event.targetId zaten taşınıyordu.

- (2026-07-04 #7) MP HATA DÜZELTMELERİ (d73786e, 135/135 test, push+deploy) — 4 kişilik gerçek maç raporu:
  - KUTU ALINAMIYOR (2/4 oyuncuya skill çıkmadı): MP'de oyuncular gridX'te (x=-3.2..+3.2) başlar, 2D'de lateral hep 0 → x HİÇ DEĞİŞMEZ; kutular x=0'da + tolerans |b.x-r.x|<1.4. Merkeze uzak şeritte başlayan kutuya hiç değemiyordu. x sahte-derinlik olduğundan kutu VE kapan (hitObstacle) alımı artık x'i YOK SAYAR. Tekli modda herkes x=0 olduğundan görünmüyordu (test de x=0'daydı — regresyon testi x=3.2 ile eklendi). **DERS: 2D'de x fake-depth, gameplay çarpışmaları sadece s+y olmalı.**
  - MAÇ SONU KİLİTLENMESİ: engine.phase yalnızca tüm koşucular bitince/120sn'de 'finished' olur; Supabase realtime garantisiz, bir uzak oyuncunun 'finish' broadcast'i düşerse active hiç sıfırlanmaz → 120sn asılı kalır. Çözüm: yerel oyuncu bitince/DQ olunca 6sn straggler bekleyip ZORLA finalize eden grace-timer (MpRaceScreen; buildResults/ranking bitmeyenleri mesafeye göre sıralar). Ekran döndürme/yükleme şikâyetleri bu kilidin belirtisiydi.

- (2026-07-04 #8) TIRMANMA YENİDEN + MAÇ SONU YATAY + HELİKOPTER SES (3 commit, 135/135 test, tarayıcıda gözle+headless doğrulama, push+deploy):
  - MADDE 1 KARA PARÇASI (4f76ca5): önceki hali gerçekten incelendi — mekanik ZORDU (!grounded && jump && vy<2 timing), CLIFF_HEIGHT=3 KISA, ön yüz düz dikey = "duvar", tek nokta. Düzeltme: KOLAY spam tırmanma (dibinde ZIPLA'ya her basış CLIMB_STEP yukarı adım, basmayınca CLIMB_MAX_SLIDE 2.2 yumuşak sarkma — düşüp baştan başlamazsın; seyrek basışla bile ~1.3sn'de çıkılıyor); CLIFF_HEIGHT 3→6.5, plato 50→74; TÜM haritalar çok noktalı (orman/volkan/gizli 2, gökyüzü 2, ejderha 3); temaya özgü drawCliff (çim tepe/bazalt+kor/bulut rafı/obsidyen/pasta katı) — organik ön yüz, katman şeritleri, tepe kabuğu. 5 harita gözle doğrulandı.
  - MADDE 2 MAÇ SONU YATAY (570075f): kök sebep — .podium-screen2d iki kez tanımlıydı, 2. tanım overflow:hidden+justify-content:center; kısa yatayda başlık+alt buton ekran dışında kalıp erişilemiyordu. Düzeltme: podyum+sonuç overflow-y:auto + margin:auto (kısaysa ortala, uzunsa scroll), confetti position:fixed, kısa-yatay media query küçültme. Kısa viewport'ta scroll+buton erişimi doğrulandı.
  - MADDE 3 HELİKOPTER SES (0447056): özgün prosedürel WebAudio (viral klip DEĞİL) — pervane testeresi + hızlanan çırpma LFO + motor uğultusu + türbin vınlaması; podyumda Helikopter hareketine bağlı.

## Bekleyenler / Kullanıcıdan Gerekenler
- Supabase SQL Editor'de çalıştırılacak: `alter table public.users add column if not exists avatar_id text;` (supabase/migrations/002_avatar.sql) — çalıştırılmazsa avatar seçimi sadece cihazda kalır, başkaları göremez.
- Supabase projesi URL + anon key (.env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) + Google OAuth provider ayarı.
- Vercel deploy hesabı bağlantısı.

---

## idaGG Game Center'a taşındı (2026-07-22)
PatiRun, idaGG Game Center hub'ına `patirun/` modülü olarak entegre edildi. Kendi Supabase client'ı → Bildim paylaşılan client; Google-OAuth → Bildim oturumu köprüsü; tablolar `pr_` önekli; CSS `.pr-root` scope. Ayrıntı: repo kökü `PROGRESS.md` (Faz 2) + `patirun/CLAUDE.md` "HUB ENTEGRASYONU".

## 2026-07-24 — Senkron yarış başlangıcı (ready/go + saat farkı telafisi)

- **Kök sebep:** başlangıç anı host'un `Date.now()` epoch'u olarak yayınlanıyordu; cihaz saatleri
  saparsa geri sayım kayıyor, yavaş yüklenen cihaz geri sayımı kaçırıyordu.
- **Çözüm (DidaGP'deki kanıtlanmış desen):** `StartMsg.t0` (host gönderim anı) + alıcıda `recvAt`
  → geri sayım "kalan süre"den hesaplanır, saat farkı etkisiz. Yeni `ready`/`go` mesajları:
  `MpRaceScreen` sahne kurulunca `sendReady()`, host herkesi bekler (7 sn güvenlik zaman aşımı)
  ve `go{t0, goAt}` yayınlar; herkes geri sayımı aynı ana hizalar (`engine.time`).
- `startAt` yedek olarak korunuyor (go düşerse yarış yine başlar; süre +2.5 sn'ye çıkarıldı).
- Değişen dosyalar: `net/protocol.ts`, `net/roomClient.ts`, `screens/LobbyScreen.tsx`,
  `screens/MpRaceScreen.tsx`. Build temiz; 2 cihaz testi kullanıcıda.

---

## 24 Temmuz 2026 — Senkron start düzeltmesi (NTP saat-offset)

DidaGP ile aynı senkron-start bug'ı PatiRun'da da vardı: `onGo` geri sayımı mesajın ALIM anına göre hizalıyor, tek yönlü ağ gecikmesini yok sayıyordu (kötü ağda ~1 sn kayma). `RoomClient`'a NTP tarzı saat senkronu eklendi: `syncClock()` (bekleme fazında ping/pong ile host−self offset), `hostToLocal()`, `clockSynced`. `MpRaceScreen.onGo` artık kalibre edildiyse `hostToLocal(goAt) − now` ile hizalar, aksi halde eski göreli yönteme düşer. Değişen: `net/roomClient.ts`, `screens/MpRaceScreen.tsx`. Build temiz.

---

## 25 Temmuz 2026 — Pozisyon mesajları toplu gönderime çevrildi (senkron bozulması)

**Bulunan hata:** host, kendi konumunun YANINDA her dolgu botu için ayrı 10 Hz pozisyon akışı
gönderiyordu (1 oyuncu + 3 bot = **40 msg/sn**). Supabase istemci hız sınırı ise
`eventsPerSecond: 20` (`src/lib/supabase.js`) → sınır aşılınca mesajlar düşüyor, uzak koşucular
ışınlanıyor/donuyordu (hızlı maçta "senkron bozuk" şikâyetinin kaynağı).

**Çözüm:** `sendPos` artık anında yayınlamıyor, kuyruğa yazıyor; `posGonder()` kare sonunda
kuyruğu **tek `posc` mesajında** yayınlıyor. Gönderim hızı koşucu sayısından bağımsız olarak
10 msg/sn'de sabit. Alıcı tarafta `posc` paketi açılıp aynı `onPos` akışına veriliyor (eski `pos`
olayı da dinlenmeye devam ediyor). Değişen: `net/protocol.ts` (`PosBatchMsg`), `net/roomClient.ts`,
`screens/MpRaceScreen.tsx`. Build temiz.

**Not:** `patirun/game/__tests__/*` vitest gerektiriyor; hub'da vitest kurulu değil (bağımsız
repodan geldi) → bu oturumda çalıştırılamadı. Değişiklik ağ katmanında, fizik/skill mantığına
dokunulmadı.

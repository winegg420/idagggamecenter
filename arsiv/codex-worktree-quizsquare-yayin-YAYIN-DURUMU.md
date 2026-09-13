# Quiz Square 3D önizleme yayını

Kullanıcı 13 Eylül 2026 tarihinde canlı siteye koymayı açıkça istedi.
Yalnız Quiz Square Vercel projesine doğrudan kaynak dağıtımı yapıldı.

- Proje: quizsquare / prj_DCi2XGWd3OnAZBf8laPkdlxesaO4
- Dağıtım: dpl_5GbUnXJNS1C9XSH4ANyj2FfCaAW7, READY
- Canlı gardırop: https://quizsquare.vercel.app/bildim/avatar3d/gardrop.html
- Atölye: https://quizsquare.vercel.app/bildim/avatar3d/index.html
- Meydan: https://quizsquare.vercel.app/bildim/avatar3d/meydan.html?envanter=1
- /gorunum sayfasına feature flag ile 3D vitrin eklendi; mevcut alışveriş korundu.

VITE_AVATAR3D_DEMO=1, VITE_MOD=bildim, VITE_SITE_URL=https://quizsquare.vercel.app
bu dağıtıma build-env olarak verildi. Tekrar dağıtımda aynı değerler gerekir.
vercel.json, avatar3d/vite.prototip.config.js çok girişli derlemesini kullanır.

Tarayıcıda canlı gardırop, 5000 deneme coin, kısa saç ve ceket önizlemesi
doğrulandı; 60 FPS görüldü. Derleme ve ayrıştırma testi geçti. Mevcut Safari
randomUUID uyarısı sürer. Gerçek satın alma, SQL veya hesap yazımı yapılmadı.

Kaynak origin/main 3ef8ecf üzerindeki ayrı detached worktree'dedir.
Commit/push yapılmadı: başka oyunların otomatik yayınını tetiklememek için
yalnız quizsquare projesi doğrudan dağıtıldı. Ana repo sonraki dağıtımından
önce buradaki avatar3d dosyaları, KarakterPage ve build değişikliği kontrollü
aktarılmalı; aksi halde bu yayın ana repodan yeniden dağıtımda kaybolabilir.
Desktop kaynağındaki kullanıcının boks değişikliklerine dokunulmadı.

## Eski görünüm ekranlarının kaldırılması

Kullanıcı yalnız yeni karakterlerin kalmasını istedi. KarakterPage ve eski
GorunumPage yeni gardıroba yönlendirilir; GorunumDukkani eski kataloğu artık
listelemez, yeni gardırop/atölye bağlantılarını gösterir. AvatarVitrin yeni
3D vitrini kullanır. Quiz Square demo derlemesinde avatarUri yeni modelden
önbellekli PNG üretir: eski hayvan görselleri profil/listelerde ve meydan
sprite'larında gösterilmez. Eski karakter kimliği deterministik yeni bir
görünümle temsil edilir; çevrimiçi yeni görünüm kaydı henüz yoktur.

Paylaşılan hesap/sahiplik kayıtları silinmedi. Diğer oyun derlemelerinde
eski avatarUri yolu korunur. Portre üretimi tek tekrar kullanılan WebGL
renderer ve en çok 64 görüntü önbelleği kullanır; modeller render sonrası
dispose edilir. Gerçek zamanlı çok oyunculu 3D animasyon entegrasyonu değildir.

## Canlı meydan hareket düzeltmesi
Sabit billboard yerine gerçek modelKur gövdesi bağlandı. dunya.yurumeAnimasyonu yeni modelin kalça/diz/kol hareketini çalıştırır; ana grup rotasyonu artık gerçek gövdeyi döndürür. Dans kafa yüksekliği yeni iskelete uyarlandı. Node testi yürüme açısının değişmesini, zıplama yüksekliğini, görünüm yenilerken yönün korunmasını ve dispose akışını doğruladı. Build ve uyumluluk geçti. Model tüm meydan oyuncularında kullanılır; eski profil görünümü yeni kombinle eşlenir, gardırop sahiplik senkronizasyonu hâlâ ayrı iştir.

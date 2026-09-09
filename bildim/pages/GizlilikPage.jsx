import { Link } from "react-router-dom";
import { y } from "../lib/yol.js";

// Google Play zorunluluğu: mağaza kaydında gösterilecek gizlilik politikası.
// Bu bir TASLAKTIR; yayına almadan önce iletişim e-postası ve şirket/kişi
// bilgisi kontrol edilmelidir.
const GUNCELLEME = "8 Eylül 2026";
const ILETISIM = "idagureli@gmail.com";

export default function GizlilikPage() {
  return (
    <div className="bd-metin-sayfa">
      <div className="baslik">Gizlilik politikası</div>
      <div className="alt-yazi" style={{ marginBottom: 18 }}>
        Son güncelleme: {GUNCELLEME}
      </div>

      <h2>Kısaca</h2>
      <p>
        Bildim!, oyunu oynayabilmen için gereken en az veriyi toplar:{" "}
        <b>e-posta adresin</b>, <b>seçtiğin takma ad</b> ve <b>avatarın</b>,
        ayrıca oyun içi <b>puan, sıralama ve şehir/ülke</b> bilgin. Verilerini satmıyoruz,
        reklam ağlarıyla paylaşmıyoruz.
      </p>

      <h2>Topladığımız veriler</h2>
      <ul>
        <li>
          <b>Hesap bilgileri:</b> e-posta adresi (yalnız giriş için; hiçbir zaman
          başka oyunculara gösterilmez) ve <b>senin seçtiğin takma ad</b>. Diğer
          oyuncular yalnızca bu takma adı görür — gerçek adın ve e-postan gizlidir.
        </li>
        <li>
          <b>Avatar:</b> hazır avatarlardan seçtiğin görsel. Google hesabının
          fotoğrafı <b>otomatik olarak alınmaz</b>; yalnız sen onaylarsan kullanılır.
        </li>
        <li>
          <b>Oyun verileri:</b> puan, haftalık puan, rütbe, rozetler, maç sonuçları,
          gördüğün sorular, arkadaşlıklar ve maç içi sohbet mesajları.
        </li>
        <li>
          <b>Konum bilgisi:</b> yalnızca kendi seçtiğin <b>şehir ve ülke</b>. Cihazının GPS
          konumunu <b>almıyoruz</b>. Bu bilgi şehir/ülke liglerinde herkese görünür.
        </li>
        <li>
          <b>Reklam:</b> uygulamada Google H5 Games Ads (AdSense) üzerinden ödüllü
          video ve maç arası geçiş reklamı gösterilir. Reklam ağı kendi çerez/reklam
          kimliğini kullanır; biz kişisel verini reklam ağına <b>göndermiyoruz</b>.
        </li>
        <li>
          <b>Bildirim izni:</b> bildirimleri açarsan tarayıcının verdiği abonelik anahtarı.
          İstediğin an profil sayfasından kapatabilirsin.
        </li>
        <li>
          <b>Teknik kayıtlar:</b> oturum açıklık bilgisi (son görülme) ve hata kayıtları.
        </li>
      </ul>

      <h2>Verileri neden kullanıyoruz</h2>
      <ul>
        <li>Hesabını oluşturmak, seni tanımak ve oturumunu sürdürmek.</li>
        <li>Maç, turnuva, sıralama ve lig özelliklerini çalıştırmak.</li>
        <li>Sana daha önce görmediğin soruları göstermek.</li>
        <li>Kötüye kullanımı (puan kasma, sahte hesap) tespit etmek.</li>
        <li>İzin verdiysen turnuva ve haftalık sonuç bildirimleri göndermek.</li>
      </ul>

      <h2>Paylaşım</h2>
      <p>
        Verilerini üçüncü taraflara satmıyoruz. Yalnızca hizmeti çalıştırmak için kullandığımız
        altyapı sağlayıcıları verileri işler: <b>Supabase</b> (veritabanı, kimlik doğrulama) ve{" "}
        <b>Vercel</b> (uygulama barındırma). <b>Takma adın</b>, seçtiğin <b>avatar</b>, puanın
        ve şehir/ülke bilgin, oyunun doğası gereği diğer oyunculara görünür. Gerçek adın ve
        e-posta adresin <b>hiçbir zaman</b> başka oyunculara gösterilmez.
      </p>

      <h2>Saklama ve silme</h2>
      <p>
        Verilerini hesabın açık olduğu sürece saklarız. Hesabını{" "}
        <Link to={y("/profil")}>Profil</Link> sayfasındaki <b>Hesabımı Sil</b> düğmesiyle
        kalıcı olarak silebilirsin; profilin, maç kayıtların, rozetlerin ve mesajların silinir.
        Bu işlem geri alınamaz. Dilersen {ILETISIM} adresine yazarak da silme talebinde
        bulunabilirsin.
      </p>

      <h2>Çocuklar</h2>
      <p>
        Bildim! 13 yaş altındaki çocuklara yönelik değildir ve bilerek 13 yaş altından veri
        toplamayız.
      </p>

      <h2>Çerezler ve yerel depolama</h2>
      <p>
        Oturumunu açık tutmak ve bazı tercihlerini (ör. kapattığın bilgilendirme şeritleri)
        hatırlamak için tarayıcının yerel depolamasını kullanırız. Reklam veya izleme çerezi
        kullanmıyoruz.
      </p>

      <h2>Değişiklikler</h2>
      <p>
        Bu politikayı güncellersek bu sayfadaki tarihi değiştiririz. Önemli değişikliklerde
        uygulama içinde bilgilendirme yaparız.
      </p>

      <h2>İletişim</h2>
      <p>
        Sorular ve veri talepleri için: <b>{ILETISIM}</b>
      </p>

      <Link to={y()} className="btn ikincil" style={{ marginTop: 18 }}>
        Ana sayfaya dön
      </Link>
    </div>
  );
}

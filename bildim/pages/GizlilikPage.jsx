import { Link } from "react-router-dom";
import { y } from "../lib/yol.js";
import { tt } from "../lib/dil.js";

// Google Play zorunluluğu: mağaza kaydında gösterilecek gizlilik politikası.
// Bu bir TASLAKTIR; yayına almadan önce iletişim e-postası ve şirket/kişi
// bilgisi kontrol edilmelidir.
const GUNCELLEME = tt("9 Eylül 2026");
const ILETISIM = "idagureli@gmail.com";

export default function GizlilikPage() {
  return (
    <div className="bd-metin-sayfa">
      <h1 className="baslik">{tt("Gizlilik politikası")}</h1>
      <div className="alt-yazi" style={{ marginBottom: 18 }}>
        {tt("Son güncelleme:")} {GUNCELLEME}
      </div>

      <h2>{tt("Kısaca")}</h2>
      <p>
        {tt("Quiz Tactics, oyunu oynayabilmen için gereken en az veriyi toplar:")}{" "}
        <b>{tt("e-posta adresin")}</b>, <b>{tt("seçtiğin takma ad")}</b> {tt("ve")} <b>{tt("avatarın")}</b>{tt(", ayrıca oyun içi")} <b>{tt("puan, sıralama ve şehir/ülke")}</b> {tt("bilgin. Verilerini satmıyoruz, reklam ağlarıyla paylaşmıyoruz.")}
      </p>

      <h2>{tt("Topladığımız veriler")}</h2>
      <ul>
        <li>
          <b>{tt("Hesap bilgileri:")}</b> {tt("e-posta adresi (yalnız giriş için; hiçbir zaman başka oyunculara gösterilmez) ve")} <b>{tt("senin seçtiğin takma ad")}</b>{tt(". Diğer oyuncular yalnızca bu takma adı görür — gerçek adın ve e-postan gizlidir.")}
        </li>
        <li>
          <b>{tt("Avatar:")}</b> {tt("hazır avatarlardan seçtiğin görsel. Google hesabının fotoğrafı")} <b>{tt("otomatik olarak alınmaz")}</b>{tt("; yalnız sen onaylarsan kullanılır.")}
        </li>
        <li>
          <b>{tt("Oyun verileri:")}</b> {tt("puan, haftalık puan, rütbe, rozetler, maç sonuçları, gördüğün sorular, arkadaşlıklar ve maç içi sohbet mesajları.")}
        </li>
        <li>
          <b>{tt("Konum bilgisi:")}</b> {tt("yalnızca kendi seçtiğin")} <b>{tt("şehir ve ülke")}</b>{tt(". Cihazının GPS konumunu")} <b>{tt("almıyoruz")}</b>{tt(". Bu bilgi şehir/ülke liglerinde herkese görünür.")}
        </li>
        <li>
          <b>{tt("Reklam:")}</b> {tt("uygulamada Google H5 Games Ads (AdSense) üzerinden ödüllü video ve maç arası geçiş reklamı gösterilir. Reklam ağı kendi çerez/reklam kimliğini kullanır; biz kişisel verini reklam ağına")} <b>{tt("göndermiyoruz")}</b>.
        </li>
        <li>
          <b>{tt("Bildirim izni:")}</b> {tt("bildirimleri açarsan tarayıcının verdiği abonelik anahtarı. İstediğin an profil sayfasından kapatabilirsin.")}
        </li>
        <li>
          <b>{tt("Teknik kayıtlar:")}</b> {tt("oturum açıklık bilgisi (son görülme) ve hata kayıtları.")}
        </li>
      </ul>

      <h2>{tt("Verileri neden kullanıyoruz")}</h2>
      <ul>
        <li>{tt("Hesabını oluşturmak, seni tanımak ve oturumunu sürdürmek.")}</li>
        <li>{tt("Maç, turnuva, sıralama ve lig özelliklerini çalıştırmak.")}</li>
        <li>{tt("Sana daha önce görmediğin soruları göstermek.")}</li>
        <li>{tt("Kötüye kullanımı (puan kasma, sahte hesap) tespit etmek.")}</li>
        <li>{tt("İzin verdiysen turnuva ve haftalık sonuç bildirimleri göndermek.")}</li>
      </ul>

      <h2>{tt("Sesli sohbet")}</h2>
      <p>
        {tt("1v1 maçlarda,")} <b>{tt("yalnızca arkadaş olduğun")}</b> {tt("bir oyuncuyla ve")}
        <b> {tt("iki taraf da açıkça kabul ederse")}</b> {tt("sesli sohbet açılabilir. Kapalı gelir; sen başlatmadan mikrofonun açılmaz.")}
      </p>
      <ul>
        <li>
          <b>{tt("Konuşma kaydedilmez.")}</b> {tt("Ses doğrudan iki cihaz arasında gider (WebRTC); sunucularımızdan geçmez, saklanmaz, dinlenmez.")}
        </li>
        <li>
          <b>{tt("IP adresi:")}</b> {tt("bu teknoloji doğrudan bağlantı kurduğu için, görüşme sırasında cihazlarınızın IP adresleri karşı tarafa görünebilir. Bu, sesli sohbetin yalnız arkadaşlarla açılmasının başlıca sebebidir.")}
        </li>
        <li>
          {tt("Mikrofon izni tarayıcından istenir ve istediğin an geri alabilirsin. Görüşmeyi tek dokunuşla kapatabilir ya da mikrofonunu susturabilirsin.")}
        </li>
        <li>
          {tt("Sesli sohbet tamamen isteğe bağlıdır; hiç kullanmadan da oyunun tamamını oynayabilirsin.")}
        </li>
      </ul>

      <h2>{tt("Paylaşım")}</h2>
      <p>
        {tt("Verilerini üçüncü taraflara satmıyoruz. Yalnızca hizmeti çalıştırmak için kullandığımız altyapı sağlayıcıları verileri işler:")} <b>Supabase</b> {tt("(veritabanı, kimlik doğrulama) ve")}{" "}
        <b>Vercel</b> {tt("(uygulama barındırma).")} <b>{tt("Takma adın")}</b>{tt(", seçtiğin")} <b>{tt("avatar")}</b>{tt(", puanın ve şehir/ülke bilgin, oyunun doğası gereği diğer oyunculara görünür. Gerçek adın ve e-posta adresin")} <b>{tt("hiçbir zaman")}</b> {tt("başka oyunculara gösterilmez.")}
      </p>

      <h2>{tt("Saklama ve silme")}</h2>
      <p>
        {tt("Verilerini hesabın açık olduğu sürece saklarız. Hesabını")}{" "}
        <Link to={y("/profil")}>{tt("Profil")}</Link> {tt("sayfasındaki")} <b>{tt("Hesabımı Sil")}</b> {tt("düğmesiyle kalıcı olarak silebilirsin; profilin, maç kayıtların, rozetlerin ve mesajların silinir. Bu işlem geri alınamaz. Dilersen")} {ILETISIM} {tt("adresine yazarak da silme talebinde bulunabilirsin.")}
      </p>

      <h2>{tt("Çocuklar")}</h2>
      <p>
        {tt("Quiz Tactics 13 yaş altındaki çocuklara yönelik değildir ve bilerek 13 yaş altından veri toplamayız.")}
      </p>

      <h2>{tt("Çerezler ve yerel depolama")}</h2>
      <p>
        {tt("Oturumunu açık tutmak ve bazı tercihlerini (ör. kapattığın bilgilendirme şeritleri) hatırlamak için tarayıcının yerel depolamasını kullanırız. Reklam veya izleme çerezi kullanmıyoruz.")}
      </p>

      <h2>{tt("Değişiklikler")}</h2>
      <p>
        {tt("Bu politikayı güncellersek bu sayfadaki tarihi değiştiririz. Önemli değişikliklerde uygulama içinde bilgilendirme yaparız.")}
      </p>

      <h2>{tt("İletişim")}</h2>
      <p>
        {tt("Sorular ve veri talepleri için:")} <b>{ILETISIM}</b>
      </p>

      <Link to={y()} className="btn ikincil" style={{ marginTop: 18 }}>
        {tt("Ana sayfaya dön")}
      </Link>
    </div>
  );
}

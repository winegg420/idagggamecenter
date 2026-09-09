import { Link } from "react-router-dom";
import { y } from "../lib/yol.js";

// Google Play, reklam ağları ve uygulama içi satın alma için zorunlu:
// Kullanım Koşulları. Gizlilik politikasıyla aynı biçimde, girişsiz erişilir.
// Bu bir TASLAKTIR; yayına almadan önce hizmet sağlayıcı kimliği (şahıs mı
// şirket mi, unvan, adres) ve uygulanacak hukuk maddesi doldurulmalıdır.
const GUNCELLEME = "9 Eylül 2026";
const ILETISIM = "idagureli@gmail.com";

export default function KosullarPage() {
  return (
    <div className="bd-metin-sayfa">
      <div className="baslik">Kullanım koşulları</div>
      <div className="alt-yazi" style={{ marginBottom: 18 }}>
        Son güncelleme: {GUNCELLEME}
      </div>

      <h2>Kısaca</h2>
      <p>
        <b>Quizador</b> bilgi yarışması ücretsiz olarak sunulur. Oyun hem kendi
        adresinde hem de Quizador oyun portalı içinde oynanabilir; bu koşullar
        ikisi için de geçerlidir. Oyunu kullanarak bu koşulları kabul etmiş olursun.
        Kurallara uyduğun sürece hesabın senindir; hile, taciz veya kötüye kullanım
        durumunda hesabın kısıtlanabilir.
      </p>

      <h2>1. Taraflar ve kapsam</h2>
      <p>
        Bu koşullar, hizmeti işleten (bundan sonra "biz") ile hizmeti kullanan kişi
        (bundan sonra "sen") arasındaki sözleşmedir. Kapsam, Quizador sitesi ve
        portalı ile içindeki tüm oyunlardır.
      </p>

      <h2>2. Hesap</h2>
      <ul>
        <li>Hesap açmak için geçerli bir e-posta adresi veya desteklenen bir sosyal hesap gerekir.</li>
        <li>
          Hesabının güvenliğinden sen sorumlusun. Hesabını başkasıyla paylaşma;
          paylaşırsan doğacak sonuçlardan sen sorumlu olursun.
        </li>
        <li>Bir kişinin birden çok hesap açarak sıralamayı etkilemesi yasaktır.</li>
        <li>
          Hesabını istediğin an profil sayfasından silebilirsin. Silme işlemi
          geri alınamaz.
        </li>
      </ul>

      <h2>3. Yaş sınırı</h2>
      <p>
        Hizmet 13 yaş altındaki çocuklara yönelik değildir. 13-18 yaş arasındaysan
        veli veya vasinin izniyle kullanabilirsin.
      </p>

      <h2>4. Kabul edilebilir kullanım</h2>
      <p>Aşağıdakiler yasaktır ve hesabın kapatılmasıyla sonuçlanabilir:</p>
      <ul>
        <li>
          <b>Hile:</b> otomasyon/bot kullanmak, oyunu tersine mühendislikle
          değiştirmek, sunucuya sahte istek göndermek, puan veya sıralamayı
          hile ile etkilemek.
        </li>
        <li>
          <b>Taciz:</b> takma ad, avatar veya maç içi sohbette hakaret, nefret
          söylemi, tehdit, cinsel içerik veya spam.
        </li>
        <li>Başkasının kimliğine bürünmek; yanıltıcı takma ad kullanmak.</li>
        <li>Hizmete aşırı yük bindirmek, güvenlik önlemlerini aşmaya çalışmak.</li>
        <li>İçeriği izinsiz kopyalayıp başka bir yerde yayımlamak.</li>
      </ul>

      <h2>5. Kullanıcı içeriği</h2>
      <p>
        Takma adın, avatar seçimin ve maç içi mesajların senin içeriğindir.
        Bunları hizmet içinde göstermemiz için bize sınırlı ve ücretsiz bir
        kullanım izni vermiş olursun. Kurallara aykırı içeriği bildirim üzerine
        veya kendiliğimizden kaldırabiliriz.
      </p>

      <h2>6. Sanal öğeler, jokerler ve satın almalar</h2>
      <ul>
        <li>
          Puan, rütbe, rozet ve jokerler <b>sanal öğelerdir</b>; gerçek para değeri
          taşımaz, nakde çevrilemez, devredilemez ve hesap dışında kullanılamaz.
        </li>
        <li>
          Uygulama içi satın alma yalnızca Android uygulamasında ve Google Play
          faturalandırması üzerinden yapılır. İade talepleri Google Play'in
          iade politikasına tabidir.
        </li>
        <li>
          Ödüllü reklam izleyerek kazanılan öğeler reklam ağının o an reklam
          sunabilmesine bağlıdır; sürekli erişim garanti edilmez.
        </li>
        <li>
          Hizmeti sonlandırmamız hâlinde sanal öğeler için bedel iadesi yapılmaz.
        </li>
      </ul>

      <h2>7. Reklamlar</h2>
      <p>
        Hizmette Google H5 Games Ads (AdSense) üzerinden ödüllü video ve maç arası
        reklam gösterilebilir. Reklam içeriği reklam ağı tarafından belirlenir ve
        bizim denetimimizde değildir.
      </p>

      <h2>8. Sorular ve içerik doğruluğu</h2>
      <p>
        Soru havuzu insan denetiminden geçse de hata içerebilir. Hatalı bulduğun
        soruyu oyun içinden bildirebilirsin; bildirimler değerlendirilip soru
        havuzdan çıkarılabilir. Sorular genel kültür amaçlıdır; profesyonel
        tavsiye yerine geçmez.
      </p>

      <h2>9. Hizmetteki değişiklikler</h2>
      <p>
        Oyun kurallarını, puanlama formüllerini, ödülleri ve özellikleri
        geliştirmek için değiştirebiliriz. Önemli değişiklikleri uygulama içinde
        duyururuz. Hizmeti tamamen durdurmamız hâlinde makul bir süre önce
        bilgilendirme yaparız.
      </p>

      <h2>10. Askıya alma ve fesih</h2>
      <p>
        Bu koşulları ihlal etmen hâlinde hesabını uyarı yaparak veya ağır
        durumlarda doğrudan askıya alabilir ya da kapatabiliriz. Kararı haksız
        buluyorsan aşağıdaki adresten itiraz edebilirsin.
      </p>

      <h2>11. Garanti reddi</h2>
      <p>
        Hizmet "olduğu gibi" sunulur. Kesintisiz veya hatasız çalışacağını
        garanti etmeyiz. Sunucu, ağ veya üçüncü taraf hizmetlerinden kaynaklanan
        kesintiler olabilir.
      </p>

      <h2>12. Sorumluluk sınırı</h2>
      <p>
        Yürürlükteki hukukun izin verdiği ölçüde; dolaylı zararlardan, veri
        kaybından veya kâr kaybından sorumlu değiliz. Hizmet ücretsiz olduğundan,
        doğrudan zararlara ilişkin toplam sorumluluğumuz son 12 ayda bize ödediğin
        tutarla (yoksa sıfırla) sınırlıdır.
      </p>

      <h2>13. Fikri mülkiyet</h2>
      <p>
        Oyunun adı, logosu, arayüz tasarımı, maskotu ve soru havuzu bize aittir.
        Kişisel kullanım dışında çoğaltılamaz, dağıtılamaz veya ticari amaçla
        kullanılamaz.
      </p>

      <h2>14. Gizlilik</h2>
      <p>
        Kişisel verilerinin nasıl işlendiğini{" "}
        <Link to="/gizlilik">Gizlilik Politikası</Link> sayfasında bulabilirsin.
        Gizlilik politikası bu koşulların ayrılmaz parçasıdır.
      </p>

      <h2>15. Uygulanacak hukuk</h2>
      <p>
        Bu koşullara Türkiye Cumhuriyeti hukuku uygulanır. Tüketici olarak sahip
        olduğun yasal haklar saklıdır; tüketici hakem heyetlerine ve tüketici
        mahkemelerine başvuru hakkın etkilenmez.
      </p>

      <h2>16. Değişiklikler</h2>
      <p>
        Bu koşulları güncellersek bu sayfadaki tarihi değiştiririz. Değişiklikten
        sonra hizmeti kullanmaya devam etmen güncel koşulları kabul ettiğin
        anlamına gelir.
      </p>

      <h2>17. İletişim</h2>
      <p>
        Sorular, itirazlar ve bildirimler için: <b>{ILETISIM}</b>
      </p>

      <Link to={y()} className="btn ikincil" style={{ marginTop: 18 }}>
        Ana sayfaya dön
      </Link>
    </div>
  );
}

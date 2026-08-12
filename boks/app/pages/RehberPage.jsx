// ============================================================
// GÖLGE BOKS — Teknik Rehberi ("önce öğren" akışı)
// İlk kez oynayan biri için altı yumruk numarasının doğru formu, sık yapılan
// hatalar ve gard/duruş temeli. Kamera gerektirmez; menüden her an açılabilir.
//
// Duruşa göre (ortodoks / güney pençe) ön-arka el adlandırması otomatik uyum
// sağlar; solak oyuncuya "sol jab" denmez.
// ============================================================

import { Link } from "react-router-dom";
import { useBoks } from "../BoksApp.jsx";

const TEKNIK = [
  {
    no: 1,
    ad: "Jab (ön el, düz)",
    ozet: "Öndeki elin düz yumruğu. Mesafeyi kuran, ritmi belirleyen temel silah.",
    form: [
      "Yumruk çeneden çıkar, dirsek gövdeye yakın, omuz çeneyi korur.",
      "Ön ayak hafifçe ilerler; güç omuz rotasyonundan gelir, kolu savurmaktan değil.",
      "Vuruş anında bilek düz, ilk iki parmak boğumu hedefe temas eder.",
      "Geri dönüş gidişten hızlı: el AYNI yoldan yüze döner.",
    ],
    hata: "Kolu tamamen kilitlemek (dirsek hiperekstansiyonu) ve dönüşte eli aşağı bırakmak.",
  },
  {
    no: 2,
    ad: "Cross (arka el, düz)",
    ozet: "Arkadaki elin düz yumruğu. En güçlü düz vuruş; kalça ve arka ayak rotasyonuyla üretilir.",
    form: [
      "Arka ayak topuğu dışa döner, kalça hedefe döner.",
      "Arka omuz öne gelirken ön omuz çeneyi korumaya çekilir.",
      "Gövde merkez hattı üzerinde kalır; öne aşırı yatma dengeyi bozar.",
      "Vuruştan sonra hemen duruşa dön; ağırlığı öne bırakma.",
    ],
    hata: "Gücü koldan aramak ve vuruş sırasında çeneyi havada bırakmak.",
  },
  {
    no: 3,
    ad: "Ön Hook (kroşe)",
    ozet: "Öndeki elin yanal yay çizen kısa yumruğu. Yakın-orta mesafenin kapatıcısı.",
    form: [
      "Dirsek yaklaşık 90°, ön kol yere paralel (kafa hooku) ya da hafif yukarı.",
      "Ön ayak topuğu içe döner; güç kalça rotasyonundan gelir.",
      "Yumruk gövdeden uzaklaşmaz; kısa ve sıkı bir yay çizer.",
      "Karşı el çeneyi kilitli tutar — hook atarken en çok açık verilen andır.",
    ],
    hata: "Kolu geriye çekip 'sallamak' (telegraflama) ve dirseği düşürmek.",
  },
  {
    no: 4,
    ad: "Arka Hook",
    ozet: "Arkadaki elin yanal yumruğu. Daha güçlü ama daha uzun yol katettiği için daha risklidir.",
    form: [
      "Arka kalça ve ayak birlikte döner; gövde tek parça hareket eder.",
      "Dirsek yumruk hizasında kalır, omuz çeneyi korur.",
      "Genelde cross'un ardından, açılan gardın yan boşluğuna gider.",
    ],
    hata: "Gövdeyi savurup dengeyi kaybetmek; vuruş sonrası duruşa dönememek.",
  },
  {
    no: 5,
    ad: "Ön Uppercut (aparkat)",
    ozet: "Öndeki elin aşağıdan yukarı kısa yumruğu. Yakın mesafede gardı açar.",
    form: [
      "Dizler hafif çöker, avuç içi kendine bakar, dirsek gövdeye yakın.",
      "Güç bacaklardan başlar, kalçadan omuza aktarılır.",
      "Yumruk kısa yol alır: 20-30 cm'lik bir hareket yeterlidir.",
      "Vuruştan sonra gard hemen yukarı kapanır.",
    ],
    hata: "Kolu aşağı sarkıtıp geniş bir kepçe hareketi yapmak.",
  },
  {
    no: 6,
    ad: "Arka Uppercut",
    ozet: "Arkadaki elin aşağıdan yukarı yumruğu. İç mesafenin en sert silahlarından.",
    form: [
      "Arka diz ve kalça yukarı doğru itiş üretir.",
      "Gövde dik kalır; öne eğilerek atılan uppercut hem güçsüz hem risklidir.",
      "Genelde 3-6 veya 2-5-2 gibi kombinasyonların içinde kullanılır.",
    ],
    hata: "Vuruş için gardı tamamen açmak ve çeneyi öne uzatmak.",
  },
];

export default function RehberPage() {
  const { tercih } = useBoks();
  const solak = tercih.durus === "guney_pence";
  const on = solak ? "sağ" : "sol";
  const arka = solak ? "sol" : "sağ";

  return (
    <div className="bx-sayfa">
      <div className="bx-sayfa-ust">
        <Link to="/boks" className="bx-geri">← Menü</Link>
        <h2>📖 Teknik Rehberi</h2>
      </div>

      <section className="bx-kart">
        <h3 className="bx-kart-baslik">Duruş ve Gard</h3>
        <p className="bx-ozet-metin">
          Seçili duruşun: <b>{solak ? "Güney Pençe (solak)" : "Ortodoks"}</b> — {on} elin ÖNDE,{" "}
          {arka} elin ARKADA. Ayaklar omuz genişliğinde, ön ayak ucu hedefe bakar, arka topuk hafif kalkık.
          Dizler yumuşak, ağırlık iki ayağa dengeli. Eldivenler elmacık kemiği hizasında, dirsekler
          kaburgaya yakın. Çene göğse doğru hafif çekik: <b>gard, atmadığın her an</b> devrededir.
        </p>
        <p className="bx-not">
          Sistem gard yüksekliğini her karede ölçer; vuruş anında karşı elin düşerse bunu ayrı bir açık
          olarak kaydeder ve sonraki antrenmanlarda düzelip düzelmediğini takip eder.
        </p>
      </section>

      {TEKNIK.map((t) => (
        <section key={t.no} className="bx-kart bx-teknik">
          <div className="bx-teknik-ust">
            <span className="bx-teknik-no">{t.no}</span>
            <div>
              <b>{t.ad}</b>
              <small>{t.ozet}</small>
            </div>
          </div>
          <ul className="bx-teknik-liste">
            {t.form.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
          <p className="bx-teknik-hata">⚠️ Sık hata: {t.hata}</p>
        </section>
      ))}

      <section className="bx-kart">
        <h3 className="bx-kart-baslik">Numara Dili</h3>
        <p className="bx-ozet-metin">
          Salonda koç kombinasyonları numarayla söyler: <b>1-2</b> (jab-cross), <b>1-2-3</b> (jab-cross-ön hook),
          <b> 1-6-3</b> (jab-arka uppercut-ön hook). Koç Modu'nda bu dili kullanırız; numaraları refleks hâline
          getirmek gerçek salonda da işine yarar.
        </p>
      </section>

      <div className="bx-alt-linkler">
        <Link to="/boks" className="bx-btn bx-btn-ana">🥊 Antrenmana Dön</Link>
      </div>
    </div>
  );
}

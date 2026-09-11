// ============================================================
// EŞ ZAMANLI MAÇ EKRANLARI — üç modun ortak parçaları
//   HazirKapisi : maç başlamadan önce "Hazır" onayı ve rakip beklemesi
//   KopukPerde  : maç sırasında rakip koptuğunda ekranı kilitleyen perde
// ============================================================
import Maskot from "./Maskot.jsx";
import Ikon from "./Ikon.jsx";

/** Rakip dönmezse maçın hükmen biteceği süre (sunucudaki değerle aynı). */
export const TERK_SN = 45;

/**
 * Maç başlamadan önceki ekran.
 *
 * @param {object} p
 * @param {boolean} p.benHazir
 * @param {number}  p.hazirSayisi   hazır olan oyuncu sayısı
 * @param {number}  p.toplamOyuncu
 * @param {string[]} p.bekleyenAdlar  henüz hazır olmayan/ekranda olmayanlar
 * @param {() => void} p.onHazir
 * @param {() => void} p.onCik
 * @param {React.ReactNode} p.tabela  oyuncu kartları (moda özel)
 */
export function HazirKapisi({
  benHazir,
  hazirSayisi,
  toplamOyuncu,
  bekleyenAdlar = [],
  onHazir,
  onCik,
  tabela = null,
}) {
  const hepsiHazir = toplamOyuncu > 0 && hazirSayisi >= toplamOyuncu;
  return (
    <div className="buyuk-mesaj">
      <Maskot poz={benHazir ? "kutluyor" : "selam"} boyut={104} className="bd-sonuc-maskot" />
      <h2>{hepsiHazir ? "Maç başlıyor…" : benHazir ? "Rakip bekleniyor" : "Hazır mısın?"}</h2>
      <p className="alt-yazi" style={{ marginBottom: 14 }}>
        Bu maç <b>eş zamanlı</b> oynanır: herkes aynı soruyu aynı anda görür,
        soru herkes için aynı anda geçer. Maç <b>hepiniz hazır olunca</b> başlar.
      </p>

      {tabela}

      <div className="bd-hazir-durum">
        <span className={"bd-hazir-sayac" + (hepsiHazir ? " tamam" : "")}>
          {hazirSayisi}/{toplamOyuncu} hazır
        </span>
        {!hepsiHazir && bekleyenAdlar.length > 0 && (
          <span className="alt-yazi">Beklenen: {bekleyenAdlar.join(", ")}</span>
        )}
      </div>

      <div className="bd-hazir-dugmeler">
        {!benHazir ? (
          <button className="btn bd-hazir-btn" onClick={onHazir}>
            <Ikon ad="onay" boyut={20} />
            Hazırım
          </button>
        ) : (
          <div className="bd-hazir-beklemede">
            <span className="bd-hazir-nokta" aria-hidden="true" />
            Hazırsın — diğerleri bekleniyor
          </div>
        )}
        <button className="btn ikincil" onClick={onCik}>Vazgeç</button>
      </div>
    </div>
  );
}

/**
 * Maç sırasında rakip kopunca ekranı kilitleyen perde.
 * Maç duraklamıştır: süre işlemez, cevap gönderilemez.
 *
 * @param {string[]} p.bekleyenAdlar
 * @param {number} p.gecenSn  kopmadan bu yana geçen saniye
 */
export function KopukPerde({ bekleyenAdlar = [], gecenSn = 0 }) {
  const kalan = Math.max(0, TERK_SN - gecenSn);
  const kim = bekleyenAdlar.length ? bekleyenAdlar.join(", ") : "Rakibin";
  return (
    <div className="bd-kopuk-perde" role="alert" aria-live="assertive">
      <div className="bd-kopuk-kutu">
        <span className="bd-kopuk-halka" aria-hidden="true" />
        <b>Rakip bekleniyor</b>
        <span>
          <b>{kim}</b> oyundan ayrıldı. Maç duraklatıldı — süre işlemiyor,
          bu yüzden bir şey kaybetmiyorsun.
        </span>
        <span className="bd-kopuk-sayac">
          {kalan > 0
            ? `${kalan} sn içinde dönmezse maçı terk etmiş sayılacak`
            : "Maç sonlandırılıyor…"}
        </span>
      </div>
    </div>
  );
}

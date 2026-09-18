import { useState } from "react";
import Modal from "./Modal.jsx";
import Ikon from "./Ikon.jsx";
import { JOKER_BILGI } from "../lib/jokerler.js";
import { hataMesaji } from "../lib/hata.js";
import { tt } from "../lib/dil.js";

/**
 * Maç içi joker satın alma onayı (Paket 27 C).
 *
 * TASARIM KARARLARI — hepsi maçın ortasında olduğumuz için:
 *  · Alttan açılan sayfa (`bd-alttan`): pop-up parmağın altında, tek elle
 *    erişilebilir yükseklikte. Ortada açılan bir kutu başparmakla zor.
 *  · SÜRE DURMAZ. Maç senkron, rakip bekliyor — burada sayaç dondurulmaz.
 *    Bu yüzden akış tek adım: onayla → satın al + kullan aynı çağrıda.
 *  · Coin yetmiyorsa onay pasif ve "Yetersiz coin" yazar. Dükkâna ya da coin
 *    satın alma ekranına YÖNLENDİRME YOK — maçın ortasında agresif durur ve
 *    oyuncuyu maçtan koparır.
 *  · Onaya basınca düğme kilitlenir: çift tıklama çift satın alma yapmasın.
 *
 * onOnay: async () => void — satın al+kullan RPC'sini çağıran fonksiyon.
 */
export default function JokerSatinAlModal({ tur, fiyat, coin, onOnay, onKapat }) {
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState(null);
  const bilgi = JOKER_BILGI[tur] ?? {};
  const yeterli = Number(coin ?? 0) >= Number(fiyat ?? 0);

  const onayla = async () => {
    if (calisiyor || !yeterli) return;
    setCalisiyor(true);
    setHata(null);
    try {
      await onOnay();
      onKapat?.();
    } catch (e) {
      setHata(hataMesaji(e, tt("Joker alınamadı.")));
      setCalisiyor(false);
    }
  };

  return (
    <Modal
      ekSinif="bd-alttan"
      etiket={tt("Joker satın al")}
      onKapat={calisiyor ? undefined : onKapat}
    >
      <div className="bd-joker-sat">
        <div className="bd-joker-sat-tutamac" aria-hidden="true" />

        <div className="bd-joker-sat-ust">
          <span className="bd-joker-sat-ikon" aria-hidden="true">
            <Ikon ad={bilgi.ikon ?? "soru"} boyut={26} />
          </span>
          <div>
            <div className="bd-joker-sat-ad">{bilgi.ad ?? tur}</div>
            <div className="bd-joker-sat-aciklama">{bilgi.aciklama}</div>
          </div>
        </div>

        <div className="bd-joker-sat-satir">
          <span>{tt("Fiyat")}</span>
          <b className="bd-joker-sat-fiyat">
            <Ikon ad="coin" boyut={15} /> {fiyat}
          </b>
        </div>
        <div className="bd-joker-sat-satir">
          <span>{tt("Coin'in")}</span>
          <b className={yeterli ? "" : "eksik"}>
            <Ikon ad="coin" boyut={15} /> {coin ?? 0}
          </b>
        </div>

        {!yeterli && (
          <div className="bd-joker-sat-not" role="alert">
            {tt("Yetersiz coin — oynayarak kazanabilirsin.")}
          </div>
        )}
        {hata && (
          <div className="bd-joker-sat-not hata" role="alert">
            {hata}
          </div>
        )}

        <div className="bd-joker-sat-dugmeler">
          <button
            type="button"
            className="btn ikincil"
            onClick={onKapat}
            disabled={calisiyor}
          >
            {tt("Vazgeç")}
          </button>
          <button
            type="button"
            className="btn"
            onClick={onayla}
            disabled={!yeterli || calisiyor}
          >
            {calisiyor ? tt("Alınıyor…") : tt("Al ve kullan")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

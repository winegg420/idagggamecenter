import { useCallback, useEffect, useRef, useState } from "react";
import Ikon from "./Ikon.jsx";
import { hataMesaji } from "../lib/hata.js";
import { Link } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { MAC_ICI_JOKERLER, JOKER_BILGI, envanterNesne } from "../lib/jokerler.js";
import JokerSatinAlModal from "./JokerSatinAlModal.jsx";
import { y } from "../lib/yol.js";
import { sesJoker } from "../lib/ses.js";
import { titret } from "../lib/geriBildirim.js";
import { tt } from "../lib/dil.js";

/**
 * Maç içi joker çubuğu. Tüm kararlar sunucudadır (joker_kullan RPC);
 * burası yalnız adet rozetini, ücretsiz hakkı ve pasiflik nedenini gösterir.
 *
 * onEtki(sonuc): { tur, kapali? , uzatildi?, atlandi?, dogru_cevap? }
 */
export default function JokerCubugu({ macTur, macId, soruIndex, onEtki, kilit }) {
  const [envanter, setEnvanter] = useState({ elli: 0, sure: 0, soru_degistir: 0, seri_koruma: 0 });
  const [durum, setDurum] = useState(null); // { sinir, kullanilan, ucretsiz_elli_kaldi }
  const [hata, setHata] = useState(null);
  const [calisan, setCalisan] = useState(null);
  // Paket 27 B: ARTIK HER TÜR maç başına bir kez. Sunucu da aynı kuralı uygular;
  // burada yalnız düğmeyi kapatmak için tutuluyor.
  const [kullandigim, setKullandigim] = useState([]);
  // Paket 27 C: maç içi satın alma — fiyatlar ve coin sunucudan.
  const [fiyatlar, setFiyatlar] = useState(null);
  const [coin, setCoin] = useState(null);
  const [satinAlinacak, setSatinAlinacak] = useState(null);
  const hataRef = useRef(null);

  // Joker çubuğu ekranın EN ALTINDA duruyor; hata notu düğmelerin altına
  // düştüğü için görünür alanın dışında kalıyordu (ölçüm: not y=817, pencere
  // 791). Oyuncu sessiz bir başarısızlık görüyordu. Not artık göze sokuluyor.
  useEffect(() => {
    if (!hata) return;
    try {
      hataRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } catch {
      /* eski tarayıcı: notu kaydıramadıysak da metin yerinde duruyor */
    }
  }, [hata]);

  const yukle = useCallback(async () => {
    try {
      const [env, mac, fiy, bak] = await Promise.all([
        supabase.rpc("envanterim"),
        supabase.rpc("joker_mac_durumu", { p_mac_tur: macTur, p_mac_id: macId }),
        supabase.rpc("joker_fiyatlari"),
        supabase.rpc("coin_bakiyem"),
      ]);
      if (env.error) throw env.error;
      if (mac.error) throw mac.error;
      setEnvanter(envanterNesne(env.data));
      setDurum(Array.isArray(mac.data) ? (mac.data[0] ?? null) : (mac.data ?? null));
      // Fiyat/coin alınamazsa satın alma gizlenir, oyun akışı bozulmaz.
      if (!fiy.error) setFiyatlar(fiy.data ?? null);
      if (!bak.error) setCoin(Array.isArray(bak.data) ? bak.data[0] : bak.data);
    } catch {
      // Migration henüz uygulanmadıysa çubuk gizlenir; oyun akışı bozulmaz.
      setDurum(null);
    }
  }, [macTur, macId]);

  useEffect(() => {
    yukle();
  }, [yukle, soruIndex]);

  if (!durum) return null;

  const sinirDoldu =
    durum.sinir !== null && durum.sinir !== undefined && durum.kullanilan >= durum.sinir;
  const finalYasak = durum.sinir === 0;

  /**
   * Joker kullan. `satinAl` true ise satın alma + kullanım TEK RPC'de yapılır
   * (joker_al_ve_kullan): araya girip coin düşüp jokerin kullanılmaması diye
   * bir durum oluşmaz, kullanım reddedilirse coin de geri gelir.
   */
  const kullan = async (tur, satinAl = false) => {
    setHata(null);
    setCalisan(tur);
    try {
      const { data, error } = await supabase.rpc(
        satinAl ? "joker_al_ve_kullan" : "joker_kullan",
        { p_mac_tur: macTur, p_mac_id: macId, p_soru_index: soruIndex, p_tur: tur }
      );
      if (error) throw error;
      sesJoker();
      titret(10);
      setKullandigim((k) => (k.includes(tur) ? k : [...k, tur]));
      if (data && typeof data.coin === "number") setCoin(data.coin);
      onEtki?.(data);
      await yukle();
    } catch (e) {
      setHata(hataMesaji(e, tt("Joker kullanılamadı.")));
      throw e;   // satın alma penceresi hatayı kendi içinde göstersin
    } finally {
      setCalisan(null);
    }
  };

  /** Envanterde 0 varken düğmeye basılınca: önce onay penceresi. */
  const bas = (tur) => {
    if (satinAlinabilir(tur)) setSatinAlinacak(tur);
    else kullan(tur).catch(() => {});
  };

  /** Envanterde yok, ücretsiz hakkı da yok ama maç içinde satın alınabilir mi? */
  const satinAlinabilir = (tur) => {
    if (kilit || finalYasak || sinirDoldu) return false;
    if (macTur === "turnuva" && tur === "soru_degistir") return false;
    if (kullandigim.includes(tur)) return false;
    if (tur === "elli" && durum?.ucretsiz_elli_kaldi) return false;
    if ((envanter[tur] ?? 0) > 0) return false;
    return Number(fiyatlar?.[tur] ?? 0) > 0;
  };

  const neden = (tur) => {
    if (kilit) return tt("Bu soruyu zaten cevapladın");
    if (finalYasak) return tt("Turnuva finalinde joker kullanılamaz");
    if (sinirDoldu) return tt("Bu maçta en fazla {0} joker", { 0: durum.sinir });
    // Turnuva herkese AYNI soruyu sorar ve elemelidir: soru değiştirilemez.
    if (macTur === "turnuva" && tur === "soru_degistir") return tt("Turnuvada soru değiştirilemez");
    // Paket 27 B: aynı joker maç başına bir kez — her tür için. Sunucu da aynı kuralı uygular.
    if (kullandigim.includes(tur)) return tt("Bu jokeri bu maçta zaten kullandın");
    const ucretsiz = tur === "elli" && durum.ucretsiz_elli_kaldi;
    // Envanterde yoksa artık "kalmadı" demiyoruz: maç içinde satın alınabiliyor.
    if (!ucretsiz && (envanter[tur] ?? 0) <= 0 && !satinAlinabilir(tur)) return tt("Jokerin kalmadı");
    return null;
  };

  return (
    <div className="bd-joker-cubuk">
      {MAC_ICI_JOKERLER.map((tur) => {
        const bilgi = JOKER_BILGI[tur];
        const ucretsiz = tur === "elli" && durum.ucretsiz_elli_kaldi;
        const engel = neden(tur);
        const adet = envanter[tur] ?? 0;
        const satilik = satinAlinabilir(tur);
        const fiyat = Number(fiyatlar?.[tur] ?? 0);
        return (
          <button
            key={tur}
            className={`bd-joker ${ucretsiz ? "ucretsiz" : ""} ${satilik ? "satilik" : ""}`}
            disabled={Boolean(engel) || calisan !== null}
            title={engel ?? (satilik ? tt("{0} coin — dokun, al ve kullan", { 0: fiyat }) : bilgi.aciklama)}
            aria-label={`${bilgi.ad} — ${engel ?? (satilik ? tt("{0} coin — dokun, al ve kullan", { 0: fiyat }) : bilgi.aciklama)}`}
            onClick={() => bas(tur)}
          >
            {/* Paket 27 C: envanterde 0 varsa düğmenin üstünde altın simgesi —
                "bu joker satın alınabilir" işareti. */}
            {satilik && (
              <span className="bd-joker-satilik" aria-hidden="true">
                <Ikon ad="coin" boyut={12} />
              </span>
            )}
            <span className="bd-joker-ikon" aria-hidden="true"><Ikon ad={bilgi.ikon} boyut={18} /></span>
            <span className="bd-joker-ad">{bilgi.ad}</span>
            <span className={`bd-joker-adet ${ucretsiz ? "bedava" : ""} ${satilik ? "fiyat" : ""}`}>
              {calisan === tur ? "…" : ucretsiz ? tt("ÜCRETSİZ") : satilik ? fiyat : adet}
            </span>
          </button>
        );
      })}

      {(sinirDoldu || finalYasak) && (
        <div className="bd-joker-not">
          {finalYasak
            ? tt("Finalde joker yok — sadece bilgi.")
            : tt("Bu maçta joker hakkın doldu ({0}/{1}).", { 0: durum.kullanilan, 1: durum.sinir })}
        </div>
      )}

      {hata && (
        <div className="bd-joker-not hata" ref={hataRef} role="alert">
          {hata}
          {/kalmadı/i.test(hata) && (
            <>
              {" "}
              <Link to={y("/joker")}>{tt("Joker al")}</Link>
            </>
          )}
        </div>
      )}

      {satinAlinacak && (
        <JokerSatinAlModal
          tur={satinAlinacak}
          fiyat={Number(fiyatlar?.[satinAlinacak] ?? 0)}
          coin={coin}
          onKapat={() => setSatinAlinacak(null)}
          onOnay={() => kullan(satinAlinacak, true)}
        />
      )}
    </div>
  );
}

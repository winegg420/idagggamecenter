import { useCallback, useEffect, useRef, useState } from "react";
import Ikon from "./Ikon.jsx";
import { hataMesaji } from "../lib/hata.js";
import { Link } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { MAC_ICI_JOKERLER, JOKER_BILGI, envanterNesne } from "../lib/jokerler.js";
import { y } from "../lib/yol.js";
import { sesJoker } from "../lib/ses.js";
import { titret } from "../lib/geriBildirim.js";

/**
 * Maç içi joker çubuğu. Tüm kararlar sunucudadır (joker_kullan RPC);
 * burası yalnız adet rozetini, ücretsiz hakkı ve pasiflik nedenini gösterir.
 *
 * onEtki(sonuc): { tur, kapali? , uzatildi?, atlandi?, dogru_cevap? }
 */
export default function JokerCubugu({ macTur, macId, soruIndex, onEtki, kilit }) {
  const [envanter, setEnvanter] = useState({ elli: 0, sure: 0, pas: 0, seri_koruma: 0 });
  const [durum, setDurum] = useState(null); // { sinir, kullanilan, ucretsiz_elli_kaldi }
  const [hata, setHata] = useState(null);
  const [calisan, setCalisan] = useState(null);
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
      const [env, mac] = await Promise.all([
        supabase.rpc("envanterim"),
        supabase.rpc("joker_mac_durumu", { p_mac_tur: macTur, p_mac_id: macId }),
      ]);
      if (env.error) throw env.error;
      if (mac.error) throw mac.error;
      setEnvanter(envanterNesne(env.data));
      setDurum(Array.isArray(mac.data) ? (mac.data[0] ?? null) : (mac.data ?? null));
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

  const kullan = async (tur) => {
    setHata(null);
    setCalisan(tur);
    try {
      const { data, error } = await supabase.rpc("joker_kullan", {
        p_mac_tur: macTur,
        p_mac_id: macId,
        p_soru_index: soruIndex,
        p_tur: tur,
      });
      if (error) throw error;
      sesJoker();
      titret(10);
      onEtki?.(data);
      await yukle();
    } catch (e) {
      setHata(hataMesaji(e, "Joker kullanılamadı."));
    } finally {
      setCalisan(null);
    }
  };

  const neden = (tur) => {
    if (kilit) return "Bu soruyu zaten cevapladın";
    if (finalYasak) return "Turnuva finalinde joker kullanılamaz";
    if (sinirDoldu) return `Bu maçta en fazla ${durum.sinir} joker`;
    if (macTur === "turnuva" && tur === "pas") return "Turnuvada pas kullanılamaz";
    const ucretsiz = tur === "elli" && durum.ucretsiz_elli_kaldi;
    if (!ucretsiz && (envanter[tur] ?? 0) <= 0) return "Jokerin kalmadı";
    return null;
  };

  return (
    <div className="bd-joker-cubuk">
      {MAC_ICI_JOKERLER.map((tur) => {
        const bilgi = JOKER_BILGI[tur];
        const ucretsiz = tur === "elli" && durum.ucretsiz_elli_kaldi;
        const engel = neden(tur);
        const adet = envanter[tur] ?? 0;
        return (
          <button
            key={tur}
            className={`bd-joker ${ucretsiz ? "ucretsiz" : ""}`}
            disabled={Boolean(engel) || calisan !== null}
            title={engel ?? bilgi.aciklama}
            aria-label={`${bilgi.ad} — ${engel ?? bilgi.aciklama}`}
            onClick={() => kullan(tur)}
          >
            <span className="bd-joker-ikon" aria-hidden="true"><Ikon ad={bilgi.ikon} boyut={18} /></span>
            <span className="bd-joker-ad">{bilgi.ad}</span>
            <span className={`bd-joker-adet ${ucretsiz ? "bedava" : ""}`}>
              {calisan === tur ? "…" : ucretsiz ? "ÜCRETSİZ" : adet}
            </span>
          </button>
        );
      })}

      {(sinirDoldu || finalYasak) && (
        <div className="bd-joker-not">
          {finalYasak
            ? "Finalde joker yok — sadece bilgi."
            : `Bu maçta joker hakkın doldu (${durum.kullanilan}/${durum.sinir}).`}
        </div>
      )}

      {hata && (
        <div className="bd-joker-not hata" ref={hataRef} role="alert">
          {hata}
          {/kalmadı/i.test(hata) && (
            <>
              {" "}
              <Link to={y("/joker")}>Joker al</Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// DÜKKÂN — GÖRÜNÜM SEKMESİ
//
// Karakterler ve kozmetik parçalar gruplu listelenir. Her kart parçanın
// ÖNİZLEMESİNİ gösterir: parçayı takmış avatar, kodla çizilir (asset yok).
// Sahip olunanda "Sahipsin" rozeti, etkinlik parçasında kilit ve
// "Etkinlik ödülü" etiketi — oyuncu neyin peşinde koşacağını bilsin.
//
// Satın alma kararı SUNUCUDA: karakter_satin_al / esya_satin_al coin'i
// düşürür, etkinlik parçalarını reddeder. Buradaki kilit yalnız bilgi.
// ============================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Ikon from "./Ikon.jsx";
import { hataMesaji } from "../lib/hata.js";
import { coinTazele, coinHatasi } from "../lib/coin.js";
import { y } from "../lib/yol.js";
import { avatarUri, kozmetikCoz, karakterId, YUVALAR } from "../karakter/gorunum.js";
import "../pages/gorunum.css";

const NADIRLIK_SINIF = { sirali: "n-sirali", ozel: "n-ozel", etkinlik: "n-etkinlik" };

export default function GorunumDukkani() {
  const { profile } = useAuth();
  const [veri, setVeri] = useState(null);
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);
  const [alinan, setAlinan] = useState(null);

  const yukle = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("karakter_katalogum");
      if (error) throw error;
      setVeri(Array.isArray(data) ? data[0] : data);
    } catch (e) {
      setHata(hataMesaji(e, "Dükkân yüklenemedi."));
    }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  const temel = useMemo(() => {
    const g = veri?.gorunum ?? profile?.gorunum ?? {};
    return { karakter: karakterId(g), kozmetik: kozmetikCoz(g) };
  }, [veri, profile]);

  if (hata) return <div className="hata-kutu">{hata}</div>;
  if (!veri) return <div className="yukleniyor">Yükleniyor…</div>;

  const karSahip = veri.karakter_sahip ?? [];
  const parcaSahip = veri.parca_sahip ?? [];

  const al = async (tur, anahtar, ad) => {
    setHata(null);
    setBilgi(null);
    setAlinan(anahtar);
    try {
      const { error } =
        tur === "karakter"
          ? await supabase.rpc("karakter_satin_al", { p_id: anahtar })
          : await supabase.rpc("esya_satin_al", { p_kod: anahtar });
      if (error) throw error;
      setBilgi(ad + " alındı.");
      coinTazele();
      await yukle();
    } catch (e) {
      setHata(coinHatasi(e));
    } finally {
      setAlinan(null);
    }
  };

  const kart = ({ anahtar, ad, fiyat, nadirlik, bende, gorsel, tur }) => {
    const etkinlik = fiyat === null || fiyat === undefined;
    return (
      <div key={anahtar} className={"bd-parca " + (bende ? "aktif " : "") + (NADIRLIK_SINIF[nadirlik] ?? "")}>
        <img src={gorsel} alt="" loading="lazy" />
        <span className="bd-parca-ad">{ad}</span>
        {bende ? (
          <span className="bd-parca-fiyat"><Ikon ad="onay" boyut={11} /> Sahipsin</span>
        ) : etkinlik ? (
          <span className="bd-parca-fiyat"><Ikon ad="kilit" boyut={11} /> Etkinlik ödülü</span>
        ) : (
          <button
            className="btn kucuk"
            disabled={alinan === anahtar}
            onClick={() => al(tur, anahtar, ad)}
          >
            {alinan === anahtar ? "…" : <><Ikon ad="coin" boyut={12} /> {Number(fiyat).toLocaleString("tr-TR")}</>}
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      {bilgi && <div className="bd-bilgi-kutu">{bilgi}</div>}

      <div className="kart bd-yuva-kart">
        <div className="bd-yuva-baslik"><span>Karakterler</span></div>
        <div className="bd-parca-grid">
          {(veri.karakterler ?? []).map((k) =>
            kart({
              anahtar: k.id, ad: k.ad, fiyat: k.coin_fiyat, nadirlik: k.nadirlik,
              bende: karSahip.includes(k.id), tur: "karakter",
              gorsel: avatarUri({ karakter: k.id }, "idle"),
            })
          )}
        </div>
      </div>

      {YUVALAR.map(({ yuva, ad }) => {
        const liste = (veri.parcalar ?? []).filter((p) => p.yuva === yuva);
        if (liste.length === 0) return null;
        return (
          <div className="kart bd-yuva-kart" key={yuva}>
            <div className="bd-yuva-baslik"><span>{ad}</span></div>
            <div className="bd-parca-grid">
              {liste.map((p) =>
                kart({
                  anahtar: p.kod, ad: p.ad, fiyat: p.coin_fiyat, nadirlik: p.nadirlik,
                  bende: parcaSahip.includes(p.kod), tur: "parca",
                  gorsel: avatarUri(
                    { karakter: temel.karakter, kozmetik: { ...temel.kozmetik, [yuva]: p.anahtar } },
                    "idle"
                  ),
                })
              )}
            </div>
          </div>
        );
      })}

      <Link className="btn ikincil" to={y("/gorunum")}>Görünümü düzenle</Link>
    </>
  );
}

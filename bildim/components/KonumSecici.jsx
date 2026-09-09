import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import { hataMesaji } from "../lib/hata.js";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import { bayrak, konumKilidiKalan, sureMetni } from "../lib/konum.js";

/**
 * Ülke + şehir seçimi.
 * mod = "modal": ilk girişte kapatılamayan zorunlu ekran (Home'dan açılır)
 * mod = "kart":  profil sayfasındaki düzenleme kartı
 * onKaydedildi: kayıt başarılı olunca çağrılır
 */
export default function KonumSecici({ mod = "kart", onKapat, onKaydedildi }) {
  const { profile, user, refreshProfile } = useAuth();
  const [ulkeler, setUlkeler] = useState([]);
  const [sehirler, setSehirler] = useState([]);
  const [ulke, setUlke] = useState(profile?.ulke ?? "TR");
  const [sehir, setSehir] = useState(profile?.sehir ?? "");
  const [hata, setHata] = useState(null);
  const [kaydediyor, setKaydediyor] = useState(false);

  const kalan = konumKilidiKalan(profile?.konum_degisti_at);
  const kilitli = mod === "kart" && kalan > 0;

  useEffect(() => {
    let aktif = true;
    const yukle = async () => {
      try {
        const { data, error } = await supabase
          .from("ulkeler")
          .select("kod, ad")
          .order("ad");
        if (error) throw error;
        if (aktif) setUlkeler(data ?? []);
      } catch (e) {
        if (aktif) setHata(hataMesaji(e, "Ülke listesi yüklenemedi."));
      }
    };
    yukle();
    return () => {
      aktif = false;
    };
  }, []);

  useEffect(() => {
    let aktif = true;
    const yukle = async () => {
      if (!ulke) return;
      try {
        const { data, error } = await supabase
          .from("sehirler")
          .select("ad")
          .eq("ulke", ulke)
          .order("ad");
        if (error) throw error;
        if (aktif) setSehirler(data ?? []);
      } catch (e) {
        if (aktif) setHata(hataMesaji(e, "Şehir listesi yüklenemedi."));
      }
    };
    yukle();
    return () => {
      aktif = false;
    };
  }, [ulke]);

  const serbestSehir = sehirler.length === 0;

  const kaydet = async () => {
    setHata(null);
    if (!ulke) {
      setHata("Ülke seçmelisin.");
      return;
    }
    if (!sehir.trim()) {
      setHata("Şehir seçmelisin.");
      return;
    }
    setKaydediyor(true);
    try {
      const { error } = await supabase.rpc("profil_konum_kaydet", {
        p_ulke: ulke,
        p_sehir: sehir.trim(),
      });
      if (error) throw error;
      await refreshProfile(user.id);
      onKaydedildi?.();
      onKapat?.();
    } catch (e) {
      setHata(hataMesaji(e, "Kaydedilemedi."));
    } finally {
      setKaydediyor(false);
    }
  };

  const govde = (
    <>
      <div className="bd-konum-baslik">
        {mod === "modal" ? "Hangi şehir için yarışıyorsun?" : "Şehrin ve ülken"}
      </div>
      <div className="bd-konum-aciklama">
        Şehir ve ülke liglerinde bu bilgiyle yarışırsın.{" "}
        <b>Haftada yalnızca bir kez değiştirebilirsin.</b>
      </div>

      <label className="bd-alan">
        <span>Ülke</span>
        <select
          value={ulke}
          disabled={kilitli}
          onChange={(e) => {
            setUlke(e.target.value);
            setSehir("");
          }}
        >
          {ulkeler.map((u) => (
            <option key={u.kod} value={u.kod}>
              {bayrak(u.kod)} {u.ad}
            </option>
          ))}
        </select>
      </label>

      <label className="bd-alan">
        <span>Şehir</span>
        {serbestSehir ? (
          <input
            type="text"
            placeholder="Şehrini yaz"
            maxLength={40}
            value={sehir}
            disabled={kilitli}
            onChange={(e) => setSehir(e.target.value)}
          />
        ) : (
          <select
            value={sehir}
            disabled={kilitli}
            onChange={(e) => setSehir(e.target.value)}
          >
            <option value="">— Seç —</option>
            {sehirler.map((s) => (
              <option key={s.ad} value={s.ad}>
                {s.ad}
              </option>
            ))}
          </select>
        )}
      </label>

      {kilitli && (
        <div className="bd-uyari">
          Konumunu tekrar değiştirebilmen için{" "}
          <b>{sureMetni(kalan)}</b> kaldı.
        </div>
      )}

      {hata && <div className="hata-kutu">{hata}</div>}

      <div className="bd-konum-butonlar">
        <button className="btn" disabled={kaydediyor || kilitli} onClick={kaydet}>
          {kaydediyor ? "Kaydediliyor…" : "Kaydet"}
        </button>
        {mod === "kart" && onKapat && (
          <button className="btn ikincil" onClick={onKapat}>
            Vazgeç
          </button>
        )}
      </div>
    </>
  );

  if (mod === "modal") {
    return (
      <Modal onKapat={onKapat} etiket="Şehir seçimi">
        <div className="bd-modal">{govde}</div>
      </Modal>
    );
  }
  return <div className="kart bd-konum-kart">{govde}</div>;
}

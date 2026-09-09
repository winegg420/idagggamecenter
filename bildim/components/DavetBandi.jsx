import { useCallback, useEffect, useState } from "react";
import { hataMesaji } from "../lib/hata.js";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Avatar from "../../src/components/Avatar.jsx";
import Ikon from "./Ikon.jsx";
import { kategoriEtiket } from "../lib/kategoriler.js";

const TUR_BILGI = {
  mac: { etiket: "sana meydan okudu", ikon: "kilic", sinif: "tur-mac", yol: "mac" },
  rovans: { etiket: "rövanş istiyor", ikon: "kilic", sinif: "tur-rovans", yol: "mac" },
  grup: { etiket: "grup maçına çağırdı", ikon: "kisiler", sinif: "tur-grup", yol: "grup-mac" },
  hizli: { etiket: "hızlı maça çağırdı", ikon: "hizli", sinif: "tur-hizli", yol: "hizli-mac" },
};

const CEVAP_RPC = {
  mac: ["respond_challenge", "p_match_id"],
  rovans: ["respond_challenge", "p_match_id"],
  grup: ["respond_group_challenge", "p_group_match_id"],
  hizli: ["respond_hizli_davet", "p_hizli_mac_id"],
};

/**
 * Üst davet bandı — üst çubuğun hemen altında, sayfa kaydırılsa da görünür.
 * Meydan okuma alt menüde küçük bir rozette kaybolmasın diye en üstte durur.
 */
export default function DavetBandi() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [davetler, setDavetler] = useState([]);
  const [islemde, setIslemde] = useState(false);
  const [hata, setHata] = useState(null);

  const yukle = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc("bekleyen_davetlerim");
      if (error) throw error;
      setDavetler(data ?? []);
    } catch {
      setDavetler([]); // RPC henüz uygulanmamış olabilir — bandı hiç gösterme
    }
  }, [user]);

  useEffect(() => {
    yukle();
    if (!user) return;
    const kanal = supabase
      .channel("davet-bandi")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `oyuncu2=eq.${user.id}` }, yukle)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_match_players", filter: `user_id=eq.${user.id}` }, yukle)
      .on("postgres_changes", { event: "*", schema: "public", table: "hizli_oyuncular", filter: `user_id=eq.${user.id}` }, yukle)
      .subscribe();
    return () => supabase.removeChannel(kanal);
  }, [user, yukle]);

  if (davetler.length === 0) return null;

  const d = davetler[0];
  const bilgi = TUR_BILGI[d.tur] ?? TUR_BILGI.mac;

  const cevapla = async (kabul) => {
    const [rpc, param] = CEVAP_RPC[d.tur] ?? CEVAP_RPC.mac;
    setIslemde(true);
    setHata(null);
    try {
      const { error } = await supabase.rpc(rpc, { [param]: d.kayit_id, p_kabul: kabul });
      if (error) throw error;
      setDavetler((l) => l.filter((x) => x.kayit_id !== d.kayit_id));
      if (kabul) navigate(`/bildim/${bilgi.yol}/${d.kayit_id}`);
    } catch (e) {
      setHata(hataMesaji(e, "İşlem başarısız"));
    } finally {
      setIslemde(false);
    }
  };

  return (
    <div className={`bd-davet-bandi ${bilgi.sinif}`} role="alert">
      <div className="bd-davet-parilti" aria-hidden="true" />

      <div className="bd-davet-govde">
        <div className="bd-davet-avatar">
          <Avatar
            profile={{ gorunen_ad: d.gorunen_ad, gorunen_avatar: d.gorunen_avatar }}
            boyut={40}
          />
          <span className="bd-davet-rozet" aria-hidden="true">
            <Ikon ad={bilgi.ikon} boyut={12} />
          </span>
        </div>

        <div className="bd-davet-metin">
          <div className="bd-davet-satir">
            <b>{d.gorunen_ad ?? "Bir oyuncu"}</b> {bilgi.etiket}!
          </div>
          <div className="bd-davet-alt">
            {d.kategori ? kategoriEtiket(d.kategori) : "Karışık"}
            {d.tur !== "mac" && d.tur !== "rovans" && d.kisi_sayisi
              ? ` · ${d.kisi_sayisi} kişi`
              : ""}
            {davetler.length > 1 ? ` · +${davetler.length - 1} davet daha` : ""}
          </div>
        </div>
      </div>

      <div className="bd-davet-eylem">
        <button
          className="bd-davet-btn kabul"
          disabled={islemde}
          onClick={() => cevapla(true)}
        >
          Kabul Et
        </button>
        <button
          className="bd-davet-btn ret"
          disabled={islemde}
          aria-label="Daveti reddet"
          onClick={() => cevapla(false)}
        >
          <Ikon ad="carpi" boyut={16} />
        </button>
      </div>

      {hata && <div className="bd-davet-hata">{hata}</div>}
    </div>
  );
}

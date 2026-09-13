// ============================================================
// GARDIROP VİTRİNİ — dükkânın "Kıyafet" sekmesi
//
// Eskiden burada 2B PatiRun karakter şeridi ve kozmetik kataloğu vardı
// (AvatarVitrin + GorunumDukkani). Tek karakter sistemine geçildi: artık
// oyuncunun 3B portresi ve 3B gardırop kataloğu görünür.
//
// Katalog `avatar3d_katalogum` RPC'sinden gelir — fiyatlar ve sahiplik
// sunucunun sözü. Satın alma ve giydirme GARDIROPTA yapılır; burası
// vitrin: ne var, neyin var, neyin peşindesin.
//
// Eski bileşenler silinmedi, yalnız bu sekmeden çıktılar.
// ============================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Ikon from "./Ikon.jsx";
import KarakterPortresi from "./KarakterPortresi.jsx";
import { hataMesaji } from "../lib/hata.js";
import { GARDROP_YOLU } from "../pages/GardropaGit.jsx";
// `.bd-gardrop-*` stilleri burada; dükkân sayfası gorunum.css'i kendiliğinden
// yüklemiyor, bu yüzden bileşen kendi stilini getiriyor.
import "../pages/gorunum.css";

const YUVA_ADLARI = {
  sac: "Saç", kiyafet: "Üst giyim", alt: "Alt giyim", ayakkabi: "Ayakkabı",
  bas: "Baş aksesuarı", gozluk: "Gözlük", sakal: "Sakal", pelerin: "Sırt",
};

export default function GardropVitrini() {
  const { profile } = useAuth();
  const [veri, setVeri] = useState(null);
  const [hata, setHata] = useState(null);

  const yukle = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("avatar3d_katalogum");
      if (error) throw error;
      const r = Array.isArray(data) ? data[0] : data;
      setVeri({
        parcalar: Array.isArray(r?.avatar3d_parcalar) ? r.avatar3d_parcalar : [],
        sahip: new Set(Array.isArray(r?.avatar3d_sahip) ? r.avatar3d_sahip : []),
        kurulmus: r?.avatar3d_gorunum != null,
        gorunum: r?.avatar3d_gorunum ?? null,
      });
    } catch (e) {
      setHata(hataMesaji(e, "Gardırop kataloğu yüklenemedi."));
    }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  if (hata) return <div className="hata-kutu">{hata}</div>;
  if (!veri) return <div className="kart"><div className="alt-yazi">Yükleniyor…</div></div>;

  const sahipSayisi = veri.parcalar.filter((p) => veri.sahip.has(p.id)).length;

  return (
    <>
      {/* ---- Şu anki görünüm ---- */}
      <div className="kart bd-gardrop-vitrin">
        <div className="bd-kat-baslik"><span>Şu anki karakterin</span></div>
        <div className="bd-gardrop-vitrin-ic">
          {/* Burada AVATAR FOTOĞRAFI DEĞİL, 3B karakterin kendisi gösterilir:
              bu sekme meydana girdiğin karakteri kurduğun yer. Listelerdeki
              avatar (Avatar.jsx) seçilen fotoğraf olmaya devam ediyor. */}
          <KarakterPortresi gorunum={veri.gorunum} boyut={96} />
          <div>
            <div className="bd-gardrop-vitrin-ad">{profile?.gorunen_ad ?? "Karakterin"}</div>
            <div className="alt-yazi">
              {veri.kurulmus
                ? `${sahipSayisi} / ${veri.parcalar.length} parça sende`
                : "Henüz karakterini kurmadın."}
            </div>
            <a className="btn" href={GARDROP_YOLU} style={{ marginTop: 10 }}>
              {veri.kurulmus ? "Gardıroba git" : "Karakterini oluştur"}
            </a>
          </div>
        </div>
      </div>

      {/* ---- Katalog ---- */}
      <div className="kart">
        <div className="bd-kat-baslik"><span>Gardırop</span></div>
        <div className="bd-gardrop-liste">
          {veri.parcalar.map((p) => {
            const sende = veri.sahip.has(p.id);
            const odul = p.coin_fiyat == null;
            return (
              <a
                key={p.id}
                className={"bd-gardrop-satir" + (sende ? " sende" : "") + (odul && !sende ? " odul" : "")}
                href={GARDROP_YOLU}
              >
                <span className="bd-gardrop-satir-ad">
                  {p.ad}
                  <small>{YUVA_ADLARI[p.yuva] ?? p.yuva}</small>
                </span>
                <span className="bd-gardrop-satir-fiyat">
                  {sende
                    ? "Sende"
                    : odul
                      ? <><Ikon ad="kilit" boyut={12} /> Turnuva ödülü</>
                      : <><Ikon ad="coin" boyut={12} /> {Number(p.coin_fiyat).toLocaleString("tr-TR")}</>}
                </span>
              </a>
            );
          })}
        </div>
        <div className="alt-yazi" style={{ marginTop: 10 }}>
          Parçalar gardıropta denenir ve satın alınır — orada karakterinin
          üstünde nasıl durduğunu görürsün.
        </div>
      </div>
    </>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Ikon from "./Ikon.jsx";

const TIP_IKON = {
  mac_daveti: "⚔️",
  rovans: "⚔️",
  grup_daveti: "👥",
  hizli_daveti: "⚡",
  lige_girdin: "🏙️",
  gecildin: "⚡",
  hafta_sonuc: "🏆",
  arkadas_istek: "🤝",
  arkadas_kabul: "🎉",
  seri_hatirlatma: "🔥",
};

// Davet bildirimleri listenin en üstüne çekilir.
const ONCELIKLI = new Set(["mac_daveti", "rovans", "grup_daveti", "hizli_daveti"]);
const oncelikSirala = (liste) =>
  [...liste].sort((a, b) => {
    const oa = ONCELIKLI.has(a.tip) && !a.okundu ? 0 : 1;
    const ob = ONCELIKLI.has(b.tip) && !b.okundu ? 0 : 1;
    if (oa !== ob) return oa - ob;
    return new Date(b.created_at) - new Date(a.created_at);
  });

function zamanMetni(iso) {
  const fark = Date.now() - new Date(iso).getTime();
  const dk = Math.floor(fark / 60000);
  if (dk < 1) return "az önce";
  if (dk < 60) return `${dk} dk önce`;
  const saat = Math.floor(dk / 60);
  if (saat < 24) return `${saat} saat önce`;
  return `${Math.floor(saat / 24)} gün önce`;
}

/** Üst çubuktaki bildirim zili: okunmamış sayısı + açılır liste. */
export default function BildirimZili() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [acik, setAcik] = useState(false);
  const [liste, setListe] = useState([]);
  const [okunmamis, setOkunmamis] = useState(0);

  const yukle = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("bildirimler")
        .select("id, tip, metin, yol, okundu, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      setListe(oncelikSirala(data ?? []));
      setOkunmamis((data ?? []).filter((b) => !b.okundu).length);
    } catch {
      /* tablo henüz yok (migration bekliyor) veya ağ hatası — sessiz geç */
    }
  }, [user]);

  useEffect(() => {
    yukle();
    if (!user) return;
    const kanal = supabase
      .channel("bildirimlerim")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bildirimler",
          filter: `user_id=eq.${user.id}`,
        },
        yukle
      )
      .subscribe();
    return () => supabase.removeChannel(kanal);
  }, [user, yukle]);

  const ac = async () => {
    const yeniDurum = !acik;
    setAcik(yeniDurum);
    if (yeniDurum && okunmamis > 0) {
      try {
        await supabase.rpc("bildirimleri_oku");
        setOkunmamis(0);
        setListe((l) => l.map((b) => ({ ...b, okundu: true })));
      } catch {
        /* sessiz geç */
      }
    }
  };

  return (
    <div className="bd-zil-sarmal">
      <button
        className="bd-zil"
        onClick={ac}
        aria-label={`Bildirimler${okunmamis > 0 ? `, ${okunmamis} okunmamış` : ""}`}
      >
        <Ikon ad="zil" boyut={19} />
        {okunmamis > 0 && <span className="bd-zil-rozet">{okunmamis > 9 ? "9+" : okunmamis}</span>}
      </button>

      {acik && (
        <>
          <div className="bd-zil-ortu" onClick={() => setAcik(false)} />
          <div className="bd-zil-liste" role="dialog" aria-label="Bildirimler">
            <div className="bd-zil-baslik">Bildirimler</div>
            {liste.length === 0 ? (
              <div className="bd-zil-bos">
                Henüz bildirim yok.<br />
                Maç davetleri, lig hareketleri ve arkadaşlık istekleri burada görünür.
              </div>
            ) : (
              liste.map((b) => (
                <button
                  key={b.id}
                  className="bd-zil-satir"
                  onClick={() => {
                    setAcik(false);
                    if (b.yol) navigate(b.yol);
                  }}
                >
                  <span className="ikon" aria-hidden="true">{TIP_IKON[b.tip] ?? "🔔"}</span>
                  <span className="govde">
                    <span className="metin">{b.metin}</span>
                    <span className="zaman">{zamanMetni(b.created_at)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// KAFA TOPU — skor tablosu ve lig görünümü.
// kafatopu_profiller puana göre listelenir; kullanıcı adları
// Bildim profiles tablosundan ayrıca çekilir (FK auth.users'a olduğu
// için otomatik join yoktur).

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../src/lib/supabase.js";
import { useKT } from "../KafaTopuApp.jsx";
import { LIGLER, ligBul } from "../../shared/ligler.js";

export default function SiralamaPage() {
  const { user } = useKT();
  const navigate = useNavigate();
  const [liste, setListe] = useState(null);

  useEffect(() => {
    let aktif = true;
    (async () => {
      try {
        const { data: profiller, error } = await supabase
          .from("kafatopu_profiller")
          .select("user_id, puan, mac_sayisi, galibiyet, beraberlik, maglubiyet, atilan_gol")
          .order("puan", { ascending: false })
          .limit(100);
        if (error) throw error;

        const idler = (profiller ?? []).map((p) => p.user_id);
        let adlar = {};
        if (idler.length) {
          const { data: profilListesi } = await supabase
            .from("profiles")
            .select("id, gorunen_ad")
            .in("id", idler);
          for (const p of profilListesi ?? []) adlar[p.id] = p.gorunen_ad;
        }
        if (aktif) {
          setListe(
            (profiller ?? []).map((p) => ({
              ...p,
              ad: adlar[p.user_id] ?? "Oyuncu",
            }))
          );
        }
      } catch (e) {
        console.error("KafaTopu sıralama hatası:", e);
        if (aktif) setListe([]);
      }
    })();
    return () => {
      aktif = false;
    };
  }, []);

  return (
    <div className="kt-sayfa">
      <h1 className="kt-baslik">📊 Sıralama</h1>

      <div className="kt-kart" style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
        {LIGLER.map((l) => (
          <span key={l.id} className="kt-lig-rozet" style={{ color: l.renk, fontSize: "0.78rem" }}>
            {l.ikon} {l.ad} {l.min}+
          </span>
        ))}
      </div>

      <div className="kt-kart">
        {liste === null && <div className="kt-alt-yazi">Yükleniyor…</div>}
        {liste?.length === 0 && (
          <div className="kt-alt-yazi">Henüz maç oynanmadı — ilk sen ol! ⚽</div>
        )}
        {liste?.map((p, i) => {
          const lig = ligBul(p.puan);
          return (
            <div key={p.user_id} className={`kt-sira-satir ${p.user_id === user.id ? "ben" : ""}`}>
              <span className="kt-sira-no">{i + 1}</span>
              <span style={{ color: lig.renk }}>{lig.ikon}</span>
              <span className="kt-sira-ad">
                {p.ad} {p.user_id === user.id && "(sen)"}
              </span>
              <span className="kt-istatistik">
                {p.galibiyet}G {p.beraberlik}B {p.maglubiyet}M
              </span>
              <span className="kt-sira-puan">{p.puan}</span>
            </div>
          );
        })}
      </div>

      <button className="kt-btn ikincil" onClick={() => navigate("/kafatopu")}>
        <span className="kt-btn-ikon">←</span>
        <span>Menüye dön</span>
      </button>
    </div>
  );
}

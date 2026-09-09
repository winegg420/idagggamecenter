import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Maskot from "./Maskot.jsx";
import { y } from "../lib/yol.js";

const ZAMAN_ASIMI_MS = 8000;

/**
 * Maç sayfalarının yükleme ekranı.
 *
 * NEDEN: "Hızlı Olan Kazanır" maçında sorgu RLS özyinelemesi yüzünden hata
 * veriyordu, sayfa da hatayı yutup sonsuza dek "Yükleniyor…" gösteriyordu
 * (konsolda bile iz yoktu). Artık 8 saniyede veri gelmezse kullanıcı Türkçe
 * bir açıklama, "Tekrar dene" ve "Maçı iptal et" görüyor.
 */
export default function MacYukleniyor({ hata, onTekrarDene, onIptal }) {
  const navigate = useNavigate();
  const [gecikti, setGecikti] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setGecikti(true), ZAMAN_ASIMI_MS);
    return () => window.clearTimeout(t);
  }, []);

  if (!gecikti && !hata) {
    return <div className="yukleniyor">Yükleniyor…</div>;
  }

  return (
    <div className="bd-hata-kart">
      <Maskot poz="dusunuyor" boyut={78} />
      <div className="bd-hata-baslik">Maç açılamadı</div>
      <div className="bd-hata-metin">
        {hata
          ? hata
          : "Maç bilgisi gelmedi. Bağlantın kesilmiş olabilir ya da maç artık geçerli değil."}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {onTekrarDene && (
          <button
            className="btn"
            onClick={() => {
              setGecikti(false);
              onTekrarDene();
            }}
          >
            Tekrar dene
          </button>
        )}
        {onIptal && (
          <button className="btn ikincil" onClick={onIptal}>
            Maçı iptal et
          </button>
        )}
        <button className="btn ikincil" onClick={() => navigate(y("/meydan"))}>
          Meydan okumalara dön
        </button>
      </div>
    </div>
  );
}

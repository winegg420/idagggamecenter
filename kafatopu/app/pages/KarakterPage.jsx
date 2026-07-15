// KAFA TOPU — karakter/kafa seçimi.
// Roster: 5 kurgusal karakter + /heads/manifest.json'dan gelen foto kafalar.
// Foto kafa seçilirse yetenek ayrıca seçilir; kurgusalın yeteneği sabittir.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../src/lib/supabase.js";
import { useKT } from "../KafaTopuApp.jsx";
import {
  tumRoster, fotoKafalariYukle, kafaBul, YETENEKLER,
} from "../../shared/karakterler.js";
import { oyuncuCiz } from "../../engine/kafaCizim.js";

function KafaOnizleme({ kafaId, takim = 1 }) {
  const ref = useRef(null);
  useEffect(() => {
    let aktif = true;
    const ciz = () => {
      const c = ref.current;
      if (!c || !aktif) return;
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.save();
      ctx.scale(c.width / 130, c.height / 170);
      oyuncuCiz(
        ctx,
        { x: 65, y: 62, vx: 0, vy: 0, va: -9999, ol: 1, ef: 0 },
        { takim, kafaKaydi: kafaBul(kafaId) },
        0
      );
      ctx.restore();
    };
    ciz();
    // Foto görselleri sonradan yüklenebilir; kısa süre yeniden çiz.
    const zamanlayici = setInterval(ciz, 600);
    setTimeout(() => clearInterval(zamanlayici), 3000);
    return () => {
      aktif = false;
      clearInterval(zamanlayici);
    };
  }, [kafaId, takim]);
  return <canvas ref={ref} width={130} height={170} />;
}

export default function KarakterPage() {
  const { profil, setProfil } = useKT();
  const navigate = useNavigate();
  const [roster, setRoster] = useState(tumRoster());
  const [secili, setSecili] = useState(profil?.kafa ?? "volkan");
  const [yetenek, setYetenek] = useState(profil?.yetenek ?? "ates_sutu");
  const [kaydediyor, setKaydediyor] = useState(false);
  const [mesaj, setMesaj] = useState("");

  useEffect(() => {
    fotoKafalariYukle().then(() => setRoster(tumRoster())).catch(() => {});
  }, []);

  useEffect(() => {
    if (profil) {
      setSecili(profil.kafa);
      setYetenek(profil.yetenek);
    }
  }, [profil]);

  const seciliKayit = kafaBul(secili);
  // Kurgusal karakterin yeteneği sabittir.
  const etkinYetenek = seciliKayit.foto ? yetenek : seciliKayit.yetenek;

  const kaydet = async () => {
    setKaydediyor(true);
    setMesaj("");
    try {
      const { data, error } = await supabase.rpc("kafatopu_profil_kaydet", {
        p_kafa: secili,
        p_yetenek: etkinYetenek,
      });
      if (error) throw error;
      setProfil(data);
      setMesaj("Kaydedildi ✓");
    } catch (e) {
      console.error("KafaTopu karakter kaydı hatası:", e);
      setMesaj("Kaydedilemedi, tekrar dene.");
    } finally {
      setKaydediyor(false);
    }
  };

  return (
    <div className="kt-sayfa">
      <h1 className="kt-baslik">🧑‍🎤 Karakter</h1>
      <div className="kt-alt-yazi">
        Tüm roster baştan açık — kilit yok. Foto kafalar /heads/ klasöründen gelir.
      </div>

      <div className="kt-roster">
        {roster.map((k) => (
          <div
            key={k.id}
            className={`kt-roster-item ${secili === k.id ? "secili" : ""}`}
            onClick={() => setSecili(k.id)}
          >
            <KafaOnizleme kafaId={k.id} />
            <div className="kt-roster-ad">{k.ad}</div>
            <div className="kt-roster-yetenek">
              {k.foto
                ? "📷 Foto kafa"
                : `${YETENEKLER[k.yetenek].ikon} ${YETENEKLER[k.yetenek].ad}`}
            </div>
          </div>
        ))}
      </div>

      <div className="kt-kart" style={{ marginTop: 16 }}>
        <b>Özel yetenek</b>
        <div className="kt-alt-yazi" style={{ marginBottom: 10 }}>
          {seciliKayit.foto
            ? "Foto kafalar istediği yeteneği seçebilir:"
            : "Kurgusal karakterlerin yeteneği kendine özeldir:"}
        </div>
        <div className="kt-yetenek-secim">
          {Object.entries(YETENEKLER).map(([id, y]) => (
            <div
              key={id}
              className={`kt-yetenek-item ${etkinYetenek === id ? "secili" : ""}`}
              style={{ opacity: seciliKayit.foto || etkinYetenek === id ? 1 : 0.4 }}
              onClick={() => seciliKayit.foto && setYetenek(id)}
            >
              <span className="ikon">{y.ikon}</span>
              <span>
                <b>{y.ad}</b>
                <div className="aciklama">{y.aciklama}</div>
              </span>
            </div>
          ))}
        </div>
      </div>

      <button className="kt-btn" onClick={kaydet} disabled={kaydediyor}>
        <span className="kt-btn-ikon">💾</span>
        <span>{kaydediyor ? "Kaydediliyor…" : "Kaydet"}</span>
      </button>
      {mesaj && <div className="kt-alt-yazi">{mesaj}</div>}
      <button className="kt-btn ikincil" onClick={() => navigate("/kafatopu")}>
        <span className="kt-btn-ikon">←</span>
        <span>Menüye dön</span>
      </button>
    </div>
  );
}

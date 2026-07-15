// KAFA TOPU — eşleştirme kuyruğu.
// kafatopu_mac_bul RPC'si birkaç saniyede bir çağrılır (poll):
// eşleşme kurulunca maç id döner ve maç ekranına geçilir.
// Hızlı 1v1'de 15 sn sonra bota karşı oynama seçeneği açılır.

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../../src/lib/supabase.js";

const POLL_MS = 3000;

export default function KuyrukPage() {
  const { mod, tur } = useParams();
  const navigate = useNavigate();
  const [saniye, setSaniye] = useState(0);
  const [hata, setHata] = useState("");
  const eslesti = useRef(false);

  useEffect(() => {
    if (!["1v1", "2v2"].includes(mod) || !["ranked", "hizli"].includes(tur)) {
      navigate("/kafatopu", { replace: true });
      return;
    }
    let aktif = true;

    const dene = async () => {
      if (!aktif || eslesti.current) return;
      try {
        const { data, error } = await supabase.rpc("kafatopu_mac_bul", {
          p_mod: mod,
          p_tur: tur,
        });
        if (error) throw error;
        if (data && aktif) {
          eslesti.current = true;
          navigate(`/kafatopu/mac/${data}`, { replace: true });
        }
      } catch (e) {
        console.error("KafaTopu eşleşme hatası:", e);
        if (aktif) setHata("Eşleşme sunucusuna ulaşılamadı, yeniden deneniyor…");
      }
    };

    dene();
    const poll = setInterval(dene, POLL_MS);
    const sayac = setInterval(() => aktif && setSaniye((s) => s + 1), 1000);

    return () => {
      aktif = false;
      clearInterval(poll);
      clearInterval(sayac);
      // Maça gitmiyorsak kuyruktan çık.
      if (!eslesti.current) {
        supabase.rpc("kafatopu_kuyruktan_cik").then(
          () => {},
          (e) => console.error("KafaTopu kuyruktan çıkış hatası:", e)
        );
      }
    };
  }, [mod, tur, navigate]);

  const gereken = mod === "2v2" ? "3 rakip/takım arkadaşı" : "1 rakip";

  return (
    <div className="kt-sayfa kt-kuyruk-orta">
      <h1 className="kt-baslik">
        {tur === "ranked" ? "🏆 Ranked" : "⚡ Hızlı Maç"} {mod}
      </h1>
      <div className="kt-spinner" />
      <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>
        Rakip aranıyor… {Math.floor(saniye / 60)}:{String(saniye % 60).padStart(2, "0")}
      </div>
      <div className="kt-alt-yazi" style={{ marginTop: 6 }}>
        {gereken} bekleniyor.{" "}
        {tur === "ranked" ? "Puanı sana yakın oyuncular öncelikli." : "İlk gelen eşleşir."}
      </div>
      {hata && <div className="kt-alt-yazi" style={{ color: "#ffb3a8" }}>{hata}</div>}

      {saniye >= 15 && (
        <button
          className="kt-btn antrenman"
          style={{ maxWidth: 340, margin: "18px auto 0" }}
          onClick={() => navigate(`/kafatopu/mac/bot?mod=${mod}`, { replace: true })}
        >
          <span className="kt-btn-ikon">🤖</span>
          <span>
            Beklemek yok — Bota karşı oyna
            <span className="kt-btn-detay">Puan etkilenmez</span>
          </span>
        </button>
      )}

      <button
        className="kt-btn ikincil"
        style={{ maxWidth: 340, margin: "14px auto 0" }}
        onClick={() => navigate("/kafatopu")}
      >
        <span className="kt-btn-ikon">✕</span>
        <span>Vazgeç</span>
      </button>
    </div>
  );
}

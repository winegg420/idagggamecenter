import { useState } from "react";
import { supabase } from "../../src/lib/supabase.js";
import { hataMesaji } from "../lib/hata.js";
import { tt } from "../lib/dil.js";

/**
 * Paket 20 II.1 — "Soruyu bildir". Mevcut vote_question (adil=false + sebep) kullanılır.
 * Yeterli sayıda gerçek oyuncu bildirirse soru sunucuda karantinaya alınır (oyun_ayarlari.soru_bildirim_esigi).
 */
export const SEBEPLER = [
  ["cevap_yanlis", "Cevap yanlış"],
  ["anlasilmiyor", "Soru anlaşılmıyor"],
  ["birden_fazla_dogru", "Birden fazla doğru şık"],
  ["yazim_hatasi", "Yazım hatası"],
  ["guncel_degil", "Güncelliğini yitirmiş"],
];

export default function SoruBildir({ questionId, bildirildi = false }) {
  const [acik, setAcik] = useState(false);
  const [gonderildi, setGonderildi] = useState(bildirildi);
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState(null);

  if (!questionId) return null;
  if (gonderildi) return <div className="bd-bildir-tamam">{tt("Bildirildi — teşekkürler, inceleyeceğiz.")}</div>;

  const gonder = async (sebep) => {
    setCalisiyor(true);
    setHata(null);
    try {
      const { error } = await supabase.rpc("vote_question", { p_question_id: questionId, p_adil: false, p_sebep: sebep });
      if (error) throw error;
      setGonderildi(true);
    } catch (e) {
      console.error("[Bildim] soru bildirilemedi:", e);
      setHata(hataMesaji(e, tt("Bildirim gönderilemedi. Tekrar dene.")));
    } finally {
      setCalisiyor(false);
    }
  };

  return (
    <div className="bd-bildir">
      {!acik ? (
        <button type="button" className="bd-bildir-ac" onClick={() => setAcik(true)}>
          {tt("Soruyu bildir")}
        </button>
      ) : (
        <div className="bd-bildir-sebepler" role="group" aria-label={tt("Neden bildiriyorsun?")}>
          <span className="bd-bildir-soru">{tt("Neden bildiriyorsun?")}</span>
          {SEBEPLER.map(([k, ad]) => (
            <button key={k} type="button" className="bd-bildir-sebep" disabled={calisiyor} onClick={() => gonder(k)}>
              {tt(ad)}
            </button>
          ))}
          <button type="button" className="bd-bildir-vazgec" disabled={calisiyor} onClick={() => setAcik(false)}>
            {tt("Vazgeç")}
          </button>
        </div>
      )}
      {hata && <div className="hata-kutu" style={{ marginTop: 6 }}>{hata}</div>}
    </div>
  );
}

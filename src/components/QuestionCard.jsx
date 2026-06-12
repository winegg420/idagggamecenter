import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { kalanSure } from "../lib/zaman.js";

const HARFLER = ["A", "B", "C", "D"];
const SURE = 15;

/**
 * Ortak soru ekranı (turnuva + 1v1).
 * soru: { question_id, soru, secenekler, soru_index, baslangic, sunucu_zamani }
 * onCevapla(cevapIndex) -> { dogru, dogru_cevap } döndüren async fonksiyon
 * onSureDoldu() -> süre bitince çağrılır (advance tetikler)
 */
export default function QuestionCard({ soru, onCevapla, onSureDoldu }) {
  const [kalan, setKalan] = useState(SURE);
  const [secim, setSecim] = useState(null);
  const [sonuc, setSonuc] = useState(null); // { dogru, dogru_cevap }
  const [oy, setOy] = useState(null);
  const sureDolduMu = useRef(false);

  // Yeni soru geldiğinde durumu sıfırla
  useEffect(() => {
    setSecim(null);
    setSonuc(null);
    setOy(null);
    sureDolduMu.current = false;
  }, [soru?.question_id, soru?.soru_index]);

  useEffect(() => {
    if (!soru) return;
    const id = setInterval(() => {
      const k = kalanSure(soru.baslangic, soru.sunucu_zamani, SURE);
      setKalan(k);
      if (k <= 0 && !sureDolduMu.current) {
        sureDolduMu.current = true;
        clearInterval(id);
        onSureDoldu?.();
      }
    }, 100);
    return () => clearInterval(id);
  }, [soru, onSureDoldu]);

  if (!soru) return null;

  const cevapla = async (i) => {
    if (secim !== null || kalan <= 0) return;
    setSecim(i);
    try {
      const r = await onCevapla(i);
      if (r) setSonuc(r);
    } catch {
      // süre dolmuş olabilir; sonuç ekranı advance ile gelir
    }
  };

  const oyVer = async (adil) => {
    setOy(adil);
    await supabase.rpc("vote_question", {
      p_question_id: soru.question_id,
      p_adil: adil,
    });
  };

  const secenekler = Array.isArray(soru.secenekler)
    ? soru.secenekler
    : JSON.parse(soru.secenekler);

  return (
    <div>
      <div className="soru-sayac">
        <div className="dolgu" style={{ width: `${(kalan / SURE) * 100}%` }} />
      </div>
      <div className="alt-yazi" style={{ marginBottom: 8 }}>
        Soru {soru.soru_index + 1} · {Math.ceil(kalan)} sn
      </div>
      <div className="soru-metin">{soru.soru}</div>
      <div className="secenekler">
        {secenekler.map((s, i) => {
          let sinif = "secenek";
          if (sonuc) {
            if (i === sonuc.dogru_cevap) sinif += " dogru";
            else if (i === secim) sinif += " yanlis";
          } else if (i === secim) {
            sinif += " secili";
          }
          return (
            <button
              key={i}
              className={sinif}
              disabled={secim !== null || kalan <= 0}
              onClick={() => cevapla(i)}
            >
              <span className="harf">{HARFLER[i]}</span>
              {s}
            </button>
          );
        })}
      </div>

      {sonuc && (
        <div className="adil-oylama">
          <span>Bu soru adil miydi?</span>
          <button className={oy === true ? "secildi" : ""} onClick={() => oyVer(true)}>
            👍
          </button>
          <button className={oy === false ? "secildi" : ""} onClick={() => oyVer(false)}>
            👎
          </button>
        </div>
      )}
    </div>
  );
}

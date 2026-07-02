import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { kalanSure, sunucuOffsetMs } from "../lib/zaman.js";

const HARFLER = ["A", "B", "C", "D"];
const SURE = 15;

/**
 * Ortak soru ekranı (turnuva + 1v1).
 * soru: { question_id, soru, secenekler, soru_index, baslangic, sunucu_zamani, dogru_cevap? }
 * dogru_cevap yalnızca yetkili hesaplarda dolu gelir; herhangi bir şık 3 sn basılı
 * tutulursa doğru cevap otomatik seçilir.
 * onCevapla(cevapIndex) -> { dogru, dogru_cevap } döndüren async fonksiyon
 * onSureDoldu() -> süre bitince çağrılır (advance tetikler)
 */
export default function QuestionCard({ soru, onCevapla, onSureDoldu, jokerler }) {
  const [kalan, setKalan] = useState(SURE);
  const [secim, setSecim] = useState(null);
  const [sonuc, setSonuc] = useState(null); // { dogru, dogru_cevap }
  const [oy, setOy] = useState(null);
  const [kapali, setKapali] = useState([]); // 50:50 ile elenen şıklar
  const sureDolduMu = useRef(false);
  const basiliTutTimer = useRef(null);

  // Yeni soru geldiğinde durumu sıfırla
  useEffect(() => {
    setSecim(null);
    setSonuc(null);
    setOy(null);
    setKapali([]);
    sureDolduMu.current = false;
    clearTimeout(basiliTutTimer.current);
  }, [soru?.question_id, soru?.soru_index]);

  useEffect(() => () => clearTimeout(basiliTutTimer.current), []);

  useEffect(() => {
    if (!soru) return;
    // Saat farkını soru geldiği anda bir kez sabitle; tik başına yeniden
    // hesaplanırsa sayaç donar.
    const offset = sunucuOffsetMs(soru.sunucu_zamani);
    let id;
    const tik = () => {
      const k = kalanSure(soru.baslangic, offset, SURE);
      setKalan(k);
      if (k <= 0 && !sureDolduMu.current) {
        sureDolduMu.current = true;
        clearInterval(id);
        onSureDoldu?.();
      }
    };
    tik();
    if (!sureDolduMu.current) id = setInterval(tik, 100);
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

  const basiliTutmayaBasla = () => {
    if (soru.dogru_cevap == null || secim !== null || kalan <= 0) return;
    clearTimeout(basiliTutTimer.current);
    basiliTutTimer.current = setTimeout(() => cevapla(soru.dogru_cevap), 3000);
  };
  const basiliTutmayiBirak = () => clearTimeout(basiliTutTimer.current);

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
        <div className="dolgu" style={{ width: `${Math.min(100, (kalan / SURE) * 100)}%` }} />
      </div>
      <div className="alt-yazi" style={{ marginBottom: 8 }}>
        Soru {soru.soru_index + 1} · {Math.ceil(kalan)} sn
      </div>
      <div className="soru-metin">{soru.soru}</div>
      <div className="secenekler">
        {secenekler.map((s, i) => {
          const elendi = kapali.includes(i);
          let sinif = "secenek";
          if (sonuc) {
            if (i === sonuc.dogru_cevap) sinif += " dogru";
            else if (i === secim) sinif += " yanlis";
          } else if (i === secim) {
            sinif += " secili";
          }
          if (elendi) sinif += " elendi";
          return (
            <button
              key={i}
              className={sinif}
              disabled={secim !== null || kalan <= 0 || elendi}
              onClick={() => cevapla(i)}
              onPointerDown={basiliTutmayaBasla}
              onPointerUp={basiliTutmayiBirak}
              onPointerLeave={basiliTutmayiBirak}
              onPointerCancel={basiliTutmayiBirak}
            >
              <span className="harf">{HARFLER[i]}</span>
              {s}
            </button>
          );
        })}
      </div>

      {jokerler && !sonuc && secim === null && kalan > 0 && (
        <div className="joker-bar">
          <button
            disabled={jokerler.kullanildi.elli || kapali.length > 0}
            onClick={async () => {
              const r = await jokerler.onKullan("elli");
              if (r?.kapali) setKapali(r.kapali);
            }}
          >
            ⚖️ 50:50 <span className="bedel">Ücretsiz</span>
          </button>
          <button
            disabled={jokerler.kullanildi.sure}
            onClick={() => jokerler.onKullan("sure")}
          >
            ⏱️ +10 sn <span className="bedel">20⭐</span>
          </button>
        </div>
      )}

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

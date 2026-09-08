import { useEffect, useRef, useState } from "react";
import { supabase } from "../../src/lib/supabase.js";
import { kalanSure, sunucuOffsetMs } from "../lib/zaman.js";
import JokerCubugu from "./JokerCubugu.jsx";

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
export default function QuestionCard({
  soru,
  onCevapla,
  onSureDoldu,
  jokerler,
  // Yeni joker ekonomisi: macTur + macId verilirse sunucu tabanlı çubuk çizilir.
  macTur,
  macId,
  onPas,
}) {
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

  // Sunucudan gelen joker etkisini uygula
  const jokerEtkisi = (sonuc) => {
    if (!sonuc) return;
    if (sonuc.tur === "elli" && Array.isArray(sonuc.kapali)) {
      setKapali(sonuc.kapali);
    } else if (sonuc.tur === "pas") {
      setSecim(-1);
      setSonuc({ dogru: false, dogru_cevap: sonuc.dogru_cevap });
      onPas?.(sonuc);
    }
    // 'sure' etkisi sunucuda soru_baslangic'ı uzatır; sayaç bir sonraki
    // yoklamada kendiliğinden güncellenir.
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

  const oran = Math.max(0, Math.min(1, kalan / SURE));
  const CEVRE = 2 * Math.PI * 20; // r=20 halka çevresi
  const halkaRenk = kalan <= 5 ? "var(--danger)" : kalan <= 9 ? "var(--accent)" : "var(--primary)";

  return (
    <div className="bd-soru">
      {/* Üst şerit: soru numarası + kalan süre halkası + ilerleme çubuğu */}
      <div className="bd-soru-ust">
        <div className="bd-soru-no">Soru {soru.soru_index + 1}</div>
        <div className="bd-sure-halka" aria-label={`${Math.ceil(kalan)} saniye kaldı`}>
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <circle className="iz" cx="24" cy="24" r="20" />
            <circle
              className="dolgu"
              cx="24"
              cy="24"
              r="20"
              stroke={halkaRenk}
              strokeDasharray={CEVRE}
              strokeDashoffset={CEVRE * (1 - oran)}
            />
          </svg>
          <span className={`bd-sure-sayi ${kalan <= 5 ? "kritik" : ""}`}>
            {Math.ceil(kalan)}
          </span>
        </div>
      </div>
      <div className="bd-soru-bar">
        <div
          className="dolgu"
          style={{ width: `${oran * 100}%`, background: halkaRenk }}
        />
      </div>

      <div className="bd-soru-metin">{soru.soru}</div>

      <div className="bd-secenekler">
        {secenekler.map((s, i) => {
          const elendi = kapali.includes(i);
          let sinif = "bd-secenek";
          if (sonuc) {
            if (i === sonuc.dogru_cevap) sinif += " dogru";
            else if (i === secim) sinif += " yanlis";
            else sinif += " solgun";
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
              <span className="bd-harf">{HARFLER[i]}</span>
              <span className="bd-secenek-metin">{s}</span>
              {sonuc && i === sonuc.dogru_cevap && <span className="bd-isaret">✓</span>}
              {sonuc && i === secim && i !== sonuc.dogru_cevap && (
                <span className="bd-isaret">✕</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Yeni joker ekonomisi (sunucu tabanlı) */}
      {macTur && macId && !sonuc && secim === null && kalan > 0 && (
        <JokerCubugu
          macTur={macTur}
          macId={macId}
          soruIndex={soru.soru_index}
          onEtki={jokerEtkisi}
        />
      )}

      {/* Eski joker çubuğu — yalnız macTur verilmeyen ekranlarda (geriye uyum) */}
      {!macTur && jokerler && !sonuc && secim === null && kalan > 0 && (
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

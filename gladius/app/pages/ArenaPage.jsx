// ============================================================
// Arena sayfası (Faz motor v1 + dövüş + round sonu): Canvas 2D motoru barındırır.
// YEREL ANTRENMAN — çevrimdışı, oyuncu + botlar, tam bir round (son ayakta kalan).
// Online eşleşme (Faz 7), tehditler (Faz 6) sonraki fazlarda bağlanacak.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../lib/host.js";
import { MOD_ADLARI } from "../../shared/sabitler.js";
import { secimAl } from "../../lib/secim.js";
import { macBitir } from "../../lib/istatistik.js";
import { HAZIR_SURE } from "../../shared/denge.js";
import { Motor } from "../../engine/motor.js";
import * as ses from "../../engine/ses.js";

export default function ArenaPage() {
  const { mod } = useParams();
  const { profile } = useAuth() || {};
  const canvasRef = useRef(null);
  const motorRef = useRef(null);
  const [sonuc, setSonuc] = useState(null);   // { kazanan } | null
  const [tur, setTur] = useState(0);          // "Tekrar Oyna" için motoru yeniden kurar
  const [intro, setIntro] = useState(true);   // maç öncesi tema metni

  useEffect(() => {
    setIntro(true);
    const zt = setTimeout(() => setIntro(false), HAZIR_SURE * 1000);
    return () => clearTimeout(zt);
  }, [tur]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let motor;
    try {
      motor = new Motor(canvas, {
        mod,
        oyuncuAd: profile?.username || "Sen",
        secim: secimAl(),
        onBitti: (kazanan) => {
          // Yerel oyuncunun ("ben") round istatistiklerinden rozet/lig/puan hesapla.
          let ozet = null;
          let roundEleme = 0;
          let roundHayatta = 0;
          try {
            const d = motorRef.current?.durum;
            const ben = d?.oyuncular.find((o) => o.id === "ben");
            if (d && ben) {
              const oluler = d.oyuncular.filter((o) => o.can <= 0 && o.olumSira !== undefined);
              const sonOlenSira = oluler.reduce((m, o) => Math.max(m, o.olumSira), 0);
              const sonNefes = ben.can <= 0 && ben.olumSira === sonOlenSira && !!kazanan && kazanan.id !== "ben";
              roundEleme = ben.eleme || 0;
              roundHayatta = Math.round(ben.can > 0 ? d.zaman : (ben.olumZaman || 0));
              ozet = macBitir({
                kazandi: kazanan?.id === "ben",
                eleme: roundEleme,
                aslanEleme: ben.aslanEleme || 0,
                ilkKan: d.ilkKanId === "ben",
                sonNefes,
                hayattaSure: roundHayatta,
              });
            }
          } catch (err) {
            console.error("[Gladius] istatistik hesabı hatası:", err);
          }
          setSonuc({ kazanan, ozet, roundEleme, roundHayatta });
        },
      });
      motor.basla();
      motorRef.current = motor;
    } catch (err) {
      console.error("[Gladius] motor başlatılamadı:", err);
    }

    return () => {
      try {
        motor?.dur();
      } catch (err) {
        console.error("[Gladius] motor durdurma hatası:", err);
      }
      motorRef.current = null;
    };
  }, [mod, profile?.username, tur]);

  const modAd = MOD_ADLARI[mod] || "Arena";

  const saldir = () => motorRef.current?.girdi.dokunSaldiri();
  const kalkanBasla = () => motorRef.current?.girdi.dokunKalkan(true);
  const kalkanBirak = () => motorRef.current?.girdi.dokunKalkan(false);

  const tekrar = () => {
    setSonuc(null);
    setTur((t) => t + 1);
  };

  return (
    <div
      className="gl-arena"
      onPointerDown={() => ses.devamEt()}
      onKeyDown={() => ses.devamEt()}
    >
      <canvas ref={canvasRef} className="gl-arena-canvas" />

      <div className="gl-arena-ust">
        <Link to="/gladius/oyna" className="gl-arena-geri">← Mod</Link>
        <span className="gl-arena-mod">{modAd}</span>
        <span className="gl-arena-rozet">Yerel antrenman · çevrimdışı</span>
      </div>

      {intro && !sonuc && (
        <div className="gl-arena-intro">
          <div className="gl-intro-metin">
            <p className="gl-intro-satir1">Roma'dasın.</p>
            <p className="gl-intro-satir2">Arenada yalnızca biri sağ çıkar.</p>
            <p className="gl-intro-hazir">HAZIR OL</p>
          </div>
        </div>
      )}

      {!sonuc && (
        <>
          <div className="gl-arena-ipucu">
            Hareket <b>WASD/oklar</b> · Saldır <b>J/Boşluk</b> · Kalkan <b>K/Shift</b> (basılı tut)
            <span className="gl-arena-not">Dokunmatik: sürükle = hareket · sağ alttaki butonlar</span>
          </div>

          <div className="gl-arena-butonlar">
            <button
              className="gl-aksiyon gl-aksiyon-kalkan"
              onPointerDown={(e) => { e.preventDefault(); kalkanBasla(); }}
              onPointerUp={kalkanBirak}
              onPointerLeave={kalkanBirak}
              onPointerCancel={kalkanBirak}
            >
              🛡️
            </button>
            <button
              className="gl-aksiyon gl-aksiyon-saldiri"
              onPointerDown={(e) => { e.preventDefault(); saldir(); }}
            >
              ⚔️
            </button>
          </div>
        </>
      )}

      {sonuc && (
        <div className="gl-sonuc">
          <div className="gl-sonuc-kart">
            <h2 className="gl-sonuc-baslik">
              {sonuc.kazanan
                ? (sonuc.kazanan.id === "ben" ? "Kazandın!" : `${sonuc.kazanan.ad} kazandı`)
                : "Kazanan yok"}
            </h2>
            <p className="gl-sonuc-alt">
              {sonuc.kazanan
                ? "Arenadan sağ çıkan son gladyatör."
                : "Herkes aynı anda düştü."}
            </p>

            {sonuc.ozet && (
              <div className="gl-ozet">
                <div className="gl-ozet-satirlar">
                  <div className="gl-ozet-satir"><span>Eleme</span><b>{sonuc.roundEleme}</b></div>
                  <div className="gl-ozet-satir"><span>Hayatta</span><b>{sonuc.roundHayatta}s</b></div>
                </div>
                <div className="gl-ozet-lig">
                  <span className="gl-lig-rozet">{sonuc.ozet.lig.ad}</span>
                  <span className="gl-ozet-puan">+{sonuc.ozet.kazanilanPuan} puan · toplam {sonuc.ozet.puan}</span>
                  {sonuc.ozet.ligAtladi && <span className="gl-lig-atladi">⬆ Lig atladın!</span>}
                </div>
                {sonuc.ozet.rozetler.length > 0 && (
                  <div className="gl-rozetler">
                    {sonuc.ozet.rozetler.map((rz) => (
                      <span key={rz.id} className="gl-rozet" title={rz.aciklama}>🏅 {rz.ad}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="gl-sonuc-butonlar">
              <button className="gl-btn gl-btn-vurgu" onClick={tekrar}>Tekrar Oyna</button>
              <Link to="/gladius" className="gl-btn">Menü</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

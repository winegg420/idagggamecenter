// ============================================================
// Karakter Seçim & Kişiselleştirme (tasarım 3.2.1).
// Karakter + saldırı silahı + kalkan seçimi, canlı kuş-bakışı önizleme.
// Seçim localStorage'a kaydedilir (Faz 1 sonrası buluta senkron edilecek).
// Kozmetik alt kategorileri (miğfer, amblem, zırh rengi...) sonraki iterasyonda.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { GLADYATORLER, karakterBul } from "../../shared/karakterler.js";
import { SILAHLAR, KALKANLAR, silahKategoriBul, silahCizimTipi, kalkanCizimTipi } from "../../shared/itemler.js";
import { secimAl, secimKaydet } from "../../lib/secim.js";
import { cizGladyator } from "../../engine/karakterCizim.js";

export default function CharacterPage() {
  const [secim, setSecim] = useState(() => secimAl());
  const [kaydedildi, setKaydedildi] = useState(false);
  const canvasRef = useRef(null);
  const secimRef = useRef(secim);
  secimRef.current = secim;

  // Canlı önizleme: yavaşça dönen kuş-bakışı gladyatör.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const boyut = 220;
    canvas.width = boyut * dpr;
    canvas.height = boyut * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf;
    let aci = Math.PI / 2;
    const ciz = () => {
      const s = secimRef.current;
      const kar = karakterBul(s.karakter);
      ctx.clearRect(0, 0, boyut, boyut);
      // zemin dairesi
      const g = ctx.createRadialGradient(boyut / 2, boyut / 2, 0, boyut / 2, boyut / 2, boyut / 2);
      g.addColorStop(0, "#c19a56");
      g.addColorStop(1, "#7a5c30");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(boyut / 2, boyut / 2, boyut / 2 - 6, 0, Math.PI * 2);
      ctx.fill();

      aci += 0.012;
      const e = {
        aci,
        karakterId: s.karakter,
        palet: kar.palet,
        silahCizim: silahCizimTipi(s.silah, s.silahVaryant),
        kalkanCizim: kalkanCizimTipi(s.kalkanVaryant),
        kalkanRenk: kar.palet.zirh,
        silahAktif: true,
        kalkanAktif: true,
      };
      cizGladyator(ctx, boyut / 2, boyut / 2, 40, e, false);
      raf = requestAnimationFrame(ciz);
    };
    ciz();
    return () => cancelAnimationFrame(raf);
  }, []);

  const guncelle = (yeni) => {
    setSecim((s) => ({ ...s, ...yeni }));
    setKaydedildi(false);
  };

  const silahKat = silahKategoriBul(secim.silah);
  const kar = karakterBul(secim.karakter);

  const kaydet = () => {
    if (secimKaydet(secim)) setKaydedildi(true);
  };

  return (
    <div className="gl-ekran">
      <div className="gl-menu-arka" aria-hidden />
      <div className="gl-ekran-govde gl-karakter">
        <header className="gl-ekran-baslik">
          <h2>Karakterim</h2>
        </header>

        <div className="gl-karakter-onizleme">
          <canvas ref={canvasRef} className="gl-onizleme-canvas" width={220} height={220} />
          <div className="gl-onizleme-ad">{kar.ad}{kar.kadin ? " ♀" : " ♂"}</div>
        </div>

        {/* Karakterler */}
        <div className="gl-bolum-baslik">Gladyatör</div>
        <div className="gl-secim-izgara">
          {GLADYATORLER.map((k) => (
            <button
              key={k.id}
              className={`gl-secim-hucre${secim.karakter === k.id ? " gl-secili" : ""}`}
              onClick={() => guncelle({ karakter: k.id })}
              title={k.ad}
            >
              <span className="gl-renk-nokta" style={{ background: k.palet.zirh, borderColor: k.palet.sac }} />
              <span className="gl-hucre-ad">{k.ad}</span>
            </button>
          ))}
        </div>

        {/* Silah kategorisi */}
        <div className="gl-bolum-baslik">Silah</div>
        <div className="gl-cip-satir">
          {SILAHLAR.map((s) => (
            <button
              key={s.anahtar}
              className={`gl-cip${secim.silah === s.anahtar ? " gl-secili" : ""}`}
              onClick={() => guncelle({ silah: s.anahtar, silahVaryant: s.varyantlar[0].id })}
            >
              {s.ad}
            </button>
          ))}
        </div>
        {/* Silah varyantı */}
        <div className="gl-cip-satir gl-alt-satir">
          {silahKat.varyantlar.map((v) => (
            <button
              key={v.id}
              className={`gl-cip gl-cip-kucuk${secim.silahVaryant === v.id ? " gl-secili" : ""}`}
              onClick={() => guncelle({ silahVaryant: v.id })}
            >
              {v.ad}
            </button>
          ))}
        </div>

        {/* Kalkan */}
        <div className="gl-bolum-baslik">Kalkan</div>
        <div className="gl-cip-satir">
          {KALKANLAR.varyantlar.map((v) => (
            <button
              key={v.id}
              className={`gl-cip gl-cip-kucuk${secim.kalkanVaryant === v.id ? " gl-secili" : ""}`}
              onClick={() => guncelle({ kalkanVaryant: v.id })}
            >
              {v.ad}
            </button>
          ))}
        </div>

        <div className="gl-karakter-alt">
          <button className="gl-btn gl-btn-vurgu gl-kaydet" onClick={kaydet}>
            {kaydedildi ? "✓ Kaydedildi" : "Kaydet"}
          </button>
          <Link to="/gladius" className="gl-geri-link">← Menü</Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Ana Menü (Faz 0 iskele — gezilebilir sürüm).
// Tasarım 3.9: "panel gibi olmasın" — atmosferik, sinematik giriş.
// Butonlar artık çalışıyor; hedef ekranlar ilgili fazlarda dolacak.
// ============================================================

import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/host.js";
import { MOD_ADLARI, MODLAR } from "../../shared/sabitler.js";
import { karakterBul } from "../../shared/karakterler.js";
import { silahCizimTipi, kalkanCizimTipi } from "../../shared/itemler.js";
import { secimAl } from "../../lib/secim.js";
import { cizGladyator } from "../../engine/karakterCizim.js";

const MENU = [
  { yol: "/gladius/oyna", etiket: "Oyna", ikon: "⚔️", vurgu: true },
  { yol: "/gladius/karakter", etiket: "Karakterim", ikon: "🛡️" },
  { yol: "/gladius/siralama", etiket: "Sıralama / Ligler", ikon: "🏆" },
  { yol: "/gladius/arkadaslar", etiket: "Arkadaşlar", ikon: "👥" },
  { yol: "/gladius/ayarlar", etiket: "Ayarlar", ikon: "⚙️" },
];

export default function MenuPage() {
  const { profile } = useAuth() || {};
  const onizlemeRef = useRef(null);

  // Seçili gladyatörün yavaşça dönen önizlemesi (menüyü canlı kılar).
  useEffect(() => {
    const canvas = onizlemeRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const boyut = 140;
    canvas.width = boyut * dpr;
    canvas.height = boyut * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = secimAl();
    const kar = karakterBul(s.karakter);
    let raf, aci = Math.PI / 2;
    const ciz = () => {
      ctx.clearRect(0, 0, boyut, boyut);
      aci += 0.01;
      cizGladyator(ctx, boyut / 2, boyut / 2, 30, {
        aci, karakterId: s.karakter, palet: kar.palet,
        silahCizim: silahCizimTipi(s.silah, s.silahVaryant),
        kalkanCizim: kalkanCizimTipi(s.kalkanVaryant),
        kalkanRenk: kar.palet.zirh, silahAktif: true, kalkanKalkik: false,
      }, false);
      raf = requestAnimationFrame(ciz);
    };
    ciz();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="gl-menu">
      <div className="gl-menu-arka" aria-hidden />
      <div className="gl-mesale gl-mesale-sol" aria-hidden />
      <div className="gl-mesale gl-mesale-sag" aria-hidden />
      <div className="gl-menu-govde">
        <header className="gl-menu-baslik">
          <h1 className="gl-logo">GLADIUS</h1>
          <p className="gl-alt-baslik">Battle Royale</p>
        </header>

        <canvas ref={onizlemeRef} className="gl-menu-onizleme" width={140} height={140} />

        <p className="gl-tema-metni">
          Roma'dasın. Kum, kan ve kükreme… Arenadan yalnızca biri sağ çıkar.
        </p>

        <nav className="gl-menu-butonlar">
          {MENU.map((m) => (
            <Link
              key={m.yol}
              to={m.yol}
              className={`gl-btn${m.vurgu ? " gl-btn-vurgu" : ""}`}
            >
              <span className="gl-btn-ikon">{m.ikon}</span>
              <span>{m.etiket}</span>
            </Link>
          ))}
        </nav>

        <div className="gl-modlar-onizleme">
          <span className="gl-mod-etiket">{MOD_ADLARI[MODLAR.BATTLE_ROYALE]}</span>
          <span className="gl-mod-ayrac">•</span>
          <span className="gl-mod-etiket">{MOD_ADLARI[MODLAR.DEATHMATCH]}</span>
        </div>

        <footer className="gl-menu-alt">
          {profile?.username && (
            <span className="gl-oyuncu">Hoş geldin, {profile.username}</span>
          )}
          <Link to="/" className="gl-geri-link">
            ← Oyun Merkezi
          </Link>
        </footer>
      </div>
    </div>
  );
}

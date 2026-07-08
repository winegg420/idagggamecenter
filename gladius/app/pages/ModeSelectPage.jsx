// ============================================================
// Mod Seçim Ekranı (Faz 0 iskele).
// İki gerçek mod: Battle Royale Modu ve Deathmatch (tasarım 3, 3.8).
// Mod seçilince gidilecek eşleşme/oda akışı Faz 7'de dolacak.
// ============================================================

import { Link } from "react-router-dom";
import { MODLAR, MOD_ADLARI, MIN_OYUNCU, MAX_OYUNCU } from "../../shared/sabitler.js";

const MODLAR_LISTE = [
  {
    anahtar: MODLAR.BATTLE_ROYALE,
    ikon: "🏛️",
    ozet: "Aşamalı tehditler: maymun, boğa, aslan, düello ve Ateş Çemberi. Son ayakta kalan kazanır.",
  },
  {
    anahtar: MODLAR.DEATHMATCH,
    ikon: "🔥",
    ozet: "Sınırsız saldırı, serbest format. Kesintisiz aksiyon, son ayakta kalan kazanır.",
  },
];

export default function ModeSelectPage() {
  return (
    <div className="gl-ekran">
      <div className="gl-menu-arka" aria-hidden />
      <div className="gl-ekran-govde">
        <header className="gl-ekran-baslik">
          <h2>Oyun Modu Seç</h2>
          <p className="gl-ekran-alt">{MIN_OYUNCU}–{MAX_OYUNCU} oyuncu · botlarla tek başına da oynanır</p>
        </header>

        <div className="gl-mod-kartlar">
          {MODLAR_LISTE.map((m) => (
            <Link key={m.anahtar} to={`/gladius/oyna/${m.anahtar}`} className="gl-mod-kart">
              <span className="gl-mod-kart-ikon">{m.ikon}</span>
              <span className="gl-mod-kart-ad">{MOD_ADLARI[m.anahtar]}</span>
              <span className="gl-mod-kart-ozet">{m.ozet}</span>
            </Link>
          ))}
        </div>

        <Link to="/gladius" className="gl-geri-link gl-geri-buton">← Menü</Link>
      </div>
    </div>
  );
}

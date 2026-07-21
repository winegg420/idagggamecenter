// MEYVE KES — ana menü: mod seçimi + sıralama + nasıl oynanır.
import { Link, useNavigate } from "react-router-dom";

export default function MenuPage() {
  const git = useNavigate();
  return (
    <div className="mk-menu">
      <Link to="/" className="mk-geri">← Bildim</Link>

      <div className="mk-baslik">
        <span className="mk-logo-emoji">🍉</span>
        <h1>MEYVE KES</h1>
        <p>Kameranı aç, ellerinle havadaki meyveleri kes!</p>
      </div>

      <div className="mk-mod-grid">
        <button className="mk-mod-kart tekli" onClick={() => git("/meyvekes/oyun/tekli")}>
          <span className="mk-mod-emoji">🙋</span>
          <b>Tekli Mod</b>
          <small>İki elinle oyna, kendi rekorunu kır</small>
        </button>
        <button className="mk-mod-kart arkadas" onClick={() => git("/meyvekes/oyun/arkadas")}>
          <span className="mk-mod-emoji">🙌</span>
          <b>Arkadaşla</b>
          <small>Aynı ekranda 2 kişi — daha hızlı, daha eğlenceli!</small>
        </button>
      </div>

      <Link to="/meyvekes/siralama" className="mk-siralama-btn">🏆 Sıralamayı Gör</Link>

      <div className="mk-nasil">
        <h3>Nasıl Oynanır?</h3>
        <ul>
          <li>📷 Kamera iznini ver, kendini ekranda göreceksin.</li>
          <li>✋ Ellerini havada hızlıca sallayarak meyveleri kes.</li>
          <li>⚡ Art arda kesersen <b>combo</b> puanı kazanırsın.</li>
          <li>⏱️ 60 saniye — en yüksek skoru yap!</li>
        </ul>
      </div>
    </div>
  );
}

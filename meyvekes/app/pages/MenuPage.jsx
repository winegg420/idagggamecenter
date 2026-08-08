// MEYVE KES — ana menü: mod seçimi + sıralama + nasıl oynanır.
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

// Takip modeli + wasm CDN'den iner (~10 MB). Menüde düşük öncelikli ön-yükleme
// başlatılırsa "Kamera ve el takibi hazırlanıyor…" beklemesi belirgin kısalır.
// Desteklemeyen tarayıcıda link etkisizdir (zararsız).
const ONYUKLE = [
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs",
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
];

export default function MenuPage() {
  const git = useNavigate();

  useEffect(() => {
    const linkler = [];
    try {
      for (const href of ONYUKLE) {
        const l = document.createElement("link");
        l.rel = "prefetch";
        l.href = href;
        l.crossOrigin = "anonymous";
        document.head.appendChild(l);
        linkler.push(l);
      }
    } catch {
      /* ön-yükleme başarısız olsa da oyun normal açılır */
    }
    return () => linkler.forEach((l) => l.remove());
  }, []);

  return (
    <div className="mk-menu">
      <Link to="/" className="mk-geri">← Oyun Merkezi</Link>

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
        <button className="mk-mod-kart yeme mk-genis" onClick={() => git("/meyvekes/oyun/yeme")}>
          <span className="mk-mod-emoji">😋</span>
          <b>Meyve Ye</b>
          <small>Tek elinle telefonu tut — meyveler ağzına gelir, ağzını açıp yut!</small>
        </button>
      </div>

      <Link to="/meyvekes/siralama" className="mk-siralama-btn">🏆 Sıralamayı Gör</Link>

      <div className="mk-nasil">
        <h3>Nasıl Oynanır?</h3>
        <ul>
          <li>📷 Kamera iznini ver, kendini ekranda göreceksin.</li>
          <li>✋ Ellerini havada hızlıca sallayarak meyveleri kes.</li>
          <li>😋 <b>Meyve Ye</b> modunda el yok: meyve ağzına gelince ağzını aç, yut!</li>
          <li>⚡ Art arda kesersen <b>combo</b> puanı kazanırsın.</li>
          <li>⏱️ 60 saniye — en yüksek skoru yap!</li>
        </ul>
      </div>
    </div>
  );
}

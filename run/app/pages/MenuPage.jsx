// ============================================================
// RUN — menü sayfası. Oyunu tanıtır, "Oyna" ile prototip round'una girer.
// ============================================================

import { useNavigate } from "react-router-dom";

export default function MenuPage() {
  const nav = useNavigate();

  return (
    <div className="run-menu">
      <div className="run-menu-glow" />
      <div className="run-menu-kart">
        <div className="run-logo">RUN</div>
        <div className="run-slogan">Karanlık labirentte kaç. Fenerin tek dostun.</div>

        <p className="run-aciklama">
          Kapalı bir tesiste drone'ların <b>kırmızı tarama ışığından saklan</b>, karanlıkta
          fenerinle yol bul ve yeşil çıkışta bekleyerek kaç. Rakiplerini <b>sopayla bayıltıp
          sat</b>, gerektiğinde <b>kalkanla</b> 3 saniye dokunulmaz ol. Alarm veren makineleri
          <b> ele geçirip</b> droneleri sersemlet, <b>kapıları kapatarak</b> peşindekinin yolunu
          kes — ama dikkat: drone kapıyı yarım saniyede açar. Yakalanırsan izleyiciye düşer,
          round sonunda sıralamayı görürsün.
        </p>

        <div className="run-ozellikler">
          <span>🔦 Sınırlı görüş / fener</span>
          <span>🔴 Kırmızı tarama konisi</span>
          <span>🤖 6 drone + çıkış bekçileri</span>
          <span>🦇 Sopa + 🛡 Kalkan</span>
          <span>💾 Makine ele geçirme</span>
          <span>🚪 Açılır-kapanır kapılar</span>
          <span>⚡ Artan zorluk</span>
          <span>👁 İzleyici modu</span>
        </div>

        <button className="run-oyna-btn" onClick={() => nav("/run/oyna")}>▶ Oyna</button>
        <button className="run-geri-btn" onClick={() => nav("/")}>← Bildim'e dön</button>

        <div className="run-not">Prototip — tek oyunculu + botlar. Multiplayer sonraki fazda.</div>
      </div>
    </div>
  );
}

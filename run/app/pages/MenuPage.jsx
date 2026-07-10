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
          fenerinle yol bul ve yeşil çıkışta bekleyerek kaç. <b>Enerji kılıcını savur</b>:
          rakipleri bayıltıp sat, üstüne gelen droneyi <b>geri savur — 3 vuruşta hurdaya
          çıkar</b>. Köşeye sıkışınca <b>atılımla</b> kurtul, gerektiğinde <b>kalkanla</b> 3
          saniye dokunulmaz ol. Haritaya saçılmış <b>veri çiplerini topla</b>, makineleri
          <b> ele geçirip</b> droneleri sersemlet, <b>kapıları kapatarak</b> yol kes.
          Yakalanırsan izleyiciye düşer, round sonunda sıralamayı görürsün.
        </p>

        <div className="run-ozellikler">
          <span>⚔ Enerji kılıcı — droneleri hurdaya çıkar</span>
          <span>💨 Atılım (dash)</span>
          <span>🔦 Sınırlı görüş / fener</span>
          <span>🔴 Kırmızı tarama konisi</span>
          <span>🤖 6 drone + çıkış bekçileri</span>
          <span>💿 Veri çipleri</span>
          <span>🛡 Kalkan · 💾 Ele geçirme · 🚪 Kapılar</span>
          <span>⚡ Artan zorluk · 👁 İzleyici modu</span>
        </div>

        <button className="run-oyna-btn" onClick={() => nav("/run/oyna")}>▶ Oyna</button>
        <button className="run-geri-btn" onClick={() => nav("/")}>← Bildim'e dön</button>

        <div className="run-not">Prototip — tek oyunculu + botlar. Multiplayer sonraki fazda.</div>
      </div>
    </div>
  );
}

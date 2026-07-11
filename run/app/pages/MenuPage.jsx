// ============================================================
// RUN — ana menü. Profesyonel oyun açılış ekranı: animasyonlu cyberpunk
// arka plan (ızgara + tarama çizgisi + parçacıklar), glitch logo, büyük CTA,
// özellik kartları ve kontrol şeması. Tamamı CSS — görsel varlık yok.
// ============================================================

import { useNavigate } from "react-router-dom";

const OZELLIKLER = [
  { ikon: "🔦", ad: "Stealth Karanlık", metin: "Fenerin tek dostun. Kırmızı tarama ışığını gören kaçar — duvar arkası güvenli." },
  { ikon: "⚔", ad: "Enerji Kılıcı", metin: "Droneleri geri savur, komboyla zincirle; 3 vuruşta hurdaya çıkar. İnsanlara işlemez." },
  { ikon: "🔒", ad: "Kilitli Çıkışlar", metin: "Çıkışlar kilitli başlar. Panelini hackle — ama bekçiler alarma geçer." },
  { ikon: "🧠", ad: "Yönetmen AI", metin: "Rahatladıkça av başlar: droneler son görüldüğün bölgeye yönlenir, sürüyle kıstırır." },
  { ikon: "💿", ad: "Veri Çipleri", metin: "Haritaya saçılmış 10 çip. Keşfet, topla, sıralamada öne geç." },
  { ikon: "🚪", ad: "Fiziksel Kapılar", metin: "Kapıyı kapat, yol kes. Drone yarım saniyede kırar — zaman kazan, kaç." },
];

const KONTROLLER = [
  ["WASD", "Hareket"],
  ["J", "Kılıç"],
  ["Shift", "Atılım"],
  ["K", "Kalkan"],
  ["E", "Hack"],
  ["Q", "Kapı"],
  ["M", "Plan"],
];

export default function MenuPage() {
  const nav = useNavigate();

  return (
    <div className="run-menu">
      <div className="run-menu-izgara" />
      <div className="run-menu-tarama" />
      <div className="run-menu-parcaciklar">
        {Array.from({ length: 14 }, (_, i) => <span key={i} style={{ "--i": i }} />)}
      </div>
      <div className="run-menu-vinyet" />

      <div className="run-menu-ic">
        <div className="run-ust-bar">
          <span className="run-rozet"><i />TESİS-07 · SİMÜLASYON AKTİF</span>
          <span className="run-surum">PROTOTİP v0.9</span>
        </div>

        <header className="run-hero">
          <div className="run-logo" data-metin="RUN">RUN</div>
          <div className="run-slogan">KARANLIK LABİRENTTE KAÇ — FENERİN TEK DOSTUN</div>
          <p className="run-ozet">
            Kilitli bir tesiste 6 avcı drone'a karşı tek şansın var: karanlıkta görünmez kal,
            çıkış panelini hackle ve yeşil ışık yanmadan önce seni bulan her şeyi hurdaya çıkar.
          </p>
          <div className="run-cta">
            <button className="run-oyna-btn" onClick={() => nav("/run/oyna")}>
              <span className="run-oyna-ikon">▶</span> OYUNA GİR
            </button>
            <button className="run-geri-btn" onClick={() => nav("/")}>← Bildim'e dön</button>
          </div>
        </header>

        <section className="run-kartlar">
          {OZELLIKLER.map((o) => (
            <div className="run-kart" key={o.ad}>
              <div className="run-kart-ikon">{o.ikon}</div>
              <div className="run-kart-ad">{o.ad}</div>
              <div className="run-kart-metin">{o.metin}</div>
            </div>
          ))}
        </section>

        <section className="run-kontroller">
          {KONTROLLER.map(([tus, ad]) => (
            <span className="run-tus" key={tus}><kbd>{tus}</kbd>{ad}</span>
          ))}
        </section>

        <footer className="run-alt">Tek oyunculu + botlar · Multiplayer yakında · Mobilde dokunmatik kontroller</footer>
      </div>
    </div>
  );
}

// ============================================================
// idaGG GAME CENTER — sitenin ana giriş sayfası (oyun portalı).
// Siteye ilk girildiğinde burası açılır; her oyun (Bildim quiz dahil)
// tıklanabilir bir kart olarak listelenir.
// ============================================================
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Avatar from "../components/Avatar.jsx";

// Portala eklenen oyunlar. Yeni oyun eklemek = buraya bir kart eklemek.
const OYUNLAR = [
  {
    ad: "Quizador",
    aciklama: "Türkçe bilgi yarışması — turnuva, meydan okuma ve gece yarışı",
    ikon: "🧠",
    yol: "/bildim",
    etiket: "Bilgi Yarışması",
    grad: "linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)",
    yeni: false,
  },
  {
    ad: "Kafa Topu",
    aciklama: "Sahilde 1v1 & 2v2 kafa topu — kendi fotoğrafınla oyna!",
    ikon: "⚽",
    yol: "/kafatopu",
    etiket: "Spor · Çok Oyunculu",
    grad: "linear-gradient(135deg, #0e7fa8 0%, #16a06a 100%)",
    yeni: false,
  },
  {
    ad: "DidaGP",
    aciklama: "3D drift yarışı — telefonu eğ, en iyi turla hayalet ol!",
    ikon: "🏎️",
    yol: "/driftgp",
    etiket: "Yarış · 3D",
    grad: "linear-gradient(135deg, #16213e 0%, #e94560 100%)",
    yeni: true,
  },
  {
    ad: "Meyve Kes",
    aciklama: "Kameranı aç, ellerinle havadaki meyveleri kes!",
    ikon: "🍉",
    yol: "/meyvekes",
    etiket: "Kamera · Hareket",
    grad: "linear-gradient(135deg, #ff5f6d 0%, #ffc371 100%)",
    yeni: true,
  },
  {
    ad: "PatiRun",
    aciklama: "Sevimli patilerle 2D yarış — arkadaşlarınla kapış!",
    ikon: "🐾",
    yol: "/patirun",
    etiket: "Yarış · Çok Oyunculu",
    grad: "linear-gradient(135deg, #3a86ff 0%, #74a57f 100%)",
    yeni: true,
  },
  {
    ad: "RUN",
    aciklama: "Karanlık labirentten kaç — dronelara yakalanma!",
    ikon: "🏃",
    yol: "/run",
    etiket: "Aksiyon · Gizlilik",
    grad: "linear-gradient(135deg, #21125e 0%, #7a1fa0 100%)",
    yeni: false,
    demo: true, // multiplayer henüz yok — DEMO
  },
  {
    ad: "Gladius",
    aciklama: "Arena dövüşü — gladyatör ol, rakiplerini yen",
    ikon: "⚔️",
    yol: "/gladius",
    etiket: "Dövüş · Arena",
    grad: "linear-gradient(135deg, #b91d1d 0%, #f0a020 100%)",
    yeni: false,
    demo: true, // Faz 0 iskelet — DEMO
  },
  {
    ad: "Gölge Boks",
    aciklama: "Kameranı aç, gerçek gölge boksu yap — antrenör seni analiz etsin!",
    ikon: "🥊",
    yol: "/boks",
    etiket: "Kamera · Antrenman",
    // "Gece Antrenmanı" kimliği: hub'ın mor paletinden bilinçli ayrışma.
    grad: "linear-gradient(135deg, #14100f 0%, #ff4d3d 130%)",
    yeni: true,
  },
];

export default function GameCenter() {
  const { profile } = useAuth();
  const ad = profile?.gorunen_ad || profile?.username || "Oyuncu";

  return (
    <div className="gc-root">
      <div className="gc-arka" aria-hidden="true" />

      <header className="gc-header">
        <div className="gc-brand">
          <span className="gc-brand-mark">🎮</span>
          <div className="gc-brand-text">
            <span className="gc-brand-name">Quizador</span>
            <span className="gc-brand-sub">GAME CENTER</span>
          </div>
        </div>
        <Link to="/siralama-genel" className="gc-user" title="Genel puan sıralaması">
          <Avatar profile={profile} boyut={40} />
          <div className="gc-user-info">
            <span className="gc-user-name">{ad}</span>
            <span className="gc-user-puan">🏆 Sıralama</span>
          </div>
        </Link>
      </header>

      <section className="gc-hero">
        <h1 className="gc-hero-baslik">
          Hoş geldin, <span>{ad}</span>! 👋
        </h1>
        <p className="gc-hero-alt">
          {OYUNLAR.length} oyun seni bekliyor — oynamak istediğini seç.
        </p>
      </section>

      <section className="gc-bolum">
        <h2 className="gc-bolum-baslik">🕹️ Oyunlar</h2>
        <div className="gc-grid">
          {OYUNLAR.map((o) => (
            <Link key={o.yol} to={o.yol} className={"gc-kart" + (o.demo ? " gc-kart-demo" : "")} style={{ background: o.grad }}>
              <span className="gc-kart-parlama" aria-hidden="true" />
              {o.yeni && <span className="gc-yeni">YENİ</span>}
              {o.demo && <span className="gc-demo">DEMO</span>}
              <div className="gc-kart-ikon">{o.ikon}</div>
              <div className="gc-kart-govde">
                <span className="gc-kart-ad">{o.ad}</span>
                <span className="gc-kart-aciklama">{o.aciklama}</span>
              </div>
              <div className="gc-kart-alt">
                <span className="gc-kart-etiket">{o.etiket}</span>
                <span className="gc-kart-oyna">OYNA ▶</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="gc-footer">
        Quizador · Tüm oyunlar tek çatı altında 🚀
        {/* Yasal metinler ana kapıdan da erişilebilir olmalı (mağaza ve reklam ağı şartı). */}
        <div className="gc-footer-yasal">
          <Link to="/gizlilik">Gizlilik politikası</Link>
          <span aria-hidden="true">·</span>
          <Link to="/kosullar">Kullanım koşulları</Link>
        </div>
      </footer>
    </div>
  );
}

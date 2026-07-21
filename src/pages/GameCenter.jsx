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
    ad: "Bildim!",
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
    ad: "Meyve Kes",
    aciklama: "Kameranı aç, ellerinle havadaki meyveleri kes!",
    ikon: "🍉",
    yol: "/meyvekes",
    etiket: "Kamera · Hareket",
    grad: "linear-gradient(135deg, #ff5f6d 0%, #ffc371 100%)",
    yeni: true,
  },
  {
    ad: "RUN",
    aciklama: "Karanlık labirentten kaç — dronelara yakalanma!",
    ikon: "🏃",
    yol: "/run",
    etiket: "Aksiyon · Gizlilik",
    grad: "linear-gradient(135deg, #21125e 0%, #7a1fa0 100%)",
    yeni: true,
  },
  {
    ad: "Gladius",
    aciklama: "Arena dövüşü — gladyatör ol, rakiplerini yen",
    ikon: "⚔️",
    yol: "/gladius",
    etiket: "Dövüş · Arena",
    grad: "linear-gradient(135deg, #b91d1d 0%, #f0a020 100%)",
    yeni: false,
  },
];

export default function GameCenter() {
  const { profile } = useAuth();
  const ad = profile?.username || "Oyuncu";

  return (
    <div className="gc-root">
      <div className="gc-arka" aria-hidden="true" />

      <header className="gc-header">
        <div className="gc-brand">
          <span className="gc-brand-mark">🎮</span>
          <div className="gc-brand-text">
            <span className="gc-brand-name">idaGG</span>
            <span className="gc-brand-sub">GAME CENTER</span>
          </div>
        </div>
        <Link to="/profil" className="gc-user">
          <Avatar profile={profile} boyut={40} />
          <div className="gc-user-info">
            <span className="gc-user-name">{ad}</span>
            <span className="gc-user-puan">⭐ {profile?.puan ?? 0}</span>
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
            <Link key={o.yol} to={o.yol} className="gc-kart" style={{ background: o.grad }}>
              <span className="gc-kart-parlama" aria-hidden="true" />
              {o.yeni && <span className="gc-yeni">YENİ</span>}
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
        idaGG Game Center · Tüm oyunlar tek çatı altında 🚀
      </footer>
    </div>
  );
}

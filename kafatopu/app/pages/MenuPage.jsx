// KAFA TOPU — ana menü: mod seçimi, profil özeti, alt sayfalara geçiş.

import { Link, useNavigate } from "react-router-dom";
import { useKT } from "../KafaTopuApp.jsx";
import { ligBul, sonrakiLig } from "../../shared/ligler.js";
import { kafaBul } from "../../shared/karakterler.js";

export default function MenuPage() {
  const { profil, adminMi } = useKT();
  const navigate = useNavigate();
  const lig = ligBul(profil?.puan ?? 1000);
  const sonraki = sonrakiLig(profil?.puan ?? 1000);
  const kafa = kafaBul(profil?.kafa ?? "volkan");

  return (
    <div className="kt-sayfa">
      <h1 className="kt-baslik">
        <span className="kt-top-ikon">⚽</span> KAFA TOPU
      </h1>
      <div className="kt-alt-yazi">Club Afrodit sahilinde kafa topu kapışması</div>

      <div className="kt-profil-ozet">
        <span className="kt-lig-rozet" style={{ color: lig.renk }}>
          {lig.ikon} {lig.ad} · {profil?.puan ?? "…"} puan
        </span>
        <span className="kt-istatistik">
          {profil
            ? `${profil.galibiyet}G ${profil.beraberlik}B ${profil.maglubiyet}M · Kafa: ${kafa.ad}`
            : "Profil yükleniyor…"}
        </span>
      </div>
      {sonraki && profil && (
        <div className="kt-alt-yazi">
          {sonraki.ikon} {sonraki.ad} ligine {sonraki.min - profil.puan} puan kaldı
        </div>
      )}

      <button className="kt-btn ranked" onClick={() => navigate("/kafatopu/kuyruk/1v1/ranked")}>
        <span className="kt-btn-ikon">🏆</span>
        <span>
          Ranked 1v1
          <span className="kt-btn-detay">ELO puanı için — lig terfi/düşme</span>
        </span>
      </button>
      <button className="kt-btn ranked" onClick={() => navigate("/kafatopu/kuyruk/2v2/ranked")}>
        <span className="kt-btn-ikon">🏆</span>
        <span>
          Ranked 2v2
          <span className="kt-btn-detay">Takım halinde puanlı maç</span>
        </span>
      </button>
      <button className="kt-btn hizli" onClick={() => navigate("/kafatopu/kuyruk/1v1/hizli")}>
        <span className="kt-btn-ikon">⚡</span>
        <span>
          Hızlı Maç 1v1
          <span className="kt-btn-detay">Puan etkilenmez, sadece eğlence</span>
        </span>
      </button>
      <button className="kt-btn hizli" onClick={() => navigate("/kafatopu/kuyruk/2v2/hizli")}>
        <span className="kt-btn-ikon">⚡</span>
        <span>
          Hızlı Maç 2v2
          <span className="kt-btn-detay">2'ye 2 takım kapışması</span>
        </span>
      </button>
      <button className="kt-btn antrenman" onClick={() => navigate("/kafatopu/mac/bot?mod=1v1")}>
        <span className="kt-btn-ikon">🤖</span>
        <span>
          Antrenman (Bota Karşı)
          <span className="kt-btn-detay">Çevrimdışı pratik — kontrolleri öğren</span>
        </span>
      </button>

      <button className="kt-btn ikincil" onClick={() => navigate("/kafatopu/karakter")}>
        <span className="kt-btn-ikon">🧑‍🎤</span>
        <span>Karakter / Kafa Seçimi</span>
      </button>
      <button className="kt-btn ikincil" onClick={() => navigate("/kafatopu/siralama")}>
        <span className="kt-btn-ikon">📊</span>
        <span>Sıralama & Ligler</span>
      </button>
      {adminMi && (
        <button className="kt-btn tehlike" onClick={() => navigate("/kafatopu/admin")}>
          <span className="kt-btn-ikon">👑</span>
          <span>Admin Paneli</span>
        </button>
      )}

      <Link to="/" style={{ display: "block", textAlign: "center", color: "#9fc3dd", marginTop: 18 }}>
        ← Bildim!'e dön
      </Link>

      <div className="kt-kart" style={{ marginTop: 18, fontSize: "0.82rem", opacity: 0.85 }}>
        <b>Kontroller:</b> ←→/AD hareket · ↑/W zıpla · Boşluk/X vuruş · E/Shift özel güç.
        Mobilde ekran butonları otomatik açılır. Maç 2 dakika; süre sonunda skoru
        yüksek olan kazanır.
      </div>
    </div>
  );
}

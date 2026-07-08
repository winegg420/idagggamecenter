// ============================================================
// Placeholder ekran (Faz 0). İlgili faz geldiğinde gerçek ekranla değişecek.
// Tekdüze "yapım aşamasında" hissi vermemesi için temaya uygun tutuldu.
// ============================================================

import { Link } from "react-router-dom";

export default function StubPage({ baslik, ikon, faz, aciklama }) {
  return (
    <div className="gl-ekran">
      <div className="gl-menu-arka" aria-hidden />
      <div className="gl-ekran-govde gl-ekran-ortali">
        <span className="gl-stub-ikon">{ikon}</span>
        <h2>{baslik}</h2>
        <p className="gl-stub-aciklama">{aciklama}</p>
        <span className="gl-stub-faz">{faz}</span>
        <Link to="/gladius" className="gl-geri-link gl-geri-buton">← Menü</Link>
      </div>
    </div>
  );
}

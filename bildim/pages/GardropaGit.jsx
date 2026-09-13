// ============================================================
// GARDIROBA GİT — /gorunum → 3B gardırop
//
// 3B gardırop SPA rotası DEĞİL: `bildim/avatar3d/gardrop.html` kendi giriş
// noktası olan ayrı bir sayfa (vercel.json'daki çok girişli derleme onu
// üretir). Bu yüzden React Router içinden bileşen olarak takılamaz; sayfa
// değişimi gerçek bir gezinme olmak zorunda.
//
// `replace` kullanılır: oyuncu geri tuşuna bastığında bu boş ara sayfaya
// değil, geldiği ekrana döner.
//
// 2B görünüm sayfası SİLİNMEDİ — /gorunum-2b altında yedekte duruyor.
// ============================================================
import { useEffect } from "react";

/** dist içindeki fiziksel yol; hem hub hem Bildim modunda aynı. */
export const GARDROP_YOLU = "/bildim/avatar3d/gardrop.html";

export default function GardropaGit() {
  useEffect(() => {
    try {
      window.location.replace(GARDROP_YOLU);
    } catch (e) {
      console.error("[Görünüm] gardıroba gidilemedi:", e);
    }
  }, []);

  return (
    <div className="bd-gorunum">
      <div className="baslik">Görünüm</div>
      <div className="alt-yazi">Gardırop açılıyor…</div>
      {/* Yönlendirme engellenirse oyuncu elle gidebilsin. */}
      <div className="bd-gorunum-eylemler">
        <a className="btn" href={GARDROP_YOLU}>Gardıroba git</a>
      </div>
    </div>
  );
}

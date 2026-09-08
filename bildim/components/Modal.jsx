import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Tam ekran modal katmanı — HER ZAMAN `document.body`'ye basılır.
 *
 * NEDEN PORTAL: `.sayfa > *` üzerindeki giriş animasyonu (`transform` içeren
 * keyframe + `animation-fill-mode`) o elemanı "containing block" yapıyordu;
 * içindeki `position: fixed` katman viewport'a değil o elemana göre
 * konumlanıyor ve ekranın dışında (ölçüm: top -916px) açılıyordu. Kullanıcı
 * hesabını pratikte silemiyordu. Animasyon da düzeltildi, ama modallerin
 * body'ye basılması bu sınıf hatayı kökten engelliyor.
 */
export default function Modal({ children, onKapat, etiket = "İletişim kutusu" }) {
  // Modal açıkken arka planın kaymasını engelle
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const eski = document.body.style.overflow;
    try {
      document.body.style.overflow = "hidden";
    } catch {
      /* önemli değil */
    }
    return () => {
      try {
        document.body.style.overflow = eski;
      } catch {
        /* sayfa kapanıyor olabilir */
      }
    };
  }, []);

  // Esc ile kapat
  useEffect(() => {
    if (!onKapat) return undefined;
    const tus = (e) => {
      if (e.key === "Escape") onKapat();
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [onKapat]);

  const govde = (
    <div
      className="bd-modal-katman"
      role="dialog"
      aria-modal="true"
      aria-label={etiket}
      onClick={onKapat ? (e) => e.target === e.currentTarget && onKapat() : undefined}
    >
      {children}
    </div>
  );

  return typeof document === "undefined" ? govde : createPortal(govde, document.body);
}

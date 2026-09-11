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
  // Modal açıkken arka planın kaymasını engelle.
  //
  // KAYDIRMA KONUMU KORUNUR. Eskiden yalnız `overflow: hidden` veriliyordu;
  // tarayıcı o anda sayfayı en üste çekiyor ve modal kapanınca oyuncu
  // listenin başına düşüyordu ("maçı iptal ettim, en yukarı attı" şikâyeti).
  // Çözüm: gövdeyi bulunduğu konumda `fixed`leyip aynı kadar yukarı
  // kaydırmak; kapanışta konum geri veriliyor.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const govde = document.body;
    const y = window.scrollY || window.pageYOffset || 0;
    const eski = {
      overflow: govde.style.overflow,
      position: govde.style.position,
      top: govde.style.top,
      width: govde.style.width,
    };
    try {
      govde.style.overflow = "hidden";
      govde.style.position = "fixed";
      govde.style.top = `-${y}px`;
      govde.style.width = "100%";   // fixed olunca genişlik daralmasın
    } catch {
      /* önemli değil */
    }
    return () => {
      try {
        govde.style.overflow = eski.overflow;
        govde.style.position = eski.position;
        govde.style.top = eski.top;
        govde.style.width = eski.width;
        // `fixed` kalkar kalkmaz eski konuma dön (anında, yumuşatmasız)
        window.scrollTo({ top: y, left: 0, behavior: "instant" });
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

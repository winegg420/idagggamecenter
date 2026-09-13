// Paylaşılan avatar bileşeni (tüm oyunlar kullanır).
//
// Bildim gizlilik güncellemesinden sonra profiller `gorunen_ad` /
// `gorunen_avatar` döndürüyor; diğer modüller hâlâ `username` /
// `avatar_url` gönderiyor. Bu yüzden ikisini de kabul eder.
//
// ============================================================
// TEK KARAKTER SİSTEMİ — 3B (13 Eylül 2026)
//
// Öncelik sırası:
//   1) `gorunum.portre_url` → düz <img>. Oyuncu gardıropta kaydederken
//      portresi BİR KEZ üretilip Storage'a yüklendi; burada WebGL yok,
//      maliyet sıfır. Lig tablosunda 25 satır bu yolla çizilir.
//   2) `gorunum.avatar3d` → portre henüz üretilmemişse (ya da yükleme
//      düşmüşse) modelden TEMBEL üretilir: kart görünür alana girince,
//      kare başına tek render, sonuç önbellekte.
//   3) baş harf (eski davranış).
//
// three.js YALNIZ 2. yola düşülürse iner (dinamik import). Portresi olan
// oyuncular için hiçbir oyunun paketine three.js sızmaz.
//
// 2B YOL KALDIRILDI: `bildim/karakter/` dosyaları duruyor ama bu bileşen
// artık oraya bakmıyor.
// ============================================================
import { useEffect, useRef, useState } from "react";

/**
 * Emekli avatar görselleri: ilk kurulumdaki 31 düz SVG ikon ve ondan önceki
 * siluetler. Dosyalar duruyor (eski profiller kırılmasın) ama ARTIK
 * GÖSTERİLMİYORLAR — tek karakter sistemine geçildi. Google fotoğrafı gibi
 * gerçek görseller etkilenmez.
 */
const ESKI_IKON = /\/avatars\/(k\d+|av\d+)\.svg(\?|$)/i;

export default function Avatar({ profile, boyut = 42 }) {
  const ad = profile?.gorunen_ad ?? profile?.username ?? "?";
  const ham =
    profile?.gorunen_avatar !== undefined
      ? profile.gorunen_avatar
      : profile?.avatar_url;
  const gorsel = typeof ham === "string" && ESKI_IKON.test(ham) ? null : ham;
  const harf = ad.charAt(0).toUpperCase();

  const gorunum = profile?.gorunum;
  const portreUrl = typeof gorunum?.portre_url === "string" ? gorunum.portre_url : null;
  const avatar3d = gorunum?.avatar3d ?? null;

  const kutuRef = useRef(null);
  const [uretilen, setUretilen] = useState(null);

  // Kaydedilmiş portre varsa üretime hiç girilmez.
  const uretilsinMi = !portreUrl && !!avatar3d;
  const anahtar = uretilsinMi ? JSON.stringify(avatar3d) : null;

  useEffect(() => {
    if (!uretilsinMi) { setUretilen(null); return undefined; }
    const kutu = kutuRef.current;
    if (!kutu) return undefined;
    let atildi = false;
    setUretilen(null);

    const uret = async () => {
      if (atildi) return;
      try {
        // three.js burada iner — yalnız portresi olmayan oyuncu için.
        const { yeniPortre } = await import("../../bildim/avatar3d/portre.js");
        const { siraya } = await import("../../bildim/avatar3d/portre-kuyrugu.js");
        siraya(() => {
          if (atildi) return;
          const veri = yeniPortre({ avatar3d });
          if (!atildi && veri) setUretilen(veri);
        });
      } catch (e) {
        console.error("[Avatar] portre uretilemedi:", e);
      }
    };

    if (typeof IntersectionObserver !== "function") { uret(); return () => { atildi = true; }; }

    const gozcu = new IntersectionObserver((girisler) => {
      for (const g of girisler) {
        if (!g.isIntersecting) continue;
        gozcu.disconnect();
        uret();
      }
    }, { rootMargin: "120px" });
    gozcu.observe(kutu);

    return () => { atildi = true; gozcu.disconnect(); };
    // `anahtar` görünümün tamamını temsil ediyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anahtar, uretilsinMi]);

  const karakter = portreUrl ?? uretilen;

  return (
    <div
      ref={kutuRef}
      className={`avatar${karakter ? " avatar-karakter" : ""}`}
      style={{ width: boyut, height: boyut, fontSize: boyut * 0.4 }}
    >
      {karakter ? (
        <img src={karakter} alt={ad} loading="lazy" />
      ) : gorsel ? (
        <img src={gorsel} alt={ad} referrerPolicy="no-referrer" />
      ) : (
        // Üretim bitene kadar baş harf durur: düzen zıplamaz, sayfa kilitlenmez.
        harf
      )}
    </div>
  );
}

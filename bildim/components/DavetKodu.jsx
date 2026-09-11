// ============================================================
// DAVET KODU — tek dokunuşta YALNIZ KOD kopyalanır
//
// Eskiden kod düz yazıydı; kopyalamak için oyuncunun metni elle seçmesi
// gerekiyordu (telefonda zor). Yanındaki düğme ise koddan başka şey
// kopyalıyordu: uzun davet LİNKİNİ. Kodu isteyen oyuncu için fazlalıktı.
//
// Artık kodun kendisi bir düğme: dokun, pano'ya "A1B2C3D4" düşsün.
// Link paylaşma düğmesi yerinde duruyor (ayrı iş).
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Panoya yazar. `navigator.clipboard` yalnız güvenli bağlamda ve izin
 * verilirse çalışır; olmadığında gizli bir alanla eski yönteme düşeriz ki
 * hiçbir cihazda "hiçbir şey olmadı" hissi kalmasın.
 *
 * ZAMAN AŞIMI ŞART: writeText bazı ortamlarda ne çözülüyor ne reddediliyor
 * (izin "granted" görünse bile ölçüldü). Beklemeye bırakılırsa düğme
 * sonsuza kadar sessiz kalıyor; kısa süre sonra eski yönteme geçiyoruz.
 */
const PANO_ZAMAN_ASIMI = 1200;

async function panoyaYaz(metin) {
  try {
    if (navigator.clipboard?.writeText) {
      const yazdi = await Promise.race([
        navigator.clipboard.writeText(metin).then(() => true),
        new Promise((c) => setTimeout(() => c(false), PANO_ZAMAN_ASIMI)),
      ]);
      if (yazdi) return true;
    }
  } catch { /* izin yok — eski yönteme düş */ }
  try {
    const alan = document.createElement("textarea");
    alan.value = metin;
    alan.setAttribute("readonly", "");
    alan.style.cssText = "position:fixed;top:-1000px;opacity:0";
    document.body.appendChild(alan);
    alan.select();
    const oldu = document.execCommand?.("copy");
    document.body.removeChild(alan);
    return Boolean(oldu);
  } catch {
    return false;
  }
}

export default function DavetKodu({ kod }) {
  const [durum, setDurum] = useState(null); // 'oldu' | 'olmadi'
  const saatRef = useRef(null);

  useEffect(() => () => clearTimeout(saatRef.current), []);

  const kopyala = useCallback(async () => {
    if (!kod) return;
    const oldu = await panoyaYaz(kod);
    setDurum(oldu ? "oldu" : "olmadi");
    clearTimeout(saatRef.current);
    saatRef.current = setTimeout(() => setDurum(null), 2200);
  }, [kod]);

  if (!kod) return <div className="bd-davet-kod">—</div>;

  return (
    <button
      type="button"
      className={"bd-davet-kod bd-davet-kod-btn" + (durum === "oldu" ? " kopyalandi" : "")}
      onClick={kopyala}
      title="Kodu kopyala"
      aria-label={`Davet kodun ${kod} — kopyalamak için dokun`}
    >
      <span className="bd-davet-kod-metin">{kod}</span>
      <span className="bd-davet-kod-ipucu" aria-hidden="true">
        {durum === "oldu" ? "kopyalandı ✓" : durum === "olmadi" ? "elle seç" : "dokun, kopyala"}
      </span>
    </button>
  );
}

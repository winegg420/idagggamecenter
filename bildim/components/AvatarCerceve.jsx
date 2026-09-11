// ============================================================
// ÇERÇEVELİ AVATAR — nadirlik çerçevesi TEK YERDE
//
// Ana sayfa, profil, oyuncu kartı, lig satırı, maç üst şeridi ve turnuva
// podyumu bu bileşeni kullanır; hiçbiri kendi çerçeve stilini yazmaz.
// Çerçeve rengi oyuncunun giydiği en yüksek nadirlikteki eşyadan gelir
// (bkz. bildim/lib/nadirlik.js). Eşyası olmayan 'sirali' (gri) alır.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import Avatar from "../../src/components/Avatar.jsx";
import { nadirlikAl, nadirlikGorunumden } from "../lib/nadirlik.js";

/**
 * @param {object} o
 * @param {object} o.profile     Avatar'ın beklediği profil nesnesi
 * @param {number} [o.boyut]
 * @param {string} [o.userId]    nadirlik bunun üzerinden çözülür
 * @param {string} [o.nadirlik]  elde hazırsa sorgu yapılmaz
 */
export default function AvatarCerceve({ profile, boyut = 42, userId, nadirlik }) {
  const [n, setN] = useState(nadirlik ?? "sirali");

  const kimlik = userId ?? profile?.id ?? null;
  // Görünüm elimizdeyse sorgu yok; anahtar string olduğu için effect her
  // render'da yeniden çalışmaz (profil nesnesi her render'da yenilenebiliyor).
  const gorunumAnahtar = useMemo(
    () => (profile?.gorunum && typeof profile.gorunum === "object" ? JSON.stringify(profile.gorunum) : null),
    [profile?.gorunum]
  );

  useEffect(() => {
    if (nadirlik) { setN(nadirlik); return undefined; }
    let aktif = true;
    const soz = gorunumAnahtar
      ? nadirlikGorunumden(JSON.parse(gorunumAnahtar))
      : nadirlikAl(kimlik);
    Promise.resolve(soz)
      .then((deger) => { if (aktif) setN(deger ?? "sirali"); })
      .catch(() => { if (aktif) setN("sirali"); });
    return () => { aktif = false; };
  }, [nadirlik, kimlik, gorunumAnahtar]);

  return (
    <span className={`bd-cerceve bd-cerceve-${n}`} style={{ width: boyut, height: boyut }}>
      <Avatar profile={profile} boyut={boyut} />
    </span>
  );
}

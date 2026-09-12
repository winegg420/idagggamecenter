// ============================================================
// AVATAR VİTRİNİ — profilin ve dükkânın başındaki büyük avatar
//
// 2B KARAKTER SİSTEMİ: avatar PatiRun'dan taşınan vektör üreteciyle
// çizilir (bildim/karakter/). three.js YÜKLENMEZ — bu bileşen artık
// hiçbir 3B modül indirmez, profil ve dükkân sayfası hafifledi.
//
// Eski 3B vitrin kodu silinmedi; meydan sahnesinin önizlemesi hâlâ
// `bildim/harita/onizleme.js` üzerinden /gorunum-3b sayfasında.
// ============================================================
import { useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabase.js";
import RankBadge from "./RankBadge.jsx";
import { NADIRLIK_ETIKET, nadirlikGorunumden } from "../lib/nadirlik.js";
import { avatarUri, karakterId } from "../karakter/gorunum.js";
import { getCharacter } from "../karakter/karakterler.js";

/**
 * @param {object} o
 * @param {string} [o.ad]      oyuncunun görünen adı
 * @param {number} [o.puan]    rütbe rozeti için
 * @param {string} [o.baslik]  kartın üst başlığı
 * @param {string} [o.poz]     idle | wave | flex | laugh
 */
export default function AvatarVitrin({ ad, puan = 0, baslik = null, poz = "idle" }) {
  const [gorunum, setGorunum] = useState(null);
  const [nadirlik, setNadirlik] = useState("sirali");

  useEffect(() => {
    let aktif = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("profilim");
        if (error) throw error;
        if (!aktif) return;
        const g = data?.gorunum ?? {};
        setGorunum(g);
        try {
          const n = await nadirlikGorunumden(g);
          if (aktif) setNadirlik(n ?? "sirali");
        } catch {
          /* nadirlik çözülemedi — gri çerçeveyle devam */
        }
      } catch (e) {
        console.error("[Bildim] vitrin gorunumu alinamadi:", e);
        if (aktif) setGorunum({});
      }
    })();
    return () => { aktif = false; };
  }, []);

  const def = getCharacter(karakterId(gorunum ?? {}));
  const gorsel = avatarUri(gorunum ?? {}, poz);

  return (
    <div className={`kart bd-vitrin n-${nadirlik}`}>
      {baslik && <div className="bd-kat-baslik"><span>{baslik}</span></div>}
      <div className="bd-vitrin-sahne">
        {gorsel ? (
          <img src={gorsel} alt={ad ?? def.name} className="bd-vitrin-gorsel" />
        ) : (
          <div className="yukleniyor">Yükleniyor…</div>
        )}
      </div>
      <div className="bd-vitrin-alt">
        <div className="bd-vitrin-ad">{ad ?? def.name}</div>
        <div className="alt-yazi">{def.bio}</div>
        <div className="bd-vitrin-rozetler">
          <RankBadge puan={puan} />
          <span className={`rutbe-chip n-${nadirlik}`}>{NADIRLIK_ETIKET[nadirlik] ?? "Sıradan"}</span>
        </div>
      </div>
    </div>
  );
}

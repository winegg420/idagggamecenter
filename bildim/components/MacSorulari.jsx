import { useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabase.js";
import { tt } from "../lib/dil.js";
import SoruBildir from "./SoruBildir.jsx";

const HARFLER = ["A", "B", "C", "D"];

/**
 * Paket 20 II.1 — maç sonu "Maçın soruları": her soru, doğru cevabı (ve verdiğin cevap) + "Soruyu bildir".
 * kaynak ("mac:<id>" · "duello:<id>" · "hizli:<id>" · "grup:<id>" · "turnuva:<id>") verilirse sunucudan
 * (`mac_sorulari`) okunur; Hatalarım gibi listeyi kendisi tutan ekran `sorular` verir.
 * Varsayılan kapalı: sonuç ekranını kalabalıklaştırmaz.
 */
export default function MacSorulari({ kaynak, sorular: verilen, baslik, acikBasla = false }) {
  const [sorular, setSorular] = useState(verilen ?? null);

  useEffect(() => {
    if (verilen) { setSorular(verilen); return; }
    if (!kaynak) return;
    let aktif = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("mac_sorulari", { p_kaynak: kaynak });
        if (error) throw error;
        if (aktif) setSorular(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("[Bildim] mac_sorulari başarısız:", e);
      }
    })();
    return () => { aktif = false; };
  }, [kaynak, verilen]);

  if (!sorular?.length) return null;

  return (
    <details className="bd-mac-sorulari" open={acikBasla}>
      <summary>{baslik ?? tt("Maçın soruları ({n})", { n: sorular.length })}</summary>
      <ol>
        {sorular.map((s, n) => {
          const secenekler = Array.isArray(s.secenekler) ? s.secenekler : JSON.parse(s.secenekler ?? "[]");
          const yanlis = s.ben_cevapladim && s.benim_cevap != null && s.benim_cevap >= 0 && s.benim_cevap !== s.dogru_cevap;
          return (
            <li key={`${s.question_id}-${n}`} className="bd-mac-soru">
              {s.tur != null && (
                <div className="bd-mac-soru-etiket">
                  {tt("Tur {tur}", { tur: s.tur })} · {s.ben_saldirdim ? tt("sen sordun") : tt("sen savundun")}
                  {s.riskli && <span className="riskli"> · {tt("riskli kategori")}</span>}
                </div>
              )}
              <div className="bd-mac-soru-metin">{s.soru}</div>
              <ul className="bd-mac-soru-siklar">
                {secenekler.map((m, i) => (
                  <li key={i} className={i === s.dogru_cevap ? "dogru" : yanlis && i === s.benim_cevap ? "yanlis" : ""}>
                    <b>{HARFLER[i]}</b> {m}
                    {i === s.dogru_cevap && <span className="bd-mac-soru-not">{tt("doğru cevap")}</span>}
                    {yanlis && i === s.benim_cevap && <span className="bd-mac-soru-not">{tt("senin cevabın")}</span>}
                  </li>
                ))}
              </ul>
              {s.ben_cevapladim && (s.benim_cevap == null || s.benim_cevap < 0) && (
                <div className="bd-mac-soru-not ayri">{tt("Süre doldu")}</div>
              )}
              <SoruBildir questionId={s.question_id} bildirildi={Boolean(s.bildirdim)} />
            </li>
          );
        })}
      </ol>
    </details>
  );
}

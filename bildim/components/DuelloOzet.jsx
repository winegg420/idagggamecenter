import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../src/lib/supabase.js";
import { tt } from "../lib/dil.js";
import { kategoriAdi } from "../lib/kategoriler.js";
import MacSorulari from "./MacSorulari.jsx";

/**
 * Paket 20 IV.5 — Düello maç özeti: doğru/yanlış, en etkili saldırı, rakibin şaşırtıldığı kategoriler,
 * kaçırılan sorular + doğru cevapları. Veri `mac_sorulari` (sunucu); burada yalnız sayılıp gösterilir,
 * ödül hesaplanmaz (ödül dökümü OdulDokumu'nda, sunucudan).
 */
export default function DuelloOzet({ id }) {
  const [sorular, setSorular] = useState(null);

  useEffect(() => {
    let aktif = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("mac_sorulari", { p_kaynak: `duello:${id}` });
        if (error) throw error;
        if (aktif) setSorular(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("[Bildim] düello özeti alınamadı:", e);
      }
    })();
    return () => { aktif = false; };
  }, [id]);

  // Sayfa saniyede birkaç kez çizilir (sayaç); türetilen listeler yalnız veri değişince yeniden kurulur
  const o = useMemo(() => {
  if (!sorular?.length) return null;
  const savunma = sorular.filter((s) => !s.ben_saldirdim);
  const saldiri = sorular.filter((s) => s.ben_saldirdim);
  const savDogru = savunma.filter((s) => s.dogru).length;
  const isabet = saldiri.filter((s) => !s.dogru);
  const geriTepen = saldiri.filter((s) => s.dogru && s.riskli).length;
  const sayim = {};
  for (const s of isabet) sayim[s.kategori] = (sayim[s.kategori] ?? 0) + 1;
  const kategoriler = Object.entries(sayim).sort((a, b) => b[1] - a[1]);
  const enEtkili = kategoriler[0];
  const kacirilan = savunma.filter((s) => !s.dogru);
  return { savunma, saldiri, savDogru, isabet, geriTepen, kategoriler, enEtkili, kacirilan };
  }, [sorular]);
  if (!o) return null;
  const { savunma, saldiri, savDogru, isabet, geriTepen, kategoriler, enEtkili, kacirilan } = o;

  return (
    <>
      <div className="bd-duello-ozet" aria-label={tt("Maç özeti")}>
        <div className="bd-duello-ozet-sayilar">
          <div><b>{savDogru}/{savunma.length}</b><span>{tt("savunmada doğru")}</span></div>
          <div><b>{isabet.length}/{saldiri.length}</b><span>{tt("saldırıda isabet")}</span></div>
          <div><b>{kacirilan.length}</b><span>{tt("kaçırılan soru")}</span></div>
        </div>
        {enEtkili && (
          <div className="bd-odul-satir">
            <span className="ad">{tt("En etkili saldırın")}</span>
            <span className="deger">{tt(kategoriAdi(enEtkili[0]))} · {tt("{n} isabet", { n: enEtkili[1] })}</span>
          </div>
        )}
        {kategoriler.length > 0 && (
          <div className="bd-odul-satir bilgi">
            <span className="ad">{tt("Rakibi şaşırttığın kategoriler: {liste}", { liste: kategoriler.map(([k]) => tt(kategoriAdi(k))).join(", ") })}</span>
          </div>
        )}
        {geriTepen > 0 && (
          <div className="bd-odul-satir bilgi">
            <span className="ad">{tt("Geri tepen riskli saldırı: {n}", { n: geriTepen })}</span>
          </div>
        )}
      </div>
      {kacirilan.length > 0 && (
        <MacSorulari sorular={kacirilan} baslik={tt("Kaçırdığın sorular ve doğru cevapları ({n})", { n: kacirilan.length })} acikBasla />
      )}
      <MacSorulari sorular={sorular} />
    </>
  );
}

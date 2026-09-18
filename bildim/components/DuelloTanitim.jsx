import { useState } from "react";
import { createPortal } from "react-dom";
import Ikon from "./Ikon.jsx";
import { tt } from "../lib/dil.js";

/**
 * Paket 20 IV.1 — Düello'ya ilk girişte kısa, atlanabilir tanıtım (4 adım).
 * Maçın İÇİNDE değil, "Rakip ara"ya ilk basışta açılır: sayaç işlemezken okunur.
 * Bir kez gösterilir; kapatınca / "Geç" deyince saklanır. Lobi altındaki "Kurallar" yeniden açar.
 * Katman position:fixed, transform yok (iOS).
 */
const DEPO = "bildim_duello_tanitim_v1";

export function duelloTanitimGoruldu() {
  try { return localStorage.getItem(DEPO) === "1"; } catch (e) { console.warn("[Bildim] localStorage okunamadı:", e?.message ?? e); return false; }
}
function isaretle() {
  try { localStorage.setItem(DEPO, "1"); } catch (e) { console.warn("[Bildim] localStorage yazılamadı:", e?.message ?? e); }
}

const ADIMLAR = [
  { ikon: "uyari", baslik: "3 can", metin: "Savunmada yanlış bilirsen ya da süren dolarsa can kaybedersin. Canı biten kaybeder; en çok 10 tur." },
  { ikon: "kilic", baslik: "Sırayla saldır, savun", metin: "Her turda önce biri, sonra öbürü saldırır. Tur her zaman iki tarafça tamamlanır: canı biten rakip de o turdaki saldırısını yapar (eşit hamle kuralı)." },
  { ikon: "kalkan", baslik: "Saldırı riski", metin: "Rakibin EN ZAYIF kategorisi maç başında sabitlenir (yüzdeler eşitse biri seçilip kilitlenir) ve kırmızı çerçeveyle görünür. Oradan saldırırsan ve rakip bilirse canı SEN kaybedersin." },
  // Joker sayıları burada TEKRARLANMAZ; kural metni lib/jokerKurallari.js'te
  // tek yerde duruyor (Paket 28 B). Burada yalnız düelloya özel olan anlatılır.
  { ikon: "yildiz", baslik: "Jokerler", metin: "Saldırı jokerleri soruyu gördüğün Saldırı Hazırlığı'nda, savunma jokerleri soru sana gelince açılır. Düelloda hiçbir joker ücretsiz değil; jokerin yoksa maçın içinden satın alabilirsin. Maç eşit biterse Altın Soru sorulur: bilen kazanır, joker yok." },
];

export default function DuelloTanitim({ onKapat }) {
  const [adim, setAdim] = useState(0);
  const kapat = () => { isaretle(); onKapat?.(); };
  const a = ADIMLAR[adim];
  const son = adim === ADIMLAR.length - 1;

  return createPortal(
    <div className="bd-arama-katman bd-duello-tanitim" role="dialog" aria-modal="true" aria-label={tt("Düello nasıl oynanır")}>
      <div className="bd-arama-kutu">
        <div className="bd-duello-tanitim-ikon" aria-hidden="true"><Ikon ad={a.ikon} boyut={34} /></div>
        <div className="bd-arama-baslik">{tt(a.baslik)}</div>
        <p className="bd-duello-tanitim-metin">{tt(a.metin)}</p>
        <div className="bd-duello-tanitim-noktalar" aria-label={tt("Adım {n}/{t}", { n: adim + 1, t: ADIMLAR.length })}>
          {ADIMLAR.map((_, i) => <span key={i} className={i === adim ? "aktif" : ""} />)}
        </div>
        <div className="bd-konum-butonlar">
          <button type="button" className="btn" onClick={() => (son ? kapat() : setAdim(adim + 1))}>
            {son ? tt("Anladım, başla") : tt("İleri")}
          </button>
          {!son && <button type="button" className="btn ikincil" onClick={kapat}>{tt("Geç")}</button>}
        </div>
      </div>
    </div>,
    document.body
  );
}

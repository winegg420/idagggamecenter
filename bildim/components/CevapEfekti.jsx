import { hareketAzalt } from "../lib/geriBildirim.js";

/**
 * Cevap sonrası görsel geri bildirim katmanı.
 * Beş oyun ekranında da aynı bileşen kullanılır (kopyalanmaz).
 *
 * dogru : cevap doğru muydu
 * puan  : kazanılan puan (yoksa/0 ise uçan rozet çizilmez)
 * seri  : üst üste doğru sayısı (>=3 ise bant görünür)
 *
 * prefers-reduced-motion açıksa hareket yok, yalnız durağan gösterim kalır.
 */
export default function CevapEfekti({ dogru, puan, seri }) {
  const azalt = hareketAzalt();
  const puanVar = dogru && puan > 0;
  const seriVar = dogru && seri >= 3;
  if (!puanVar && !seriVar) return null;

  return (
    <div className="bd-cevap-efekt" aria-hidden="true">
      {puanVar && (
        <div className={`bd-puan-ucus ${azalt ? "durgun" : ""}`}>+{puan}</div>
      )}
      {seriVar && (
        <div className={`bd-seri-bant ${azalt ? "durgun" : ""}`}>
          {seri} ÜST ÜSTE!
        </div>
      )}
    </div>
  );
}

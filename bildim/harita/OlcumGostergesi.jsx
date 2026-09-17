// ============================================================
// MEYDAN — ÖLÇÜM GÖSTERGESİ (Aşama 2C Bölüm A)
//
// `/harita?olcum=1` açar, bu cihazda hatırlanır; `?olcum=0` kapatır.
// Varsayılan KAPALI — normal oyuncu görmez. Yalnız okuma: sahneye dokunmaz.
// Metin geliştirici aracıdır, çevrilmez (sayılar tr-TR biçiminde).
// ============================================================
import { useEffect, useState } from "react";

const ANAHTAR = "bildim_harita_olcum";

/** URL'deki ?olcum=1/0 tercihini işler ve göstergenin açık olup olmadığını döner. */
export function olcumAcikMi() {
  let acik = false;
  try {
    const p = new URLSearchParams(window.location.search).get("olcum");
    if (p === "1") localStorage.setItem(ANAHTAR, "1");
    else if (p === "0") localStorage.removeItem(ANAHTAR);
    acik = p === "1" || (p !== "0" && localStorage.getItem(ANAHTAR) === "1");
  } catch {
    acik = new URLSearchParams(window.location.search).get("olcum") === "1";   // özel mod: yalnız URL
  }
  return acik;
}

const sayi = (n, basamak = 0) =>
  n == null ? "—" : n.toLocaleString("tr-TR", { minimumFractionDigits: basamak, maximumFractionDigits: basamak });

/** @param {{ canliRef: { current: any } }} props */
export default function OlcumGostergesi({ canliRef }) {
  const [v, setV] = useState(null);
  const [kare, setKare] = useState(null);     // CPU+GPU ölçümü
  const [olcuyor, setOlcuyor] = useState(false);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    const saat = setInterval(() => {
      const c = canliRef.current;
      if (!c?.dunya?.olcum) return;
      try {
        const d = c.dunya, i = d.render.info.render, o = d.olcum.oku();
        setV({
          cagri: i.calls, ucgen: i.triangles, fps: o.fps, cpu: o.cpu,
          tam: d.karakterler?.tamSayisi ?? null,
          oyuncu: 1 + (c.uzaklar?.size ?? 0) + (c.botlar?.size ?? 0),
          dpr: d.render.getPixelRatio(),
          px: `${d.render.domElement.width}×${d.render.domElement.height}`,
        });
      } catch (e) {
        console.error("[Meydan] olcum okuma:", e);
      }
    }, 500);
    return () => clearInterval(saat);
  }, [canliRef]);

  const olc = async () => {
    const d = canliRef.current?.dunya;
    if (!d?.olcum || olcuyor) return;
    setOlcuyor(true); setHata(null);
    try {
      setKare(await d.olcum.olc({ isinma: 120, ornek: 300 }));
    } catch (e) {
      console.error("[Meydan] CPU+GPU olcumu:", e);
      setHata(String(e?.message ?? e));
    } finally {
      setOlcuyor(false);
    }
  };

  return (
    <div className="bd-harita-olcum" aria-live="off">
      <div>{sayi(v?.cagri)} çağrı · {sayi(v?.ucgen)} üçgen</div>
      <div>
        <b>{sayi(v?.fps)} fps</b> · <span title="Yalnız render.render gönderim süresi, sürekli">CPU {sayi(v?.cpu, 2)} ms</span>
      </div>
      <div title="Kare + gl.finish, 120 ısınma + 300 kare; medyan (p95). Sürekli ölçülmez.">
        CPU+GPU {kare ? `${sayi(kare.cpuGpu, 2)} ms (p95 ${sayi(kare.cpuGpuP95, 2)})` : "— ms"}
        {kare?.gpu != null && <> · GPU {sayi(kare.gpu, 2)} ms</>}
        {kare && !kare.gpuDestek && <> · GPU zamanlayıcı yok</>}
      </div>
      <div>{sayi(v?.tam)} tam 3B karakter · {sayi(v?.oyuncu)} oyuncu</div>
      <div className="bd-harita-olcum-alt">
        <span>{v ? `${v.px} · DPR ${sayi(v.dpr, 2)}` : ""}</span>
        <button type="button" onClick={olc} disabled={olcuyor}>
          {olcuyor ? "ölçülüyor…" : "CPU+GPU ölç"}
        </button>
      </div>
      {hata && <div className="bd-harita-olcum-hata">{hata}</div>}
    </div>
  );
}

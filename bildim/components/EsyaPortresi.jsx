// ============================================================
// EŞYA PORTRESİ — gardırop kartındaki küçük resim
//
// Sayfada zaten canlı 3B sahne dönüyor. 12 portreyi birden üretirsek sahne
// takılır, bu yüzden iki fren var:
//   1) TEMBEL — kart görünür alana girmeden portre üretilmez
//      (IntersectionObserver).
//   2) SIRALI — kare başına EN FAZLA BİR portre üretilir; istekler modül
//      düzeyindeki kuyruğa girer, requestAnimationFrame tek tek boşaltır.
//
// Hazır olana kadar iskelet durur ve görsel kutusunun boyu baştan sabittir
// (aspect-ratio: 1), böylece resim gelince düzen zıplamaz.
//
// prefers-reduced-motion altında da küçük resimler GÖRÜNÜR: bunlar durağan
// PNG, hareket değil.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { parcaPortresi } from "../harita/portre.js";

// ---- kare başına tek render kuyruğu ----
const kuyruk = [];
let raf = 0;

function kuyruguIsle() {
  raf = 0;
  const is = kuyruk.shift();
  if (is) {
    try { is(); } catch (e) { console.error("[Portre] kuyruk isi:", e); }
  }
  if (kuyruk.length) raf = requestAnimationFrame(kuyruguIsle);
}

function siraya(is) {
  kuyruk.push(is);
  if (!raf) raf = requestAnimationFrame(kuyruguIsle);
}

/**
 * @param {object} p
 * @param {object} p.gorunum  oyuncunun o anki görünümü
 * @param {string} p.yuva     yuva kodu (sac, sapka, ust…)
 * @param {string|null} p.kod eşya kodu (null: "Yok" seçeneği)
 * @param {object} p.bilgi    esyaBilgisi(katalog) çıktısı
 * @param {number} [p.boyut]  render kenarı (px)
 */
export default function EsyaPortresi({ gorunum, yuva, kod, bilgi, boyut = 192 }) {
  const kutuRef = useRef(null);
  const [kaynak, setKaynak] = useState(null);

  // Görünüm anahtarı: ten/saç rengi değişince portre yenilensin.
  const anahtar = JSON.stringify({ ...(gorunum ?? {}), [yuva]: kod ?? null });

  useEffect(() => {
    const kutu = kutuRef.current;
    if (!kutu) return undefined;
    let atildi = false;
    setKaynak(null);

    const uret = () => {
      if (atildi) return;
      const veri = parcaPortresi(gorunum, { yuva, deger: kod }, bilgi, boyut);
      if (!atildi && veri) setKaynak(veri);
    };

    // IntersectionObserver yoksa (çok eski tarayıcı) doğrudan sıraya al.
    if (typeof IntersectionObserver !== "function") {
      siraya(uret);
      return () => { atildi = true; };
    }

    const gozcu = new IntersectionObserver((girisler) => {
      for (const g of girisler) {
        if (!g.isIntersecting) continue;
        gozcu.disconnect();
        siraya(uret);
      }
    }, { rootMargin: "120px" });
    gozcu.observe(kutu);

    return () => {
      atildi = true;
      gozcu.disconnect();
    };
    // `anahtar` görünümün tamamını temsil ediyor; bilgi tablosu katalogla sabit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anahtar, yuva, kod, boyut]);

  return (
    <span className="bd-esya-gorsel" ref={kutuRef}>
      {kaynak
        ? <img src={kaynak} alt="" draggable="false" />
        : <span className="bd-esya-iskelet" aria-hidden="true" />}
    </span>
  );
}

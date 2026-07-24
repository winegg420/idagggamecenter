// ============================================================
// KAFA TOPU — misafir tarafı durum yumuşatma.
// Host'tan gelen 20Hz "durum" paketleri tamponlanır ve render,
// INTERP_GECIKME_MS kadar geriden iki paket arasında lineer
// interpolasyonla çizilir (PatiRun deseninin sadeleştirilmiş hali).
// ============================================================

import { AG } from "../shared/sabitler.js";

// Mobil ağda paket aralığı dalgalanır (jitter). Sabit tampon ya çok kısa
// (paket gecikince donma/takılma) ya da gereksiz uzun (his gecikmesi) olur.
// Bu yüzden tampon ölçülen jitter'a göre kendini ayarlar.
const GECIKME_MIN = 70;
const GECIKME_MAX = 260;
const EKSTRAPOLASYON_MAX = 90; // ms — paket gecikirse bu kadar ileri tahmin

export function interpKur() {
  const tampon = []; // { alinma: yerelMs, snap }
  let hedefGecikme = AG.INTERP_GECIKME_MS;
  let sonAlinma = 0;
  let araEma = AG.DURUM_HZ_MS;
  let jitterEma = 8;

  return {
    ekle(snap) {
      const simdi = performance.now();
      if (sonAlinma) {
        const ara = simdi - sonAlinma;
        // 2 sn'den uzun boşluk = sekme arka planda kalmıştı; ölçüme katma.
        if (ara < 2000) {
          jitterEma = jitterEma * 0.85 + Math.abs(ara - araEma) * 0.15;
          araEma = araEma * 0.85 + ara * 0.15;
          const istenen = Math.min(GECIKME_MAX, Math.max(GECIKME_MIN, araEma + jitterEma * 2.5));
          // Yukarı hızlı uyum (takılmayı hemen kes), aşağı yavaş (gecikmeyi sızdır).
          const kat = istenen > hedefGecikme ? 0.5 : 0.04;
          hedefGecikme += (istenen - hedefGecikme) * kat;
        }
      }
      sonAlinma = simdi;
      tampon.push({ alinma: simdi, snap });
      // 2 saniyeden eski paketleri at
      const esik = simdi - 2000;
      while (tampon.length > 2 && tampon[0].alinma < esik) tampon.shift();
    },

    // Hedef zamana göre interpolasyonlu görünüm döndürür.
    // Paket yoksa null; tek paket varsa onu döndürür.
    ornekle() {
      if (tampon.length === 0) return null;
      const hedef = performance.now() - hedefGecikme;

      // hedefi saran iki paketi bul; hedef son pakedin ötesindeyse (veri gecikti)
      // SON İKİ paket kullanılır → eğim doğru, kısa ekstrapolasyon anlamlı olur.
      const n = tampon.length;
      let a = tampon[Math.max(0, n - 2)], b = tampon[n - 1];
      for (let i = 0; i < tampon.length - 1; i++) {
        if (tampon[i].alinma <= hedef && tampon[i + 1].alinma >= hedef) {
          a = tampon[i];
          b = tampon[i + 1];
          break;
        }
      }
      // Tek/aynı paket: tüketici (girdi öngörüsü) oy dizisini değiştirebildiği
      // için orijinal snap'i DEĞİL kopyasını ver (paket bozulmasın).
      if (a === b || b.alinma === a.alinma) {
        return { ...b.snap, oy: b.snap.oy.map((o) => ({ ...o })) };
      }

      // Paket gecikirse son iki pakedin hızıyla kısa süre İLERİ tahmin edilir
      // (donup zıplamak yerine akmaya devam eder). t>1 = ekstrapolasyon.
      const aralik = b.alinma - a.alinma;
      const tavan = 1 + EKSTRAPOLASYON_MAX / aralik;
      const t = Math.min(tavan, Math.max(0, (hedef - a.alinma) / aralik));
      const L = (x, y) => x + (y - x) * t;

      // Ayrık alanlar (skor, faz, olaylar) her zaman yeni paketten alınır;
      // olaylar ekle() sırasında değil tüketici tarafından işlenir.
      return {
        ...b.snap,
        top: {
          ...b.snap.top,
          x: L(a.snap.top.x, b.snap.top.x),
          y: L(a.snap.top.y, b.snap.top.y),
          a: L(a.snap.top.a, b.snap.top.a),
        },
        oy: b.snap.oy.map((oyB, i) => {
          const oyA = a.snap.oy[i] || oyB;
          return { ...oyB, x: L(oyA.x, oyB.x), y: L(oyA.y, oyB.y) };
        }),
      };
    },
  };
}

// ============================================================
// KAFA TOPU — güç sistemi.
// İki mekanizma: (1) rastgele düşen güç-yükseltmeler,
// (2) karaktere özel yetenekler (soğuma süreli).
// Tüm mantık host simülasyonunda çalışır; misafirler sadece görür.
// ============================================================

import Matter from "matter-js";
import { SAHA, GUC, YETENEK, OYUNCU } from "../shared/sabitler.js";

const { Body } = Matter;

// Efekt bit bayrakları (ağ/render için kompakt gösterim)
export const EFEKT_BAYRAK = {
  ates: 1, buz: 2, hiz: 4, dev_sut: 8, buyuk: 16, mini: 32, kalkan: 64,
};

// Düşen güç türleri
export const GUC_TURLERI = [
  { tip: "buyuk_kafa",  ikon: "🎈", hedef: "kendi" },   // kafa 1.5x
  { tip: "hiz",         ikon: "💨", hedef: "kendi" },   // hız 1.45x
  { tip: "dev_sut",     ikon: "💥", hedef: "kendi" },   // vuruş 1.7x
  { tip: "rakip_yavas", ikon: "🐌", hedef: "rakip" },   // rakip 0.55x hız
  { tip: "mini_rakip",  ikon: "🪄", hedef: "rakip" },   // rakip kafası 0.65x
];

function rastgeleAralik(min, max) {
  return min + Math.random() * (max - min);
}

export function gucDurumKur() {
  return {
    sonraki: rastgeleAralik(GUC.ARALIK_MIN_MS, GUC.ARALIK_MAX_MS),
    aktif: [],   // sahadaki toplanabilir güçler: {id, tip, ikon, x, y, yereIndi}
    sayac: 0,
  };
}

// Bir oyuncunun anlık efekt çarpanları (simMs = simülasyon zamanı).
export function efektCarpanlari(oyDurum, simMs) {
  const e = oyDurum.efekt;
  const hiz = (e.hiz > simMs ? 1.45 : 1) * (e.buz > simMs ? YETENEK.BUZ_CARPAN : 1)
            * (e.yavas > simMs ? 0.55 : 1);
  const vurus = (e.ates > simMs ? YETENEK.ATES_CARPAN : 1) * (e.dev_sut > simMs ? 1.7 : 1);
  const olcek = (e.dev > simMs ? YETENEK.DEV_KAFA_OLCEK : 1)
              * (e.buyuk > simMs ? 1.5 : 1) * (e.mini > simMs ? 0.65 : 1);
  return { hiz, vurus, olcek: Math.min(1.8, Math.max(0.55, olcek)) };
}

// Efekt bayraklarını hesapla (ağ paketi için).
export function efektBayraklari(oyDurum, simMs) {
  const e = oyDurum.efekt;
  let b = 0;
  if (e.ates > simMs) b |= EFEKT_BAYRAK.ates;
  if (e.buz > simMs || e.yavas > simMs) b |= EFEKT_BAYRAK.buz;
  if (e.hiz > simMs) b |= EFEKT_BAYRAK.hiz;
  if (e.dev_sut > simMs) b |= EFEKT_BAYRAK.dev_sut;
  if (e.buyuk > simMs || e.dev > simMs) b |= EFEKT_BAYRAK.buyuk;
  if (e.mini > simMs) b |= EFEKT_BAYRAK.mini;
  return b;
}

// Her fizik adımında çağrılır: güç doğurma, düşme, toplama, süre bitimi.
export function guclerTick(mac, tickMs) {
  const g = mac.guc;
  const simdi = mac.simMs;

  // Yeni güç doğur
  g.sonraki -= tickMs;
  if (g.sonraki <= 0 && g.aktif.length < 2 && mac.faz === "oyun") {
    const tur = GUC_TURLERI[Math.floor(Math.random() * GUC_TURLERI.length)];
    g.aktif.push({
      id: ++g.sayac, tip: tur.tip, ikon: tur.ikon, hedef: tur.hedef,
      x: 150 + Math.random() * (SAHA.W - 300), y: -30, yereIndi: 0,
    });
    g.sonraki = rastgeleAralik(GUC.ARALIK_MIN_MS, GUC.ARALIK_MAX_MS);
    mac.olaylar.push({ tip: "guc_dogdu" });
  }

  // Düşme + toplama + yerde bekleme
  const zeminY = SAHA.ZEMIN_Y - GUC.R;
  for (let i = g.aktif.length - 1; i >= 0; i--) {
    const p = g.aktif[i];
    if (p.y < zeminY) p.y += GUC.DUSME_HIZ;
    else if (!p.yereIndi) p.yereIndi = simdi;
    if (p.yereIndi && simdi - p.yereIndi > GUC.YERDE_KALMA_MS) {
      g.aktif.splice(i, 1);
      continue;
    }
    // Toplama: bir oyuncu kafasıyla değdi mi?
    for (let s = 0; s < mac.dunya.oyuncular.length; s++) {
      const b = mac.dunya.oyuncular[s];
      const d = Math.hypot(b.position.x - p.x, b.position.y - p.y);
      if (d < OYUNCU.KAFA_R * mac.oyuncuDurum[s].olcek + GUC.R) {
        gucUygula(mac, s, p);
        g.aktif.splice(i, 1);
        break;
      }
    }
  }
}

// Toplanan gücün etkisini uygula.
function gucUygula(mac, slot, guc) {
  const simdi = mac.simMs;
  const bitis = simdi + GUC.ETKI_MS;
  const benimTakim = mac.meta[slot].takim;

  const hedefler =
    guc.hedef === "kendi"
      ? [slot]
      : mac.meta.map((m, i) => i).filter((i) => mac.meta[i].takim !== benimTakim);

  for (const h of hedefler) {
    const e = mac.oyuncuDurum[h].efekt;
    if (guc.tip === "buyuk_kafa") e.buyuk = bitis;
    else if (guc.tip === "hiz") e.hiz = bitis;
    else if (guc.tip === "dev_sut") e.dev_sut = bitis;
    else if (guc.tip === "rakip_yavas") e.yavas = bitis;
    else if (guc.tip === "mini_rakip") e.mini = bitis;
  }
  mac.olaylar.push({ tip: "guc_alindi", slot, guc: guc.tip, ikon: guc.ikon });
}

// Karaktere özel yeteneği kullan (soğuma kontrolü dahil).
export function yetenekKullan(mac, slot) {
  const d = mac.oyuncuDurum[slot];
  const simdi = mac.simMs;
  const bekleme = d.adminGuc ? 1000 : YETENEK.BEKLEME_MS; // admin: neredeyse sınırsız
  if (simdi - d.yetenekSon < bekleme) return;
  if (mac.faz !== "oyun") return;

  const yetenek = mac.meta[slot].yetenek || "ates_sutu";
  const takim = mac.meta[slot].takim;
  d.yetenekSon = simdi;

  if (yetenek === "ates_sutu") {
    d.efekt.ates = simdi + YETENEK.ATES_SUTU_MS;
  } else if (yetenek === "buz") {
    for (let i = 0; i < mac.meta.length; i++) {
      if (mac.meta[i].takim !== takim) mac.oyuncuDurum[i].efekt.buz = simdi + YETENEK.BUZ_MS;
    }
  } else if (yetenek === "isinlanma") {
    // Topun hemen yanına (kendi kalesi tarafına) ışınlan.
    const top = mac.dunya.top.position;
    const yon = takim === 1 ? -1 : 1; // kendi tarafından yaklaş
    const b = mac.dunya.oyuncular[slot];
    const x = Math.min(SAHA.W - 60, Math.max(60, top.x + yon * (OYUNCU.KAFA_R + 26)));
    const y = Math.min(SAHA.ZEMIN_Y - OYUNCU.KAFA_R, Math.max(80, top.y));
    Body.setPosition(b, { x, y });
    Body.setVelocity(b, { x: 0, y: 0 });
  } else if (yetenek === "kalkan") {
    // Kendi kalesinin ağzına geçici bariyer.
    if (d.kalkanBody) mac.dunya.kalkanKaldir(d.kalkanBody);
    d.kalkanBody = mac.dunya.kalkanEkle(takim);
    d.kalkanBitis = simdi + YETENEK.KALKAN_MS;
  } else if (yetenek === "dev_kafa") {
    d.efekt.dev = simdi + YETENEK.DEV_KAFA_MS;
  }

  mac.olaylar.push({ tip: "yetenek", slot, yetenek });
}

// Süresi dolan kalkan bariyerlerini kaldır (her tick çağrılır).
export function kalkanlariTemizle(mac) {
  for (const d of mac.oyuncuDurum) {
    if (d.kalkanBody && mac.simMs > d.kalkanBitis) {
      mac.dunya.kalkanKaldir(d.kalkanBody);
      d.kalkanBody = null;
    }
  }
}

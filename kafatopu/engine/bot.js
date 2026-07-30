// ============================================================
// KAFA TOPU — bot yapay zekâsı (antrenman modu).
// Basit ama etkili: topu takip et, savun, fırsatta vur, yeteneği akıllıca kullan.
// Her tick host simülasyonunda çağrılır, normal girdi üretir.
// ============================================================

import { SAHA, OYUNCU, TOP } from "../shared/sabitler.js";
import { bosGirdi } from "./oyun.js";

// Bot zorluk ayarı (tepki gecikmesi + hata payı + kaçırma payları).
// Not: bot fazla güçlüydü (neredeyse yenilmiyordu); değerler insansı
// seviyeye çekildi — hâlâ savunma yapar ve gol atar, ama açık verir.
const BOT = {
  TEPKI_MS: 205,     // karar tazeleme aralığı (yüksek = geç tepki)
  HATA: 44,          // hedef x'e eklenen rastgele sapma
  VURUS_MESAFE: OYUNCU.VURUS_MENZIL * 0.84,
  TAHMIN_KATSAYI: 1.8, // balistik tahmin gücü (yüksek = daha isabetli kestirim)
  ZIPLA_SANS: 0.72,  // fırsat başına zıplama olasılığı (karar anında belirlenir)
  VURUS_SANS: 0.45,  // menzilde vuruş olasılığı
  ACIL_SANS: 0.82,   // kale ağzındaki acil temizleme olasılığı
  GUC_SANS: 0.008,   // yetenek kullanma olasılığı (tick başına)
  DALGINLIK_SANS: 0.08, // karar başına kısa dalgınlık (oyuncuya boşluk açar)
  DALGINLIK_MS: 380,
};

export function botDurumKur() {
  return {
    hedefX: SAHA.W / 2,
    sonKarar: -9999,
    sapma: 0,
    ziplaIzin: true,
    dalginBitis: -9999,
  };
}

export function botGirdiHesapla(mac, slot, botDurum) {
  const g = bosGirdi();
  const b = mac.dunya.oyuncular[slot];
  const top = mac.dunya.top;
  const takim = mac.meta[slot].takim;
  const kaleX = takim === 1 ? 0 : SAHA.W;          // kendi kalesi
  const yon = takim === 1 ? 1 : -1;                 // hücum yönü

  if (mac.faz !== "oyun") return g;

  // Karar tazeleme (insansı gecikme)
  if (mac.simMs - botDurum.sonKarar > BOT.TEPKI_MS) {
    botDurum.sonKarar = mac.simMs;
    botDurum.sapma = (Math.random() - 0.5) * BOT.HATA * 2;
    botDurum.ziplaIzin = Math.random() < BOT.ZIPLA_SANS;
    // Ara sıra dalgınlaşır: kısa süre hiçbir şey yapmaz (oyuncuya fırsat)
    if (Math.random() < BOT.DALGINLIK_SANS) {
      botDurum.dalginBitis = mac.simMs + BOT.DALGINLIK_MS;
    }

    // Topun yere düşeceği yaklaşık x'i kestir (basit balistik tahmin)
    const dusmeSuresi = Math.max(0, (SAHA.ZEMIN_Y - top.position.y) / Math.max(4, Math.abs(top.velocity.y) + 4));
    let tahminX = top.position.x + top.velocity.x * dusmeSuresi * BOT.TAHMIN_KATSAYI;
    tahminX = Math.min(SAHA.W - 50, Math.max(50, tahminX));

    // Top kendi yarı sahamıza geliyorsa araya gir (savunma pozisyonu:
    // topla kale arasında dur), değilse topa bas.
    const kendiYarim = takim === 1 ? top.position.x < SAHA.W / 2 : top.position.x > SAHA.W / 2;
    botDurum.hedefX = kendiYarim
      ? tahminX - yon * (OYUNCU.KAFA_R * 0.9)   // topun hafif kale tarafında dur
      : tahminX - yon * OYUNCU.KAFA_R * 0.5;
    botDurum.hedefX += botDurum.sapma;
  }

  // Dalgınlık: kısa süre girdi üretmez (boş girdi döner)
  if (mac.simMs < botDurum.dalginBitis) return g;

  // Hareket
  const fark = botDurum.hedefX - b.position.x;
  if (Math.abs(fark) > 14) {
    if (fark > 0) g.sag = true; else g.sol = true;
  }

  const dx = top.position.x - b.position.x;
  const dy = top.position.y - b.position.y;
  const mesafe = Math.hypot(dx, dy);

  // Zıplama: top yakın ve yukarıdaysa, ya da kafa vuruşu fırsatı varsa
  if (botDurum.ziplaIzin && mesafe < 190 && dy < -OYUNCU.KAFA_R && top.position.y < SAHA.ZEMIN_Y - 120) {
    g.zipla = true;
  }

  // Vuruş: top menzilde ve rakip kalesi yönünde anlamlıysa
  const topOnumde = Math.sign(dx) === yon || Math.abs(dx) < TOP.R * 2;
  if (mesafe < BOT.VURUS_MESAFE && topOnumde && Math.random() < BOT.VURUS_SANS) {
    g.vur = true;
  }

  // Acil savunma: top kaleme çok yaklaştıysa uzaklaştırmayı dener (garanti değil)
  const kaleyeMesafe = Math.abs(top.position.x - kaleX);
  if (kaleyeMesafe < 200 && mesafe < BOT.VURUS_MESAFE + 20 && Math.random() < BOT.ACIL_SANS) {
    g.vur = true;
  }

  // Topsuz vuruş: top uzaktayken önümdeki rakibi ara sıra bayılt
  if (mesafe > BOT.VURUS_MESAFE * 1.5) {
    for (let r = 0; r < mac.meta.length; r++) {
      if (mac.meta[r].takim === takim) continue;
      const rb = mac.dunya.oyuncular[r];
      const rdx = rb.position.x - b.position.x;
      if (Math.abs(rdx) < BOT.VURUS_MESAFE &&
          Math.abs(rb.position.y - b.position.y) < OYUNCU.KAFA_R * 1.6 &&
          Math.sign(rdx) === yon && Math.random() < 0.03) {
        g.vur = true;
        break;
      }
    }
  }

  // Yetenek: skor gerideyse ya da top tehlikedeyken kullan (kabaca)
  const benimSkor = mac.skor[takim - 1];
  const rakipSkor = mac.skor[takim === 1 ? 1 : 0];
  if ((rakipSkor > benimSkor || kaleyeMesafe < 250) && Math.random() < BOT.GUC_SANS) {
    g.guc = true;
  }

  return g;
}

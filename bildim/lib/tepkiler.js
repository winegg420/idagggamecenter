import { tt } from "./dil.js";
// Maç içi tepkiler — işletim sistemi emojisi yerine kendi SVG ikonlarımız.
//
// Neden: 👍😂😮😡🔥😎 her cihazda farklı çiziliyor (Android/iOS/Windows üç
// ayrı görsel dil) ve oyunun çizgi ikon diliyle hiç ilgisi yok. Oyundan
// emojiler zaten temizlenmişti, tepki çubuğunda geri gelmişlerdi.
//
// ÖNEMLİ: sunucuya giden mesaj metni DEĞİŞMEDİ. `deger` alanı eskisi gibi
// emoji karakteri olarak gönderiliyor; yalnız EKRANDA ikon çiziliyor.
// Böylece eski istemcilerle ve kayıtlı mesajlarla uyum bozulmuyor.

export const TEPKILER = [
  { ad: "begeni",   deger: "👍", etiket: tt("Beğendim") },
  { ad: "gulen",    deger: "😂", etiket: tt("Çok komik") },
  { ad: "sasirmis", deger: "😮", etiket: tt("Şaşırdım") },
  { ad: "kizgin",   deger: "😡", etiket: tt("Sinirlendim") },
  { ad: "ates",     deger: "🔥", etiket: tt("Harika") },
  { ad: "havali",   deger: "😎", etiket: tt("Havalı") },
];

/** Mesaj bir tepki emojisiyse ikon adını döndürür, değilse null. */
export function tepkiIkonu(mesaj) {
  const t = TEPKILER.find((x) => x.deger === mesaj);
  return t ? t.ad : null;
}

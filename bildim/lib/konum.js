// Konum (ülke/şehir) ve haftalık lig yardımcıları.
// Ülke/şehir listeleri DB'deki `ulkeler` / `sehirler` tablolarından gelir
// (sunucu doğrulaması için); burada yalnızca gösterim yardımcıları var.

// ISO-3166 alpha-2 kodundan bayrak emojisi (regional indicator sembolleri).
export function bayrak(kod) {
  if (!kod || kod.length !== 2) return "🌍";
  const buyuk = kod.toUpperCase();
  if (!/^[A-Z]{2}$/.test(buyuk)) return "🌍";
  return String.fromCodePoint(
    ...[...buyuk].map((h) => 0x1f1e6 + h.charCodeAt(0) - 65)
  );
}

// Konum günde bir kez değişebilir (RPC de aynı kuralı uygular).
export const KONUM_KILIT_MS = 24 * 60 * 60 * 1000;

// Kalan kilit süresi (ms). 0 = değiştirilebilir.
export function konumKilidiKalan(konumDegistiAt) {
  if (!konumDegistiAt) return 0;
  const bitis = new Date(konumDegistiAt).getTime() + KONUM_KILIT_MS;
  return Math.max(0, bitis - Date.now());
}

// Haftanın bitişi: Pazartesi 00:00 TSİ = Pazar 21:00 UTC (Türkiye yıl boyu UTC+3).
// Sunucudaki `bildim-hafta-kapat` cron'u ile aynı an.
export function haftaBitisi() {
  const simdi = new Date();
  const hedef = new Date(simdi);
  hedef.setUTCHours(21, 0, 0, 0);
  // Pazar = 0
  const gunFarki = (7 - hedef.getUTCDay()) % 7;
  hedef.setUTCDate(hedef.getUTCDate() + gunFarki);
  if (hedef <= simdi) hedef.setUTCDate(hedef.getUTCDate() + 7);
  return hedef;
}

// "3 gün 4 saat" / "5 saat 12 dk" / "42 dk" biçiminde kısa süre metni
export function sureMetni(ms) {
  const sn = Math.max(0, Math.floor(ms / 1000));
  const gun = Math.floor(sn / 86400);
  const saat = Math.floor((sn % 86400) / 3600);
  const dk = Math.floor((sn % 3600) / 60);
  if (gun > 0) return `${gun} gün ${saat} saat`;
  if (saat > 0) return `${saat} saat ${dk} dk`;
  return `${dk} dk`;
}

// Bir sonraki 22:00 (Europe/Istanbul) zamanını UTC Date olarak döndürür.
// Türkiye yıl boyu UTC+3 kullanır.
export function sonrakiTurnuvaZamani() {
  const simdi = new Date();
  // İstanbul saatine göre bugünün 22:00'si = 19:00 UTC
  const hedef = new Date(simdi);
  hedef.setUTCHours(19, 0, 0, 0);
  if (hedef <= simdi) hedef.setUTCDate(hedef.getUTCDate() + 1);
  return hedef;
}

export function geriSayim(hedef) {
  const fark = Math.max(0, hedef.getTime() - Date.now());
  const sn = Math.floor(fark / 1000);
  return {
    saat: Math.floor(sn / 3600),
    dakika: Math.floor((sn % 3600) / 60),
    saniye: sn % 60,
    toplamSn: sn,
  };
}

// Sunucu zamanına göre kalan soru süresi (saniye)
export function kalanSure(baslangicIso, sunucuZamaniIso, sureSn = 15) {
  // Sunucu-istemci saat farkını telafi et
  const sunucuOffset = sunucuZamaniIso
    ? new Date(sunucuZamaniIso).getTime() - Date.now()
    : 0;
  const baslangic = new Date(baslangicIso).getTime();
  const sunucuSimdi = Date.now() + sunucuOffset;
  return Math.max(0, sureSn - (sunucuSimdi - baslangic) / 1000);
}

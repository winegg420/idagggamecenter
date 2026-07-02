// Günde iki turnuva: 10:00 (sabah) ve 22:00 (akşam), Europe/Istanbul.
// Türkiye yıl boyu UTC+3 kullanır: 10:00 TSİ = 07:00 UTC, 22:00 TSİ = 19:00 UTC.
export function sonrakiTurnuvaZamani() {
  const simdi = new Date();
  const sabah = new Date(simdi);
  sabah.setUTCHours(7, 0, 0, 0);
  const aksam = new Date(simdi);
  aksam.setUTCHours(19, 0, 0, 0);
  if (simdi < sabah) return sabah;
  if (simdi < aksam) return aksam;
  sabah.setUTCDate(sabah.getUTCDate() + 1);
  return sabah;
}

// Sıradaki turnuva sabah mı akşam mı?
export function sonrakiTurnuvaSeans() {
  return sonrakiTurnuvaZamani().getUTCHours() === 7 ? "sabah" : "aksam";
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

// Sunucu-istemci saat farkı (ms). Soru verisi geldiği anda BİR KEZ hesaplanmalı;
// her tikte sabit sunucu_zamani ile yeniden hesaplanırsa Date.now() sadeleşir
// ve kalan süre donar.
export function sunucuOffsetMs(sunucuZamaniIso) {
  return sunucuZamaniIso
    ? new Date(sunucuZamaniIso).getTime() - Date.now()
    : 0;
}

// Sunucu zamanına göre kalan soru süresi (saniye)
export function kalanSure(baslangicIso, offsetMs = 0, sureSn = 15) {
  const baslangic = new Date(baslangicIso).getTime();
  const sunucuSimdi = Date.now() + offsetMs;
  return Math.max(0, sureSn - (sunucuSimdi - baslangic) / 1000);
}

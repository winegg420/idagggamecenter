// Günde iki turnuva. Saatler SABİT ve TÜRKİYE saatine göre (oyuncunun
// yerel saatine göre DEĞİL): yerel saate göre olsaydı zaten ince olan
// oyuncu havuzu saat dilimlerine bölünür, turnuvalar boş kalırdı.
//
// Tek kaynak sunucudaki oyun_ayarlari (turnuva_saat_sabah/aksam). Buradaki
// değerler yalnız sunucuya ulaşılamadığında kullanılan varsayılan.
// Türkiye yıl boyu UTC+3: 13:00 TSİ = 10:00 UTC, 21:50 TSİ = 18:50 UTC.
const VARSAYILAN = { sabah: [10, 0], aksam: [18, 50] };   // UTC
let saatler = VARSAYILAN;

/** Sunucudan gelen "13:00" / "21:50" (TSİ) değerlerini UTC'ye çevirip saklar. */
export function turnuvaSaatleriniAyarla(sabahTsi, aksamTsi) {
  const cevir = (metin, yedek) => {
    try {
      const [s, d] = String(metin).split(":").map(Number);
      if (!Number.isFinite(s) || !Number.isFinite(d)) return yedek;
      const utcSaat = (s - 3 + 24) % 24;   // TSİ = UTC+3
      return [utcSaat, d];
    } catch {
      return yedek;
    }
  };
  saatler = {
    sabah: cevir(sabahTsi, VARSAYILAN.sabah),
    aksam: cevir(aksamTsi, VARSAYILAN.aksam),
  };
}

/** Gösterim için TSİ metni ("13:00"). */
export function turnuvaSaatMetni(seans) {
  const [s, d] = saatler[seans] ?? VARSAYILAN[seans];
  const tsi = (s + 3) % 24;
  return `${String(tsi).padStart(2, "0")}:${String(d).padStart(2, "0")}`;
}

export function sonrakiTurnuvaZamani() {
  const simdi = new Date();
  const sabah = new Date(simdi);
  sabah.setUTCHours(saatler.sabah[0], saatler.sabah[1], 0, 0);
  const aksam = new Date(simdi);
  aksam.setUTCHours(saatler.aksam[0], saatler.aksam[1], 0, 0);
  if (simdi < sabah) return sabah;
  if (simdi < aksam) return aksam;
  sabah.setUTCDate(sabah.getUTCDate() + 1);
  return sabah;
}

// Sıradaki turnuva sabah mı akşam mı?
export function sonrakiTurnuvaSeans() {
  const z = sonrakiTurnuvaZamani();
  return z.getUTCHours() === saatler.sabah[0] && z.getUTCMinutes() === saatler.sabah[1]
    ? "sabah"
    : "aksam";
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

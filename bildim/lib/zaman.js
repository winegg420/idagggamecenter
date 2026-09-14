// Günde iki turnuva. Saatler SABİT ve TÜRKİYE saatine göre (oyuncunun
// yerel saatine göre DEĞİL): yerel saate göre olsaydı zaten ince olan
// oyuncu havuzu saat dilimlerine bölünür, turnuvalar boş kalırdı.
//
// Tek kaynak sunucudaki oyun_ayarlari (turnuva_saat_sabah/aksam). Buradaki
// değerler yalnız sunucuya ulaşılamadığında kullanılan varsayılan.
// Türkiye yıl boyu UTC+3: 13:00 TSİ = 10:00 UTC, 21:50 TSİ = 18:50 UTC.
const VARSAYILAN = { sabah: [10, 0], aksam: [18, 50] };   // UTC
let saatler = VARSAYILAN;

// ---- GÜNDE 7 TURNUVA (Paket 12, madde 7) ----
// Tek kaynak artık oyun_ayarlari.turnuva_saatleri: TSİ "HH:MM" dizisi,
// "24:00" o günün gece yarısı. Yukarıdaki sabah/akşam değerleri eski
// çağrılar kırılmasın diye duruyor; sıradaki turnuva hesabı listeden.
const VARSAYILAN_LISTE = ["10:00", "12:30", "15:00", "18:00", "20:00", "22:00", "24:00"];
let turnuvaListesi = VARSAYILAN_LISTE;
const TSI_MS = 3 * 3600 * 1000;   // Türkiye yıl boyu UTC+3
const GUN_MS = 24 * 3600 * 1000;

/** "12:30" → 750 (dakika); geçersizse null. "24:00" geçerli, "24:10" değil. */
function dakikaCoz(metin) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(metin ?? "").trim());
  if (!m) return null;
  const s = Number(m[1]), d = Number(m[2]);
  if (s > 24 || d > 59 || (s === 24 && d > 0)) return null;
  return s * 60 + d;
}

/** Sunucudaki listeyi (oyun_ayarlari.turnuva_saatleri) saklar; bozuksa varsayılan kalır. */
export function turnuvaListesiniAyarla(dizi) {
  try {
    const temiz = [...new Set((Array.isArray(dizi) ? dizi : []).map(String))]
      .filter((x) => dakikaCoz(x) !== null)
      .sort((a, b) => dakikaCoz(a) - dakikaCoz(b));
    if (temiz.length) turnuvaListesi = temiz;
  } catch {
    /* varsayılan liste kalır */
  }
}

/** Günün turnuva saatleri (TSİ metin, sıralı). */
export function turnuvaSaatleri() {
  return [...turnuvaListesi];
}

/** Verilen anın TÜRKİYE tarihine göre gün başlangıcı (UTC ms). */
function tsiGunBasi(ms) {
  const t = new Date(ms + TSI_MS);
  return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - TSI_MS;
}

function gununTurnuvalari(gunBasiMs) {
  return turnuvaListesi.map((saat) => ({ saat, an: new Date(gunBasiMs + dakikaCoz(saat) * 60000) }));
}

/** Sıradaki turnuva: { saat: "20:00", an: Date }. */
export function sonrakiTurnuva(simdi = new Date()) {
  const ms = simdi.getTime();
  const bugun = tsiGunBasi(ms);
  // Dünün "24:00"ı bugünün 00:00'ıdır; o yüzden dünden başlanır.
  for (const gun of [bugun - GUN_MS, bugun, bugun + GUN_MS]) {
    for (const t of gununTurnuvalari(gun)) if (t.an.getTime() > ms) return t;
  }
  return gununTurnuvalari(bugun + GUN_MS)[0];
}

/** Sıradaki turnuvanın TSİ saati ("22:00"). */
export function sonrakiTurnuvaSaati() {
  return sonrakiTurnuva().saat;
}

/** Bugün (TSİ) henüz başlamamış turnuvaların saatleri. */
export function bugunKalanTurnuvalar(simdi = new Date()) {
  const ms = simdi.getTime();
  return gununTurnuvalari(tsiGunBasi(ms)).filter((t) => t.an.getTime() > ms).map((t) => t.saat);
}

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

// ESKİDEN: yalnız sabah/akşam arasında seçim yapıyordu. Artık günün
// listesinden (Paket 12, madde 7); geri sayımların hepsi buradan beslenir.
export function sonrakiTurnuvaZamani() {
  return sonrakiTurnuva().an;
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

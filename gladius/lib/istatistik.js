// ============================================================
// Yerel istatistik / lig / rozet sistemi (tasarım 2.1).
// localStorage tabanlı (lib/secim.js deseniyle). Faz 1 migration'ı uygulanınca
// gl_profiller ile senkron edilecek (TODO: DB katmanı).
// ============================================================

const ANAHTAR = "gl_istatistik";

// Lig eşikleri (düşükten yükseğe) — tasarım 2.1.
export const LIGLER = [
  { id: "cirak", ad: "Çırak", esik: 0 },
  { id: "gladyator", ad: "Gladyatör", esik: 300 },
  { id: "sampiyon", ad: "Şampiyon", esik: 800 },
  { id: "efsane", ad: "Efsane", esik: 1800 },
  { id: "imparator", ad: "İmparator", esik: 4000 },
];

// Rozet tanımları (tasarım 2.1). kosul(sonuc) → kazanıldı mı.
export const ROZETLER = [
  { id: "ilk_kan", ad: "İlk Kan", aciklama: "Round'da ilk elemeyi yaptın", kosul: (s) => s.ilkKan },
  { id: "arena_fatihi", ad: "Arena Fatihi", aciklama: "Round'u kazandın", kosul: (s) => s.kazandi },
  { id: "son_nefes", ad: "Son Nefes", aciklama: "Round'da en son elenen sendin (2.)", kosul: (s) => s.sonNefes },
  { id: "aslan_avcisi", ad: "Aslan Avcısı", aciklama: "Bir aslan öldürdün", kosul: (s) => (s.aslanEleme || 0) > 0 },
  { id: "hayatta_kalan", ad: "Hayatta Kalan", aciklama: "Uzun süre hayatta kaldın", kosul: (s) => s.kazandi || (s.hayattaSure || 0) >= 45 },
];

export function ligBul(puan) {
  let sonuc = LIGLER[0];
  for (const l of LIGLER) if (puan >= l.esik) sonuc = l;
  return sonuc;
}

const VARSAYILAN = {
  puan: 0, macSayisi: 0, galibiyet: 0, toplamEleme: 0, enUzunHayatta: 0,
  rozetler: [],           // kazanılan benzersiz rozet id'leri
  gunlukSeri: 0, sonGiris: null,  // (günlük görev/seri sonraki adımda kullanılacak)
};

export function istatistikAl() {
  try {
    const ham = localStorage.getItem(ANAHTAR);
    if (!ham) return { ...VARSAYILAN, rozetler: [] };
    const s = JSON.parse(ham);
    return { ...VARSAYILAN, ...s, rozetler: Array.isArray(s.rozetler) ? s.rozetler : [] };
  } catch (err) {
    console.error("[Gladius] istatistik okunamadı:", err);
    return { ...VARSAYILAN, rozetler: [] };
  }
}

export function istatistikKaydet(kayit) {
  try {
    localStorage.setItem(ANAHTAR, JSON.stringify(kayit));
    return true;
  } catch (err) {
    console.error("[Gladius] istatistik kaydedilemedi:", err);
    return false;
  }
}

// Round sonu: sonuç → kazanılan rozetler + puan + lig; kalıcı kayда işlenir.
// sonuc = { kazandi, eleme, aslanEleme, ilkKan, sonNefes, hayattaSure }
export function macBitir(sonuc) {
  const kayit = istatistikAl();

  const kazanilanRozetler = ROZETLER.filter((rz) => {
    try { return rz.kosul(sonuc); } catch { return false; }
  });

  const kazanilanPuan = 20
    + (sonuc.eleme || 0) * 10
    + (sonuc.kazandi ? 100 : 0)
    + (sonuc.aslanEleme || 0) * 15;

  const oncekiPuan = kayit.puan;
  kayit.puan += kazanilanPuan;
  kayit.macSayisi += 1;
  if (sonuc.kazandi) kayit.galibiyet += 1;
  kayit.toplamEleme += (sonuc.eleme || 0);
  kayit.enUzunHayatta = Math.max(kayit.enUzunHayatta, Math.round(sonuc.hayattaSure || 0));
  for (const rz of kazanilanRozetler) {
    if (!kayit.rozetler.includes(rz.id)) kayit.rozetler.push(rz.id);
  }

  istatistikKaydet(kayit);

  const oncekiLig = ligBul(oncekiPuan);
  const yeniLig = ligBul(kayit.puan);
  return {
    rozetler: kazanilanRozetler,       // bu round kazanılanlar (ad/aciklama ile)
    kazanilanPuan,
    puan: kayit.puan,
    lig: yeniLig,
    ligAtladi: yeniLig.id !== oncekiLig.id,
    kayit,
  };
}

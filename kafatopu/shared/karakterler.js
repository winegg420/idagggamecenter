// ============================================================
// KAFA TOPU — karakter roster'ı.
// İki kaynak: (1) 5 kurgusal karakter (kod-çizim, telif içermez),
// (2) /heads/manifest.json'dan gelen foto kafalar (kullanıcı yükler).
// Tüm roster baştan açıktır; kilit/coin yoktur.
// ============================================================

// Yetenek tanımları (görsel ad + açıklama; mekanik gucler.js'te)
export const YETENEKLER = {
  ates_sutu: { ad: "Ateş Şutu", ikon: "🔥", aciklama: "6 sn boyunca vuruşların 2 kata yakın güçlü olur." },
  buz:       { ad: "Dondurucu", ikon: "🧊", aciklama: "Rakipler 3 sn boyunca yarı hızda hareket eder." },
  isinlanma: { ad: "Işınlanma", ikon: "⚡", aciklama: "Anında topun yanına ışınlanırsın." },
  kalkan:    { ad: "Kalkan",    ikon: "🛡️", aciklama: "Kendi kalenin ağzını 2.5 sn bariyerle kapatır." },
  dev_kafa:  { ad: "Dev Kafa",  ikon: "🎈", aciklama: "5 sn boyunca kafan büyür, topa hükmedersin." },
};

// 5 kurgusal karakter — gerçek kişilere benzemez, tamamen jenerik tasarım.
// cizim: prosedürel yüz parametreleri (render/kafaCizim.js kullanır).
export const KURGUSAL_KAFALAR = [
  {
    id: "volkan", ad: "Volkan", yetenek: "ates_sutu",
    cizim: { ten: "#e8a06a", sac: "#b3341f", sacStil: "alevli", goz: "#3d2b1f", aksesuar: "bandana", aksesuarRenk: "#d92b0e" },
  },
  {
    id: "buzul", ad: "Buzul", yetenek: "buz",
    cizim: { ten: "#dceef7", sac: "#7fd4f0", sacStil: "dik", goz: "#1a6fa8", aksesuar: "yok", aksesuarRenk: "" },
  },
  {
    id: "golge", ad: "Gölge", yetenek: "isinlanma",
    cizim: { ten: "#b9a5d0", sac: "#2b2140", sacStil: "yatik", goz: "#6c3fd1", aksesuar: "maske", aksesuarRenk: "#231a38" },
  },
  {
    id: "kaya", ad: "Kaya", yetenek: "kalkan",
    cizim: { ten: "#c9b18f", sac: "#5d4a33", sacStil: "kel", goz: "#33291c", aksesuar: "sakal", aksesuarRenk: "#4a3a27" },
  },
  {
    id: "yildiz", ad: "Yıldız", yetenek: "dev_kafa",
    cizim: { ten: "#f5c99b", sac: "#f2d022", sacStil: "topuz", goz: "#2d6b30", aksesuar: "yildiz", aksesuarRenk: "#ffd700" },
  },
];

// Foto kafalar: /heads/manifest.json → { "kafalar": [{ "id","ad","dosya",
// "odakX","odakY","yaricap" }] }. odak/yarıçap görüntü oranı cinsindendir
// (0-1) ve yüz görselin neresinde diye belirtir; verilmezse merkez kabul edilir.
// Dosyalar /heads/ altında durur. Manifest yoksa sadece kurgusal roster görünür.
let fotoKafalar = null;
let fotoImgler = new Map(); // id → HTMLImageElement (yüklenmişse)

export async function fotoKafalariYukle() {
  if (fotoKafalar !== null) return fotoKafalar;
  try {
    const yanit = await fetch("/heads/manifest.json", { cache: "no-cache" });
    if (!yanit.ok) throw new Error("manifest yok");
    const veri = await yanit.json();
    fotoKafalar = (veri.kafalar || []).filter((k) => k.id && k.dosya);
    // Görselleri arka planda önden yükle.
    for (const k of fotoKafalar) {
      const img = new Image();
      img.src = `/heads/${k.dosya}`;
      img.onload = () => fotoImgler.set(k.id, img);
      img.onerror = () => {};
    }
  } catch {
    fotoKafalar = []; // manifest yoksa sorun değil, kurgusal roster yeter
  }
  return fotoKafalar;
}

export function fotoKafaImg(id) {
  return fotoImgler.get(id) || null;
}

// id → karakter kaydı (kurgusal ya da foto). Bulunamazsa ilk kurgusala düşer.
export function kafaBul(id) {
  const k = KURGUSAL_KAFALAR.find((x) => x.id === id);
  if (k) return { ...k, foto: false };
  const f = (fotoKafalar || []).find((x) => x.id === id);
  if (f)
    return {
      id: f.id, ad: f.ad, yetenek: null, foto: true, dosya: f.dosya,
      odakX: f.odakX ?? 0.5, odakY: f.odakY ?? 0.5, yaricap: f.yaricap ?? 0.5,
    };
  return { ...KURGUSAL_KAFALAR[0], foto: false };
}

export function tumRoster() {
  return [
    ...KURGUSAL_KAFALAR.map((k) => ({ ...k, foto: false })),
    ...(fotoKafalar || []).map((f) => ({
      id: f.id, ad: f.ad, yetenek: null, foto: true, dosya: f.dosya,
      odakX: f.odakX ?? 0.5, odakY: f.odakY ?? 0.5, yaricap: f.yaricap ?? 0.5,
    })),
  ];
}

// ============================================================
// YERLEŞİM ÇÖZÜMLEYİCİ (Aşama 3A-2 §A) — ham manifest (yerlesim.json) → çizime hazır manifest. Saf JS (DOM yok, Node'da da çalışır).
//
// BÖLGE HİYERARŞİSİ: her parsel / nokta / alan / tramvay bir `bolge` taşır (bolgeler[*].id ile birebir).
// `bolgeler[*].kaydir: [dx, dz]` o bölgeye bağlı HER ŞEYİ birlikte öteler: bölgenin kendi zemini/kaldırımı/bordürü,
// parsel çapaları (bina + çarpışma kutusu + cephe + saksı + kapı önü ipucu), noktalar, alanlar (ağaç, bank, kedi, lamba),
// tramvay rayı ve yürünebilir SINIR. Böylece bir sokağı kaydırmak tek satırdır.
//
// TEK KAYNAK: `sinir.parcalar` içinde `{ "tip": "koridor", "bolge": "istiklal" }` gibi bölge referansı verilirse şekil
// (merkez/r ya da başlangıç/bitiş/genişlik) bölgeden TÜRETİLİR — aynı bilgi iki yerde tutulmaz.
//
// Bütün tüketiciler (yerlesimDunya, cevre, cephe, bogaz, varlik/cephe_ao.mjs) çözülmüş manifesti okur. Ham manifest
// değişmez (derin kopya). Hatalar (bilinmeyen / eksik bölge) `M.cozum.hatalar`'da; yerlesimDunya konsola yazar.
// ============================================================

const ekle2 = ([x, z], [dx, dz]) => [x + dx, z + dz];

/** @returns {object} çözülmüş manifest (idempotent: zaten çözülmüşse aynı nesne) */
export function manifestCoz(ham) {
  if (ham?.cozum) return ham;
  const M = JSON.parse(JSON.stringify(ham));
  const hatalar = [];
  const bolgeler = new Map((M.bolgeler ?? []).map((b) => [b.id, b]));

  const ote = (sahip, bolgeId, zorunlu = true) => {
    if (bolgeId == null) { if (zorunlu) hatalar.push(`${sahip}: bölge alanı yok (bolgeler: ${[...bolgeler.keys()].join(", ")})`); return [0, 0]; }
    const b = bolgeler.get(bolgeId);
    if (!b) { hatalar.push(`${sahip}: bilinmeyen bölge "${bolgeId}" (bolgeler: ${[...bolgeler.keys()].join(", ")})`); return [0, 0]; }
    return Array.isArray(b.kaydir) && b.kaydir.length === 2 ? b.kaydir : [0, 0];
  };

  // ---- bölgelerin kendisi
  for (const b of bolgeler.values()) {
    const k = Array.isArray(b.kaydir) ? b.kaydir : [0, 0];
    if (b.sekil === "daire") b.merkez = ekle2(b.merkez, k);
    else if (b.sekil === "koridor") { b.baslangic = ekle2(b.baslangic, k); b.bitis = ekle2(b.bitis, k); }
  }

  // ---- sınır: bölge referansı → şekil bölgeden türetilir
  const parcalar = M.sinir?.parcalar ?? (M.sinir ? [M.sinir] : []);
  for (const [i, s] of parcalar.entries()) {
    if (s.bolge == null) continue;
    const b = bolgeler.get(s.bolge);
    if (!b) { hatalar.push(`sinir.parcalar[${i}]: bilinmeyen bölge "${s.bolge}"`); continue; }
    if (s.tip === "daire" && b.sekil === "daire") { s.merkez = [...b.merkez]; s.r = s.r ?? b.r; }
    else if (s.tip === "koridor" && b.sekil === "koridor") { s.baslangic = [...b.baslangic]; s.bitis = [...b.bitis]; s.genislik = s.genislik ?? b.genislik; }
    else hatalar.push(`sinir.parcalar[${i}]: tip "${s.tip}" bölge "${s.bolge}" şekliyle (${b.sekil}) uyuşmuyor`);
  }

  // ---- parseller
  for (const p of M.parseller ?? []) {
    const [dx, dz] = ote(`parsel ${p.id}`, p.bolge);
    p.capa.konum = [p.capa.konum[0] + dx, p.capa.konum[1], p.capa.konum[2] + dz];
  }
  // ---- noktalar
  for (const n of M.noktalar ?? []) {
    const [dx, dz] = ote(`nokta ${n.id}`, n.bolge);
    n.konum = [n.konum[0] + dx, n.konum[1], n.konum[2] + dz];
  }
  // ---- alanlar
  for (const a of M.alanlar ?? []) {
    const k = ote(`alan ${a.id}`, a.bolge);
    if (a.cokgen) a.cokgen = a.cokgen.map((p) => ekle2(p, k));
    if (a.hat) a.hat = a.hat.map((p) => ekle2(p, k));
    if (a.yerlestir?.hat) a.yerlestir.hat = a.yerlestir.hat.map((p) => ekle2(p, k));
  }
  // ---- tramvay
  if (M.tramvay) {
    const k = ote("tramvay", M.tramvay.bolge);
    M.tramvay.hat = M.tramvay.hat.map((p) => ekle2(p, k));
    for (const d of M.tramvay.duraklar ?? []) d.konum = ekle2(d.konum, k);
  }

  M.cozum = { hatalar, kaydirilan: [...bolgeler.values()].filter((b) => b.kaydir && (b.kaydir[0] || b.kaydir[1])).map((b) => `${b.id} ${JSON.stringify(b.kaydir)}`) };
  return M;
}

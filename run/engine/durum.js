// ============================================================
// RUN — oyun durumu ve güncelleme (prototip, tek-oyunculu + bot + droneler).
// Çekirdek döngü: karanlık labirentte fenerle gez, drone'dan kaç, çıkışa ulaş.
// Beceriler: sopa (rakibi bayıltıp "sat") + kalkan (3sn dokunulmazlık).
// Kapılar: kapatınca enerji perdesi olur — drone geçemez, kırması gerekir.
// AI ele geçirme: nesneler aktifleşir → drone çeker; oyuncu hack'leyip
// droneleri sersemletebilir. Zorluk zamanla artar.
// Yakalanma = izleyici modu; round bitince 2 katmanlı sıralama.
// ============================================================

import {
  OYUNCU_HIZ, OYUNCU_YARICAP, BOT_SAYISI, BOT_HIZ,
  ISIK_DEGISIM_ARALIK, DRONE_DEVRIYE_HIZ, DRONE_KOVALA_HIZ, DRONE_GORUS,
  HEAT_YARICAP, HEAT_SURE, YAKALA_YARICAP, KAYIP_SURE, BOT_GRUP_MENZIL, DRONE_SAYISI,
  ATES_MENZIL, ATES_SURE, ZORLUK_ARALIK, ZORLUK_MAKS,
  SOPA_MENZIL, SOPA_ACI, SOPA_BEKLEME, SOPA_SAVURMA, KILIC_HAMLE, KALKAN_SURE, KALKAN_BEKLEME,
  DRONE_HP, KILIC_SAVURMA_GUC, KILIC_SERSEM, DRONE_YENIDEN,
  DASH_SURE, DASH_CARPAN, DASH_BEKLEME, CIP_SAYISI, CIP_YARICAP,
  NESNE_AKTIF_ARALIK, NESNE_AKTIF_SURE, NESNE_CEK_MENZIL,
  BOT_KACIS_ZAMANI, IZLEYICI_MAKS,
  KAPI_MENZIL, KAPI_BEKLEME, KAPI_ACILMA, KAPI_KIRILMA, KAPI_BOT_ACMA,
  HACK_MENZIL, HACK_SURE, HACK_SERSEM_MENZIL, SERSEM_SURE, PARCACIK_MAKS,
  TARAMA_MENZIL, TARAMA_ACI, TARAMA_SALINIM, CIKIS_SURE,
} from "./sabitler.js";
import { OFIS, yurunebilir, cikistaMi, duvarKesiyorMu } from "./harita.js";
import { cikisYonu } from "./navigasyon.js";

const BOT_ADLARI = ["Neo", "Trinity", "Ghost", "Vega", "Kilo", "Rook", "Delta"];

function rastgele(min, max) { return min + Math.random() * (max - min); }

// Haritada rastgele yürünebilir bir nokta (odalardan birinin içinden).
function rastgeleNokta(harita) {
  for (let d = 0; d < 40; d++) {
    const a = harita.alanlar[Math.floor(Math.random() * harita.alanlar.length)];
    const x = a.x + Math.random() * a.w, y = a.y + Math.random() * a.h;
    if (yurunebilir(harita, x, y)) return { x, y };
  }
  return { ...harita.baslangic };
}

// Başlangıca yakın yürünebilir bir nokta (botlar oyuncunun yanında başlasın → görünür).
function baslangicYakini(harita) {
  for (let d = 0; d < 60; d++) {
    const a = rastgele(0, Math.PI * 2), r = rastgele(40, 340);
    const x = harita.baslangic.x + Math.cos(a) * r, y = harita.baslangic.y + Math.sin(a) * r;
    if (yurunebilir(harita, x, y)) return { x, y };
  }
  return { ...harita.baslangic };
}

// Eksen bazlı hareket + duvar kayması (yürünemeyen noktaya girmeyi engeller).
// Gerçekten kımıldadıysa true döner (bot tıkanma tespiti için).
function hareketEt(harita, e, vx, vy) {
  const ox = e.x, oy = e.y;
  if (yurunebilir(harita, e.x + vx, e.y)) e.x += vx;
  if (yurunebilir(harita, e.x, e.y + vy)) e.y += vy;
  return e.x !== ox || e.y !== oy;
}

// Nokta aydınlık bir alanda mı (ışıklı oda)?
function aydinliktaMi(harita, x, y) {
  for (const a of harita.alanlar) {
    if (a.aydinlik && x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) return true;
  }
  return false;
}

// En yakın çıkışın merkezi.
function enYakinCikis(harita, x, y) {
  let en = null, enD = Infinity;
  for (const c of harita.cikislar) {
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2, d = Math.hypot(cx - x, cy - y);
    if (d < enD) { enD = d; en = { x: cx, y: cy }; }
  }
  return en;
}

// --- Parçacıklar (vuruş/hack/ateş/kapı kıvılcımları) ---
export function parcacikEkle(durum, x, y, adet, renk, hiz = 120, boy = 2.2) {
  const p = durum.parcaciklar;
  for (let i = 0; i < adet && p.length < PARCACIK_MAKS; i++) {
    const a = Math.random() * Math.PI * 2, v = hiz * (0.35 + Math.random() * 0.65);
    const omur = 0.3 + Math.random() * 0.5;
    p.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, omur, maks: omur, renk, boy: boy * (0.6 + Math.random() * 0.8) });
  }
}

function parcaciklariGuncelle(durum, dt) {
  const p = durum.parcaciklar;
  for (let i = p.length - 1; i >= 0; i--) {
    const k = p[i];
    k.omur -= dt;
    if (k.omur <= 0) { p.splice(i, 1); continue; }
    k.x += k.vx * dt; k.y += k.vy * dt;
    const sonum = Math.max(0, 1 - 3.2 * dt);           // sürtünme
    k.vx *= sonum; k.vy *= sonum;
  }
}

// --- Kapılar ---
// Nokta bir kapının (şişirilmiş) gövdesinde mi? Sadece drone engellemesi için.
function kapidaMi(k, x, y, pay = 12) {
  return x >= k.x - pay && x <= k.x + k.w + pay && y >= k.y - pay && y <= k.y + k.h + pay;
}

function enYakinKapi(harita, x, y, menzil) {
  let en = null, enD = menzil;
  for (const k of harita.kapilar) {
    const kx = k.x + k.w / 2, ky = k.y + k.h / 2, d = Math.hypot(kx - x, ky - y);
    if (d < enD) { enD = d; en = k; }
  }
  return en;
}

// Q: menzildeki kapıyı AÇ/KAPA (toggle). Kapalı kapı herkes için fiziksel engel.
function kapiToggle(durum, ben) {
  const k = enYakinKapi(durum.harita, ben.x, ben.y, KAPI_MENZIL);
  if (!k) return;
  ben._kapiCd = KAPI_BEKLEME;
  if (k.kapali) { kapiAc(durum, k, false); durum.sesler.push("kapi"); return; }
  // Eşikte biri varsa kapı kapanmaz (kapı üstüne kapanma/cheese engeli)
  const dolu = durum.oyuncular.some((s) => !s.yakalandi && !s.cikti &&
    s.x >= k.x - 10 && s.x <= k.x + k.w + 10 && s.y >= k.y - 10 && s.y <= k.y + k.h + 10);
  if (dolu) { durum.sesler.push("ui"); return; }
  k.kapali = true; k._acilma = KAPI_ACILMA; k.kirilma = 0;
  durum.sesler.push("kapi");
  akisEkle(durum, `🚪 ${k.oda || "Kapı"} kapatıldı`);
  parcacikEkle(durum, k.x + k.w / 2, k.y + k.h / 2, 8, "90,200,255", 70, 1.8);
}

function kapiAc(durum, k, droneAcisi) {
  k.kapali = false; k._acilma = 0; k.kirilma = 0; k._itis = 0;
  if (droneAcisi) {
    durum.sesler.push("kapi");
    akisEkle(durum, `🤖 ${k.oda || "Kapı"} kapısı drone tarafından açıldı`);
    parcacikEkle(durum, k.x + k.w / 2, k.y + k.h / 2, 14, "255,140,60", 150, 2.4);
  }
}

// --- Ele geçirme (hack) ---
function enYakinAktifNesne(harita, x, y, menzil) {
  let en = null, enD = menzil;
  for (const n of harita.nesneler || []) {
    if (!n.aktif) continue;
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < enD) { enD = d; en = n; }
  }
  return en;
}

// Aktif makineyi basılı tutarak ele geçir: ödül + yakın droneler sersemler.
// Bedeli: hack sırasında yavaşsın/duruyorsun → ısı algılamasına açıksın.
function hackGuncelle(durum, ben, dt, basili) {
  const hedef = enYakinAktifNesne(durum.harita, ben.x, ben.y, HACK_MENZIL);
  ben.hackHedef = basili && hedef ? hedef : null;
  if (!ben.hackHedef) {
    ben._hackIlerleme = Math.max(0, ben._hackIlerleme - dt * 2);
    return;
  }
  ben._hackIlerleme += dt;
  parcacikEkle(durum, hedef.x + rastgele(-8, 8), hedef.y + rastgele(-6, 6), 1, "90,230,240", 40, 1.6);
  if (ben._hackIlerleme < HACK_SURE) return;

  // Tamamlandı
  ben._hackIlerleme = 0; ben.hackHedef = null;
  hedef.aktif = false; hedef._sure = 0;
  ben.hack++;
  durum.sesler.push("hack");
  akisEkle(durum, `💾 ${hedef.ad} ele geçirildi (+1)`);
  parcacikEkle(durum, hedef.x, hedef.y, 22, "120,240,255", 190, 2.6);

  let sersemleyen = 0;
  for (const d of durum.droneler) {
    if (Math.hypot(d.x - hedef.x, d.y - hedef.y) > HACK_SERSEM_MENZIL) continue;
    d.sersem = SERSEM_SURE; d._kilit = 0; d.mod = "devriye"; d.hedefId = null;
    parcacikEkle(durum, d.x, d.y, 8, "255,220,120", 110, 2);
    sersemleyen++;
  }
  if (sersemleyen) {
    durum.sesler.push("sersem");
    akisEkle(durum, `⚡ ${sersemleyen} drone sersemledi`);
  }
}

// Kill feed / olay akışı (en yeni üstte, sınırlı).
function akisEkle(durum, metin) {
  durum.akis.unshift({ metin, zaman: durum.zaman });
  if (durum.akis.length > 6) durum.akis.length = 6;
}

// Bir oyuncuyu çözer (kaçtı ya da yakalandı) ve akışa yazar.
function cikisIsle(durum, s) {
  if (s.yakalandi || s.cikti) return;
  s.cikti = true; s._bitisZaman = durum.zaman;
  akisEkle(durum, `🏃 ${s.ad} çıkışa ulaştı`);
  durum.sesler.push(s.id === "ben" ? "kacti" : "kapi");
}
function yakalanIsle(durum, s, sebep) {
  if (s.yakalandi || s.cikti) return;
  s.yakalandi = true; s._bitisZaman = durum.zaman;
  akisEkle(durum, sebep === "sopa" ? `🦇 ${s.ad} satıldı (Sen)` : `🤖 ${s.ad} yakalandı`);
  durum.sesler.push("yakala");
  parcacikEkle(durum, s.x, s.y, 16, sebep === "sopa" ? "255,220,120" : "255,80,70", 170, 2.4);
  s.hackHedef = null; s._hackIlerleme = 0;   // yarım kalan ele geçirme iptal
  if (s.id === "ben") { durum.sesler.push("yakalandi"); durum.sarsinti = Math.max(durum.sarsinti, 16); durum.izleyici = true; durum._izleyiciSayaci = IZLEYICI_MAKS; }
}

export function createDurum() {
  const harita = JSON.parse(JSON.stringify(OFIS)); // kopya (ışık/nesne durumu değişecek)
  const oyuncular = [];

  oyuncular.push({
    id: "ben", ad: "Sen", bot: false,
    x: harita.baslangic.x, y: harita.baslangic.y, aci: -Math.PI / 2,
    yakalandi: false, cikti: false, durgun: 0, _bitisZaman: 0,
    sat: 0, hack: 0, cip: 0, kalkan: 0, _sopaCd: 0, _kalkanCd: 0, _sopaFlash: 0,
    _kapiCd: 0, _hackIlerleme: 0, hackHedef: null, _cikis: 0, _yuru: 0,
    _dash: 0, _dashCd: 0, _dashYon: { x: 0, y: -1 },
  });

  const adlar = [...BOT_ADLARI].sort(() => Math.random() - 0.5);
  for (let i = 0; i < BOT_SAYISI; i++) {
    const k = baslangicYakini(harita);
    oyuncular.push({
      id: `bot${i}`, ad: adlar[i % adlar.length], bot: true,
      x: k.x, y: k.y, aci: Math.random() * Math.PI * 2,
      yakalandi: false, cikti: false, durgun: 0, _bitisZaman: 0, _cikis: 0, _yuru: 0,
      _yon: Math.random() * Math.PI * 2, _yonZaman: rastgele(0.6, 2), _kacis: false,
    });
  }

  const droneler = [];
  for (let i = 0; i < DRONE_SAYISI; i++) {
    // Spawn başlangıçtan uzak olsun — round ilk saniyede yakalanmayla açılmasın.
    let dk = rastgeleNokta(harita);
    for (let d = 0; d < 40; d++) {
      if (Math.hypot(dk.x - harita.baslangic.x, dk.y - harita.baslangic.y) >= 700) break;
      dk = rastgeleNokta(harita);
    }
    droneler.push({
      x: dk.x, y: dk.y, aci: 0, mod: "devriye", hedefId: null, hedefX: dk.x, hedefY: dk.y,
      kayip: 0, sersem: 0, _kilit: 0, _ates: 0, hp: DRONE_HP, yok: 0,
      _faz: Math.random() * Math.PI * 2,               // tarama konisi salınım fazı
      _bekci: i < harita.cikislar.length ? i : -1,     // ilk 3 drone çıkış bekçisi
    });
  }

  // Veri çipleri: haritaya saçılır (birbirinden ve başlangıçtan uzak) — keşif ödülü.
  const cipler = [];
  for (let i = 0; i < CIP_SAYISI; i++) {
    let n = rastgeleNokta(harita);
    for (let d = 0; d < 40; d++) {
      const uzakBas = Math.hypot(n.x - harita.baslangic.x, n.y - harita.baslangic.y) >= 300;
      const uzakDiger = cipler.every((c) => Math.hypot(c.x - n.x, c.y - n.y) >= 240);
      if (uzakBas && uzakDiger) break;
      n = rastgeleNokta(harita);
    }
    cipler.push({ x: n.x, y: n.y, alindi: false });
  }

  // Nesneler ele-geçirilebilir hale gelir (aktif olunca drone çeker).
  for (const n of harita.nesneler || []) { n.aktif = false; n._sure = 0; }
  // Kapılar açık başlar.
  for (const k of harita.kapilar || []) { k.kapali = false; k._acilma = 0; k.kirilma = 0; }

  return {
    harita, oyuncular, droneler, cipler,
    parcaciklar: [],
    sarsinti: 0, hitstop: 0,     // ekran sarsıntısı + vuruş donması (aksiyon hissi)
    zaman: 0, isikSayaci: ISIK_DEGISIM_ARALIK,
    bitti: false, sonuc: null,   // 'kacti' | 'yakalandi'
    izleyici: false, _izleyiciSayaci: 0,
    izlenenId: "ben",            // kamera/fener kaynağı (izleyicide canlı bota geçer)
    genelBakis: false,           // GENEL BAKIŞ (uzaklaştırılmış test kamerası)
    zorluk: 1, _zorlukSayaci: ZORLUK_ARALIK,
    _nesneSayaci: NESNE_AKTIF_ARALIK,
    akis: [],                    // kill feed / olay akışı
    siralama: null,              // round sonu 2 katmanlı sıralama
    kamera: { x: harita.baslangic.x, y: harita.baslangic.y },
    sesler: [],                  // ses olay kuyruğu (motor boşaltır)
  };
}

// Bir hayatta kalan, verilen drone tarafından algılanabilir mi?
function algilanabilir(durum, s, d) {
  if (s.yakalandi || s.cikti) return false;
  const gorusCarpan = 1 + (durum.zorluk - 1) * 0.09;
  const uz = Math.hypot(s.x - d.x, s.y - d.y);
  // Aydınlıkta: GPS ile geniş menzilde görülür
  if (uz < DRONE_GORUS * gorusCarpan && aydinliktaMi(durum.harita, s.x, s.y)) return true;
  // Karanlıkta hareketsiz: ısı ile yakın menzilde
  if (uz < HEAT_YARICAP * gorusCarpan && s.durgun >= HEAT_SURE) return true;
  // KIRMIZI TARAMA KONİSİ: koninin içindeysen ve arada duvar yoksa ANINDA görülürsün.
  // Kırmızı ışığı gören oyuncu kaçmalı/saklanmalı (duvar arkası güvenli).
  if (uz < TARAMA_MENZIL * gorusCarpan) {
    let fark = Math.abs(Math.atan2(s.y - d.y, s.x - d.x) - (d._tarama ?? d.aci));
    if (fark > Math.PI) fark = Math.PI * 2 - fark;
    if (fark <= TARAMA_ACI && !duvarKesiyorMu(durum.harita, d.x, d.y, s.x, s.y)) return true;
  }
  return false;
}

// Round tamamen çözüldü mü (herkes kaçtı ya da yakalandı)?
function roundCozuldu(durum) {
  return durum.oyuncular.every((s) => s.yakalandi || s.cikti);
}

// 2 katmanlı sıralama: önce kaçanlar (erken kaçan üstte), sonra yakalananlar
// (geç yakalanan = daha çok hayatta kaldı, üstte).
function siralamaYap(durum) {
  const kacan = durum.oyuncular.filter((s) => s.cikti).sort((a, b) => a._bitisZaman - b._bitisZaman);
  const tutulan = durum.oyuncular.filter((s) => s.yakalandi).sort((a, b) => b._bitisZaman - a._bitisZaman);
  const kalan = durum.oyuncular.filter((s) => !s.cikti && !s.yakalandi);
  return [...kacan, ...tutulan, ...kalan].map((s) => ({
    ad: s.ad, ben: s.id === "ben",
    durum: s.cikti ? "kacti" : s.yakalandi ? "yakalandi" : "kaldi",
    sat: s.sat || 0, hack: s.hack || 0, cip: s.cip || 0,
  }));
}

// Round'u bitir (sonuç oyuncunun durumuna göre).
function roundBitir(durum) {
  durum.bitti = true;
  const ben = durum.oyuncular[0];
  durum.sonuc = ben.cikti ? "kacti" : "yakalandi";
  durum.siralama = siralamaYap(durum);
}

// Koni testi: hedef, vuranın önündeki kılıç yayı içinde mi?
function koniIcinde(ben, hx, hy, menzil) {
  const dx = hx - ben.x, dy = hy - ben.y, d = Math.hypot(dx, dy);
  if (d > menzil) return false;
  let fark = Math.abs(Math.atan2(dy, dx) - ben.aci);
  if (fark > Math.PI) fark = Math.PI * 2 - fark;
  return fark <= SOPA_ACI;
}

// Hurda droneyi oyuncudan uzak bir noktada yeniden doğur (baskı sürsün).
function droneYenidenDogur(durum, d) {
  const ben = durum.oyuncular[0];
  let dk = rastgeleNokta(durum.harita);
  for (let i = 0; i < 40; i++) {
    if (Math.hypot(dk.x - ben.x, dk.y - ben.y) >= 700) break;
    dk = rastgeleNokta(durum.harita);
  }
  d.x = dk.x; d.y = dk.y; d.hedefX = dk.x; d.hedefY = dk.y;
  d.hp = DRONE_HP; d.yok = 0; d.sersem = 0.5; d.mod = "devriye"; d.hedefId = null; d._kilit = 0;
  akisEkle(durum, "🚁 Yeni drone sevkiyatı geldi");
}

// Enerji kılıcı: geniş savurma — konideki TÜM diri botları bayılt+sat,
// konideki droneleri geri savur + sersemlet (3 vuruşta hurda + patlama).
// Savururken kısa ileri hamle yapılır; isabet vuruş donması + sarsıntı verir.
function kilicVur(durum, ben) {
  ben._sopaCd = SOPA_BEKLEME; ben._sopaFlash = SOPA_SAVURMA;
  ben._savurmaYon = -(ben._savurmaYon || 1);   // her savuruş ters yönden (kombo görünümü)
  durum.sesler.push("kilic");
  // İleri hamle (duvara saygılı)
  hareketEt(durum.harita, ben, Math.cos(ben.aci) * KILIC_HAMLE, Math.sin(ben.aci) * KILIC_HAMLE);
  const menzil = SOPA_MENZIL + OYUNCU_YARICAP;
  let isabet = 0;

  for (const s of durum.oyuncular) {
    if (s.id === "ben" || s.yakalandi || s.cikti) continue;
    if (!koniIcinde(ben, s.x, s.y, menzil)) continue;
    yakalanIsle(durum, s, "sopa"); ben.sat++; durum.sesler.push("sat");
    isabet++;
  }

  for (const d of durum.droneler) {
    if (d.yok > 0 || !koniIcinde(ben, d.x, d.y, menzil)) continue;
    isabet++;
    d.hp--;
    d.sersem = Math.max(d.sersem, KILIC_SERSEM);
    d._kilit = 0; d.mod = "devriye"; d.hedefId = null;
    // Geri savrulma (vuruş yönünde)
    const yon = Math.atan2(d.y - ben.y, d.x - ben.x);
    d.x += Math.cos(yon) * KILIC_SAVURMA_GUC;
    d.y += Math.sin(yon) * KILIC_SAVURMA_GUC;
    parcacikEkle(durum, d.x, d.y, 14, "140,240,255", 200, 2.4);
    if (d.hp <= 0) {
      d.yok = DRONE_YENIDEN;
      durum.sesler.push("patlama");
      durum.sarsinti = Math.max(durum.sarsinti, 14);
      akisEkle(durum, "💥 Droneyi hurdaya çıkardın!");
      parcacikEkle(durum, d.x, d.y, 34, "255,160,60", 260, 3);
      parcacikEkle(durum, d.x, d.y, 18, "255,90,60", 180, 2.4);
    } else {
      durum.sesler.push("darbe");
      akisEkle(durum, `⚔ Droneye vurdun (${d.hp} dayanım kaldı)`);
    }
  }

  if (isabet) {
    durum.hitstop = Math.max(durum.hitstop, 0.06);
    durum.sarsinti = Math.max(durum.sarsinti, 8);
  }
}

export function guncelle(durum, dt, girdi) {
  if (durum.bitti) return;
  // Vuruş donması: isabet anında dünya bir an durur (aksiyon vurgusu)
  if (durum.hitstop > 0) { durum.hitstop -= dt; return; }
  durum.sarsinti = Math.max(0, durum.sarsinti - dt * 40);
  durum.zaman += dt;
  parcaciklariGuncelle(durum, dt);

  // Kapılar: kapalı kapı süresi dolunca kendiliğinden açılır.
  for (const k of durum.harita.kapilar) {
    if (!k.kapali) continue;
    k._acilma -= dt;
    if (k._acilma <= 0) kapiAc(durum, k, false);
  }

  // Zorluk eğrisi: zamanla droneler hızlanır/görüşü artar (algilanabilir + hız çarpanı)
  durum._zorlukSayaci -= dt;
  if (durum._zorlukSayaci <= 0 && durum.zorluk < ZORLUK_MAKS) {
    durum.zorluk++; durum._zorlukSayaci = ZORLUK_ARALIK;
    akisEkle(durum, `⚡ Zorluk arttı — Kademe ${durum.zorluk}`);
  }
  const hizCarpan = 1 + (durum.zorluk - 1) * 0.11;

  // Işık/karanlık değişimi: periyodik olarak aydınlık odaları karıştır (tasarım 5)
  durum.isikSayaci -= dt;
  if (durum.isikSayaci <= 0) {
    durum.isikSayaci = ISIK_DEGISIM_ARALIK;
    const adliOdalar = durum.harita.alanlar.filter((a) => a.ad);
    for (const a of adliOdalar) a.aydinlik = Math.random() < 0.4;
  }

  // AI ele geçirme: periyodik olarak bir nesne aktifleşir (drone çeker), süresi dolunca söner.
  durum._nesneSayaci -= dt;
  const nesneler = durum.harita.nesneler || [];
  if (durum._nesneSayaci <= 0 && nesneler.length) {
    durum._nesneSayaci = NESNE_AKTIF_ARALIK;
    const pasif = nesneler.filter((n) => !n.aktif);
    if (pasif.length) {
      const n = pasif[Math.floor(Math.random() * pasif.length)];
      n.aktif = true; n._sure = NESNE_AKTIF_SURE;
      akisEkle(durum, `⚠ ${n.ad} ele geçiriliyor`); durum.sesler.push("alarm");
    }
  }
  for (const n of nesneler) {
    if (!n.aktif) continue;
    n._sure -= dt;
    if (n._sure <= 0) n.aktif = false;
    else if (Math.random() < dt * 7) parcacikEkle(durum, n.x, n.y - 6, 1, "255,150,60", 45, 1.7); // kıvılcım
  }
  const aktifNesneler = nesneler.filter((n) => n.aktif);

  // Hayatta kalanlar (oyuncu + botlar)
  for (const s of durum.oyuncular) {
    if (s.yakalandi || s.cikti) continue;
    if (s.bot) {
      s._yonZaman -= dt;
      if (s._yonZaman <= 0) { s._yon = Math.random() * Math.PI * 2; s._yonZaman = rastgele(0.6, 2); }
      // Round ilerledikçe (ya da oyuncu elendiğinde) botlar çıkışa yönelir → round çözülür.
      if (!s._kacis && (durum.zaman > BOT_KACIS_ZAMANI || durum.izleyici)) s._kacis = true;
      if (s._kacis) {
        // Odalar duvarlı: düz çizgi yerine BFS akış alanını takip et (kapı geçitlerini bulur).
        const yon = cikisYonu(s.x, s.y);
        if (yon) s._yon = Math.atan2(yon.y, yon.x) + (Math.random() - 0.5) * 0.12;
        else {
          const c = enYakinCikis(durum.harita, s.x, s.y);
          if (c) s._yon = Math.atan2(c.y - s.y, c.x - s.x) + (Math.random() - 0.5) * 0.5;
        }
      } else {
        // Oyuncudan çok uzaklaşınca ona doğru yönel (grup halinde görünür kalsınlar)
        const ben0 = durum.oyuncular[0];
        const gdx = ben0.x - s.x, gdy = ben0.y - s.y, gd = Math.hypot(gdx, gdy);
        if (gd > BOT_GRUP_MENZIL) s._yon = Math.atan2(gdy, gdx) + (Math.random() - 0.5) * 0.7;
      }
      // Hayatta kalma içgüdüsü: yakın (sersem olmayan) drone'dan uzaklaş — her moddan öncelikli.
      let kx = 0, ky = 0;
      for (const dr of durum.droneler) {
        if (dr.sersem > 0 || dr.yok > 0) continue;
        const du = Math.hypot(s.x - dr.x, s.y - dr.y);
        if (du < 220) { kx += (s.x - dr.x) / (du || 1); ky += (s.y - dr.y) / (du || 1); }
      }
      if (kx || ky) s._yon = Math.atan2(ky, kx) + (Math.random() - 0.5) * 0.4;
      // Kaçış kanalı: çıkışın içindeyse durup bekler; süre dolunca kaçar
      if (cikistaMi(durum.harita, s.x, s.y)) {
        s._cikis += dt;
        s.durgun = 0;
        if (s._cikis >= CIKIS_SURE) cikisIsle(durum, s);
        continue;
      }
      s._cikis = Math.max(0, s._cikis - dt * 2);
      const vx = Math.cos(s._yon) * BOT_HIZ * dt, vy = Math.sin(s._yon) * BOT_HIZ * dt;
      const ox = s.x, oy = s.y;
      const kimildadi = hareketEt(durum.harita, s, vx, vy);
      if (!kimildadi) {
        s._yonZaman = 0; // duvara/mobilyaya takıldı → yön değiştir
        // Kapalı kapıyı itiyor olabilir: bir süre itince açar (kapana kısılmaz)
        const k = enYakinKapi(durum.harita, s.x, s.y, 54);
        if (k && k.kapali) { k._itis = (k._itis || 0) + dt; if (k._itis >= KAPI_BOT_ACMA) kapiAc(durum, k, false); }
      } else {
        s.aci = Math.atan2(s.y - oy, s.x - ox);
        s._yuru += BOT_HIZ * dt;   // yürüme animasyon fazı
      }
      s.durgun = 0;
    } else {
      const v = girdi.hareketVektoru();
      // Atılım (dash): kısa süre yüksek hızda kayma — iz parçacıkları bırakır
      s._dashCd = Math.max(0, s._dashCd - dt);
      if (girdi.dashAl() && s._dashCd <= 0 && s._dash <= 0) {
        s._dash = DASH_SURE; s._dashCd = DASH_BEKLEME;
        s._dashYon = (v.x || v.y) ? { x: v.x, y: v.y } : { x: Math.cos(s.aci), y: Math.sin(s.aci) };
        durum.sesler.push("dash");
      }
      if (s._dash > 0) {
        s._dash -= dt;
        const ox = s.x, oy = s.y;
        hareketEt(durum.harita, s, s._dashYon.x * OYUNCU_HIZ * DASH_CARPAN * dt, s._dashYon.y * OYUNCU_HIZ * DASH_CARPAN * dt);
        s.aci = Math.atan2(s._dashYon.y, s._dashYon.x);
        s.durgun = 0;
        s._yuru += Math.hypot(s.x - ox, s.y - oy);
        parcacikEkle(durum, s.x, s.y, 2, "150,220,255", 40, 2);
      } else if (v.x !== 0 || v.y !== 0) {
        const ox = s.x, oy = s.y;
        hareketEt(durum.harita, s, v.x * OYUNCU_HIZ * dt, v.y * OYUNCU_HIZ * dt);
        s.aci = Math.atan2(v.y, v.x);
        s.durgun = 0;
        s._yuru += Math.hypot(s.x - ox, s.y - oy);   // yürüme animasyon fazı
      } else {
        s.durgun += dt;
      }
      // Veri çipi toplama (üstünden geç)
      for (const c of durum.cipler) {
        if (c.alindi || Math.hypot(c.x - s.x, c.y - s.y) > CIP_YARICAP) continue;
        c.alindi = true; s.cip++;
        const kalan = durum.cipler.filter((k) => !k.alindi).length;
        durum.sesler.push("cip");
        akisEkle(durum, kalan ? `💿 Veri çipi aldın (${s.cip}/${durum.cipler.length})` : "🌟 TÜM ÇİPLERİ TOPLADIN!");
        parcacikEkle(durum, c.x, c.y, 16, "120,255,200", 160, 2.2);
      }
      // Beceriler
      s._sopaCd = Math.max(0, s._sopaCd - dt);
      s._kalkanCd = Math.max(0, s._kalkanCd - dt);
      s._kapiCd = Math.max(0, s._kapiCd - dt);
      s.kalkan = Math.max(0, s.kalkan - dt);
      s._sopaFlash = Math.max(0, s._sopaFlash - dt);
      if (girdi.sopaAl() && s._sopaCd <= 0) kilicVur(durum, s);
      // Kapı: menzildeki kapıyı AÇ/KAPA (kapalı kapı herkes için engel; drone hızlı açar)
      if (girdi.kapiAl() && s._kapiCd <= 0) kapiToggle(durum, s);
      // Makine ele geçirme (E basılı tut)
      hackGuncelle(durum, s, dt, girdi.hackBasiliMi());
      // Kalkan: basış kenarında aktifleşir (cooldown bitmişse)
      if (girdi.kalkanBasiliMi()) {
        if (!s._kalkanBasili) { s._kalkanBasili = true; if (s._kalkanCd <= 0 && s.kalkan <= 0) { s.kalkan = KALKAN_SURE; s._kalkanCd = KALKAN_BEKLEME; durum.sesler.push("kalkan"); } }
      } else s._kalkanBasili = false;
      // Kaçış kanalı: çıkışın içinde CIKIS_SURE bekleyince kaçarsın (anında değil)
      if (cikistaMi(durum.harita, s.x, s.y)) {
        s._cikis += dt;
        if (s._cikis >= CIKIS_SURE) cikisIsle(durum, s);
      } else {
        s._cikis = Math.max(0, s._cikis - dt * 2);
      }
    }
  }

  // Drone AI (her drone bağımsız devriye/kovala/ateş)
  for (const d of durum.droneler) {
    // Hurda (kılıçla düşürüldü): sahada yok; süresi dolunca uzakta yeniden doğar.
    if (d.yok > 0) {
      d.yok -= dt;
      if (d.yok <= 0) droneYenidenDogur(durum, d);
      continue;
    }
    // Sersem (hack/kılıç darbesi): ne algılar ne hareket eder — kaçmak için pencere.
    if (d.sersem > 0) {
      d.sersem -= dt;
      d._kilit = 0;
      d._ates = Math.max(0, d._ates - dt);
      if (Math.random() < dt * 8) parcacikEkle(durum, d.x, d.y, 1, "255,220,120", 60, 1.6);
      continue;
    }
    const adaylar = durum.oyuncular.filter((s) => algilanabilir(durum, s, d));
    if (adaylar.length) {
      const ben = adaylar.find((s) => s.id === "ben");
      const hedef = ben || adaylar[0];
      d.hedefId = hedef.id; d.mod = "kovala"; d.kayip = 0;
      d.hedefX = hedef.x; d.hedefY = hedef.y;
    } else if (d.mod === "kovala") {
      d.kayip += dt; d._kilit = 0;
      if (d.kayip >= KAYIP_SURE) { d.mod = "devriye"; d.hedefId = null; }
    }

    // Boş (devriye) drone yakındaki aktif nesneye çekilir (AI ele geçirme).
    if (d.mod === "devriye" && aktifNesneler.length) {
      let en = null, enD = NESNE_CEK_MENZIL;
      for (const n of aktifNesneler) { const dd = Math.hypot(n.x - d.x, n.y - d.y); if (dd < enD) { enD = dd; en = n; } }
      if (en) { d.hedefX = en.x; d.hedefY = en.y; }
    }

    const hiz = (d.mod === "kovala" ? DRONE_KOVALA_HIZ : DRONE_DEVRIYE_HIZ) * hizCarpan;
    if (d.mod === "devriye" && Math.hypot(d.hedefX - d.x, d.hedefY - d.y) < 30 && !aktifNesneler.length) {
      // Bekçi drone çoğunlukla kendi çıkışının çevresinde devriye gezer (çıkışlar korunur)
      const bekci = d._bekci >= 0 ? durum.harita.cikislar[d._bekci] : null;
      if (bekci && Math.random() < 0.65) {
        const bx0 = bekci.x + bekci.w / 2, by0 = bekci.y + bekci.h / 2;
        for (let dn = 0; dn < 20; dn++) {
          const a = Math.random() * Math.PI * 2, r = 90 + Math.random() * 330;
          const px = bx0 + Math.cos(a) * r, py = by0 + Math.sin(a) * r;
          if (yurunebilir(durum.harita, px, py)) { d.hedefX = px; d.hedefY = py; break; }
        }
      } else {
        const p = rastgeleNokta(durum.harita); d.hedefX = p.x; d.hedefY = p.y;
      }
    }
    // Kırmızı tarama konisi yönü: devriyede gövde yönü etrafında salınır, kovalarken kilitli
    d._tarama = d.mod === "kovala" ? d.aci : d.aci + Math.sin(durum.zaman * 1.3 + d._faz) * TARAMA_SALINIM;
    const ddx = d.hedefX - d.x, ddy = d.hedefY - d.y, duz = Math.hypot(ddx, ddy) || 1;
    const nx = d.x + (ddx / duz) * hiz * dt, ny = d.y + (ddy / duz) * hiz * dt;
    // Kapalı kapı enerji perdesi: drone geçemez, kırmak zorunda (oyuncuya zaman kazandırır).
    const perde = durum.harita.kapilar.find((k) => k.kapali && kapidaMi(k, nx, ny));
    if (perde) {
      perde.kirilma += dt;
      if (Math.random() < dt * 12) parcacikEkle(durum, nx, ny, 1, "255,90,70", 90, 1.8);
      if (perde.kirilma >= KAPI_KIRILMA) kapiAc(durum, perde, true);
    } else {
      d.x = nx; d.y = ny;
    }
    d.aci = Math.atan2(ddy, ddx);
    d._ates = Math.max(0, d._ates - dt);

    // Yakalama: menzilden kilit-ateş (ATES) veya çok yakında temas.
    let kilitVar = false;
    for (const s of durum.oyuncular) {
      if (s.yakalandi || s.cikti) continue;
      const uz = Math.hypot(s.x - d.x, s.y - d.y);
      if (uz < YAKALA_YARICAP) { if (s.kalkan > 0) continue; yakalanIsle(durum, s, "drone"); continue; }
      // Kilit-ateş sadece kovaladığı hedefe
      if (d.mod === "kovala" && s.id === d.hedefId && uz < ATES_MENZIL) {
        kilitVar = true;
        if (s.kalkan <= 0) {
          d._kilit += dt;
          if (d._kilit >= ATES_SURE) { d._kilit = 0; d._ates = 0.2; durum.sesler.push("ates"); yakalanIsle(durum, s, "drone"); }
        }
      }
    }
    if (!kilitVar) d._kilit = Math.max(0, d._kilit - dt * 2);
  }

  // İzleyici modu: oyuncu elendiyse round'u bir süre daha sürdür (botları izle),
  // güvenlik süresi dolunca ya da herkes çözülünce bitir.
  if (durum.izleyici && !durum.oyuncular[0].cikti) {
    durum._izleyiciSayaci -= dt;
    if (durum._izleyiciSayaci <= 0) { roundBitir(durum); return; }
  }
  if (roundCozuldu(durum)) { roundBitir(durum); return; }
  // Oyuncu kaçtıysa hemen bitir (izleyici değilsek).
  if (durum.oyuncular[0].cikti && !durum.izleyici) { roundBitir(durum); return; }

  // Kamera/fener kaynağı: oyuncu diriyse oyuncu; elendiyse izlenecek canlı bir oyuncu.
  const ben = durum.oyuncular[0];
  let izlenen = ben;
  if (ben.yakalandi || ben.cikti) {
    const mevcut = durum.oyuncular.find((s) => s.id === durum.izlenenId && !s.yakalandi && !s.cikti);
    izlenen = mevcut || durum.oyuncular.find((s) => !s.yakalandi && !s.cikti) || ben;
  }
  durum.izlenenId = izlenen.id;
  durum.kamera.x += (izlenen.x - durum.kamera.x) * Math.min(1, dt * 6);
  durum.kamera.y += (izlenen.y - durum.kamera.y) * Math.min(1, dt * 6);
}

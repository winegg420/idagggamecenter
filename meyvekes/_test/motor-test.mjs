// ============================================================
// MEYVE KES — başsız motor testi (Node)
// Kamera/MediaPipe olmadan oyun.js kesim mantığını sentetik landmark'larla
// doğrular. Çalıştırma:  node meyvekes/_test/motor-test.mjs
// ============================================================

import { Oyun } from "../engine/oyun.js";

let gecti = 0;
let kaldi = 0;
function ok(ad, kosul) {
  if (kosul) {
    gecti++;
    console.log("  ✓ " + ad);
  } else {
    kaldi++;
    console.log("  ✗ " + ad);
  }
}

const W = 800;
const H = 600;
// harita: landmark zaten ekran-normalize (0..1) → doğrudan px (aynasız test).
const harita = (nx, ny) => ({ x: nx * W, y: ny * H });

// 21 landmark'lık bir "el" üretir; tüm noktalar (px→normalize) verilen ekran
// merkezine yakın konumlanır. Böylece KESIM_NOKTA (0,4,8,12,16,20,9) örneklenir.
function elYap(pxX, pxY) {
  const noktalar = [];
  for (let i = 0; i < 21; i++) {
    // parmaklar merkez etrafında küçük ofsetlerle (segment mantığını bozmaz)
    const ox = ((i % 5) - 2) * 4;
    const oy = (((i / 5) | 0) - 2) * 4;
    noktalar.push({ x: (pxX + ox) / W, y: (pxY + oy) / H, z: 0 });
  }
  return { noktalar, taraf: pxX < W / 2 ? "sol" : "sag" };
}

// ---- Test 1: faz makinesi geri → oyun ----
{
  console.log("Test 1: faz makinesi");
  const o = new Oyun("tekli");
  ok("başlangıç geri", o.faz === "geri");
  for (let i = 0; i < 80; i++) o.guncelle(0.05, [], 0, harita, W, H);
  ok("3sn sonra oyun fazı", o.faz === "oyun");
}

// ---- Test 2: el meyvenin üstünden geçince kesilir ----
{
  console.log("Test 2: kesim (el meyveyi biçer)");
  const o = new Oyun("tekli");
  // oyun fazına geç
  while (o.faz !== "oyun") o.guncelle(0.05, [], 0, harita, W, H);
  // sabit bir meyve yerleştir (fiziği kesime karışmasın diye vy=0)
  o.meyveler = [{ meyve: { r: 40, renk: "#f00", altin: false }, x: 400, y: 300, vx: 0, vy: 0, r: 40, aci: 0, donHiz: 0 }];
  const oncekiKesim = o.kesimSayisi;
  // 1. algılama karesi: el solda
  o.guncelle(0.03, [elYap(250, 300)], 1, harita, W, H);
  // 2. algılama karesi: el meyvenin üstünde (segment 250→400 meyveyi biçer)
  o.guncelle(0.03, [elYap(400, 300)], 2, harita, W, H);
  ok("meyve kesildi", o.kesimSayisi === oncekiKesim + 1);
  ok("puan arttı", o.puan > 0);
}

// ---- Test 3: statik el (hareketsiz) kesmez ----
{
  console.log("Test 3: statik el kesmez");
  const o = new Oyun("tekli");
  while (o.faz !== "oyun") o.guncelle(0.05, [], 0, harita, W, H);
  o.meyveler = [{ meyve: { r: 40, renk: "#f00", altin: false }, x: 400, y: 300, vx: 0, vy: 0, r: 40, aci: 0, donHiz: 0 }];
  o.guncelle(0.03, [elYap(400, 300)], 1, harita, W, H); // el zaten üstünde ama hareket yok
  o.guncelle(0.03, [elYap(400, 300)], 2, harita, W, H); // aynı yer → segment ~0 < MIN
  ok("hareketsiz el kesmedi", o.kesimSayisi === 0);
}

// ---- Test 4: hızlı savurma (uzun segment) yine keser ----
{
  console.log("Test 4: hızlı savurma keser");
  const o = new Oyun("tekli");
  while (o.faz !== "oyun") o.guncelle(0.05, [], 0, harita, W, H);
  o.meyveler = [{ meyve: { r: 40, renk: "#f00", altin: false }, x: 400, y: 300, vx: 0, vy: 0, r: 40, aci: 0, donHiz: 0 }];
  o.guncelle(0.03, [elYap(80, 300)], 1, harita, W, H);
  o.guncelle(0.03, [elYap(720, 300)], 2, harita, W, H); // 640px savurma meyveden geçer
  ok("hızlı savurma kesti", o.kesimSayisi === 1);
}

// ---- Test 5: 4 dizili meyve tek savuruşla combo ----
{
  console.log("Test 5: combo (tek savuruş 4 meyve)");
  const o = new Oyun("tekli");
  while (o.faz !== "oyun") o.guncelle(0.05, [], 0, harita, W, H);
  o.meyveler = [200, 350, 500, 650].map((x) => ({
    meyve: { r: 38, renk: "#f00", altin: false }, x, y: 300, vx: 0, vy: 0, r: 38, aci: 0, donHiz: 0,
  }));
  o.guncelle(0.03, [elYap(120, 300)], 1, harita, W, H);
  o.guncelle(0.03, [elYap(720, 300)], 2, harita, W, H); // yatay savurma hepsini biçer
  ok("4 meyve kesildi", o.kesimSayisi === 4);
  ok("combo oluştu", o.combo >= 3);
}

// ---- Test 6: 60sn tam oyun, NaN yok ----
{
  console.log("Test 6: 60sn tam oyun");
  const o = new Oyun("tekli");
  let damga = 0;
  let t = 0;
  let elX = 100;
  let nanVar = false;
  while (!o.bitti && t < 70) {
    // her ~0.05sn'de bir "algılama karesi": el ekranı sağa-sola tarar
    damga++;
    elX = 100 + ((t * 400) % 600);
    o.guncelle(0.05, [elYap(elX, 250 + 100 * Math.sin(t))], damga, harita, W, H);
    t += 0.05;
    if (!Number.isFinite(o.puan) || !Number.isFinite(o.sure)) nanVar = true;
  }
  ok("oyun bitti", o.bitti);
  ok("NaN yok", !nanVar);
  ok("meyve kesildi (>0)", o.kesimSayisi > 0);
  console.log(`    → kesim: ${o.kesimSayisi}, puan: ${o.puan}`);
}

// Yönlü el: bilek (0) ve avuç (9) verilen eksende → kılıç yönü belirli olur.
// Kol, bilekten avucun TERSİ yönünde uzar (kilicHesap ile aynı varsayım).
function elYapYonlu(bilekX, bilekY, mcpX, mcpY) {
  const noktalar = new Array(21);
  const ux = mcpX - bilekX;
  const uy = mcpY - bilekY;
  for (let i = 0; i < 21; i++) {
    // varsayılan: avuçta topla; kritik indeksler aşağıda ezilir
    noktalar[i] = { x: mcpX / W, y: mcpY / H, z: 0 };
  }
  noktalar[0] = { x: bilekX / W, y: bilekY / H, z: 0 };
  noktalar[9] = { x: mcpX / W, y: mcpY / H, z: 0 };
  noktalar[12] = { x: (mcpX + ux * 0.6) / W, y: (mcpY + uy * 0.6) / H, z: 0 };
  return { noktalar, taraf: mcpX < W / 2 ? "sol" : "sag" };
}

// ---- Test 7: KOL da keser (el meyvenin uzağında, kol hattı üstünden geçiyor) ----
{
  console.log("Test 7: kol bıçağı");
  const o = new Oyun("tekli");
  while (o.faz !== "oyun") o.guncelle(0.05, [], 0, harita, W, H);
  // el yukarı bakıyor (bilek 400,400 → avuç 400,340; boy 60) → kol aşağı uzar,
  // kuyruk ≈ (400, 604). Meyve kolun ortasında (400, 520).
  o.meyveler = [{ meyve: { r: 30, renk: "#f00", altin: false }, x: 400, y: 520, vx: 0, vy: 0, r: 30, aci: 0, donHiz: 0 }];
  o.guncelle(0.03, [elYapYonlu(340, 400, 340, 340)], 1, harita, W, H);
  o.guncelle(0.03, [elYapYonlu(400, 400, 400, 340)], 2, harita, W, H); // yana savurma
  ok("kol hattındaki meyve kesildi", o.kesimSayisi === 1);
}

// ---- Test 8: gecikme telafisi (el, ileri sarılan konumda keser) ----
{
  console.log("Test 8: gecikme telafisi");
  const kur = () => {
    const o = new Oyun("tekli");
    while (o.faz !== "oyun") o.guncelle(0.05, [], 0, harita, W, H);
    // meyve, elin gittiği yönde 60px ilerde (bir sonraki kareye kadar oraya varır)
    o.meyveler = [{ meyve: { r: 18, renk: "#f00", altin: false }, x: 520, y: 300, vx: 0, vy: 0, r: 18, aci: 0, donHiz: 0 }];
    return o;
  };
  // telafisiz: el 300→420 (hız 4000 px/s), meyve 520'de → segment ucundan 100px uzak
  const a = kur();
  a.guncelle(0.03, [elYapYonlu(300, 300, 300, 260)], 1, harita, W, H);
  a.guncelle(0.03, [elYapYonlu(420, 300, 420, 260)], 2, harita, W, H);
  // telafili: aynı hareket, 25 ms algılama gecikmesi bildirilir → el ileri sarılır
  const b = kur();
  b.guncelle(0.03, [elYapYonlu(300, 300, 300, 260)], 1, harita, W, H, 0.025);
  b.guncelle(0.03, [elYapYonlu(420, 300, 420, 260)], 2, harita, W, H, 0.025);
  ok("telafisiz ıskalıyor", a.kesimSayisi === 0);
  ok("telafiyle kesiyor", b.kesimSayisi === 1);
}

// ---- Test 9: el kadrajdan çıkıp geri girince hemen keser ----
{
  console.log("Test 9: el çıkıp geri girince senkron");
  const o = new Oyun("tekli");
  while (o.faz !== "oyun") o.guncelle(0.05, [], 0, harita, W, H);
  o.guncelle(0.03, [elYap(250, 300)], 1, harita, W, H);
  // el 0.4 sn kaybolur (kadraj dışı) — eski takip kaydı düşer
  for (let i = 0; i < 14; i++) o.guncelle(0.03, [], 2 + i, harita, W, H);
  ok("kayıp elin izi temizlendi", o.izler.length === 0);
  // geri girer ve savurur: ilk kare referans, ikinci karede kesim olmalı
  o.meyveler = [{ meyve: { r: 40, renk: "#f00", altin: false }, x: 400, y: 300, vx: 0, vy: 0, r: 40, aci: 0, donHiz: 0 }];
  o.guncelle(0.03, [elYap(250, 300)], 100, harita, W, H);
  o.guncelle(0.03, [elYap(430, 300)], 101, harita, W, H);
  ok("geri girince ikinci karede kesti", o.kesimSayisi === 1);
}

console.log(`\nSonuç: ${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi > 0 ? 1 : 0);

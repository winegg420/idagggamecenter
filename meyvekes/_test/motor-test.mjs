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

// ---- Test 10: bıçak izi — hareket varken üretilir, el dururken üretilmez ----
{
  console.log("Test 10: bıçak izi (hareket/durgunluk)");
  const o = new Oyun("tekli");
  while (o.faz !== "oyun") o.guncelle(0.05, [], 0, harita, W, H);
  o.guncelle(0.03, [elYap(200, 300)], 1, harita, W, H);
  o.guncelle(0.03, [elYap(360, 300)], 2, harita, W, H); // hızlı savurma
  ok("savururken iz noktası üretildi", o.izler.length === 1 && o.izler[0].length > 0);
  // çizim kareleri (yeni algılama yok) → iz akıcı biçimde büyümeye devam eder
  const oncekiUzunluk = o.izler[0].length;
  o.guncelle(0.016, [], 2, harita, W, H);
  o.guncelle(0.016, [], 2, harita, W, H);
  ok("algılama beklemeden iz akıyor (60fps)", o.izler[0].length > oncekiUzunluk);

  const d = new Oyun("tekli");
  while (d.faz !== "oyun") d.guncelle(0.05, [], 0, harita, W, H);
  d.guncelle(0.03, [elYap(400, 300)], 1, harita, W, H);
  d.guncelle(0.03, [elYap(400, 300)], 2, harita, W, H); // el sabit
  for (let i = 0; i < 5; i++) d.guncelle(0.016, [elYap(400, 300)], 3 + i, harita, W, H);
  ok("duran el iz üretmedi", d.izler.every((iz) => iz.length === 0));
}

// Ağız landmark üreteci (normalize): merkez (px) + açıklık (px) + genişlik (px)
function agizYap(pxX, pxY, acikPx, genPx = 80) {
  return {
    ust: { x: pxX / W, y: (pxY - acikPx / 2) / H },
    alt: { x: pxX / W, y: (pxY + acikPx / 2) / H },
    sol: { x: (pxX - genPx / 2) / W, y: pxY / H },
    sag: { x: (pxX + genPx / 2) / W, y: pxY / H },
  };
}

// ---- Test 11: MEYVE YE — ağız açıkken yutar, kapalıyken yutmaz ----
{
  console.log("Test 11: meyve ye (ağız)");
  const kur = () => {
    const o = new Oyun("yeme");
    while (o.faz !== "oyun") o.guncelle(0.05, [], 0, harita, W, H, 0, null);
    o.meyveler = [{ meyve: { r: 40, renk: "#f00", altin: false }, x: 400, y: 300, vx: 0, vy: 0, r: 40, aci: 0, donHiz: 0 }];
    return o;
  };
  const kapali = kur();
  kapali.guncelle(0.03, [], 1, harita, W, H, 0, agizYap(400, 300, 6));
  ok("ağız kapalıyken yutmadı", kapali.kesimSayisi === 0 && kapali.agiz && !kapali.agiz.acik);

  const acikO = kur();
  acikO.guncelle(0.03, [], 1, harita, W, H, 0, agizYap(400, 300, 36));
  ok("ağız açıkken yuttu", acikO.kesimSayisi === 1 && acikO.puan > 0);
  ok("yutma animasyonu başladı", acikO.yutulanlar.length === 1);

  // uzaktaki meyve yutulmaz
  const uzak = kur();
  uzak.meyveler[0].x = 700;
  uzak.guncelle(0.03, [], 1, harita, W, H, 0, agizYap(400, 300, 36));
  ok("uzaktaki meyve yutulmadı", uzak.kesimSayisi === 0);

  // histerezis: açıldıktan sonra yarı kapalı ağız hâlâ açık sayılır
  const his = kur();
  his.guncelle(0.03, [], 1, harita, W, H, 0, agizYap(400, 300, 36));
  his.guncelle(0.03, [], 2, harita, W, H, 0, agizYap(400, 300, 20)); // oran 0.25
  ok("histerezis çalışıyor", his.agiz.acik === true);
}

// ---- Test 12: MEYVE YE — meyveler ağza nişan alarak fırlatılır ----
{
  console.log("Test 12: meyve ye (ağza nişan)");
  const o = new Oyun("yeme");
  while (o.faz !== "oyun") o.guncelle(0.05, [], 0, harita, W, H, 0, null);
  o.guncelle(0.03, [], 1, harita, W, H, 0, agizYap(400, 260, 6)); // ağız (400,260)
  let enIyiSapma = 1e9;
  for (let i = 0; i < 6; i++) {
    o.meyveler = [];
    o._meyveFirlat(W, H);
    const f = o.meyveler[0];
    let sapma = 1e9;
    for (let s = 0; s < 200; s++) {
      f.vy += 1500 * 0.016;
      f.x += f.vx * 0.016;
      f.y += f.vy * 0.016;
      sapma = Math.min(sapma, Math.abs(f.y - 260));
      if (f.y > H + 200) break;
    }
    enIyiSapma = Math.min(enIyiSapma, sapma);
    if (sapma > 60) enIyiSapma = 1e9; // her meyve ağız hizasından geçmeli
  }
  ok("fırlatılan meyveler ağız hizasından geçiyor", enIyiSapma < 60);
}

// ---- Test 13: kesim efektleri (flaş, dalga, sarsıntı, ses) ----
{
  console.log("Test 13: kesim efektleri");
  const o = new Oyun("tekli");
  while (o.faz !== "oyun") o.guncelle(0.05, [], 0, harita, W, H);
  o.meyveler = [{ meyve: { r: 40, renk: "#f00", altin: false }, x: 400, y: 300, vx: 0, vy: 0, r: 40, aci: 0, donHiz: 0 }];
  o.guncelle(0.03, [elYap(250, 300)], 1, harita, W, H);
  o.guncelle(0.03, [elYap(400, 300)], 2, harita, W, H);
  ok("slash flaşı üretildi", o.slashlar.length === 1);
  ok("halka dalgası üretildi", o.dalgalar.length === 1);
  ok("ekran sarsıntısı tetiklendi", o.sarsinti > 0);
  ok("ses olayı kuyruğa girdi", o.sesler.includes("kes"));
  ok("yarımlar kesim açısı taşıyor", o.yarilar.length === 2 && typeof o.yarilar[0].kesimAci === "number");
  // efektler zamanla sönmeli
  for (let i = 0; i < 40; i++) o.guncelle(0.016, [], 2, harita, W, H);
  ok("efektler söndü", o.slashlar.length === 0 && o.dalgalar.length === 0 && o.sarsinti === 0);
}

// ---- Test 14: HIZLI geri giriş (köprü) — ilk karede keser ----
// Kullanıcı şikâyeti: "kollarım ekrandan çıkıp hızlıca girince oyun tanımıyor".
// Kısa kayıpta kimlik korunur (KAYIP_SURE) → dönüş savurması İLK karede kesmeli.
{
  console.log("Test 14: hızlı geri giriş köprüsü");
  const o = new Oyun("tekli");
  while (o.faz !== "oyun") o.guncelle(0.05, [], 0, harita, W, H);
  o.guncelle(0.03, [elYap(250, 300)], 1, harita, W, H);
  // 0.15 sn kadraj dışı (KAYIP_SURE=0.4 içinde) → kimlik korunmalı
  for (let i = 0; i < 5; i++) o.guncelle(0.03, [], 2, harita, W, H);
  o.meyveler = [{ meyve: { r: 40, renk: "#f00", altin: false }, x: 360, y: 300, vx: 0, vy: 0, r: 40, aci: 0, donHiz: 0 }];
  o.guncelle(0.03, [elYap(430, 300)], 3, harita, W, H);
  ok("kısa kayıp sonrası İLK karede kesti", o.kesimSayisi === 1);

  // Uzun kayıp (KAYIP_SURE üstü) köprü kurmaz — kimlik gerçekten düşer
  const u = new Oyun("tekli");
  while (u.faz !== "oyun") u.guncelle(0.05, [], 0, harita, W, H);
  u.guncelle(0.03, [elYap(250, 300)], 1, harita, W, H);
  for (let i = 0; i < 20; i++) u.guncelle(0.03, [], 2, harita, W, H); // 0.6 sn
  u.meyveler = [{ meyve: { r: 40, renk: "#f00", altin: false }, x: 360, y: 300, vx: 0, vy: 0, r: 40, aci: 0, donHiz: 0 }];
  u.guncelle(0.03, [elYap(430, 300)], 3, harita, W, H);
  ok("uzun kayıpta köprü kurulmadı", u.kesimSayisi === 0);

  // Ekranın bir ucundan diğerine köprü "bedava kesim" vermez (segment tavanı)
  const b = new Oyun("tekli");
  while (b.faz !== "oyun") b.guncelle(0.05, [], 0, harita, W, H);
  b.guncelle(0.03, [elYap(40, 300)], 1, harita, W, H);
  for (let i = 0; i < 4; i++) b.guncelle(0.03, [], 2, harita, W, H);
  b.meyveler = [{ meyve: { r: 30, renk: "#f00", altin: false }, x: 400, y: 300, vx: 0, vy: 0, r: 30, aci: 0, donHiz: 0 }];
  b.guncelle(0.03, [elYap(780, 300)], 3, harita, W, H);
  ok("uçtan uca köprü kesmiyor (tavan)", b.kesimSayisi === 0);
}

// ---- Test 15: 60 Hz algılamada HAREKET KAPISI ----
// Worker'lı çıkarımda algılama 60 Hz'e çıkar. Landmark titremesi (2-5 px) kare
// başına "gerçek hareket" gibi görünüp DURAN ELDE kesim yapıyordu (kullanıcı
// şikâyeti). Kesim izni artık ~0.12 sn penceredeki NET yer değiştirmeye bakar.
{
  console.log("Test 15: 60 Hz algılamada hareket kapısı");
  const o = new Oyun("tekli");
  while (o.faz !== "oyun") o.guncelle(0.05, [], 0, harita, W, H);
  o.meyveler = [];
  let x = 300;
  o.guncelle(1 / 60, [elYap(x, 300)], 1, harita, W, H);
  o.meyveler = [{ meyve: { r: 34, renk: "#f00", altin: false }, x: 380, y: 300, vx: 0, vy: 0, r: 34, aci: 0, donHiz: 0 }];
  // ölçülü ama GERÇEK savurma: 60 Hz'de kare başına 8 px (~480 px/s)
  for (let i = 0; i < 10; i++) {
    x += 8;
    o.guncelle(1 / 60, [elYap(x, 300)], 2 + i, harita, W, H);
  }
  ok("60 Hz'de ölçülü savurma kesti", o.kesimSayisi === 1);

  // KULLANICI ŞİKÂYETİ: el sabit dururken (yalnız landmark titremesi) meyve
  // kesilmemeli — meyve kılıcın TAM üstünde dursa bile.
  const d = new Oyun("tekli");
  while (d.faz !== "oyun") d.guncelle(0.05, [], 0, harita, W, H);
  let tohum = 7;
  const titre = () => {
    // deterministik sözde-rastgele ±4 px titreme
    tohum = (tohum * 1103515245 + 12345) & 0x7fffffff;
    return ((tohum % 800) / 100 - 4);
  };
  d.guncelle(1 / 60, [elYap(400, 300)], 1, harita, W, H);
  for (let i = 0; i < 60; i++) {
    // her karede kılıcın üstüne yeni meyve koy (kesim şansı sürekli olsun)
    d.meyveler = [{ meyve: { r: 34, renk: "#f00", altin: false }, x: 400, y: 300, vx: 0, vy: 0, r: 34, aci: 0, donHiz: 0 }];
    d.guncelle(1 / 60, [elYap(400 + titre(), 300 + titre())], 2 + i, harita, W, H);
  }
  ok("duran el (±4 px titreme) 1 sn boyunca kesmedi", d.kesimSayisi === 0);
  ok("duran el iz de üretmedi", d.izler.every((iz) => iz.length === 0));
}

// ---- Test 16: eşikler ekran boyundan bağımsız (telefon dikey ekran) ----
// Hareket kapısı eşikleri köşegene oranlı; küçük telefon ekranında da duran el
// kesmemeli, gerçek savurma kesmeli.
{
  console.log("Test 16: telefon ekranında hareket kapısı");
  const W2 = 390;
  const H2 = 844; // iPhone 14 mantıksal çözünürlük
  const harita2 = (nx, ny) => ({ x: nx * W2, y: ny * H2 });
  const el2 = (pxX, pxY) => {
    const noktalar = [];
    for (let i = 0; i < 21; i++) {
      const ox = ((i % 5) - 2) * 4;
      const oy = (((i / 5) | 0) - 2) * 4;
      noktalar.push({ x: (pxX + ox) / W2, y: (pxY + oy) / H2, z: 0 });
    }
    return { noktalar, taraf: pxX < W2 / 2 ? "sol" : "sag" };
  };

  const d = new Oyun("tekli");
  while (d.faz !== "oyun") d.guncelle(0.05, [], 0, harita2, W2, H2);
  let tohum = 3;
  const titre = () => {
    tohum = (tohum * 1103515245 + 12345) & 0x7fffffff;
    return (tohum % 800) / 100 - 4;
  };
  d.guncelle(1 / 60, [el2(190, 400)], 1, harita2, W2, H2);
  for (let i = 0; i < 60; i++) {
    d.meyveler = [{ meyve: { r: 30, renk: "#f00", altin: false }, x: 190, y: 400, vx: 0, vy: 0, r: 30, aci: 0, donHiz: 0 }];
    d.guncelle(1 / 60, [el2(190 + titre(), 400 + titre())], 2 + i, harita2, W2, H2);
  }
  ok("telefonda duran el kesmedi", d.kesimSayisi === 0);

  const o = new Oyun("tekli");
  while (o.faz !== "oyun") o.guncelle(0.05, [], 0, harita2, W2, H2);
  let y = 300;
  o.guncelle(1 / 60, [el2(190, y)], 1, harita2, W2, H2);
  o.meyveler = [{ meyve: { r: 30, renk: "#f00", altin: false }, x: 190, y: 400, vx: 0, vy: 0, r: 30, aci: 0, donHiz: 0 }];
  for (let i = 0; i < 10; i++) {
    y += 10; // ~600 px/s savurma
    o.guncelle(1 / 60, [el2(190, y)], 2 + i, harita2, W2, H2);
  }
  ok("telefonda gerçek savurma kesti", o.kesimSayisi === 1);
}

console.log(`\nSonuç: ${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi > 0 ? 1 : 0);

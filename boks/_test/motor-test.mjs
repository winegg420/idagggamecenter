// ============================================================
// GÖLGE BOKS — başsız motor testi (Node, kamera/DOM gerekmez)
//
// Sahte poz landmark'ları üretip motoru gerçek bir oyun döngüsü gibi çalıştırır:
// yumruk sınıflandırma, faz makinesi, puanlama/combo, savunma modu, gard
// tespiti, analiz motoru ve dövüşçü eşleştirmesi doğrulanır.
//
// NOT: ayrı bir el modeli yoktur; el ölçeği (derinlik proxy'si) poz modelinin
// parmak köklerinden okunur — `govde()` bunu `solOlcek`/`sagOlcek` ile simüle
// eder (bilek ↔ parmak kökü mesafesi kameraya yaklaşınca büyür).
//
// Çalıştırma:  node boks/_test/motor-test.mjs
// ============================================================

import { Oyun, ZORLUKLAR, comboCarpan } from "../engine/oyun.js";
import { YumrukTanima, TUR, noBilgi, ORTODOKS, GUNEY_PENCE } from "../engine/yumrukTanima.js";
import { P } from "../engine/posetakip.js";
import {
  stilVektoru,
  stilArketip,
  roundAnalizi,
  zayiflikTespit,
  zorlukOnerisi,
  elDengesi,
} from "../engine/antrenorAnalizi.js";
import { DOVUSCULER, enYakinDovuscular, DOVUSCU_SAYISI } from "../engine/dovusculKutuphanesi.js";
import { rozetKontrol, PROGRAMLAR } from "../engine/ilerleme.js";

const W = 900;
const H = 600;
const DT = 1 / 30; // poz takibi ~30 Hz

let gecti = 0;
let kaldi = 0;
function sina(ad, kosul, ek = "") {
  if (kosul) {
    gecti++;
    console.log(`  ✓ ${ad}`);
  } else {
    kaldi++;
    console.log(`  ✗ ${ad}${ek ? " — " + ek : ""}`);
  }
}

// Ekran eşleyici (render.js ile aynı mantık, aynalı; test için basitleştirilmiş).
const harita = (nx, ny) => ({ x: W - nx * W, y: ny * H });

// ---------------------------------------------------------------
// Sahte vücut: normalize koordinatlarda dik duran bir oyuncu
// ---------------------------------------------------------------
function govde({
  solBilek,
  sagBilek,
  solOlcek = 0.03,
  sagOlcek = 0.03,
  kalca = true,
  bacak = false,
} = {}) {
  const n = (x, y, g = 1) => ({ x, y, z: 0, g });
  const sb = { x: solBilek?.x ?? 0.45, y: solBilek?.y ?? 0.3 };
  const gb = { x: sagBilek?.x ?? 0.55, y: sagBilek?.y ?? 0.3 };
  const noktalar = {
    [P.BURUN]: n(0.5, 0.22),
    [P.SOL_KULAK]: n(0.47, 0.23),
    [P.SAG_KULAK]: n(0.53, 0.23),
    [P.SOL_OMUZ]: n(0.4, 0.36),
    [P.SAG_OMUZ]: n(0.6, 0.36),
    [P.SOL_DIRSEK]: n(0.38, 0.46),
    [P.SAG_DIRSEK]: n(0.62, 0.46),
    [P.SOL_BILEK]: n(sb.x, sb.y),
    [P.SAG_BILEK]: n(gb.x, gb.y),
    // Parmak kökleri: bileğin `olcek` kadar ötesinde → el ölçeği bu mesafedir.
    [P.SOL_SERCE]: n(sb.x, sb.y - solOlcek),
    [P.SOL_ISARET]: n(sb.x, sb.y - solOlcek),
    [P.SAG_SERCE]: n(gb.x, gb.y - sagOlcek),
    [P.SAG_ISARET]: n(gb.x, gb.y - sagOlcek),
  };
  if (kalca) {
    noktalar[P.SOL_KALCA] = n(0.43, 0.62);
    noktalar[P.SAG_KALCA] = n(0.57, 0.62);
  }
  if (bacak) {
    noktalar[P.SOL_DIZ] = n(0.43, 0.78);
    noktalar[P.SAG_DIZ] = n(0.57, 0.78);
    noktalar[P.SOL_AYAK] = n(0.43, 0.94);
    noktalar[P.SAG_AYAK] = n(0.57, 0.94);
  }
  return { noktalar, dunya: null };
}

// ---------------------------------------------------------------
// 1) Yumruk sınıflandırma
// ---------------------------------------------------------------
function yumrukAt(tanima, { taraf = "sol", tur = "duz" } = {}) {
  const bilekAd = taraf === "sol" ? "solBilek" : "sagBilek";
  const olcekAd = taraf === "sol" ? "solOlcek" : "sagOlcek";
  const bas = { x: taraf === "sol" ? 0.45 : 0.55, y: 0.3 };
  // Hedef yer değiştirme (normalize): türe göre yön.
  // Hook merkez hattını geçerek karşı tarafa yay çizer (gerçek kroşe gibi);
  // uppercut aşağıdan yukarı; düz yumruk ekranda az yer değiştirir ama el
  // kameraya yaklaşır (aşağıda ölçek büyümesiyle simüle edilir).
  const hedef =
    tur === "hook"
      ? { x: bas.x + (taraf === "sol" ? 0.16 : -0.16), y: bas.y - 0.01 }
      : tur === "uppercut"
        ? { x: bas.x, y: bas.y - 0.12 }
        : { x: bas.x + (taraf === "sol" ? -0.02 : 0.02), y: bas.y + 0.01 };

  const kapsam = { ustGovde: true, kollar: true, kalca: true, bacaklar: false };
  // 1. faz: gard pozisyonunda birkaç kare (durum makinesi "bekle"ye otursun)
  for (let i = 0; i < 6; i++) {
    tanima.guncelle(DT, { poz: pozEkran(govde({ [bilekAd]: bas })), kapsam });
  }
  // 2. faz: itme (3 kare, hızlı)
  for (let i = 1; i <= 3; i++) {
    const t = i / 3;
    const p = { x: bas.x + (hedef.x - bas.x) * t, y: bas.y + (hedef.y - bas.y) * t };
    // Düz yumrukta el kameraya yaklaşır → ölçek büyür (derinlik ilerlemesi)
    const olcek = tur === "duz" ? 0.03 + 0.04 * t : 0.03;
    tanima.guncelle(DT, {
      poz: pozEkran(govde({ [bilekAd]: p, [olcekAd]: olcek })),
      kapsam,
    });
  }
  // 3. faz: darbe (hareket durur → uzanma tepe noktası)
  for (let i = 0; i < 3; i++) {
    const olcek = tur === "duz" ? 0.07 : 0.03;
    tanima.guncelle(DT, {
      poz: pozEkran(govde({ [bilekAd]: hedef, [olcekAd]: olcek })),
      kapsam,
    });
  }
  // 4. faz: geri çekiş
  for (let i = 0; i < 4; i++) {
    tanima.guncelle(DT, { poz: pozEkran(govde({ [bilekAd]: bas })), kapsam });
  }
  const olaylar = tanima.olaylar.slice();
  tanima.olaylar.length = 0;
  return olaylar;
}

function pozEkran(poz) {
  const n = {};
  for (const idx in poz.noktalar) {
    const p = poz.noktalar[idx];
    const e = harita(p.x, p.y);
    n[idx] = { x: e.x, y: e.y, z: p.z, g: p.g };
  }
  return { n };
}

console.log("\n— 1) Yumruk sınıflandırma —");
{
  const t = new YumrukTanima({ durus: ORTODOKS });
  // durgun vücut → yumruk üretilmemeli
  for (let i = 0; i < 30; i++) {
    t.guncelle(DT, {
      poz: pozEkran(govde()),
      kapsam: { ustGovde: true, kollar: true, kalca: true, bacaklar: false },
    });
  }
  sina("Durgun vücutta yumruk üretilmiyor", t.olaylar.length === 0, `${t.olaylar.length} olay`);

  const jab = yumrukAt(t, { taraf: "sol", tur: "duz" });
  sina("Ön el düz yumruk → 1 (jab)", jab.length === 1 && jab[0].no === 1, JSON.stringify(jab.map((o) => o.no)));

  const cross = yumrukAt(t, { taraf: "sag", tur: "duz" });
  sina("Arka el düz yumruk → 2 (cross)", cross.length === 1 && cross[0].no === 2, JSON.stringify(cross.map((o) => o.no)));

  const hook = yumrukAt(t, { taraf: "sol", tur: "hook" });
  sina("Ön el yanal yumruk → 3 (ön hook)", hook.length === 1 && hook[0].no === 3, JSON.stringify(hook.map((o) => o.no)));

  const upper = yumrukAt(t, { taraf: "sag", tur: "uppercut" });
  sina("Arka el aşağıdan yukarı → 6 (arka uppercut)", upper.length === 1 && upper[0].no === 6, JSON.stringify(upper.map((o) => o.no)));

  sina("Şiddet skoru 5-100 aralığında", jab.every((o) => o.siddet >= 5 && o.siddet <= 100));
  sina("İlk yumruklar 'kalibre ediliyor' işaretli", jab[0].kalibre === true);
}

// Güney pençe (solak) aynalama
{
  const t = new YumrukTanima({ durus: GUNEY_PENCE });
  const sag = yumrukAt(t, { taraf: "sag", tur: "duz" });
  sina("Güney pençede SAĞ el düz → 1 (jab, aynalandı)", sag.length === 1 && sag[0].no === 1, JSON.stringify(sag.map((o) => o.no)));
  const sol = yumrukAt(t, { taraf: "sol", tur: "hook" });
  sina("Güney pençede SOL el hook → 4 (arka hook)", sol.length === 1 && sol[0].no === 4, JSON.stringify(sol.map((o) => o.no)));
}

// noBilgi tutarlılığı
{
  const ok = [1, 2, 3, 4, 5, 6].every((no) => {
    const b = noBilgi(no, ORTODOKS);
    return b.no === no && (no <= 2 ? b.tur === TUR.DUZ : no <= 4 ? b.tur === TUR.HOOK : b.tur === TUR.UPPERCUT);
  });
  sina("noBilgi() tüm numaralarda tutarlı", ok);
}

// ---------------------------------------------------------------
// 2) Gard tespiti
// ---------------------------------------------------------------
console.log("\n— 2) Gard tespiti —");
{
  const yuksek = new YumrukTanima({ durus: ORTODOKS });
  for (let i = 0; i < 60; i++) {
    yuksek.guncelle(DT, {
      poz: pozEkran(govde({ solBilek: { x: 0.46, y: 0.24 }, sagBilek: { x: 0.54, y: 0.24 } })),
      kapsam: { ustGovde: true, kollar: true, kalca: true, bacaklar: false },
    });
  }
  sina("Yüksek gard → düşük gard süresi ~0", yuksek.gardDusukSure < 0.2, `${yuksek.gardDusukSure.toFixed(2)} sn`);

  const dusuk = new YumrukTanima({ durus: ORTODOKS });
  for (let i = 0; i < 60; i++) {
    dusuk.guncelle(DT, {
      poz: pozEkran(govde({ solBilek: { x: 0.44, y: 0.56 }, sagBilek: { x: 0.56, y: 0.56 } })),
      kapsam: { ustGovde: true, kollar: true, kalca: true, bacaklar: false },
    });
  }
  sina("Bel hizasındaki eller → düşük gard ölçülüyor", dusuk.gardDusukSure > 1, `${dusuk.gardDusukSure.toFixed(2)} sn`);
  sina("Düşük gard olayları üretiliyor", dusuk.gardOlaylari.length >= 2, `${dusuk.gardOlaylari.length} olay`);
}

// ---------------------------------------------------------------
// 3) Faz makinesi + round yapısı
// ---------------------------------------------------------------
console.log("\n— 3) Faz makinesi —");
{
  for (const z of ["kolay", "orta", "zor", "pro"]) {
    const o = new Oyun({ mod: "serbest", zorluk: z });
    const fazlar = new Set();
    let adim = 0;
    const tavan = ((ZORLUKLAR[z].sure + ZORLUKLAR[z].mola + 20) * ZORLUKLAR[z].round + 60) * 60;
    while (!o.bitti && adim < tavan) {
      o.guncelle(1 / 60, { pozHam: null, damga: adim, harita, W, H });
      fazlar.add(o.faz);
      adim++;
    }
    sina(
      `${ZORLUKLAR[z].ad}: ${ZORLUKLAR[z].round} round tamamlanıyor`,
      o.bitti && o.roundlar.length === ZORLUKLAR[z].round,
      `${o.roundlar.length} round`,
    );
    if (z === "orta") {
      sina("Isınma ve mola fazları geçiliyor", fazlar.has("isinma") && fazlar.has("mola"));
    }
  }
}

// ---------------------------------------------------------------
// 4) Pad / puanlama / combo
// ---------------------------------------------------------------
console.log("\n— 4) Puanlama ve combo —");
{
  sina("Combo çarpan eğrisi artan", comboCarpan(1) === 1 && comboCarpan(3) === 1.2 && comboCarpan(6) === 1.5 && comboCarpan(10) === 1.8 && comboCarpan(15) === 2.2);

  const o = new Oyun({ mod: "serbest", zorluk: "orta" });
  // ısınmayı geç
  o.faz = "round";
  o.fazSure = 75;
  const pad = { no: 1, x: 300, y: 200, el: "sol", tur: "duz", r: 40, t: 0, omur: 2, titre: 0, vuruldu: false };
  o.padler = [pad];
  o.tanima.birim = 160;
  const olay = { no: 1, tur: "duz", on: true, el: "sol", x: 305, y: 205, hiz: 4, siddet: 70, uzanma: 0.4, karsiGardDusuk: false, karsiEl: "sag", t: 1 };
  o._yumrukIsle(olay, W, H);
  sina("Doğru pad + doğru yumruk → puan", o.puan > 0, `puan ${o.puan}`);
  sina("İsabet sayacı arttı", o.ist.isabet === 1);

  // yanlış tür
  const pad2 = { ...pad, no: 3, vuruldu: false, t: 0 };
  o.padler = [pad2];
  const puanOnce = o.puan;
  o._yumrukIsle({ ...olay, no: 2, t: 2 }, W, H);
  sina("Yanlış yumruk türü → puan yok, ceza yok", o.puan === puanOnce && o.ist.yanlisTur === 1);
  sina("Yanlış türde pad titriyor (ceza değil)", pad2.titre > 0 && !pad2.vuruldu);

  // combo artışı
  const o2 = new Oyun({ mod: "serbest", zorluk: "orta" });
  o2.faz = "round";
  o2.fazSure = 75;
  o2.tanima.birim = 160;
  for (let i = 0; i < 5; i++) {
    o2.padler = [{ no: 2, x: 400, y: 250, el: "sag", tur: "duz", r: 40, t: 0, omur: 2, titre: 0, vuruldu: false }];
    o2._t += 0.5;
    o2._yumrukIsle({ no: 2, tur: "duz", on: false, el: "sag", x: 400, y: 250, hiz: 4, siddet: 60, uzanma: 0.4, karsiGardDusuk: true, karsiEl: "sol", t: o2._t }, W, H);
  }
  sina("Ardışık isabet combo'yu büyütüyor", o2.combo === 5, `combo ${o2.combo}`);
  sina("Vuruş anındaki açık gard ayrı sayaçta", o2.ist.vurustaAcikGard === 5, `${o2.ist.vurustaAcikGard}`);
}

// ---------------------------------------------------------------
// 5) Koç modu komut dizisi
// ---------------------------------------------------------------
console.log("\n— 5) Koç modu —");
{
  const o = new Oyun({ mod: "koc", zorluk: "orta" });
  o.faz = "round";
  o.fazSure = 75;
  o.tanima.birim = 160;
  o._komutBaslat(W, H);
  sina("Komut dizisi üretildi", !!o.komut && o.komut.dizi.length >= 1);
  sina("Sadece sıradaki pad ekranda", o.padler.length === 1 && o.padler[0].sirali === true);
  const ilk = o.komut.dizi[0];
  const pad = o.padler[0];
  o._yumrukIsle({ no: ilk, tur: "duz", on: true, el: pad.el, x: pad.x, y: pad.y, hiz: 4, siddet: 60, uzanma: 0.4, karsiGardDusuk: false, karsiEl: "sag", t: 1 }, W, H);
  sina("Doğru numara → dizide ilerleme", o.komut === null || o.komut.indeks === 1);
}

// ---------------------------------------------------------------
// 6) Savunma modu
// ---------------------------------------------------------------
console.log("\n— 6) Savunma modu —");
{
  const o = new Oyun({ mod: "savunma", zorluk: "orta" });
  o.faz = "round";
  o.fazSure = 75;
  o.tanima.birim = 160;
  o.tanima.kafa = { x: 450, y: 150, hiz: 0 };
  o._tehditUret(W, H);
  const th = o.tehditler[0];
  sina("Tehdit üretildi ve hedef kafaya kilitlendi", !!th && Math.abs(th.hx - 450) < 1);

  // kafa yerinde kalırsa → kaçamadı
  o.tanima.kollar.sol.gorunur = true;
  o.tanima.kollar.sag.gorunur = true;
  o.tanima.kollar.sol.gardDusuk = true;
  o.tanima.kollar.sag.gardDusuk = true;
  o._tehditCoz(th);
  sina("Kafa bölgede + gard açık → kaçış yok (ceza da yok)", o.ist.kacinmaDeneme === 1 && o.ist.kacinmaBasari === 0 && o.ist.blok === 0);

  // kafa uzaklaşırsa → başarılı kaçış
  o.tanima.kafa = { x: 560, y: 150, hiz: 3 };
  o._tehditUret(W, H);
  const th2 = o.tehditler[o.tehditler.length - 1];
  th2.hx = 450;
  th2.hy = 150;
  o._tehditCoz(th2);
  sina("Kafa vuruş bölgesinden çıktı → kaçış başarılı", o.ist.kacinmaBasari === 1);

  // gard kapalı, kafa yerinde → blok
  o.tanima.kafa = { x: 450, y: 150, hiz: 0 };
  o.tanima.kollar.sol.gardDusuk = false;
  o.tanima.kollar.sag.gardDusuk = false;
  o._tehditUret(W, H);
  const th3 = o.tehditler[o.tehditler.length - 1];
  th3.hx = 450;
  th3.hy = 150;
  o._tehditCoz(th3);
  sina("Gard kapalıyken kafa bölgede → blok sayıldı", o.ist.blok === 1);
}

// ---------------------------------------------------------------
// 7) Kalori (MET) ve istatistik toplama
// ---------------------------------------------------------------
console.log("\n— 7) Kalori ve toplamlar —");
{
  const o = new Oyun({ mod: "serbest", zorluk: "orta", kiloKg: 75 });
  const ist = { ...o.ist, sure: 300, toplamYumruk: 250 };
  const k = o.kalori(ist);
  sina("MET aralığı 4-12 arasında", k.met >= 4 && k.met <= 12, `${k.met} MET`);
  sina("Kalori makul aralıkta (5 dk, 75 kg)", k.deger > 15 && k.deger < 150, `${k.deger} kcal`);
  sina("Kilo girilince 'tahmini' değil", k.tahmini === false);

  const o2 = new Oyun({ mod: "serbest", zorluk: "orta" });
  sina("Kilo girilmezse tahmini etiketi", o2.kalori(ist).tahmini === true);

  // toplam istatistik birleştirme
  const o3 = new Oyun({ mod: "serbest", zorluk: "kolay" });
  o3.roundlar = [
    { ...o3.ist, puan: 100, toplamYumruk: 50, isabet: 30, enIyiCombo: 5, yumruk: { 1: 20, 2: 15, 3: 10, 4: 5, 5: 0, 6: 0 }, sure: 90, tempoDilim: [5, 6], kapsam: { ustGovde: true, kollar: true, kalca: true, bacaklar: false } },
    { ...o3.ist, puan: 140, toplamYumruk: 60, isabet: 40, enIyiCombo: 8, yumruk: { 1: 25, 2: 20, 3: 10, 4: 5, 5: 0, 6: 0 }, sure: 90, tempoDilim: [7, 8], kapsam: { ustGovde: true, kollar: true, kalca: false, bacaklar: false } },
  ];
  o3.faz = "bitti";
  const t = o3.toplamIstatistik();
  sina("Toplam puan/yumruk birleşiyor", t.puan === 240 && t.toplamYumruk === 110);
  sina("En iyi combo maksimum alınıyor", t.enIyiCombo === 8);
  sina("Kapsam OR ile birleşiyor", t.kapsam.kalca === true && t.kapsam.bacaklar === false);
}

// ---------------------------------------------------------------
// 8) Analiz motoru
// ---------------------------------------------------------------
console.log("\n— 8) Antrenör analizi —");
{
  const ist = {
    puan: 900,
    yumruk: { 1: 40, 2: 30, 3: 12, 4: 8, 5: 3, 6: 2 },
    toplamYumruk: 95,
    isabet: 62,
    kacirma: 12,
    yanlisTur: 5,
    solYumruk: 55,
    sagYumruk: 40,
    siddetToplam: 95 * 62,
    siddetMax: 91,
    hizToplam: 400,
    dusukGardOlay: 6,
    vurustaAcikGard: 22,
    gardDusukSure: 18,
    gardOlcuSure: 75,
    kacinmaDeneme: 0,
    kacinmaBasari: 0,
    blok: 0,
    posturUyari: 1,
    enIyiCombo: 7,
    ritimMukemmel: 0,
    sure: 75,
    tempoDilim: [16, 14, 12, 8, 6],
    kapsam: { ustGovde: true, kollar: true, kalca: true, bacaklar: false },
  };
  const v = stilVektoru(ist);
  sina("Stil vektörü 8 boyut ve 0-100 aralığında",
    ["gard", "baski", "cesitlilik", "tempo", "guc", "kontra", "hareket", "kombinasyon"].every(
      (k) => typeof v[k] === "number" && v[k] >= 0 && v[k] <= 100,
    ));
  const ark = stilArketip(v);
  sina("Arketip tanısı üretildi", !!ark && !!ark.ad && !!ark.aciklama, ark?.ad);

  const r = roundAnalizi(ist, { mod: "serbest", zorluk: "orta", durus: ORTODOKS });
  sina("Round raporunda özet + maddeler var", r.ozet.length > 80 && r.madde.length >= 4, `${r.madde.length} madde`);
  sina("Rapor metninde ölçüm sayısı geçiyor (jenerik değil)", /%\d+|\d+ yumruk/.test(r.ozet));
  sina("Tek somut ipucu üretiliyor", typeof r.ipucu === "string" && r.ipucu.length > 40);

  const z = zayiflikTespit(ist, v);
  sina("Zayıflık tespiti çalışıyor", z.length >= 2, z.map((x) => x.kod).join(","));
  sina("Vuruş anında açık gard yakalandı", z.some((x) => x.kod === "vurusta_acik"));
  sina("Tempo düşüşü yakalandı", z.some((x) => x.kod === "tempo_dususu"));

  // Kapsam kuralı: kalça görünmüyorsa duruş analizi ÜRETİLMEMELİ
  const ist2 = { ...ist, kapsam: { ustGovde: true, kollar: true, kalca: false, bacaklar: false } };
  const r2 = roundAnalizi(ist2, {});
  sina("Kalça görünmüyorsa duruş/denge maddesi yok",
    !r2.madde.some((m) => m.baslik === "Duruş ve denge") &&
      r2.madde.some((m) => m.baslik === "Analiz kapsamı"));

  // Yumruksuz round
  const bos = { ...ist, toplamYumruk: 0, yumruk: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }, isabet: 0 };
  const r3 = roundAnalizi(bos, {});
  sina("Yumruksuz round'da uydurma analiz yok", r3.madde.length === 0 && r3.ozet.includes("kaydedilmedi"));

  const d = elDengesi(ist);
  sina("El dengesi hesabı doğru", d.sol === 58 && d.sag === 42, `${d.sol}/${d.sag}`);

  const oneri = zorlukOnerisi(ist);
  sina("Zorluk önerisi geçerli bir seviye", ["kolay", "orta", "zor", "pro"].includes(oneri.zorluk), oneri.zorluk);
}

// ---------------------------------------------------------------
// 9) Dövüşçü kütüphanesi + eşleştirme
// ---------------------------------------------------------------
console.log("\n— 9) Dövüşçü eşleştirme —");
{
  sina("Kütüphane geniş (200+ dövüşçü)", DOVUSCU_SAYISI >= 200, `${DOVUSCU_SAYISI} kayıt`);
  const eksik = DOVUSCULER.filter(
    (d) => !d.ad || !d.not || !d.sporAd || !d.durusAd || Object.values(d.o).some((x) => typeof x !== "number"),
  );
  sina("Tüm kayıtlar eksiksiz", eksik.length === 0, eksik.map((d) => d.ad).join(","));
  const sporlar = new Set(DOVUSCULER.map((d) => d.spor));
  sina("Boks + MMA + kickboks kapsanıyor", sporlar.has("B") && sporlar.has("M") && sporlar.has("K"));

  // Yüksek gard + yüksek baskı + hook → peek-a-boo tarzına yakın biri çıkmalı
  const baskici = { gard: 88, baski: 94, cesitlilik: 74, tempo: 80, guc: 96, kontra: 46, hareket: 86, kombinasyon: 84 };
  const es1 = enYakinDovuscular(baskici, { durus: "ortodoks", adet: 3 });
  sina("Baskı profili için 3 eşleşme dönüyor", es1.length === 3);
  sina("Benzerlik yüzdesi makul", es1[0].benzerlik >= 60 && es1[0].benzerlik <= 100, `%${es1[0].benzerlik}`);

  // Savunmacı/kontra profil farklı biriyle eşleşmeli
  const kontraci = { gard: 92, baski: 26, cesitlilik: 60, tempo: 36, guc: 40, kontra: 95, hareket: 74, kombinasyon: 48 };
  const es2 = enYakinDovuscular(kontraci, { durus: "ortodoks", adet: 3 });
  sina("Farklı stil → farklı eşleşme", es2[0].ad !== es1[0].ad, `${es1[0].ad} vs ${es2[0].ad}`);
  sina("Spor filtresi çalışıyor", enYakinDovuscular(baskici, { spor: "M", adet: 5 }).every((d) => d.spor === "M"));
}

// ---------------------------------------------------------------
// 10) Rozetler ve programlar
// ---------------------------------------------------------------
console.log("\n— 10) İlerleme sistemi —");
{
  const ist = {
    yumruk: { 1: 120, 2: 40, 3: 20, 4: 10, 5: 5, 6: 5 },
    toplamYumruk: 200,
    enIyiCombo: 12,
    gardDusukSure: 2,
    gardOlcuSure: 120,
    kacinmaDeneme: 10,
    kacinmaBasari: 9,
    ritimMukemmel: 22,
    siddetMax: 96,
    kapsam: { ustGovde: true, kollar: true, kalca: true, bacaklar: true },
  };
  const r = rozetKontrol(ist, { zorluk: "pro", mod: "serbest", kariyer: { y1: 50, toplam_yumruk: 900, toplam_kalori: 480, toplam_round: 20 }, seriGun: 7, kalori: 60 });
  sina("Rozet kontrolü çoklu rozet veriyor", r.length >= 8, r.join(","));
  sina("Pro rozeti verildi", r.includes("ilk_pro"));
  sina("Altı silah rozeti verildi", r.includes("cesitlilik"));
  sina("Gard ustası rozeti verildi", r.includes("gard_ustasi"));
  sina("7 gün seri rozeti verildi", r.includes("seri_7"));
  sina("Tam kadraj rozeti verildi", r.includes("tam_kadraj"));

  sina("Programlar tanımlı ve günleri dolu",
    PROGRAMLAR.length >= 3 && PROGRAMLAR.every((p) => p.gunler.length > 0 && p.gunler.every((g) => g.mod && g.zorluk && g.hedef)));
}

// ---------------------------------------------------------------
// 11) Uçtan uca: gerçek poz akışıyla tam round
// ---------------------------------------------------------------
console.log("\n— 11) Uçtan uca akış —");
{
  const o = new Oyun({ mod: "serbest", zorluk: "kolay", durus: ORTODOKS, kiloKg: 78 });
  let damga = 0;
  let kare = 0;
  const bas = { x: 0.45, y: 0.3 };
  // Isınma + 1. round boyunca sürekli jab-cross at
  while (!o.bitti && kare < 60 * 400) {
    const dongu = kare % 20;
    const t = dongu < 6 ? dongu / 6 : dongu < 12 ? 1 - (dongu - 6) / 6 : 0;
    const solB = { x: bas.x - 0.02 * t, y: bas.y + 0.01 * t };
    const sagB = { x: 0.55 + 0.02 * t, y: bas.y + 0.01 * t };
    const poz = govde({
      solBilek: solB,
      sagBilek: sagB,
      solOlcek: 0.03 + 0.04 * t,
      sagOlcek: 0.03 + 0.04 * t,
      bacak: true,
    });
    if (kare % 2 === 0) damga++;
    o.guncelle(1 / 60, { pozHam: poz, damga, harita, W, H });
    kare++;
  }
  sina("Tam antrenman tamamlandı", o.bitti && o.roundlar.length === 2, `${o.roundlar.length} round`);
  const toplam = o.toplamIstatistik();
  sina("Gerçek poz akışından yumruk üretildi", toplam.toplamYumruk > 20, `${toplam.toplamYumruk} yumruk`);
  sina("Gard süresi ölçüldü", toplam.gardOlcuSure > 30, `${toplam.gardOlcuSure.toFixed(0)} sn`);
  sina("Kapsam tam vücut olarak işaretlendi", toplam.kapsam.bacaklar === true);
  const rapor = roundAnalizi(toplam, { durus: ORTODOKS });
  sina("Uçtan uca rapor üretildi", rapor.madde.length >= 4 && rapor.ozet.length > 60);
  const es = enYakinDovuscular(rapor.vektor, { durus: "ortodoks", adet: 1 });
  sina("Uçtan uca dövüşçü eşleşmesi bulundu", es.length === 1 && !!es[0].ad, es[0]?.ad);
  sina("Ses/koç kuyrukları sınırsız büyümedi", o.sesler.length <= 24 && o.konusmalar.length <= 12);
}

console.log(`\n=== ${gecti} geçti, ${kaldi} kaldı ===\n`);
process.exit(kaldi > 0 ? 1 : 0);

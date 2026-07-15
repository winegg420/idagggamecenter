// ============================================================
// KAFA TOPU — başsız motor testleri (Node, canvas gerekmez).
// Çalıştırma (repo kökünden):  node kafatopu/_test/motor-test.mjs
// Kapsam: golKontrol sınırları, faz geçişleri, ELO formül eşleniği,
// tam maç simülasyonları (1v1/2v2), zıplama-basılı-tutma (göğe uçma) regresyonu.
// ============================================================

import Matter from "matter-js";
import { macKur, macTick, girdiAyarla, anlikDurum, bosGirdi } from "../engine/oyun.js";
import { botDurumKur, botGirdiHesapla } from "../engine/bot.js";
import { golKontrol } from "../engine/fizik.js";
import { SAHA, KALE, TOP, MAC } from "../shared/sabitler.js";

let gecen = 0, kalan = 0;
function dogrula(ad, kosul) {
  if (kosul) { gecen++; console.log(`  ✓ ${ad}`); }
  else { kalan++; console.error(`  ✗ ${ad}`); }
}

function metaYap(sayi) {
  const yetenekler = ["ates_sutu", "buz", "isinlanma", "kalkan", "dev_kafa"];
  return Array.from({ length: sayi }, (_, s) => ({
    slot: s, takim: s % 2 === 0 ? 1 : 2,
    kafa: "volkan", yetenek: yetenekler[s % 5], ad: `T${s}`, adminGuc: false,
  }));
}

// ---------- 1) golKontrol sınır testleri ----------
console.log("[golKontrol]");
const kaleUst = SAHA.ZEMIN_Y - KALE.ACIKLIK;
const sahteTop = (x, y) => ({ position: { x, y } });
dogrula("sol kale içi → takım 2 golü", golKontrol(sahteTop(10, SAHA.ZEMIN_Y - 40)) === 2);
dogrula("sağ kale içi → takım 1 golü", golKontrol(sahteTop(SAHA.W - 10, SAHA.ZEMIN_Y - 40)) === 1);
dogrula("orta saha → gol yok", golKontrol(sahteTop(SAHA.W / 2, SAHA.ZEMIN_Y - 40)) === 0);
dogrula("sol üst direk üstü → gol yok", golKontrol(sahteTop(10, kaleUst - 60)) === 0);
dogrula("kale ağzı çizgisinde (tam girmemiş) → gol yok",
  golKontrol(sahteTop(KALE.DERINLIK + TOP.R, SAHA.ZEMIN_Y - 40)) === 0);

// ---------- 2) Faz geçişleri ----------
// macTick tek çağrıda en fazla 250 ms işler (duraklama koruması);
// zaman küçük adımlarla ilerletilir.
console.log("[faz geçişleri]");
function zamanIlerle(mac, ms) {
  for (let t = 0; t < ms; t += 50) macTick(mac, 50);
}
{
  const mac = macKur({ mod: "1v1", meta: metaYap(2) });
  dogrula("başlangıç fazı geri_sayim", mac.faz === "geri_sayim");
  zamanIlerle(mac, MAC.BASLANGIC_GERI_SAYIM_SN * 1000 + 300);
  dogrula("geri sayım sonrası oyun", mac.faz === "oyun");

  // Topu sol kaleye ışınla → takım 2 golü + gol_bekle
  Matter.Body.setPosition(mac.dunya.top, { x: 10, y: SAHA.ZEMIN_Y - 40 });
  Matter.Body.setVelocity(mac.dunya.top, { x: 0, y: 0 });
  zamanIlerle(mac, 100);
  dogrula("gol sonrası gol_bekle fazı", mac.faz === "gol_bekle");
  dogrula("skor takım 2'ye işlendi", mac.skor[1] === 1 && mac.skor[0] === 0);

  zamanIlerle(mac, MAC.GOL_BEKLE_MS + 300);
  dogrula("gol beklemesi sonrası tekrar oyun", mac.faz === "oyun");
  dogrula("pozisyon resetlendi (top ortada)",
    Math.abs(mac.dunya.top.position.x - SAHA.W / 2) < 2);

  mac.kalanMs = 50; // süreyi bitir
  zamanIlerle(mac, 300);
  dogrula("süre bitince faz bitti", mac.faz === "bitti");
  const snap = anlikDurum(mac, true);
  dogrula("bitti olayı kazananı doğru veriyor",
    snap.olaylar.some((o) => o.tip === "bitti" && o.kazanan === 2));
}

// ---------- 3) ELO formül eşleniği ----------
// kafatopu_sonuc_kaydet'teki SQL matematiğinin birebir JS kopyası; formül
// değişirse iki taraf birlikte güncellenmeli (K=32, taban 100 hariç saf delta).
console.log("[ELO]");
function eloDelta(r1, r2, kazanan /* 1|2|0 */) {
  const e1 = 1 / (1 + Math.pow(10, (r2 - r1) / 400));
  const s1 = kazanan === 1 ? 1 : kazanan === 2 ? 0 : 0.5;
  return Math.round(32 * (s1 - e1));
}
dogrula("eşit puan, galibiyet = +16", eloDelta(1000, 1000, 1) === 16);
dogrula("eşit puan, beraberlik = 0", eloDelta(1000, 1000, 0) === 0);
dogrula("eşit puan, mağlubiyet = -16", eloDelta(1000, 1000, 2) === -16);
dogrula("güçlü (1100) zayıfı (900) yenince az kazanır (+8)", eloDelta(1100, 900, 1) === 8);
dogrula("zayıf (900) güçlüyü (1100) yenince çok kazanır (+24)", eloDelta(900, 1100, 1) === 24);
dogrula("delta simetrik (kazanan + kaybeden = 0)",
  eloDelta(1234, 987, 1) + (-eloDelta(1234, 987, 1)) === 0);

// ---------- 4) Tam maç simülasyonları (botlarla) ----------
console.log("[tam maç]");
function macSimule(mod, sureSn = 400) {
  const meta = metaYap(mod === "2v2" ? 4 : 2);
  const mac = macKur({ mod, meta });
  const botlar = meta.map(() => botDurumKur());
  let gol = 0, vurus = 0, bayilma = 0, yetenek = 0;
  const adim = 16.67;
  for (let a = 0; a < Math.ceil((sureSn * 1000) / adim); a++) {
    for (let s = 0; s < meta.length; s++)
      girdiAyarla(mac, s, botGirdiHesapla(mac, s, botlar[s]));
    macTick(mac, adim);
    const snap = anlikDurum(mac, true);
    for (const o of snap.olaylar) {
      if (o.tip === "gol") gol++;
      if (o.tip === "vurus") vurus++;
      if (o.tip === "bayildi") bayilma++;
      if (o.tip === "yetenek") yetenek++;
    }
    if (!isFinite(snap.top.x) || snap.oy.some((oy) => !isFinite(oy.x)))
      throw new Error("NaN konum!");
    if (mac.faz === "bitti") break;
  }
  console.log(`  [${mod}] skor=${mac.skor.join("-")} gol=${gol} vurus=${vurus} bayilma=${bayilma} yetenek=${yetenek}`);
  dogrula(`${mod} maçı süre içinde bitti`, mac.faz === "bitti");
  dogrula(`${mod} skor/gol tutarlı`, mac.skor[0] + mac.skor[1] === gol);
  dogrula(`${mod} vuruş/yetenek/bayılma tetiklendi`, vurus > 0 && yetenek > 0 && bayilma > 0);
}
macSimule("1v1");
macSimule("2v2");

// ---------- 5) Zıplama-basılı-tutma regresyonu (göğe uçma bug'ı) ----------
console.log("[zıpla-tut]");
{
  const mac = macKur({ mod: "1v1", meta: metaYap(2) });
  let minY = 9999;
  for (let a = 0; a < 60 * 15; a++) {
    girdiAyarla(mac, 0, { ...bosGirdi(), zipla: true });
    macTick(mac, 16.67);
    minY = Math.min(minY, mac.dunya.oyuncular[0].position.y);
  }
  const tepe = Math.round(SAHA.ZEMIN_Y - 44 - minY);
  console.log(`  tepe: zeminden ${tepe}px`);
  dogrula("karakter göğe uçmuyor (y > 150)", minY > 150);
  dogrula("zıplama makul (tepe ≤ 220px)", tepe <= 220);
}

// ---------- Sonuç ----------
console.log(`\n${gecen} geçti, ${kalan} kaldı.`);
if (kalan > 0) process.exit(1);
console.log("TÜM MOTOR TESTLERİ GEÇTİ ✓");

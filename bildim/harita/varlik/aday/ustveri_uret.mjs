// ============================================================
// AŞAMA 1H — aday üstverileri + karşılaştırma sayfası tanımları (muayene hattı için). hazirla.mjs'ten SONRA çalışır.
//   node bildim/harita/varlik/aday/ustveri_uret.mjs
// Kemik ROLLERİ adayın kendi (içe aktarılmış, adı temizlenmiş) kemik adlarına eşlenir → aynı yakın çekim her adayda aynı anatomik yere bakar.
// ============================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const BURASI = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(BURASI, "../../../..");
const USTVERI = path.join(KOK, "bildim/harita/muayene/ustveri");
const SAYFA = path.join(KOK, "bildim/harita/muayene/karsilastirma");
const kareler = JSON.parse(fs.readFileSync(path.join(BURASI, "kareler.json"), "utf8"));

const ROLLER = {
  mixamo: { solKol: "LeftArm", sagKol: "RightArm", kalca: "Hips", gogus: "Spine2", boyun: "Neck", bas: "Head", solEl: "LeftHand", sagOmuz: "RightArm", sagOnKol: "RightForeArm", solOnKol: "LeftForeArm", solDiz: "LeftLeg", sagDiz: "RightLeg" },
  ue: { solKol: "upperarm_l", sagKol: "upperarm_r", kalca: "pelvis", gogus: "spine_03", boyun: "neck_01", bas: "Head", solEl: "hand_l", sagOmuz: "upperarm_r", sagOnKol: "lowerarm_r", solOnKol: "lowerarm_l", solDiz: "calf_l", sagDiz: "calf_r" },
  umm: { solKol: "UpperArmL", sagKol: "UpperArmR", kalca: "Hips", gogus: "Chest", boyun: "Neck", bas: "Head", solEl: "WristL", sagOmuz: "UpperArmR", sagOnKol: "LowerArmR", solOnKol: "LowerArmL", solDiz: "LowerLegL", sagDiz: "LowerLegR" },
};

// §6 aday kontakt yakın çekimleri: boyun-omuz · torso-pelvis · bacak ayrımı · el · tam profil  + §5 deformasyon kareleri
const YAKIN = [
  { ad: "boyun-omuz", hedef: { rol: "boyun", ofset: [0, -0.02, 0] }, yon: [0.55, 0.12, 1], mesafe: 0.95 },
  { ad: "torso-pelvis", hedef: { rol: "kalca", ofset: [0, 0.22, 0] }, yon: [0.35, 0.05, 1], mesafe: 1.45 },
  { ad: "bacak ayrımı", hedef: { rol: "kalca", ofset: [0, -0.18, 0] }, yon: [0, -0.05, 1], mesafe: 1.0 },
  { ad: "el", hedef: { rol: "solEl", ofset: [0.05, 0, 0] }, yon: [0.25, 0.55, 1], mesafe: 0.5 },
  { ad: "tam profil (sabit kamera, nötr poz)", tip: "sabit", kam: [5.4, 0.95, 0], hedef: [0, 0.92, 0], fov: 22, klip: "Dur", zaman: 0 },
  { ad: `dirsek bükülü (${kareler.dirsek.klip} ${kareler.dirsek.zaman}s)`, klip: kareler.dirsek.klip, zaman: kareler.dirsek.zaman, hedef: { rol: "gogus" }, yon: [0.7, 0.2, 1], mesafe: 1.6 },
  { ad: `diz bükülü (${kareler.diz.klip} ${kareler.diz.zaman}s)`, klip: kareler.diz.klip, zaman: kareler.diz.zaman, hedef: { rol: "kalca", ofset: [0, -0.45, 0] }, yon: [1, 0.05, 0.35], mesafe: 1.5 },
  { ad: `omuz kalkık (${kareler.omuz.klip} ${kareler.omuz.zaman}s)`, klip: kareler.omuz.klip, zaman: kareler.omuz.zaman, hedef: { rol: "sagOmuz" }, yon: [-0.55, 0.15, 1], mesafe: 0.9 },
  { ad: `kalça dönük (${kareler.kalca.klip} ${kareler.kalca.zaman}s)`, klip: kareler.kalca.klip, zaman: kareler.kalca.zaman, hedef: { rol: "kalca", ofset: [0, -0.25, 0] }, yon: [1, 0.1, 0.25], mesafe: 1.55 },
];

const adayRapor = (ad) => { const f = path.join(BURASI, ad, "rapor.json"); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null; };
const yaz = (dosya, veri) => { fs.mkdirSync(path.dirname(dosya), { recursive: true }); fs.writeFileSync(dosya, JSON.stringify(veri, null, 2) + "\n"); };
const klasorUrl = (ad) => `/bildim/harita/varlik/aday/${ad}/`;

// ---- aday üstverileri ----
const ustveriler = {};
const adayUstveri = (anahtar, glb, klasor, rig, ek = {}) => {
  const u = { glb, klasor, tip: "karakter", duzTen: true, kemikler: ROLLER[rig], yakin: YAKIN, temas_esigi_m: 0.02, ...ek };
  yaz(path.join(USTVERI, anahtar + ".json"), u); ustveriler[anahtar] = u;
};
// C: mevcut gövde (kontrol) — mevcut GLB'den okunur, uret.mjs'e dokunulmaz; mekanik test kuralları karakter_insan'dan
const insan = JSON.parse(fs.readFileSync(path.join(USTVERI, "karakter_insan.json"), "utf8"));
const { glb: _g, tip: _t, kozmetik: _k, yakin: _y, kozmetik_izinli: _ki, ...insanKurallari } = insan;   // mekanik test kuralları aynen (kozmetik hariç)
adayUstveri("aday_c_mevcut", "karakter_insan", undefined, "mixamo", insanKurallari);
delete ustveriler.aday_c_mevcut.klasor;
for (const ad of ["a_regular", "b_teen", "a0_superhero", "d_beach"]) {
  const r = adayRapor(ad); if (!r) continue;
  const rig = ad === "d_beach" ? "umm" : "ue";
  adayUstveri(`aday_${ad}_ham`, path.basename(r.hamDosya, ".glb"), klasorUrl(ad), rig);
  if (r.sadeDosya !== r.hamDosya) adayUstveri(`aday_${ad}_sade`, path.basename(r.sadeDosya, ".glb"), klasorUrl(ad), rig);
}

// ---- karşılaştırma sayfaları ----
const sade = (ad) => { const r = adayRapor(ad); return r ? (r.sadeDosya !== r.hamDosya ? `aday_${ad}_sade` : `aday_${ad}_ham`) : null; };
const sutun = (ad, etiket, yokNotu) => {
  const r = adayRapor(ad);
  if (!r) return { ustveriAd: null, etiket, yokNotu, satirlar: ["ham → sade: —", "retarget: denenemedi"] };
  return { ustveriAd: sade(ad), etiket, satirlar: [`ham ${r.hamUcgen.toLocaleString("tr-TR")} → sade ${r.sadeUcgen.toLocaleString("tr-TR")} üçgen`, `retarget: ${r.retarget.calisti ? "çalıştı" : "SORUNLU"} (${r.retarget.eslenenKemik} kemik)`, `skin doğrulama: ${r.dogrulama.sade.gecti ? "geçti" : "KALDI"}`, `CC0 · ${r.normalize.cevrildi180 ? "180° çevrildi" : "yön aynı"}`] };
};
const YOK = "Regular/Teen yalnız ücretli Source|sürümünde (itch.io, 19,99 $).|Dosya a_regular|b_teen/kaynak/ klasörüne konunca|hazirla.mjs + bu sayfa yeniden üretilir.";
const cMevcut = { ustveriAd: "aday_c_mevcut", etiket: "C · Mevcut gövde (kontrol)", satirlar: ["6.656 üçgen (sadeleştirme gerekmez)", "retarget: — (kendi klipleri)", "saç/ceket/yaka/kapüşon çökertildi", "yüz yamaları geometride duruyor"] };
const SUTUNLAR = [
  sutun("a_regular", "A · Universal Base Regular", YOK),
  sutun("b_teen", "B · Universal Base Teen", YOK),
  sutun("a0_superhero", "A0 · Universal Base Superhero (ek)"),
  cMevcut,
  sutun("d_beach", "D · Modular Men — Beach"),
];
const DUR = { klip: "Dur", zaman: 0 };   // nötr poz: kaynak T-pozu, kollar 55° aşağı — her adaya retarget, C'ye muayenede aynı dönüş
yaz(path.join(SAYFA, "govde_karsilastirma.json"), {
  baslik: "AŞAMA 1H — GÖVDE KARŞILAŞTIRMASI (sadeleştirilmiş hal, düz ten, çıplak)",
  altBaslik: `Aynı sabit kamera · aynı poz (nötr = bizim T-poz, kollar 55° aşağı; diz = Walk; hepsi retarget) · boy ${kareler.boy} m · kök y=0 · ışık B+ · #F2C9A7 pürüz 0,82 · A0 kitin ücretsiz paketteki tek erkek gövdesi (A/B yerine DEĞİL)`,
  sutunlar: SUTUNLAR,
  satirlar: [
    { ad: "ÖN|nötr poz", gorunum: { tip: "sabit", kam: [0, 0.95, 5.4], hedef: [0, 0.92, 0], fov: 22, ...DUR } },
    { ad: "YAN PROFİL|nötr poz", gorunum: { tip: "sabit", kam: [5.4, 0.95, 0], hedef: [0, 0.92, 0], fov: 22, ...DUR } },
    { ad: "3/4 AÇI|nötr poz", gorunum: { tip: "sabit", kam: [3.8, 1.25, 3.8], hedef: [0, 0.92, 0], fov: 22, ...DUR } },
    { ad: `DİZ BÜKÜLÜ|${kareler.diz.klip} ${kareler.diz.zaman} s`, gorunum: { tip: "sabit", kam: [5.0, 0.95, 2.0], hedef: [0, 0.92, 0], fov: 22, klip: kareler.diz.klip, zaman: kareler.diz.zaman } },
  ],
});
yaz(path.join(SAYFA, "govde_deformasyon.json"), {
  baslik: "AŞAMA 1H — DEFORMASYON (sadeleştirilmiş hal, bizim klipler retarget)",
  altBaslik: `Kareler kaynak kliplerde ölçüldü: dirsek ${kareler.dirsek.deger}° · diz ${kareler.diz.deger}° · omuz (el omuzdan ${kareler.omuz.deger} m yukarıda) · uyluk arası ${kareler.kalca.deger}° — her aday AYNI kare`,
  sutunlar: SUTUNLAR,
  satirlar: YAKIN.slice(5).map((y) => ({ ad: y.ad.replace(" (", "|(").replace(")", ")"), gorunum: { tip: "yakin", ...y } })),
});
if (adayRapor("a0_superhero")) yaz(path.join(SAYFA, "govde_sadelestirme_kaybi.json"), {
  baslik: "AŞAMA 1H — SADELEŞTİRME KAYBI: A0 Superhero ham ↔ sade",
  altBaslik: "meshoptimizer simplify (konum kaynaştırma, alt küme köşe) · JOINTS/WEIGHTS birebir korundu (değişen köşe 0) · aynı kamera, aynı kare",
  sutunlar: [
    { ustveriAd: "aday_a0_superhero_ham", etiket: "A0 ham", satirlar: [`${adayRapor("a0_superhero").hamUcgen.toLocaleString("tr-TR")} üçgen`] },
    { ustveriAd: "aday_a0_superhero_sade", etiket: "A0 sade", satirlar: [`${adayRapor("a0_superhero").sadeUcgen.toLocaleString("tr-TR")} üçgen`] },
  ],
  satirlar: [
    { ad: "3/4 AÇI|nötr poz", gorunum: { tip: "sabit", kam: [3.8, 1.25, 3.8], hedef: [0, 0.92, 0], fov: 22, ...DUR } },
    { ad: "YÜZ-BOYUN|yakın", gorunum: { tip: "yakin", ...YAKIN[0] } },
    { ad: "EL|yakın", gorunum: { tip: "yakin", ...YAKIN[3] } },
    ...YAKIN.slice(5, 7).map((y) => ({ ad: y.ad.replace(" (", "|("), gorunum: { tip: "yakin", ...y } })),
  ],
});
console.log("[aday] üstveri:", Object.keys(ustveriler).join(", "));

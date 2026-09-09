// Bildim avatar üreteci — 30 karakterli, komik çizim avatar (128x128 SVG).
// Tamamı özgün çizim: telifli fotoğraf ya da gerçek kişi benzerliği yok.
// Palet gece lacivert + altın ailesiyle uyumlu; mor kullanılmıyor.

import fs from "node:fs";
import path from "node:path";

const KOYU = "#0B1220";
const AK = "#FFF8EC";

// ---------- parça yardımcıları ----------

const gozBuyuk = (renk = KOYU, bak = 0) => `
  <circle cx="48" cy="66" r="12" fill="${AK}"/>
  <circle cx="80" cy="66" r="12" fill="${AK}"/>
  <circle cx="${48 + bak}" cy="68" r="6" fill="${renk}"/>
  <circle cx="${80 + bak}" cy="68" r="6" fill="${renk}"/>
  <circle cx="${45 + bak}" cy="64" r="2.2" fill="${AK}"/>
  <circle cx="${77 + bak}" cy="64" r="2.2" fill="${AK}"/>`;

const gozKisik = (renk = KOYU) => `
  <path d="M38 68q10-11 20 0" stroke="${renk}" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M70 68q10-11 20 0" stroke="${renk}" stroke-width="5" fill="none" stroke-linecap="round"/>`;

const gozCizgi = (renk = KOYU) => `
  <rect x="36" y="63" width="24" height="6" rx="3" fill="${renk}"/>
  <rect x="68" y="63" width="24" height="6" rx="3" fill="${renk}"/>`;

const gozTek = (renk = KOYU) => `
  <ellipse cx="64" cy="66" rx="20" ry="16" fill="${AK}"/>
  <circle cx="66" cy="68" r="8" fill="${renk}"/>
  <circle cx="62" cy="63" r="3" fill="${AK}"/>`;

const gozUc = (renk = KOYU) => `
  <circle cx="42" cy="64" r="9" fill="${AK}"/><circle cx="43" cy="65" r="4.5" fill="${renk}"/>
  <circle cx="64" cy="60" r="9" fill="${AK}"/><circle cx="65" cy="61" r="4.5" fill="${renk}"/>
  <circle cx="86" cy="64" r="9" fill="${AK}"/><circle cx="87" cy="65" r="4.5" fill="${renk}"/>`;

const gozKare = (renk) => `
  <rect x="38" y="58" width="20" height="16" rx="4" fill="${KOYU}"/>
  <rect x="70" y="58" width="20" height="16" rx="4" fill="${KOYU}"/>
  <rect x="44" y="63" width="8" height="6" rx="2" fill="${renk}"/>
  <rect x="76" y="63" width="8" height="6" rx="2" fill="${renk}"/>`;

const gozGozluk = (cerceve) => `
  ${gozBuyuk()}
  <circle cx="48" cy="66" r="15" fill="none" stroke="${cerceve}" stroke-width="4"/>
  <circle cx="80" cy="66" r="15" fill="none" stroke="${cerceve}" stroke-width="4"/>
  <path d="M63 66h2" stroke="${cerceve}" stroke-width="4" stroke-linecap="round"/>`;

const agizGulus = (renk = KOYU) =>
  `<path d="M50 88q14 13 28 0" stroke="${renk}" stroke-width="5" fill="none" stroke-linecap="round"/>`;

const agizSirit = () => `
  <path d="M44 84h40a20 20 0 0 1-40 0z" fill="${KOYU}"/>
  <path d="M46 84h36v6H46z" fill="${AK}"/>`;

const agizDil = () => `
  <path d="M44 84h40a20 20 0 0 1-40 0z" fill="${KOYU}"/>
  <path d="M58 96a8 8 0 0 0 14 0z" fill="#E8543F"/>`;

const agizO = (renk = KOYU) => `<ellipse cx="64" cy="90" rx="9" ry="10" fill="${renk}"/>`;

const agizDisli = () => `
  <path d="M44 84h40v4a18 18 0 0 1-40 0z" fill="${KOYU}"/>
  <path d="M48 85l5 7 5-7 5 7 5-7 5 7 5-7z" fill="${AK}"/>`;

const agizDuz = (renk = KOYU) =>
  `<rect x="52" y="88" width="24" height="5" rx="2.5" fill="${renk}"/>`;

const kulakUcgen = (renk, ic) => `
  <path d="M28 44 34 14l22 16z" fill="${renk}"/>
  <path d="M100 44 94 14 72 30z" fill="${renk}"/>
  <path d="M34 40l3-16 12 9z" fill="${ic}"/>
  <path d="M94 40l-3-16-12 9z" fill="${ic}"/>`;

const kulakYuvarlak = (renk) => `
  <circle cx="30" cy="34" r="15" fill="${renk}"/>
  <circle cx="98" cy="34" r="15" fill="${renk}"/>`;

const kulakSarkan = (renk) => `
  <path d="M26 44q-12 26 8 34 10-14 6-34z" fill="${renk}"/>
  <path d="M102 44q12 26-8 34-10-14-6-34z" fill="${renk}"/>`;

const boynuz = (renk) => `
  <path d="M34 34 26 12l18 12z" fill="${renk}"/>
  <path d="M94 34l8-22-18 12z" fill="${renk}"/>`;

const anten = (renk) => `
  <rect x="61" y="14" width="6" height="16" rx="3" fill="${renk}"/>
  <circle cx="64" cy="12" r="7" fill="${renk}"/>`;

const tac = () => `
  <path d="M34 34 40 12l12 12 12-16 12 16 12-12 6 22z" fill="#F2B23C"/>
  <circle cx="64" cy="20" r="3.5" fill="#E8543F"/>`;

const sapkaAsci = () => `
  <path d="M32 36q-4-22 14-22 4-10 18-10t18 10q18 0 14 22z" fill="${AK}"/>
  <rect x="32" y="32" width="64" height="12" rx="4" fill="#E6E0D2"/>`;

const sapkaBuyucu = (renk) => `
  <path d="M64 4 92 40H36z" fill="${renk}"/>
  <rect x="28" y="36" width="72" height="10" rx="5" fill="${renk}"/>
  <circle cx="76" cy="26" r="3.5" fill="#F2B23C"/>
  <circle cx="56" cy="20" r="2.5" fill="#F2B23C"/>`;

const bandana = (renk) => `
  <path d="M28 40q36-16 72 0v-8q-36-16-72 0z" fill="${renk}"/>
  <rect x="26" y="30" width="76" height="12" rx="6" fill="${renk}"/>
  <path d="M26 36l-14 8 6 10 12-12z" fill="${renk}"/>`;

const kask = (renk) => `
  <path d="M26 46a38 38 0 0 1 76 0v6H26z" fill="${renk}"/>
  <rect x="60" y="46" width="8" height="34" rx="4" fill="${renk}"/>`;

const vikingBoynuz = () => `
  <path d="M26 44a38 38 0 0 1 76 0v4H26z" fill="#8496B2"/>
  <path d="M24 44q-16-4-16-18 14 2 18 14z" fill="${AK}"/>
  <path d="M104 44q16-4 16-18-14 2-18 14z" fill="${AK}"/>`;

const sapkaDedektif = (renk) => `
  <rect x="20" y="36" width="88" height="8" rx="4" fill="${renk}"/>
  <path d="M36 36q4-20 28-20t28 20z" fill="${renk}"/>`;

const kabarikSac = (renk) => `
  <circle cx="36" cy="34" r="16" fill="${renk}"/>
  <circle cx="64" cy="24" r="18" fill="${renk}"/>
  <circle cx="92" cy="34" r="16" fill="${renk}"/>`;

// Yalnız yanlarda kabaran saç, tepesi açık (profesör tipi).
// Tepeyi de kapatınca kafa beyaz bir halkanın içinde kalıp koyuna benziyordu.
const yanSac = (renk) => `
  <circle cx="24" cy="60" r="15" fill="${renk}"/>
  <circle cx="104" cy="60" r="15" fill="${renk}"/>
  <circle cx="30" cy="42" r="11" fill="${renk}"/>
  <circle cx="98" cy="42" r="11" fill="${renk}"/>`;

const yuzMaske = (renk) => `
  <rect x="24" y="56" width="80" height="18" rx="9" fill="${renk}"/>`;

const gozBandi = () => `
  <rect x="24" y="58" width="80" height="12" rx="6" fill="${KOYU}"/>
  <path d="M44 58a10 10 0 0 1 20 0z" fill="${KOYU}"/>`;

const sargi = () => `
  <path d="M26 50h76v9H26z" fill="#F5F0E2"/>
  <path d="M30 74h68v9H30z" fill="#F5F0E2"/>
  <path d="M28 90h58v9H28z" fill="#F5F0E2"/>
  <path d="M24 40l74 26-4 9-74-26z" fill="#FFFBF0"/>
  <path d="M26 59h76M30 83h68M28 99h58" stroke="#B8B0A0" stroke-width="1.6"/>`;

const kask_astronot = () => `
  <circle cx="64" cy="68" r="42" fill="#CFE3F5" opacity="0.14"/>
  <circle cx="64" cy="68" r="42" fill="none" stroke="${AK}" stroke-width="7"/>
  <circle cx="64" cy="68" r="47" fill="none" stroke="#F2B23C" stroke-width="5"/>
  <path d="M40 46a30 30 0 0 1 22-8" stroke="${AK}" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.8"/>`;

const yanak = (renk) => `
  <ellipse cx="34" cy="82" rx="8" ry="5" fill="${renk}" opacity="0.55"/>
  <ellipse cx="94" cy="82" rx="8" ry="5" fill="${renk}" opacity="0.55"/>`;

const biyik = (renk) => `
  <path d="M46 84q18-8 36 0-18 6-36 0z" fill="${renk}"/>`;

const sakal = (renk) => `
  <path d="M38 84q26 30 52 0-4 26-26 26T38 84z" fill="${renk}"/>`;

const yuzukSac = (renk) => `
  <path d="M30 60q-2-34 34-34t34 34q-6-18-34-18T30 60z" fill="${renk}"/>`;

// ---------- kafa biçimleri ----------
const kafaYuvarlak = (renk) => `<ellipse cx="64" cy="70" rx="40" ry="38" fill="${renk}"/>`;
const kafaKare = (renk) => `<rect x="26" y="36" width="76" height="68" rx="18" fill="${renk}"/>`;
const kafaDamla = (renk) => `<path d="M64 30c24 0 38 18 38 38s-14 40-38 40-38-18-38-40 14-38 38-38z" fill="${renk}"/>`;

// ---------- karakterler ----------
// zemin, ten, parçalar (arka = kafanın arkasına, on = kafanın önüne)
const KARAKTERLER = [
  { ad: "kedi", zemin: "#F2B23C", ten: "#3B4A6B", arka: () => kulakUcgen("#3B4A6B", "#E0729A"),
    on: () => kafaYuvarlak("#3B4A6B") + gozBuyuk("#2FBF71") + biyik("#0B1220") + agizGulus() },
  { ad: "kopek", zemin: "#5AA9E6", ten: "#C98A22", arka: () => kulakSarkan("#8A5F16"),
    on: () => kafaYuvarlak("#C98A22") +
      `<ellipse cx="64" cy="88" rx="25" ry="18" fill="#E6C79A"/>` +
      gozBuyuk() + `<ellipse cx="64" cy="79" rx="9" ry="7" fill="${KOYU}"/>` + agizDil() },
  { ad: "baykus", zemin: "#3FA9A0", ten: "#26365A", arka: () => boynuz("#26365A"),
    on: () => kafaYuvarlak("#26365A") + gozBuyuk("#F2B23C") + `<path d="M64 78 56 92h16z" fill="#F2B23C"/>` },
  { ad: "tilki", zemin: "#4A9DD9", ten: "#EE8B3C", arka: () => kulakUcgen("#EE8B3C", "#0B1220"),
    on: () => kafaDamla("#EE8B3C") + `<path d="M64 76c14 0 22 8 22 16s-10 14-22 14-22-6-22-14 8-16 22-16z" fill="${AK}"/>` + gozKisik() + `<ellipse cx="64" cy="86" rx="7" ry="5" fill="${KOYU}"/>` + agizGulus() },
  { ad: "panda", zemin: "#8CBF3F", ten: AK, arka: () => kulakYuvarlak(KOYU),
    on: () => kafaYuvarlak(AK) + `<ellipse cx="46" cy="66" rx="14" ry="16" fill="${KOYU}"/><ellipse cx="82" cy="66" rx="14" ry="16" fill="${KOYU}"/>` + `<circle cx="46" cy="66" r="6" fill="${AK}"/><circle cx="82" cy="66" r="6" fill="${AK}"/>` + `<ellipse cx="64" cy="86" rx="7" ry="5" fill="${KOYU}"/>` + agizGulus() },
  { ad: "penguen", zemin: "#F2B23C", ten: "#26365A", arka: () => "",
    on: () => kafaYuvarlak("#26365A") + `<ellipse cx="64" cy="78" rx="26" ry="28" fill="${AK}"/>` + gozBuyuk() + `<path d="M64 82 54 92h20z" fill="#EE8B3C"/>` },
  { ad: "kurbaga", zemin: "#4FB3C9", ten: "#2FBF71", arka: () => `<circle cx="42" cy="42" r="16" fill="#2FBF71"/><circle cx="86" cy="42" r="16" fill="#2FBF71"/>`,
    on: () => kafaYuvarlak("#2FBF71") + `<circle cx="42" cy="42" r="9" fill="${AK}"/><circle cx="86" cy="42" r="9" fill="${AK}"/><circle cx="43" cy="43" r="4.5" fill="${KOYU}"/><circle cx="87" cy="43" r="4.5" fill="${KOYU}"/>` + `<path d="M40 82q24 18 48 0" stroke="${KOYU}" stroke-width="5" fill="none" stroke-linecap="round"/>` + yanak("#E8543F") },
  { ad: "ayi", zemin: "#57C9A0", ten: "#8A5F16", arka: () => kulakYuvarlak("#8A5F16"),
    on: () => kafaYuvarlak("#8A5F16") + `<ellipse cx="64" cy="84" rx="20" ry="16" fill="#C98A22"/>` + gozBuyuk() + `<ellipse cx="64" cy="80" rx="7" ry="5" fill="${KOYU}"/>` + agizGulus() },
  { ad: "maymun", zemin: "#E0729A", ten: "#8A5F16", arka: () => kulakYuvarlak("#C98A22"),
    on: () => kafaYuvarlak("#8A5F16") + `<ellipse cx="64" cy="78" rx="26" ry="24" fill="#E6C79A"/>` + gozBuyuk() + `<ellipse cx="58" cy="84" rx="2.5" ry="3" fill="${KOYU}"/><ellipse cx="70" cy="84" rx="2.5" ry="3" fill="${KOYU}"/>` + agizGulus() },
  { ad: "dinozor", zemin: "#F2B23C", ten: "#2FBF71", arka: () => `<path d="M50 30l6-14 8 12 8-14 6 16z" fill="#8CBF3F"/>`,
    on: () => kafaKare("#2FBF71") + gozBuyuk() + agizDisli() },
  { ad: "ejderha", zemin: "#26365A", ten: "#E8543F", arka: () => boynuz("#F2B23C"),
    on: () => kafaDamla("#E8543F") + gozKisik("#F2B23C") + agizDisli() + `<path d="M64 100q-6 10 0 18" stroke="#F2B23C" stroke-width="4" fill="none" stroke-linecap="round"/>` },
  { ad: "kopekbaligi", zemin: "#4FB3C9", ten: "#5C7FA8", arka: () => `<path d="M56 28l8-18 8 18z" fill="#5C7FA8"/>`,
    on: () => kafaDamla("#5C7FA8") + `<path d="M64 78c16 0 24 6 24 12s-10 12-24 12-24-6-24-12 8-12 24-12z" fill="#CFE3F5"/>` + gozCizgi() + agizDisli() },
  { ad: "ahtapot", zemin: "#F2B23C", ten: "#D9536A", arka: () => "",
    on: () => `<path d="M64 26c22 0 36 16 36 36v20H28V62c0-20 14-36 36-36z" fill="#D9536A"/>` + `<path d="M28 82q8 18 0 26M46 82q6 20-2 26M64 82q4 22 0 26M82 82q-6 20 2 26M100 82q-8 18 0 26" stroke="#D9536A" stroke-width="11" fill="none" stroke-linecap="round"/>` + gozBuyuk() + agizO() },
  { ad: "ari", zemin: "#26365A", ten: "#F2B23C", arka: () => `<circle cx="40" cy="26" r="7" fill="${KOYU}"/><circle cx="88" cy="26" r="7" fill="${KOYU}"/><path d="M44 30l10 12M84 30 74 42" stroke="${KOYU}" stroke-width="4" stroke-linecap="round"/>`,
    on: () => kafaYuvarlak("#F2B23C") + `<rect x="26" y="76" width="76" height="9" fill="${KOYU}"/><rect x="30" y="92" width="68" height="9" fill="${KOYU}"/>` + gozBuyuk() },
  { ad: "robot", zemin: "#4A9DD9", ten: "#8496B2", arka: () => anten("#F2B23C"),
    on: () => kafaKare("#8496B2") + gozKare("#4FB3C9") + agizDuz(KOYU) + `<rect x="18" y="60" width="8" height="20" rx="4" fill="#5C7FA8"/><rect x="102" y="60" width="8" height="20" rx="4" fill="#5C7FA8"/>` },
  { ad: "uzayli", zemin: "#2FBF71", ten: "#8CBF3F", arka: () => `<circle cx="40" cy="20" r="6" fill="#8CBF3F"/><circle cx="88" cy="20" r="6" fill="#8CBF3F"/><path d="M44 26l8 14M84 26l-8 14" stroke="#8CBF3F" stroke-width="4" stroke-linecap="round"/>`,
    on: () => `<path d="M64 32c24 0 38 16 38 34s-16 42-38 42-38-22-38-42 14-34 38-34z" fill="#8CBF3F"/>` + gozTek() + agizDuz() },
  { ad: "astronot", zemin: "#5C7FA8", ten: "#E6C79A", arka: () => "",
    on: () => kafaYuvarlak("#E6C79A") + gozBuyuk() + agizGulus() + kask_astronot() },
  { ad: "ninja", zemin: "#E8543F", ten: "#26365A", arka: () => "",
    on: () => kafaYuvarlak("#26365A") + `<rect x="24" y="58" width="80" height="16" rx="8" fill="#E6C79A"/>` + gozCizgi() + `<path d="M100 62l18 6-18 6z" fill="#26365A"/>` },
  { ad: "korsan", zemin: "#4FB3C9", ten: "#E6C79A", arka: () => "",
    on: () => kafaYuvarlak("#E6C79A") + bandana("#E8543F") + `<circle cx="48" cy="66" r="12" fill="${AK}"/><circle cx="48" cy="68" r="6" fill="${KOYU}"/>` + `<rect x="66" y="58" width="26" height="16" rx="4" fill="${KOYU}"/><path d="M92 62l14-10" stroke="${KOYU}" stroke-width="4"/>` + agizSirit() },
  { ad: "sovalye", zemin: "#C98A22", ten: "#5C7FA8", arka: () => "",
    on: () => kafaKare("#8496B2") + kask("#5C7FA8") + `<rect x="38" y="58" width="52" height="12" rx="6" fill="${KOYU}"/><rect x="44" y="60" width="8" height="8" rx="2" fill="#4FB3C9"/><rect x="76" y="60" width="8" height="8" rx="2" fill="#4FB3C9"/>` },
  { ad: "buyucu", zemin: "#3FA9A0", ten: "#E6C79A", arka: () => "",
    on: () => kafaYuvarlak("#E6C79A") + gozKisik() + sakal(AK) + sapkaBuyucu("#26365A") },
  { ad: "dedektif", zemin: "#8496B2", ten: "#E6C79A", arka: () => "",
    on: () => kafaYuvarlak("#E6C79A") + sapkaDedektif("#8A5F16") + gozGozluk("#26365A") + biyik("#3B4A6B") + agizDuz() },
  { ad: "asci", zemin: "#E8543F", ten: "#E6C79A", arka: () => "",
    on: () => kafaYuvarlak("#E6C79A") + sapkaAsci() + gozBuyuk() + biyik("#3B4A6B") + agizGulus() },
  { ad: "profesor", zemin: "#4A9DD9", ten: "#E6C79A", arka: () => yanSac("#C9D3E2"),
    on: () => kafaYuvarlak("#E6C79A") + gozGozluk("#26365A") + `<path d="M48 90q16 12 32 0-2 16-16 16t-16-16z" fill="#C9D3E2"/>` },
  { ad: "viking", zemin: "#5AA9E6", ten: "#E6C79A", arka: () => "",
    on: () => kafaYuvarlak("#E6C79A") + vikingBoynuz() + gozBuyuk() + sakal("#EE8B3C") },
  { ad: "hayalet", zemin: "#26365A", ten: AK, arka: () => "",
    on: () => `<path d="M64 24c22 0 34 16 34 36v46l-11-10-12 10-11-10-11 10-11-10-12 10V60c0-20 12-36 34-36z" fill="${AK}"/>` + `<ellipse cx="50" cy="62" rx="7" ry="9" fill="${KOYU}"/><ellipse cx="78" cy="62" rx="7" ry="9" fill="${KOYU}"/>` + agizO() },
  { ad: "zombi", zemin: "#8CBF3F", ten: "#57C9A0", arka: () => "",
    on: () => kafaYuvarlak("#57C9A0") + `<path d="M30 48q16-10 32-2" stroke="#2FBF71" stroke-width="4" fill="none" stroke-linecap="round"/>` + `<circle cx="48" cy="66" r="12" fill="${AK}"/><circle cx="46" cy="66" r="5" fill="${KOYU}"/>` + `<circle cx="80" cy="66" r="9" fill="${AK}"/><circle cx="83" cy="67" r="4" fill="${KOYU}"/>` + agizDisli() },
  { ad: "mumya", zemin: "#C98A22", ten: "#E6E0D2", arka: () => "",
    // Kafa ile sargı aynı renkti, sargılar görünmüyordu: kafa koyulaştı,
    // sargılar açıldı ve aralarına gölge çizgisi eklendi.
    on: () => kafaYuvarlak("#CDC6B4") + sargi() +
      `<circle cx="48" cy="66" r="9" fill="${KOYU}"/><circle cx="80" cy="66" r="9" fill="${KOYU}"/>` +
      `<circle cx="50" cy="63" r="3" fill="${AK}"/><circle cx="82" cy="63" r="3" fill="${AK}"/>` },
  { ad: "kahraman", zemin: "#D9536A", ten: "#E6C79A", arka: () => "",
    on: () => kafaYuvarlak("#E6C79A") + yuzukSac("#26365A") + `<path d="M22 56h84l-8 18H30z" fill="#F2B23C"/>` + `<circle cx="48" cy="65" r="7" fill="${AK}"/><circle cx="80" cy="65" r="7" fill="${AK}"/>` + agizSirit() },
  { ad: "palyaco", zemin: "#4A9DD9", ten: AK, arka: () => kabarikSac("#E8543F"),
    on: () => kafaYuvarlak(AK) + gozBuyuk() + `<circle cx="64" cy="82" r="10" fill="#E8543F"/>` + `<path d="M44 92q20 18 40 0" stroke="#E8543F" stroke-width="5" fill="none" stroke-linecap="round"/>` },
  { ad: "kral", zemin: "#26365A", ten: "#E6C79A", arka: () => "",
    on: () => kafaYuvarlak("#E6C79A") + tac() + gozBuyuk() + sakal(AK) },
];

// ---------- üret ----------
const cikti = path.join("public", "avatars");
fs.mkdirSync(cikti, { recursive: true });

KARAKTERLER.forEach((k, i) => {
  const no = String(i + 1).padStart(2, "0");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="${k.ad}">` +
    `<rect width="128" height="128" rx="28" fill="${k.zemin}"/>` +
    `<circle cx="64" cy="118" r="46" fill="${KOYU}" opacity="0.12"/>` +
    k.arka() +
    k.on() +
    `</svg>`;
  fs.writeFileSync(path.join(cikti, `k${no}.svg`), svg.replace(/\s+/g, " ").replace(/> </g, "><"));
});

console.log("üretilen avatar:", KARAKTERLER.length);
console.log(KARAKTERLER.map((k, i) => `k${String(i + 1).padStart(2, "0")} ${k.ad}`).join(", "));

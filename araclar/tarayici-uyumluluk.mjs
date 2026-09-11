#!/usr/bin/env node
// ============================================================
// TARAYICI UYUMLULUK DENETİMİ — her derlemeden sonra çalışır
//
// NEDEN VAR: iPhone'larda site bembeyaz açılıyordu. Sebep, Vite'ın varsayılan
// derleme hedefinin (safari14) paketlere `?.` ve `??` sözdizimini HAM
// bırakmasıydı; iOS 13.3 ve altı bu dosyayı ayrıştıramayıp uygulamayı hiç
// çalıştırmıyordu. Hata konsola bile düşmüyordu — kod hiç başlamıyordu.
//
// Bu betik aynı hatanın SESSİZCE geri gelmesini engeller: `npm run build`
// sonrası kendiliğinden çalışır ve eşik altındaki bir şey bulursa
// derlemeyi ÇÖKERTİR (exit 1).
//
// Taban: iOS 12.2 / Safari 12.1 — hâlâ ayakta olan en eski iPhone'lar
// (5s, 6). Hedefi yükseltmek isteyen önce burayı okusun.
// ============================================================
import fs from "node:fs";
import path from "node:path";

const KOK = process.argv[2] || "dist";
const VARLIK = path.join(KOK, "assets");

// ---------- Safari 12.1 ÜSTÜ SÖZDİZİMİ (ayrıştırma hatası = beyaz ekran) ----------
const SOZDIZIMI = [
  {
    ad: "optional chaining (?.)",
    // `?.` ancak ardından tanımlayıcı/`(`/`[` gelirse gerçek optional chaining.
    // Küçültücü `x ? .5 : 1` ifadesini `x?.5:1` yazıyor — o YANLIŞ POZİTİF.
    kalip: /\?\.[A-Za-z_$([]/g,
    surum: "Safari 13.1",
  },
  {
    ad: "nullish coalescing (??)",
    // Metin içindeki "???" yanlış pozitif vermesin: ardı ardına ? gelmemeli.
    kalip: /[^?]\?\?[^?=]/g,
    surum: "Safari 13.1",
  },
  { ad: "mantıksal atama (??= ||= &&=)", kalip: /(\?\?=|\|\|=|&&=)/g, surum: "Safari 14" },
  { ad: "sınıf statik bloğu (static {})", kalip: /\bstatic\s*\{/g, surum: "Safari 16.4" },
  { ad: "özel sınıf alanı (#alan)", kalip: /[{;,]\s*#[A-Za-z_$][\w$]*\s*[=(;]/g, surum: "Safari 14.1" },
];

// ---------- Safari 12.1 ÜSTÜ ÇALIŞMA ZAMANI API'leri ----------
// Bunlar ayrıştırmayı bozmaz ama KORUMASIZ çağrılırsa çalışma anında patlar.
// "korumali" deseni varsa sorun yok sayılır.
const API = [
  { ad: "BroadcastChannel", surum: "Safari 15.4", koruma: /(typeof BroadcastChannel|globalThis\.BroadcastChannel|window\.BroadcastChannel)/ },
  { ad: "ResizeObserver", surum: "Safari 13.1", koruma: /typeof ResizeObserver/ },
  { ad: "structuredClone", surum: "Safari 15.4", koruma: /typeof structuredClone/ },
  { ad: "randomUUID", surum: "Safari 15.4", koruma: /(typeof crypto[^;]{0,40}randomUUID|randomUUID\s*\?\.|randomUUID\s*&&)/ },
  { ad: "Object.hasOwn", surum: "Safari 15.4", koruma: /typeof Object\.hasOwn/ },
  { ad: "replaceAll", surum: "Safari 13.1", koruma: /String\.prototype\.replaceAll/ },
  { ad: "findLast", surum: "Safari 15.4", koruma: /Array\.prototype\.findLast/ },
];

// ---------- CSS: yedeksiz modern değerler ----------
// color-mix() iOS 16.2+, :has() iOS 15.4+. Bildirim düşerse eski iPhone'da o
// özellik HİÇ uygulanmaz; tam ekran bir perdenin zemini düşerse perde
// görünmez ama tıklamayı engellemeye devam eder.
const CSS_YEDEK_GEREKENLER = ["background", "color", "border-color"];

function dosyalar(klasor, uzanti) {
  try {
    return fs.readdirSync(klasor).filter((a) => a.endsWith(uzanti)).map((a) => path.join(klasor, a));
  } catch {
    return [];
  }
}

function baglam(metin, indeks, en = 60) {
  return metin.slice(Math.max(0, indeks - en), indeks + en).replace(/\s+/g, " ");
}

const hatalar = [];
const uyarilar = [];

// ---------- JS ----------
const jsDosyalari = dosyalar(VARLIK, ".js");
if (jsDosyalari.length === 0) {
  console.error(`HATA: ${VARLIK} içinde .js bulunamadı. Önce "npm run build" çalıştır.`);
  process.exit(1);
}

for (const dosya of jsDosyalari) {
  const icerik = fs.readFileSync(dosya, "utf8");
  const ad = path.basename(dosya);

  for (const k of SOZDIZIMI) {
    k.kalip.lastIndex = 0;
    const bulunanlar = [...icerik.matchAll(k.kalip)];
    if (bulunanlar.length === 0) continue;
    hatalar.push(
      `${ad}: ${k.ad} — ${bulunanlar.length} adet (${k.surum}+ gerekir)\n` +
      `      örnek: …${baglam(icerik, bulunanlar[0].index)}…`
    );
  }

  for (const a of API) {
    if (!icerik.includes(a.ad)) continue;
    if (a.koruma.test(icerik)) continue;
    uyarilar.push(`${ad}: ${a.ad} korumasız kullanılmış (${a.surum}+ gerekir)`);
  }
}

// ---------- CSS ----------
for (const dosya of dosyalar(VARLIK, ".css")) {
  const icerik = fs.readFileSync(dosya, "utf8");
  const ad = path.basename(dosya);
  // Küçültülmüş CSS: bildirimleri ; ile ayır
  const bildirimler = icerik.split(/[;{}]/);
  bildirimler.forEach((b, i) => {
    if (!b.includes("color-mix(")) return;
    const ozellik = b.split(":")[0].trim().split(/\s/).pop();
    if (!CSS_YEDEK_GEREKENLER.includes(ozellik)) return;   // gölge/kenarlık: süs
    const onceki = (bildirimler[i - 1] ?? "").trim();
    if (onceki.startsWith(ozellik + ":")) return;          // yedeği var
    uyarilar.push(`${ad}: yedeksiz color-mix — ${b.trim().slice(0, 70)}`);
  });
}

// ---------- RAPOR ----------
const toplamJs = jsDosyalari.length;
console.log(`\nTarayıcı uyumluluk denetimi — taban: iOS 12.2 / Safari 12.1`);
console.log(`${toplamJs} JS paketi tarandı.`);

if (uyarilar.length) {
  console.log(`\nUYARI (${uyarilar.length}) — çalışır ama eski cihazda bozulabilir:`);
  for (const u of [...new Set(uyarilar)].slice(0, 20)) console.log("  · " + u);
}

if (hatalar.length) {
  console.error(`\nHATA (${hatalar.length}) — BU SÖZDİZİMİ ESKİ iPHONE'DA BEYAZ EKRAN DEMEK:`);
  for (const h of hatalar) console.error("  ✗ " + h);
  console.error(
    `\nDüzeltme: vite.config.js içindeki build.target değerini düşür.\n` +
    `Şu an beklenen: ["es2019","safari12",...]. Hedefi yükseltmek eski\n` +
    `iPhone'ları dışarı atar — sebepsiz değiştirme.\n`
  );
  process.exit(1);
}

console.log("\nSonuç: TEMİZ — eski iPhone'larda ayrıştırma hatası yok.\n");

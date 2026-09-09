// Sentry gizlilik temizliği testi.
// Çalıştır: node src/lib/_test/hata-izleme-test.mjs
//
// NEDEN ÖNEMLİ: Oyunun açık vaadi "gerçek adın hiçbir zaman gösterilmez".
// Hata raporu bu vaadin kaçak yolu olmamalı. Burada davet kodunun ve e-posta
// benzeri dizgilerin olaydan gerçekten silindiği doğrulanıyor.

import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const burasi = path.dirname(fileURLToPath(import.meta.url));
const kaynak = path.join(burasi, "..", "hataIzleme.js");

// import.meta.env Vite'a özgü; testte boş DSN ile taklit ediliyor.
const cikti = await build({
  entryPoints: [kaynak],
  bundle: false,
  write: false,
  format: "esm",
  define: { "import.meta.env.VITE_SENTRY_DSN": "undefined" },
});
const { temizleOlay, temizleMetin } = await import(
  "data:text/javascript;base64," +
    Buffer.from(cikti.outputFiles[0].text).toString("base64")
);

let gecti = 0;
let kaldi = 0;
const bekle = (ad, kosul) => {
  if (kosul) gecti++;
  else {
    kaldi++;
    console.log("  ✘ " + ad);
  }
};

// --- temizleMetin -----------------------------------------------------------
bekle(
  "davet kodu URL'den silinmeli",
  temizleMetin("https://quizador.pages.dev/?davet=09RP84K3") ===
    "https://quizador.pages.dev/?davet=[gizlendi]",
);
bekle(
  "davet kodu & ile geldiginde de silinmeli",
  !temizleMetin("https://x.dev/?a=1&davet=09RP84K3&b=2").includes("09RP84K3"),
);
bekle(
  "davet sonrasi parametre korunmali",
  temizleMetin("https://x.dev/?davet=ABC&b=2").includes("&b=2"),
);
bekle(
  "e-posta silinmeli",
  temizleMetin("kullanici idagureli@gmail.com hata aldi") ===
    "kullanici [e-posta] hata aldi",
);
bekle(
  "birden fazla e-posta silinmeli",
  !temizleMetin("a@b.com ve c@d.org").includes("@b.com") &&
    !temizleMetin("a@b.com ve c@d.org").includes("@d.org"),
);
bekle("normal metin bozulmamali", temizleMetin("Maç bulunamadı") === "Maç bulunamadı");
bekle("bos/gecersiz girdi patlamamali", temizleMetin(null) === null);

// --- temizleOlay ------------------------------------------------------------
const olay = {
  user: { id: "abc", email: "idagureli@gmail.com", ip_address: "1.2.3.4", username: "idaGG" },
  request: {
    url: "https://quizador.pages.dev/davet/09RP84K3?davet=09RP84K3",
    query_string: "davet=09RP84K3",
    cookies: { sb: "gizli" },
    headers: { Referer: "https://x.dev/?davet=ZZZ" },
  },
  message: "hata: idagureli@gmail.com",
  breadcrumbs: [
    { message: "navigate", data: { to: "/?davet=09RP84K3", from: "/" } },
    { message: "kullanici a@b.com", data: {} },
  ],
  extra: { yol: "/?davet=09RP84K3" },
  exception: { values: [{ value: "a@b.com adresi bulunamadi" }] },
};
const t = temizleOlay(JSON.parse(JSON.stringify(olay)));
const hepsi = JSON.stringify(t);

bekle("e-posta olayin HICBIR yerinde kalmamali", !hepsi.includes("idagureli@gmail.com"));
bekle("a@b.com kalmamali", !hepsi.includes("a@b.com"));
bekle("davet kodu SORGUDA kalmamali", !hepsi.includes("davet=09RP84K3"));
bekle("user.email silinmeli", t.user.email === undefined);
bekle("user.ip_address silinmeli", t.user.ip_address === undefined);
bekle("user.username silinmeli", t.user.username === undefined);
bekle("cerezler silinmeli", t.request.cookies === undefined);
bekle("breadcrumb data temizlenmeli", !JSON.stringify(t.breadcrumbs).includes("davet=09RP84K3"));
bekle("extra temizlenmeli", !JSON.stringify(t.extra).includes("davet=09RP84K3"));
bekle("exception degeri temizlenmeli", !JSON.stringify(t.exception).includes("a@b.com"));
bekle("null olay patlamamali", temizleOlay(null) === null);
bekle("bos olay patlamamali", JSON.stringify(temizleOlay({})) === "{}");

// Yol parçası olarak gelen davet kodu (query değil) — bu BİLEREK silinmiyor,
// çünkü /davet/:kod rotası uygulamanın gerçek bir sayfası. Test bunu belgeliyor.
bekle(
  "yol parcasindaki davet kodu (belgelenmis sinir) duruyor",
  t.request.url.includes("/davet/09RP84K3"),
);

console.log(`\nSonuc: ${gecti} gecti, ${kaldi} kaldi`);
process.exit(kaldi === 0 ? 0 : 1);

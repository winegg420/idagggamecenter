// Dil kurali testi: profil > localStorage > tarayici dili. IP yok.
import assert from "node:assert";
const depo = new Map();
globalThis.localStorage = {
  getItem: (k) => (depo.has(k) ? depo.get(k) : null),
  setItem: (k, v) => depo.set(k, String(v)),
};
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { languages: ["en-US", "en"], language: "en-US" } });
const { dilCoz, dilKaydet, tarayiciDili, t } = await import("../lib/dil.js");

const kontrol = (ad, a, b) => { assert.strictEqual(a, b, ad + " (beklenen " + b + ", gelen " + a + ")"); console.log("  ok  " + ad + " -> " + a); };

kontrol("tarayici en-US", tarayiciDili(), "en");
kontrol("giris yapmamis, tarayici İngilizce", dilCoz(null), "en");

Object.defineProperty(globalThis, "navigator", { configurable: true, value: { languages: ["tr-TR", "tr"], language: "tr-TR" } });
kontrol("tarayici tr-TR", tarayiciDili(), "tr");
kontrol("giris yapmamis, tarayici Turkce", dilCoz(null), "tr");

Object.defineProperty(globalThis, "navigator", { configurable: true, value: { languages: ["de-DE"], language: "de-DE" } });
kontrol("Almanca tarayici -> Ingilizce", dilCoz(null), "en");

dilKaydet("tr");
kontrol("elle secim tarayiciyi ezer", dilCoz(null), "tr");
kontrol("secim kalici (localStorage)", localStorage.getItem("bildim_dil"), "tr");

kontrol("profil tercihi her seyin ustunde", dilCoz({ dil: "en" }), "en");

kontrol("ceviri: Google", t("en", "Google ile devam et"), "Continue with Google");
kontrol("Turkce t() aynen dondurur", t("tr", "Google ile devam et"), "Google ile devam et");
kontrol("yer tutucu", t("en", "Giriş bağlantısı {eposta} adresine gönderildi. E-postanı kontrol et.", { eposta: "a@b.c" }),
        "A sign-in link was sent to a@b.c. Please check your email.");
kontrol("sozlukte olmayan anahtar Turkce kalir", t("en", "Bilinmeyen bir metin"), "Bilinmeyen bir metin");
console.log("\nTumu gecti.");

// Çeviri hattı makine kontrolleri + karar testi.
// Çalıştır: node supabase/functions/generate-questions/_test/ceviri-test.mjs
// ceviri.ts saf mantıktır; esbuild ile (kalite.ts dahil) paketlenip doğrudan çağrılır. Model çağrısı YOK.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const burasi = path.dirname(fileURLToPath(import.meta.url));
const cikti = await build({ entryPoints: [path.join(burasi, "..", "ceviri.ts")], bundle: true, write: false, format: "esm", platform: "neutral" });
const m = await import("data:text/javascript;base64," + Buffer.from(cikti.outputFiles[0].text).toString("base64"));

let gecti = 0, kaldi = 0;
const bekle = (ad, kosul) => { if (kosul) gecti++; else { kaldi++; console.log("KALDI:", ad); } };

const EN = { dil: "en", ad: "English", kurallar: "", ondalik: ".", binlik: ",", sozluk: { "Düello": "Duel" }, atilacak: ["the", "a", "an", "of"] };
const q = (soru, secenekler, dogru = 0, kategori = "genel_kultur") => ({ id: "x", soru, secenekler, dogru_cevap: dogru, kategori });
const c = (soru, secenekler, ek = {}) => ({ no: 0, cevrilebilir: true, atlama_nedeni: "", soru, secenekler: secenekler.map((metin, i) => ({ i, metin })), yerlesik_adlar: [], ...ek });
const gk = (dogru, coklu = false) => ({ no: 0, dogru, birden_fazla_dogru: coklu });

// sayılar
bekle("tr sayı biçimi", JSON.stringify(m.sayilar("1.000,50 ve 1453", ",", ".")) === "[1000.5,1453]");
bekle("en sayı biçimi", JSON.stringify(m.sayilar("1,000.50 and 1453", ".", ",")) === "[1000.5,1453]");
bekle("sayı korunmuş", m.sayiFarki("1.000,5 km", "1,000.5 km", EN) === null);
bekle("TR biçimi hedefte yakalanır", m.sayiFarki("3,5 metre", "3,5 metres", EN) !== null);
bekle("kaybolan sayı yakalanır", m.sayiFarki("1453 yılında", "in the 15th century", EN) !== null);

// benzer şık
bekle("eşanlamlıya düşen şık", m.benzerSikCiftleri(["Kent", "Şehir", "Köy", "Kasaba"], ["City", "The city", "Village", "Town"], 0.9, EN.atilacak).length === 1);
bekle("kaynakta zaten benzer olan sayılmaz", m.benzerSikCiftleri(["1914", "1915", "1920", "1930"], ["1914", "1915", "1920", "1930"], 0.7, []).length === 0);
bekle("normal şıklar geçer", m.benzerSikCiftleri(["Kızılırmak", "Fırat", "Sakarya", "Dicle"], ["Kızılırmak", "Euphrates", "Sakarya", "Tigris"], 0.9, EN.atilacak).length === 0);

// karar
const kaynak = q("Türkiye'nin en uzun nehri hangisidir?", ["Kızılırmak", "Fırat", "Sakarya", "Dicle"], 0, "cografya");
const iyi = c("Which is the longest river entirely within Turkey?", ["Kızılırmak", "Euphrates", "Sakarya", "Tigris"]);
bekle("sağlam çeviri yazılır", m.karar(kaynak, iyi, gk(0), EN, 0.9).tamam === true);
bekle("geri kontrol farklı → atla", m.karar(kaynak, iyi, gk(1), EN, 0.9).kod === "geri_kontrol_farkli");
bekle("geri kontrol çoklu → atla", m.karar(kaynak, iyi, gk(0, true), EN, 0.9).kod === "geri_kontrol_coklu");
bekle("geri kontrol yoksa yazılmaz", m.karar(kaynak, iyi, undefined, EN, 0.9).tamam === false);
bekle("şık sayısı", m.karar(kaynak, c("Q?", ["a", "b", "c"]), gk(0), EN, 0.9).kod === "sik_sayisi");
const sira = { ...iyi, secenekler: [{ i: 1, metin: "Euphrates" }, { i: 0, metin: "Kızılırmak" }, { i: 2, metin: "Sakarya" }, { i: 3, metin: "Tigris" }] };
bekle("şık sırası", m.karar(kaynak, sira, gk(1), EN, 0.9).kod === "sik_sirasi");
bekle("çevrilemez", m.karar(kaynak, { ...iyi, cevrilebilir: false, atlama_nedeni: "Türkçe dilbilgisi" }, undefined, EN, 0.9).kod === "cevrilemez");
const cami = q("Hangisi 'Mantıku't-Tayr' eserinin yazarıdır?", ["Feridüddin Attar", "Sadi", "Hafız", "Cami"], 0, "edebiyat");
bekle("Cami → Mosque yakalanır", m.karar(cami, c("Who wrote 'The Conference of the Birds'?", ["Farid al-Din Attar", "Saadi", "Hafez", "Mosque"]), gk(0), EN, 0.9).kod === "ozel_isim");
bekle("Cami → Jami geçer", m.karar(cami, c("Who wrote 'The Conference of the Birds'?", ["Feridüddin Attar", "Sadi", "Hafız", "Jami"]), gk(0), EN, 0.9).tamam === true);

// istemler: geri kontrolde Türkçe ve doğru indeks YOK
const gi = m.geriKontrolIstemi(EN, [{ no: 0, soru: iyi.soru, secenekler: ["Kızılırmak", "Euphrates", "Sakarya", "Tigris"] }]);
bekle("geri kontrolde doğru indeks gönderilmez", !gi.user.includes("dogru_cevap") && !gi.user.includes("Türkiye"));
const ci = m.ceviriIstemi(EN, [kaynak]);
bekle("çeviride bağlam: doğru indeks + kategori + şıklar", ci.user.includes("dogru_cevap") && ci.user.includes("cografya") && ci.user.includes("Dicle"));
bekle("çeviri isteminde sözlük veriden", ci.system.includes("Düello → Duel"));

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);

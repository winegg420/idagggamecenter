// Soru kalite kapıları testi.
// Çalıştır: node supabase/functions/generate-questions/_test/kalite-test.mjs
//
// kalite.ts saf mantıktır (Deno bağımlılığı yok); burada esbuild ile derlenip
// doğrudan çağrılıyor. Amaç: normal bir sorunun ASLA elenmemesi, kurala
// aykırı sorunun ise mutlaka elenmesi.

import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const burasi = path.dirname(fileURLToPath(import.meta.url));
const kaynak = path.join(burasi, "..", "kalite.ts");

const cikti = await build({
  entryPoints: [kaynak],
  bundle: false,
  write: false,
  format: "esm",
  loader: { ".ts": "ts" },
});
const kod = cikti.outputFiles[0].text;
const { nedenGecersiz, normalize, KATEGORILER } = await import(
  "data:text/javascript;base64," + Buffer.from(kod).toString("base64")
);

let gecti = 0;
let kaldi = 0;
const bekle = (ad, kosul) => {
  if (kosul) {
    gecti++;
  } else {
    kaldi++;
    console.log("  ✘ " + ad);
  }
};

const soru = (s, secenekler, dogru = 0) => ({ soru: s, secenekler, dogru_cevap: dogru });

// --- GEÇMESİ gerekenler (normal oyun soruları) ------------------------------
const gecerliler = [
  soru("Türkiye'nin başkenti neresidir?", ["Ankara", "İstanbul", "İzmir", "Bursa"], 0),
  soru("Su molekülü kaç hidrojen atomu içerir?", ["1", "2", "3", "4"], 1),
  soru("'Yüzyıllık Yalnızlık' romanının yazarı kimdir?", [
    "Gabriel García Márquez", "Mario Vargas Llosa", "Jorge Luis Borges", "Julio Cortázar",
  ], 0),
  soru("Bir futbol takımında sahada kaç oyuncu bulunur?", ["9", "10", "11", "12"], 2),
  soru("Gitarın standart tel sayısı kaçtır?", ["4", "5", "6", "7"], 2),
];
for (const q of gecerliler) {
  const s = nedenGecersiz(q);
  bekle(`gecerli sayilmali: "${q.soru.slice(0, 40)}" (sebep: ${s})`, s === null);
}

// --- ELENMESİ gerekenler ----------------------------------------------------
const elenmeliler = [
  ["4 şık değil", soru("Türkiye'nin başkenti neresidir?", ["Ankara", "İstanbul", "İzmir"], 0)],
  ["boş şık", soru("Türkiye'nin başkenti neresidir?", ["Ankara", "", "İzmir", "Bursa"], 0)],
  ["şıklar birbirinin aynısı", soru("Türkiye'nin başkenti neresidir?", ["Ankara", "ankara!", "İzmir", "Bursa"], 0)],
  ["dogru_cevap aralık dışı", soru("Türkiye'nin başkenti neresidir?", ["Ankara", "İstanbul", "İzmir", "Bursa"], 7)],
  ["soru çok kısa", soru("Kaç?", ["1", "2", "3", "4"], 0)],
  ["cevap sorunun içinde geçiyor",
    soru("Ankara hangi ülkenin başkentidir ve Ankara nerededir?", ["Ankara", "İstanbul", "İzmir", "Bursa"], 0)],
  ["olumsuz kalıp",
    soru("Aşağıdakilerden hangisi bir gezegen değildir?", ["Plüton", "Mars", "Venüs", "Jüpiter"], 0)],
  ["olumsuz kalıp (yanlıştır)",
    soru("Aşağıdaki ifadelerden hangisi yanlıştır?", ["A ifadesi", "B ifadesi", "C ifadesi", "D ifadesi"], 0)],
  ["zamana bağlı bilgi",
    soru("Şu anki Türkiye Cumhurbaşkanı kimdir?", ["Kişi A", "Kişi B", "Kişi C", "Kişi D"], 0)],
  ["zamana bağlı bilgi (en son)",
    soru("En son çıkan iPhone modeli hangisidir?", ["Model A", "Model B", "Model C", "Model D"], 0)],
  ["zamana bağlı bilgi (kaç yaşında)",
    soru("Ünlü oyuncu kaç yaşındadır bugün?", ["30", "40", "50", "60"], 0)],
];
for (const [beklenen, q] of elenmeliler) {
  const s = nedenGecersiz(q);
  bekle(`elenmeli (${beklenen}): "${q.soru.slice(0, 40)}" → ${s}`, s !== null);
}

// --- normalize: denetimde bulunan gerçek ikiz çift --------------------------
bekle(
  "tirnak farkli ikizler ayni normalize edilmeli",
  normalize("'Guernica' tablosunun ressamı kimdir?") ===
    normalize('"Guernica" tablosunun ressamı kimdir?'),
);
bekle(
  "tire/bosluk farki yok sayilmali",
  normalize("Stop motion tekniğinde ne yapılır?") ===
    normalize("Stop-motion tekniğinde ne yapılır?"),
);
bekle("farkli sorular farkli normalize edilmeli",
  normalize("Ankara nerede?") !== normalize("İzmir nerede?"));

// --- Kategori kümesi --------------------------------------------------------
bekle("10 kategori olmali", KATEGORILER.length === 10);
bekle("karisik enum'da OLMAMALI", !KATEGORILER.includes("karisik"));
bekle("genel enum'da OLMAMALI", !KATEGORILER.includes("genel"));
for (const k of ["sinema", "muzik", "teknoloji", "genel_kultur"]) {
  bekle(`${k} enum'da OLMALI`, KATEGORILER.includes(k));
}

console.log(`\nSonuc: ${gecti} gecti, ${kaldi} kaldi`);
process.exit(kaldi === 0 ? 0 : 1);

// npm run soru:disari [-- --adet 100] [--kuru]
// --kuru: liste üretilir, veritabanında "dışa aktarıldı" işareti KONMAZ (parti_deneme.json)
// Denetlenecek soruları öncelik sırasıyla .tmp/soru_denetim/parti_NN.json dosyasına yazar:
//   karantinadakiler → istatistik şüphelileri / oyuncu bildirimleri → kural şüphelileri → denetlenmemişler.
// Aktarılan sorular veritabanında "dışa aktarıldı" diye işaretlenir; sonraki parti aynı soruları vermez.
import fs from "node:fs";
import path from "node:path";
import { KLASOR, sorgu } from "./ortak.mjs";

const kuru = process.argv.includes("--kuru");
const ai = process.argv.indexOf("--adet");
const adet = ai > 0 ? Number(process.argv[ai + 1]) : null;
if (adet !== null && !(Number.isInteger(adet) && adet > 0 && adet <= 1000)) {
  console.error("--adet 1 ile 1000 arasında tam sayı olmalı");
  process.exit(1);
}

fs.mkdirSync(KLASOR, { recursive: true });
const mevcut = fs.readdirSync(KLASOR).map((f) => /^parti_(\d+)\.json$/.exec(f)?.[1]).filter(Boolean).map(Number);
const no = String((mevcut.length ? Math.max(...mevcut) : 0) + 1).padStart(2, "0");
const ad = kuru ? "parti_deneme" : `parti_${no}`;

try {
  const [satir] = sorgu(`select public.soru_denetim_disa_aktar(${adet ?? "null"}, '${ad}', ${kuru}) as sorular;`);
  const sorular = satir?.sorular ?? [];
  if (!sorular.length) {
    console.log("Denetlenecek soru kalmadı (hepsi denetlenmiş ya da bir partide bekliyor).");
    process.exit(0);
  }
  const dosya = path.join(KLASOR, `${ad}.json`);
  fs.writeFileSync(dosya, JSON.stringify({
    parti: ad,
    olusturma: new Date().toISOString(),
    adet: sorular.length,
    talimat: [
      "Her soruyu doğrula: soru net mi, tek doğru şık var mı, dogru_indeks gerçekten doğru mu (0'dan sayılır)?",
      "Sonucu parti_" + no + "_sonuc.json olarak yaz: bir DİZİ, her eleman {id, karar, kaynak, not} ve gerekiyorsa düzeltme alanları.",
      "karar: 'onayla' (soru doğru) · 'duzelt' (soru/secenekler/dogru_cevap alanlarından değişeni ver) · 'kaldir' (kurtarılamaz).",
      "duzelt için: secenekler tam 4 metin, dogru_cevap 0-3 tam sayı. Değişmeyen alanı yazmak zorunlu değil.",
      "kaynak: doğruladığın referans (kitap, ansiklopedi maddesi, URL). not: kısa açıklama.",
      "Sonra: npm run soru:iceri -- parti_" + no + "_sonuc.json",
    ],
    sorular,
  }, null, 2));
  const say = (o) => sorular.filter((s) => s.oncelik === o).length;
  console.log(`${dosya} yazıldı — ${sorular.length} soru (karantina ${say(1)} · istatistik/bildirim ${say(2)} · kural ${say(3)} · denetlenmemiş ${say(4)})`);
} catch (e) {
  console.error("[soru:disari]", e.message);
  process.exit(1);
}

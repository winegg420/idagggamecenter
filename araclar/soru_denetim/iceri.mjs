// npm run soru:iceri -- parti_NN_sonuc.json [--kuru]
// --kuru: her satır işlenir ve raporlanır, sonra hepsi geri alınır (hiçbir şey yazılmaz)
// Denetim sonucunu veritabanına işler. Her satır ayrı doğrulanır; bozuk satır atlanır ve raporlanır,
// parti düşmez. Düzeltmede eski hâl soru_surum'a yazılır, çeviri "eskidi" işaretlenir; kaldırma = aktif=false.
import fs from "node:fs";
import path from "node:path";
import { KLASOR, sorgu, jsonSabit } from "./ortak.mjs";

const kuru = process.argv.includes("--kuru");
const arg = process.argv.slice(2).find((a) => a !== "--kuru");
if (!arg) {
  console.error("Kullanım: npm run soru:iceri -- parti_NN_sonuc.json");
  process.exit(1);
}
const dosya = fs.existsSync(arg) ? arg : path.join(KLASOR, arg);
if (!fs.existsSync(dosya)) {
  console.error("Dosya bulunamadı:", dosya);
  process.exit(1);
}

let kayitlar;
try {
  const ham = JSON.parse(fs.readFileSync(dosya, "utf8"));
  kayitlar = Array.isArray(ham) ? ham : ham.sonuclar ?? ham.sorular;
  if (!Array.isArray(kayitlar)) throw new Error("dosya bir dizi ya da {sonuclar: [...]} olmalı");
} catch (e) {
  console.error("Sonuç dosyası okunamadı:", e.message);
  process.exit(1);
}

// Yalnız izin verilen alanlar gider (dışa aktarma dosyası yanlışlıkla verilirse fazlalık yok sayılır)
const ALAN = ["id", "karar", "soru", "secenekler", "dogru_cevap", "kaynak", "not"];
const temiz = kayitlar.map((k) => Object.fromEntries(Object.entries(k ?? {}).filter(([a]) => ALAN.includes(a))));
const parti = path.basename(dosya).replace(/_sonuc\.json$|\.json$/, "");

// Paket 25 — kalite kapısı: düzeltilmiş şıklar "doğru şık kendini ele veriyor" kuralına
// takılıyorsa sessizce alınmasın. Kural veritabanında tek yerde tanımlı
// (soru_kural_isaretleri); burada yalnız çağrılır, eşik kopyalanmaz.
// Engellemez — düzeltme yine işlenir; ama denetleyen uyarıyı görür ve çeldiricileri
// doğru şıkla aynı biçime getirebilir.
const duzeltmeler = temiz.filter((k) => k.karar === "duzelt" && k.id);
if (duzeltmeler.length) {
  try {
    const takilan = sorgu(`
      with g as (
        select * from jsonb_to_recordset(${jsonSabit(duzeltmeler)})
                 as x(id uuid, soru text, secenekler jsonb, dogru_cevap smallint)
      ), b as (
        select g.id, public.soru_kural_isaretleri(
                 coalesce(g.soru, q.soru),
                 coalesce(g.secenekler, q.secenekler),
                 coalesce(g.dogru_cevap, q.dogru_cevap)) isaret
          from g join public.questions q on q.id = g.id
      )
      select b.id::text id, string_agg(i, ', ') isaretler
        from b, unnest(b.isaret) i
       where public.soru_isaret_agirligi(i) >= 2
       group by b.id;
    `);
    if (takilan.length) {
      console.warn(`UYARI — ${takilan.length} düzeltme kalite kapısına takılıyor (rekabetçi havuza girmez):`);
      for (const t of takilan) console.warn(`  ${t.id}: ${t.isaretler}`);
      console.warn("  Doğru hamle: çeldiricileri doğru şıkla aynı uzunluk/kelime biçimine getir.");
    }
  } catch (e) {
    console.warn("[soru:iceri] kalite kapısı kontrol edilemedi:", e.message.slice(0, 200));
  }
}

try {
  const [satir] = sorgu(`select public.soru_denetim_ice_aktar(${jsonSabit(temiz)}, 'sahip', '${parti.replace(/[^a-zA-Z0-9_-]/g, "")}', ${kuru}) as rapor;`);
  const rapor = satir?.rapor;
  const raporDosya = dosya.replace(/\.json$/, "") + (kuru ? "_kuru_rapor.json" : "_rapor.json");
  fs.writeFileSync(raporDosya, JSON.stringify(rapor, null, 2));
  const i = rapor?.islenen ?? {};
  if (kuru) console.log("KURU ÇALIŞMA — veritabanına hiçbir şey yazılmadı.");
  console.log(`${rapor?.toplam ?? 0} kayıt: onay ${i.onayla ?? 0} · düzeltme ${i.duzelt ?? 0} · kaldırma ${i.kaldir ?? 0} · atlanan ${rapor?.atlanan?.length ?? 0}`);
  for (const a of rapor?.atlanan ?? []) console.log(`  atlandı #${a.sira} ${a.id ?? "-"}: ${a.sebep}`);
  console.log("Rapor:", raporDosya);
} catch (e) {
  console.error("[soru:iceri]", e.message);
  process.exit(1);
}

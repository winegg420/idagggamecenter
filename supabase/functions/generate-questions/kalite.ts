// Soru kalite kapıları — SAF mantık (Deno/Supabase bağımlılığı yok).
//
// Ayrı dosyada tutuluyor ki sınanabilsin: _test/kalite-test.mjs bu dosyayı
// esbuild ile derleyip doğrudan çağırıyor. index.ts yalnız bunu kullanır.

/** Oyuncuya görünen gerçek kategoriler. get_categories ile aynı küme. */
export const KATEGORILER = [
  "genel_kultur",
  "tarih",
  "cografya",
  "bilim",
  "sanat",
  "spor",
  "edebiyat",
  "sinema",
  "muzik",
  "teknoloji",
] as const;

/**
 * Tekrar karşılaştırması için metni sadeleştirir.
 * Noktalama, boşluk ve büyük/küçük harf farkı yok sayılır — denetimde
 * bulunan 15 ikiz soru tam olarak bu farklarla havuza sızmıştı
 * ("'Guernica' ..." ile '"Guernica" ...' gibi).
 */
export function normalize(s: string): string {
  return (s ?? "").toLocaleLowerCase("tr").replace(/[^a-z0-9çğıöşü]/gi, "");
}

/** "Aşağıdakilerden hangisi yanlıştır" türü olumsuz kalıplar. */
const OLUMSUZ =
  /hangisi\s+(yanlış|yanliş|değildir|degildir|olamaz|olmaz)|hangisi[^?]{0,40}\s(değildir|degildir|olmaz)|yanlıştır\s*\?|değildir\s*\?/i;

// Zamana bağlı, bugün doğru yarın yanlış olabilecek kalıplar.
//
// KELİME SINIRI ŞART: ilk sürümde sınırsız `en\s+son` yazılmıştı ve
// "şimşek-TEN SON-ra", "sona ermiştir", "işlemden sonra" gibi tamamen masum
// sorulara takılıyordu. Mevcut havuza uygulayınca 18 yanlış pozitif çıktı.
// Türkçe harfleri kapsaması için \b yerine Unicode lookaround kullanılıyor.
//
// BİLEREK DIŞARIDA BIRAKILANLAR:
//  • "bugün"  → "Aztek İmparatorluğu BUGÜNKÜ hangi ülkededir?" sabit cevaplı
//    ve gayet geçerli bir soru. Çok fazla masum soruyu eliyordu.
//  • yalın "kaç yaşında" → "fethettiğinde kaç yaşındaydı" geçmiş zaman, sabit.
//    Yalnız şimdiki zamanlı "kaç yaşındadır" eleniyor.
// Az elemek, çok elemekten iyidir: normal oyun sorusu ASLA takılmamalı.
const B1 = "(?<![\\p{L}\\p{N}])"; // kelime başı
const B2 = "(?![\\p{L}\\p{N}])"; // kelime sonu
const ZAMANA_BAGLI = new RegExp(
  "(" +
    [
      "şu\\s*an(ki|da)?",
      "günümüzde",
      "gunumuzde",
      "en\\s+son",
      "güncel",
      "guncel",
      "hâlen",
      "halen",
      "kaç\\s+yaşındad[ıi]r",
      "geçen\\s+yıl",
      "bu\\s+yıl",
      "yakın\\s+zamanda",
      "son\\s+olarak",
    ]
      .map((p) => B1 + p + B2)
      .join("|") +
    ")",
  "iu",
);

export type Soru = {
  soru: string;
  secenekler: string[];
  dogru_cevap: number;
};

/**
 * UZUNLUK DENGESİ — doğru şık, yanlış şıkların ortalamasının bu katından
 * uzun olamaz.
 *
 * NEDEN: canlı havuz denetiminde bulundu. Model doğru cevabı özenle ve uzun
 * yazıp çeldiricileri tek kelimeyle geçiştiriyordu; ölçülen sonuç, 9.381
 * global soruda doğru şık ortalama 17,8 karakter, yanlış şıklar 10,0 karakter.
 * Bunun oyundaki bedeli: "soruyu hiç okumadan en uzun şıkkı seç" stratejisi
 * %68,1 başarıyla oynuyordu (4 şıkta rastlantı ~%25). Gerçek oyuncular ise
 * aynı dönemde %59,9 doğru yapıyordu — yani oyun bilgiyle değil şık
 * uzunluğuna bakarak kazanılıyordu.
 *
 * EŞİK VERİDEN SEÇİLDİ, tahminle değil: mevcut havuzda 1,2 / 1,3 / 1,4 /
 * 1,5 / 1,75 / 2,0 denendi. 1,4'te kapıyı geçen soruların oluşturduğu havuzda
 * aynı stratejinin başarısı %24,1'e (rastlantı seviyesine) düşüyor; 1,5'te
 * %31,8'de kalıyor. Bu yüzden 1,4.
 *
 * MUTLAK FARK MUAFİYETİ: yalnız oransal bakmak, cevabı doğal olarak biraz
 * uzun olan meşru soruları eliyordu ("Ses hangi ortamda en hızlı yayılır?
 * Katılarda | Boşlukta | Suda | Havada"). Birkaç karakterlik fark oyuncuya
 * kullanılabilir bir ipucu vermez. 0/3/4/5/6/8 karakter denendi: 3'te kapıyı
 * geçen havuzda strateji %27,5 (hedef %30'un altında), 5'te %32,4'e çıkıyor.
 * Bu yüzden 3.
 */
export const DENGE_ORANI = 1.4;
export const DENGE_MUAF_FARK = 3;

/** Doğru şık / yanlış şıkların ortalaması. Şık yoksa 0 döner. */
export function dengeOrani(q: Soru): number {
  const uz = q.secenekler.map((s) => String(s ?? "").trim().length);
  const digerleri = uz.filter((_, i) => i !== q.dogru_cevap);
  if (digerleri.length === 0) return 0;
  const ortalama = digerleri.reduce((a, b) => a + b, 0) / digerleri.length;
  if (ortalama === 0) return Number.POSITIVE_INFINITY;
  return uz[q.dogru_cevap] / ortalama;
}

/** Doğru şık, yanlışların ortalamasından kaç karakter uzun. */
export function dengeFarki(q: Soru): number {
  const uz = q.secenekler.map((s) => String(s ?? "").trim().length);
  const digerleri = uz.filter((_, i) => i !== q.dogru_cevap);
  if (digerleri.length === 0) return 0;
  return uz[q.dogru_cevap] - digerleri.reduce((a, b) => a + b, 0) / digerleri.length;
}

/**
 * Doğru şık, uzunluğuyla kendini ele veriyor mu?
 * İki koşul birlikte aranır: oransal olarak belirgin uzun VE mutlak farkın
 * fark edilebilir olması.
 */
export function uzunlukEleVeriyorMu(q: Soru): boolean {
  return dengeOrani(q) > DENGE_ORANI && dengeFarki(q) > DENGE_MUAF_FARK;
}

/**
 * Tek bir soruyu kurallara göre denetler.
 * Geçerliyse null, değilse Türkçe sebep döner (raporlanabilsin diye).
 */
export function nedenGecersiz(q: Soru): string | null {
  const metin = String(q?.soru ?? "").trim();
  if (metin.length < 12) return "soru çok kısa";
  if (!Array.isArray(q.secenekler) || q.secenekler.length !== 4) return "4 şık değil";
  if (q.secenekler.some((s) => !String(s ?? "").trim())) return "boş şık";
  if (!Number.isInteger(q.dogru_cevap) || q.dogru_cevap < 0 || q.dogru_cevap > 3) {
    return "dogru_cevap aralık dışı";
  }

  // Şıklar birbirinden net ayrı olmalı
  const benzersiz = new Set(q.secenekler.map((s) => normalize(String(s))));
  if (benzersiz.size !== 4) return "şıklar birbirinin aynısı";

  // Cevap sorunun içinde geçmesin. Çok kısa cevaplarda ("3", "AB") rastlantı
  // olabileceği için yalnız 4+ karakterli cevaplarda bakılıyor.
  const cevap = normalize(String(q.secenekler[q.dogru_cevap]));
  if (cevap.length >= 4 && normalize(metin).includes(cevap)) {
    return "cevap sorunun içinde geçiyor";
  }

  if (OLUMSUZ.test(metin)) return "olumsuz kalıp";
  if (ZAMANA_BAGLI.test(metin)) return "zamana bağlı bilgi";

  // Doğru şık uzunluğuyla kendini ele vermesin (bkz. DENGE_ORANI notu).
  if (uzunlukEleVeriyorMu(q)) return "doğru şık diğerlerinden belirgin uzun";
  return null;
}

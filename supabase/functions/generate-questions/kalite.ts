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


/* ============================================================
   ÖZEL İSİMLER ASLA ÇEVRİLMEZ
   ============================================================

   NEDEN: bir soruda şıklar "Feridüddin Attar / Sadi / Hafız / Cami" —
   dördü de İranlı şair. Otomatik çeviri "Cami"yi ibadethane sanıp
   "Mosque" yazarsa şık anlamsızlaşır ve soru bozulur. Doğrusu "Jami".

   KURAL: kişi, yer, eser ve marka adları ULUSLARARASI YAZIMIYLA bırakılır.
     Cami (şair) → Jami   · Mosque DEĞİL
     Sadi → Saadi · Hafız → Hafez · Yunus Emre → Yunus Emre (aynen)
     Kaz Dağları → Kaz Mountains / Mount Ida · Goose Mountains DEĞİL

   ULUSLARARASI YAZIM İLE ÇEVİRİ NASIL AYIRT EDİLİYOR:
   yazım farkı küçüktür (Cami→Jami 1 harf, Sadi→Saadi 1 harf), çeviri ise
   bambaşka bir kelimedir (Cami→Mosque 6 harf). Bu yüzden kapı ADLARI
   DÜZENLEME UZAKLIĞIYLA eşleştiriyor; eşleşme yoksa ad kaybolmuş sayılır.

   ÇEVRİLMESİ DOĞRU OLANLAR (ülke, kıta, ay, "Dağları/Gölü" gibi tür
   sözcükleri) `CEVRILEBILIR` kümesinde; onlar denetlenmez.
   ============================================================ */

/** Karşılaştırma biçimi: aksan ve noktalama sadeleştirilir. */
export function adSade(s: string): string {
  return String(s ?? "")
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (x) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" }[x] ?? x))
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Çevrilmesi DOĞRU olan büyük harfli kelimeler: coğrafi tür sözcükleri,
 * ülke/kıta/okyanus adları, aylar ve cümle başında büyüyen sıradan
 * kelimeler. Bunlar "özel isim korunmalı" kuralının dışındadır.
 */
export const CEVRILEBILIR = new Set([
  // Tür sözcükleri — "Kaz DAĞLARI" → "Kaz MOUNTAINS" doğrudur
  "dagi", "daglari", "golu", "nehri", "irmagi", "denizi", "okyanusu",
  "korfezi", "bogazi", "adasi", "adalari", "ovasi", "yaylasi", "vadisi",
  "yarimadasi", "camii", "sarayi", "kalesi", "koprusu", "meydani",
  "savasi", "devrimi", "imparatorlugu", "krallik", "cumhuriyeti",
  "universitesi", "muzesi", "kulesi", "kilisesi", "manastiri",
  // Kıta, okyanus, yön
  "avrupa", "asya", "afrika", "amerika", "okyanusya", "antarktika",
  "kuzey", "guney", "dogu", "bati", "orta", "atlas", "pasifik", "hint", "arktik",
  // Sık geçen ülke adları (çevirisi doğru olan)
  "turkiye", "almanya", "fransa", "ingiltere", "italya", "ispanya",
  "portekiz", "hollanda", "belcika", "avusturya", "isvicre", "isvec",
  "norvec", "danimarka", "finlandiya", "polonya", "macaristan", "yunanistan",
  "rusya", "ukrayna", "cin", "japonya", "hindistan", "misir", "brezilya",
  "arjantin", "meksika", "kanada", "avustralya", "yenizelanda", "guneykore",
  "iran", "irak", "suriye", "lubnan", "israil", "sili", "peru", "kolombiya",
  // Aylar
  "ocak", "subat", "mart", "nisan", "mayis", "haziran", "temmuz",
  "agustos", "eylul", "ekim", "kasim", "aralik",
  // Cümle/şık başında büyüyen sıradan kelimeler ve soru kalıpları.
  // Metnin İLK kelimesi de denetleniyor ("Kaz Dağları hangi ilde…" —
  // ilk kelime atlansaydı asıl özel isim gözden kaçardı), bu yüzden
  // Türkçe soru başlangıçları burada tek tek elenir.
  "bir", "bu", "su", "ve", "ile", "her", "hic", "tum", "cok", "az",
  "evet", "hayir", "dogru", "yanlis", "hepsi", "hicbiri", "diger", "hicbir",
  "hangi", "hangisi", "hangisidir", "kim", "kimdir", "kime", "kimin",
  "ne", "nedir", "neye", "neyi", "nerede", "neresi", "neresidir", "kac",
  "asagidaki", "asagidakilerden", "yukaridaki", "ilk", "son", "en",
  "insan", "dunya", "dunyanin", "yil", "yilinda", "eski", "yeni", "buyuk",
  "kucuk", "once", "sonra", "nasil", "niye", "neden", "kimler", "kaci",
]);

/** Levenshtein düzenleme uzaklığı (küçük dizeler için yeterli). */
export function duzenlemeUzakligi(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let onceki = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const simdi = [i];
    for (let j = 1; j <= n; j++) {
      simdi[j] = Math.min(
        onceki[j] + 1,
        simdi[j - 1] + 1,
        onceki[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    onceki = simdi;
  }
  return onceki[n];
}

/**
 * Metindeki özel ad adaylarını döndürür.
 *
 * NİYE BU KADAR TEMKİNLİ: Türkçede cümlenin ve şıkkın İLK harfi zaten
 * büyüktür. "Büyük harfle başlıyorsa özel isimdir" demek işe yaramıyor —
 * canlı havuzun 7.682 çevirisine uygulandığında soruların %89,7'sini
 * işaretledi (Tek, Yalnız, Ses, Renk, Futbolda…). Ölçüldü, tahmin değil.
 *
 * GÜVENİLİR İŞARET: Türkçe yazımda cümlenin ORTASINDA büyük harf yalnız
 * özel isimde olur. Bu yüzden aday, içinde ilk sıradan sonra gelen büyük
 * harfli bir kelime bulunan BÜYÜK HARF DİZİSİDİR:
 *   "Kaz Dağları hangi ilde…"  → dizi [Kaz, Dağları], 2. kelime büyük
 *                                 → dizinin tamamı özel ad; "Kaz" korunmalı
 *   "Hangi ilde yer alır?"     → [Hangi] tek başına → cümle başı, aday değil
 *
 * @param tekBasinaAd şık listesinde en az bir kesin özel ad varsa true
 *   gelir; o zaman tek kelimelik şıklar da ad sayılır. Böylece
 *   "Attar / Sadi / Hafız / Cami" dizisinde "Cami" de denetlenir.
 */
export function ozelIsimAdaylari(metin: string, tekBasinaAd = false): string[] {
  // TIRNAK İÇİ ESER ADLARI DENETLENMEZ. Eserin YERLEŞİK İngilizce adı
  // vardır ve onu kullanmak doğrudur: 'Mantıku't-Tayr' → 'The Conference
  // of the Birds', 'Suç ve Ceza' → 'Crime and Punishment'. Kişi ve yer
  // adları tırnak içinde yazılmadığı için kural onlarda çalışmaya devam
  // eder — asıl korunması gereken de onlar.
  const tirnaksiz = String(metin ?? "").replace(/['"“”‘’«»]([^'"“”‘’«»]{2,})['"“”‘’«»]/gu, " ");
  const kelimeler = tirnaksiz.split(/[^\p{L}\p{N}'’-]+/u).filter(Boolean);
  const buyuk = kelimeler.map((k) => k[0] === k[0].toLocaleUpperCase("tr") && /\p{L}/u.test(k[0]));

  const adaylar: string[] = [];
  let i = 0;
  while (i < kelimeler.length) {
    if (!buyuk[i]) { i++; continue; }
    let j = i;
    while (j + 1 < kelimeler.length && buyuk[j + 1]) j++;
    // Dizi cümle ortasında mı, yoksa yalnız baştaki tek kelime mi?
    const kesinAd = i > 0 || j > i || tekBasinaAd;
    if (kesinAd) {
      for (let k = i; k <= j; k++) {
        const kelime = kelimeler[k];
        if (kelime.length < 3) continue;
        if (CEVRILEBILIR.has(adSade(kelime))) continue;
        adaylar.push(kelime);
      }
    }
    i = j + 1;
  }
  return adaylar;
}

/** Şıklardan en az biri kesin özel ad mı? (çok kelimeli ya da iç büyük harf) */
export function siklardaKesinAdVarMi(secenekler: string[]): boolean {
  return secenekler.some((s) => ozelIsimAdaylari(String(s ?? ""), false).length > 0);
}

/** Ad çeviride korunmuş mu? Uluslararası yazım farkına tolerans var. */
export function adKorunmusMu(ad: string, hedefKelimeler: string[]): boolean {
  const a = adSade(ad);
  if (a.length < 3) return true;
  // Uzunluğa göre tolerans: kısa adda 1, uzun adda 2 harf fark kabul.
  const tolerans = a.length <= 5 ? 1 : 2;
  for (const h of hedefKelimeler) {
    if (h.length < 2) continue;
    if (h.includes(a) || a.includes(h)) return true;
    if (duzenlemeUzakligi(a, h) <= tolerans) return true;
  }
  return false;
}

/**
 * Bir çeviriyi denetler: kaynaktaki özel adlar çeviride duruyor mu?
 * Geçerliyse null, değilse Türkçe sebep döner.
 *
 * @param serbest bu soruya özel, çevrilmesi doğru olan ek adlar
 */
export function ceviriNedenGecersiz(
  kaynak: Soru,
  ceviri: { soru: string; secenekler: string[] },
  serbest: Set<string> = new Set(),
): string | null {
  if (!ceviri || typeof ceviri.soru !== "string") return "çeviri yok";
  if (!Array.isArray(ceviri.secenekler)) return "çeviri şıkları yok";
  if (ceviri.secenekler.length !== kaynak.secenekler.length) {
    return "çeviride şık sayısı kaynakla aynı değil";
  }
  if (!ceviri.soru.trim()) return "çeviri sorusu boş";
  if (ceviri.secenekler.some((s) => !String(s ?? "").trim())) return "çeviride boş şık";

  const hedefKelimeler = [ceviri.soru, ...ceviri.secenekler]
    .join(" ")
    .split(/[^\p{L}\p{N}'’-]+/u)
    .filter(Boolean)
    .map(adSade)
    .filter(Boolean);

  // Şıklardan biri kesin özel adsa (ör. "Feridüddin Attar"), o soruda
  // şıkların hepsi aynı türdendir: tek kelimelik olanlar da ad sayılır.
  const sikler = kaynak.secenekler.map((s) => String(s ?? ""));
  const hepsiAd = siklardaKesinAdVarMi(sikler);

  const parcalar: Array<[string, boolean]> = [
    [kaynak.soru, false],
    ...sikler.map((s) => [s, hepsiAd] as [string, boolean]),
  ];

  for (const [metin, tekBasinaAd] of parcalar) {
    for (const ad of ozelIsimAdaylari(metin, tekBasinaAd)) {
      if (serbest.has(adSade(ad))) continue;
      if (!adKorunmusMu(ad, hedefKelimeler)) {
        return `özel isim çevrilmiş ya da kaybolmuş: "${ad}"`;
      }
    }
  }
  return null;
}

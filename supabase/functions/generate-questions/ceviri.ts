// Çeviri hattı — SAF mantık (Deno/Supabase/Anthropic bağımlılığı yok; _test/ceviri-test.mjs sınar).
//
// EN KRİTİK KURAL: düz çeviri yasak. Bilgi yarışmasında yanlış çeviri metni
// değil CEVABI bozar — soru "çalışır" görünür ama yanlış şıkkı doğru sayar.
//
// Hat (index.ts yürütür):
//   1) BAĞLAMLA ÇEVİRİ: model soru + bütün şıklar + kategori + doğru indeksi birlikte görür.
//      Çevrilemez soruyu (kelime oyunu, Türkçe dilbilgisi…) kendisi işaretler → ATLA.
//   2) MAKİNE KONTROLLERİ (bu dosya): şık sayısı, şık sırası (indeks), çeviride
//      eşanlamlıya düşen şıklar, özel isimler (kalite.ts), sayılar/biçim.
//   3) GERİ KONTROL: ayrı çağrı, model YALNIZ hedef dildeki sürümü görür (Türkçe ve doğru
//      indeks gösterilmez) ve doğru şıkkı seçer. Farklı indeks ya da "birden fazla doğru"
//      → çeviri bozuk, ceviri_atlanan'a yazılır, havuza girmez.
//
// Dile özel her şey (kurallar, sayı biçimi, sözlük, atılacak kelimeler) VERİDEN gelir
// (ceviri_dil_kurallari). Bu dosyada dil adı ya da dile özel liste yoktur.

import { ceviriNedenGecersiz, duzenlemeUzakligi, type Soru } from "./kalite.ts";

export type DilKurali = {
  dil: string;
  ad: string;
  kurallar: string;
  ondalik: string;
  binlik: string;
  sozluk: Record<string, string>;
  atilacak: string[];
};

export type KaynakSoru = Soru & { id: string; kategori: string };

/** Çeviri çağrısının bir öğesi (model çıktısı). */
export type CeviriCiktisi = {
  no: number;
  cevrilebilir: boolean;
  atlama_nedeni: string;
  soru: string;
  secenekler: { i: number; metin: string }[];
  yerlesik_adlar: string[];
};

/** Geri kontrol çağrısının bir öğesi (model çıktısı). */
export type GeriKontrolCiktisi = { no: number; dogru: number; birden_fazla_dogru: boolean };

export type Karar =
  | { tamam: true; soru: string; secenekler: string[] }
  | { tamam: false; kod: string; neden: string; ayrinti?: unknown };

// ------------------------------------------------------------ şemalar
export const ceviriSemasi = {
  type: "object",
  properties: {
    ceviriler: {
      type: "array",
      items: {
        type: "object",
        properties: {
          no: { type: "integer" },
          cevrilebilir: { type: "boolean" },
          atlama_nedeni: { type: "string" },
          soru: { type: "string" },
          secenekler: {
            type: "array",
            items: {
              type: "object",
              properties: { i: { type: "integer" }, metin: { type: "string" } },
              required: ["i", "metin"],
              additionalProperties: false,
            },
          },
          yerlesik_adlar: { type: "array", items: { type: "string" } },
        },
        required: ["no", "cevrilebilir", "atlama_nedeni", "soru", "secenekler", "yerlesik_adlar"],
        additionalProperties: false,
      },
    },
  },
  required: ["ceviriler"],
  additionalProperties: false,
};

export const geriKontrolSemasi = {
  type: "object",
  properties: {
    cevaplar: {
      type: "array",
      items: {
        type: "object",
        properties: {
          no: { type: "integer" },
          dogru: { type: "integer" },
          birden_fazla_dogru: { type: "boolean" },
        },
        required: ["no", "dogru", "birden_fazla_dogru"],
        additionalProperties: false,
      },
    },
  },
  required: ["cevaplar"],
  additionalProperties: false,
};

// ------------------------------------------------------------ istemler
/** Çeviri istemi: soru + BÜTÜN şıklar + kategori + doğru indeks BİRLİKTE. */
export function ceviriIstemi(kural: DilKurali, sorular: KaynakSoru[]): { system: string; user: string } {
  const sozluk = Object.entries(kural.sozluk ?? {}).map(([tr, h]) => `- ${tr} → ${h}`).join("\n");
  const system =
    `You translate Turkish trivia questions into ${kural.ad} for a quiz game. ` +
    "This is NOT literal translation: the translated question must still have exactly ONE correct option, " +
    "and it must be the SAME option (same index) as in the source. You are given the category and the correct index " +
    "so you can protect that. Keep the option ORDER exactly as in the source: return every option with its source index i.\n" +
    "If two different Turkish options would become synonyms or near-identical in the target language, " +
    "or the question depends on Turkish itself (wordplay, letters/syllables, Turkish grammar, spelling, idioms, " +
    "proverbs, a Turkish-only term) set cevrilebilir=false, give a short Turkish atlama_nedeni and leave the other fields empty. " +
    "Do not force a translation.\n" +
    `Language rules for ${kural.ad}:\n${kural.kurallar}\n` +
    (sozluk
      ? "Game terms: when these appear as game terms, use exactly these translations:\n" + sozluk + "\n"
      : "") +
    "yerlesik_adlar: list only the Turkish source names you replaced with a well-established exonym; otherwise an empty list.";
  const user = JSON.stringify(sorular.map((q, no) => ({
    no, kategori: q.kategori, soru: q.soru,
    secenekler: q.secenekler.map((metin, i) => ({ i, metin })),
    dogru_cevap: q.dogru_cevap,
  })));
  return { system, user };
}

/** Geri kontrol istemi: YALNIZ hedef dildeki sürüm. Kaynak metin ve doğru indeks YOK. */
export function geriKontrolIstemi(kural: DilKurali, ceviriler: { no: number; soru: string; secenekler: string[] }[]): { system: string; user: string } {
  const system =
    `You are a careful trivia expert. The questions below are in ${kural.ad}. ` +
    "For each question choose the index (0-based) of the single correct option. " +
    "If more than one option could reasonably be correct, or the question is ambiguous, set birden_fazla_dogru=true. " +
    "If no option is correct, return dogru=-1.";
  const user = JSON.stringify(ceviriler.map((c) => ({ no: c.no, soru: c.soru, secenekler: c.secenekler.map((metin, i) => ({ i, metin })) })));
  return { system, user };
}

// ------------------------------------------------------------ makine kontrolleri
/** Benzerlik için sadeleştirme: küçük harf, aksan/noktalama yok, atılacak kelimeler yok. */
export function sikSade(s: string, atilacak: string[] = []): string {
  const at = new Set(atilacak.map((x) => x.toLowerCase()));
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((k) => k && !at.has(k))
    .join(" ");
}

/** 0..1 benzerlik (1 = aynı), düzenleme uzaklığından. */
export function benzerlik(a: string, b: string): number {
  if (a === b) return 1;
  const uzun = Math.max(a.length, b.length);
  return uzun === 0 ? 1 : 1 - duzenlemeUzakligi(a, b) / uzun;
}

/**
 * Çeviride eşanlamlıya düşen şık çiftleri. Kaynakta zaten benzer olan çift sayılmaz
 * (ör. "1914"/"1918" kaynakta da öyle) — yalnız ÇEVİRİNİN yarattığı yakınlık.
 */
export function benzerSikCiftleri(kaynak: string[], hedef: string[], esik: number, atilacak: string[]): [number, number][] {
  const hs = hedef.map((s) => sikSade(s, atilacak));
  const ks = kaynak.map((s) => sikSade(s));
  const ciftler: [number, number][] = [];
  for (let i = 0; i < hs.length; i++) {
    for (let j = i + 1; j < hs.length; j++) {
      const h = benzerlik(hs[i], hs[j]);
      const k = benzerlik(ks[i], ks[j]);
      if (h >= 1 || (h >= esik && k < esik)) ciftler.push([i, j]);
    }
  }
  return ciftler;
}

/**
 * Metindeki sayıları, verilen biçime göre DEĞER olarak çıkarır.
 * "1.000,50" (tr: ondalık ",", binlik ".") → 1000.5 · "1,000.50" (en) → 1000.5.
 * Hedefte kaynak dilin biçimiyle yazılmış sayı farklı değere çözülür ve yakalanır.
 */
export function sayilar(metin: string, ondalik: string, binlik: string): number[] {
  const kacis = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const b = kacis(binlik), o = kacis(ondalik);
  const re = new RegExp(`\\d{1,3}(?:${b}\\d{3})+(?:${o}\\d+)?|\\d+(?:${o}\\d+)?`, "g");
  const out: number[] = [];
  for (const m of String(metin ?? "").matchAll(re)) {
    const ham = m[0].split(binlik).join("").replace(ondalik, ".");
    const n = Number(ham);
    if (Number.isFinite(n)) out.push(n);
  }
  return out.sort((x, y) => x - y);
}

const TR_BICIM = { ondalik: ",", binlik: "." };   // kaynak dil her zaman Türkçe (questions.kaynak_dil = 'tr')

/** Kaynaktaki sayı değerleri hedefte (hedef biçimiyle okununca) aynı mı? Değilse eksik/fazla listesi. */
export function sayiFarki(kaynakMetin: string, hedefMetin: string, kural: DilKurali): { eksik: number[]; fazla: number[] } | null {
  const k = sayilar(kaynakMetin, TR_BICIM.ondalik, TR_BICIM.binlik);
  const h = sayilar(hedefMetin, kural.ondalik, kural.binlik);
  const kalan = [...h], eksik: number[] = [];
  for (const x of k) {
    const i = kalan.findIndex((y) => Math.abs(y - x) < 1e-9);
    if (i >= 0) kalan.splice(i, 1); else eksik.push(x);
  }
  return eksik.length || kalan.length ? { eksik, fazla: kalan } : null;
}

/**
 * Makine kontrolleri + (varsa) geri kontrol sonucu → tek karar.
 * Sıra önemli değil ama ilk bulunan sebep yazılır; ayrıntı ceviri_atlanan.ayrinti'ye gider.
 */
export function karar(
  kaynak: KaynakSoru,
  c: CeviriCiktisi | undefined,
  gk: GeriKontrolCiktisi | undefined,
  kural: DilKurali,
  esik: number,
): Karar {
  if (!c) return { tamam: false, kod: "cevrilemez", neden: "modelden çeviri gelmedi" };
  if (!c.cevrilebilir) return { tamam: false, kod: "cevrilemez", neden: (c.atlama_nedeni || "model çevrilemez dedi").slice(0, 300) };

  if (!Array.isArray(c.secenekler) || c.secenekler.length !== kaynak.secenekler.length) {
    return { tamam: false, kod: "sik_sayisi", neden: `şık sayısı ${c.secenekler?.length ?? 0} ≠ kaynak ${kaynak.secenekler.length}` };
  }
  const siraBozuk = c.secenekler.some((s, n) => s.i !== n);
  if (siraBozuk) {
    return { tamam: false, kod: "sik_sirasi", neden: "şık sırası (indeks) korunmadı", ayrinti: c.secenekler.map((s) => s.i) };
  }
  const secenekler = c.secenekler.map((s) => String(s.metin ?? "").trim());
  const soru = String(c.soru ?? "").trim();

  const benzer = benzerSikCiftleri(kaynak.secenekler, secenekler, esik, kural.atilacak ?? []);
  if (benzer.length) {
    return { tamam: false, kod: "benzer_sik", neden: "çeviride iki şık aynı/çok benzer oldu (iki doğru cevap riski)", ayrinti: { ciftler: benzer, secenekler } };
  }

  const serbest = new Set((c.yerlesik_adlar ?? []).flatMap((a) => String(a).split(/\s+/)).map((x) =>
    x.toLocaleLowerCase("tr").replace(/[çğıöşü]/g, (y) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" }[y] ?? y)).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "")
  ).filter(Boolean));
  const ozel = ceviriNedenGecersiz(kaynak, { soru, secenekler }, serbest);
  if (ozel) return { tamam: false, kod: ozel.startsWith("özel isim") ? "ozel_isim" : "bicim", neden: ozel };

  const sf = sayiFarki([kaynak.soru, ...kaynak.secenekler].join(" \n "), [soru, ...secenekler].join(" \n "), kural);
  if (sf) return { tamam: false, kod: "sayi", neden: "sayı kayboldu, eklendi ya da hedef dil biçimine uymuyor", ayrinti: sf };

  // GERİ KONTROL — atlanmaz: sonucu yoksa çeviri yazılmaz.
  if (!gk) return { tamam: false, kod: "geri_kontrol_farkli", neden: "geri kontrol sonucu gelmedi" };
  if (gk.birden_fazla_dogru) {
    return { tamam: false, kod: "geri_kontrol_coklu", neden: "geri kontrol: birden fazla doğru görünüyor", ayrinti: { secilen: gk.dogru, beklenen: kaynak.dogru_cevap } };
  }
  if (gk.dogru !== kaynak.dogru_cevap) {
    return { tamam: false, kod: "geri_kontrol_farkli", neden: `geri kontrol farklı şık seçti (${gk.dogru} ≠ ${kaynak.dogru_cevap})`, ayrinti: { secilen: gk.dogru, beklenen: kaynak.dogru_cevap } };
  }
  return { tamam: true, soru, secenekler };
}
